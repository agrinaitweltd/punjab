import { randomInt, randomUUID } from 'node:crypto'
import bcrypt from 'bcryptjs'
import { guardApi, safeError } from '../security.js'
import { requireSensitiveStaff, requireSystemDeveloper, writeSystemAudit } from '../sensitive-actions.js'
import { globalTestMode } from '../runtime-mode.js'
import { brandedEmail, sendTransactionalEmail } from '../email-system.js'

const CODE_TTL_MS = 10 * 60_000
const PIN_PATTERN = /^\d{4}$/

// Exactly the "invoices, PDFs, [customer] accounts" scope the admin asked
// for - never admin_staff, auth.users, admin_roles, system_settings, or any
// other login/config/catalogue data. Order matters (children before
// parents) so foreign keys never block a delete.
const RESET_TABLES_IN_ORDER = ['credit_note_allocations', 'payments', 'invoice_items', 'invoices', 'credit_notes', 'activity_log', 'email_imports', 'customers']

async function currentStaff(admin, userId) {
  const { data, error } = await admin.from('admin_staff').select('id,name,email,role,active,reset_pin_hash,reset_pin_set_at').eq('auth_user_id', userId).maybeSingle()
  if (error) throw error
  return data
}

export default async function handler(req, res) {
  if (!guardApi(req, res, { methods: ['GET', 'POST'], maxBytes: 2_000, limit: 20, windowMs: 60_000 })) return

  if (req.method === 'GET') {
    const context = await requireSystemDeveloper(req, res)
    if (!context) return
    try {
      // requireSystemDeveloper's own staff lookup doesn't select the PIN
      // columns, so re-fetch just those.
      const staff = await currentStaff(context.admin, context.user.id)
      return res.status(200).json({ pinConfigured: Boolean(staff?.reset_pin_hash), pinSetAt: staff?.reset_pin_set_at || null, tables: RESET_TABLES_IN_ORDER })
    } catch (error) {
      console.error('database-reset status failed', error instanceof Error ? error.message : 'Unknown error')
      return res.status(500).json({ error: safeError })
    }
  }

  const step = String(req.body?.step || '')

  if (step === 'set-pin') {
    // Changing/creating the PIN is itself a sensitive action - requires the
    // System Developer's current login password re-verified first, same as
    // enabling Test Mode or creating a backup.
    const context = await requireSensitiveStaff(req, res, { systemDeveloperOnly: true })
    if (!context) return
    const pin = String(req.body?.pin || '')
    if (!PIN_PATTERN.test(pin)) return res.status(400).json({ error: 'PIN must be exactly 4 digits.' })
    try {
      const pinHash = await bcrypt.hash(pin, 12)
      const { error } = await context.admin.from('admin_staff').update({ reset_pin_hash: pinHash, reset_pin_set_at: new Date().toISOString() }).eq('id', context.staff.id)
      if (error) throw error
      await writeSystemAudit(context.admin, context.user.id, 'database_reset_pin_changed', 'admin_staff', context.staff.id)
      return res.status(200).json({ ok: true })
    } catch (error) {
      console.error('database-reset set-pin failed', error instanceof Error ? error.message : 'Unknown error')
      return res.status(500).json({ error: safeError })
    }
  }

  if (step === 'request-code') {
    const context = await requireSystemDeveloper(req, res)
    if (!context) return
    try {
      const staff = await currentStaff(context.admin, context.user.id)
      if (!staff?.active) return res.status(403).json({ error: 'System Developer access required.' })
      if (!staff.email) return res.status(400).json({ error: 'Your account has no email on file to send a code to.' })
      const code = String(randomInt(0, 1_000_000)).padStart(6, '0')
      const codeHash = await bcrypt.hash(code, 10)
      const { error: insertErr } = await context.admin.from('database_reset_codes').insert({ id: randomUUID(), admin_staff_id: staff.id, code_hash: codeHash, expires_at: new Date(Date.now() + CODE_TTL_MS).toISOString() })
      if (insertErr) throw insertErr
      const html = brandedEmail({
        heading: 'Database Reset Verification Code', preheader: 'Your one-time verification code',
        intro: 'A database reset was requested on your Punjab Exotic Foods System Developer account. Enter this code, along with your reset PIN, to continue.',
        contentHtml: `<p style="text-align:center;font-size:32px;font-weight:800;letter-spacing:6px;color:#17241c;margin:18px 0">${code}</p><p style="text-align:center;color:#b91c1c;font-size:13px">This code expires in 10 minutes. If you did not request this, ignore this email and consider rotating your password - this action permanently deletes invoice, customer and document data.</p>`,
      })
      const sent = await sendTransactionalEmail({ category: 'security', to: staff.email, subject: 'Your database reset verification code', html, admin: context.admin, createdBy: staff.name })
      if (!sent.ok) return res.status(502).json({ error: 'The verification code could not be emailed. Please try again.' })
      return res.status(200).json({ ok: true, sentTo: staff.email.replace(/^(.{2}).*(@.*)$/, '$1***$2') })
    } catch (error) {
      console.error('database-reset request-code failed', error instanceof Error ? error.message : 'Unknown error')
      return res.status(500).json({ error: safeError })
    }
  }

  if (step === 'execute') {
    const context = await requireSystemDeveloper(req, res)
    if (!context) return
    const emailCode = String(req.body?.emailCode || '').trim()
    const pin = String(req.body?.pin || '').trim()
    if (!emailCode || !PIN_PATTERN.test(pin)) return res.status(400).json({ error: 'Enter the 6-digit email code and your 4-digit PIN.' })
    try {
      const staff = await currentStaff(context.admin, context.user.id)
      if (!staff?.active) return res.status(403).json({ error: 'System Developer access required.' })
      if (!staff.reset_pin_hash) return res.status(400).json({ error: 'Set up your reset PIN first.' })
      if (!(await bcrypt.compare(pin, staff.reset_pin_hash))) return res.status(401).json({ error: 'Incorrect PIN.' })

      const { data: candidates, error: codeErr } = await context.admin.from('database_reset_codes').select('id,code_hash,expires_at,consumed').eq('admin_staff_id', staff.id).eq('consumed', false).order('created_at', { ascending: false }).limit(5)
      if (codeErr) throw codeErr
      const now = Date.now()
      let matchedCodeId = null
      for (const candidate of candidates || []) {
        if (new Date(candidate.expires_at).getTime() < now) continue
        if (await bcrypt.compare(emailCode, candidate.code_hash)) { matchedCodeId = candidate.id; break }
      }
      if (!matchedCodeId) return res.status(401).json({ error: 'That code is incorrect or has expired. Request a new one.' })
      await context.admin.from('database_reset_codes').update({ consumed: true }).eq('id', matchedCodeId)

      const testMode = await globalTestMode(context.admin)
      const table = name => (testMode ? `test_${name}` : name)
      const counts = {}
      for (const name of RESET_TABLES_IN_ORDER) {
        const { count, error } = await context.admin.from(table(name)).delete({ count: 'exact' }).not('id', 'is', null)
        if (error) throw error
        counts[name] = count ?? 0
      }
      await writeSystemAudit(context.admin, context.user.id, 'database_reset_executed', 'system', null, { testMode, counts })
      return res.status(200).json({ ok: true, testMode, counts })
    } catch (error) {
      console.error('database-reset execute failed', error instanceof Error ? error.message : 'Unknown error')
      return res.status(500).json({ error: safeError })
    }
  }

  return res.status(400).json({ error: 'Unknown step.' })
}
