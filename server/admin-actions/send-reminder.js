// Manual reminder send (items 2/17/20 from the previous pass, now with a
// server-enforced 24h cooldown - item 2 of this pass). This is the ONLY
// place a reminder email actually gets sent from now on: the browser no
// longer calls sendEmail()/createNotificationLog() directly for reminders,
// so the cooldown can't be bypassed by a stale client or another admin's
// tab (see sql/migrations/032_reminder_cooldown.sql's
// reserve_invoice_reminder_slot, which does the actual atomic gating).
import { guardApi, requireUser, safeError } from '../security.js'
import { serviceClient, globalTestMode, simulatedResult } from '../runtime-mode.js'
import { sendTransactionalEmail } from '../email-system.js'
import { storedInvoicePdf, normalizePhone, sendWhatsAppDocumentServer } from '../reminderShared.js'

const VALID_STAGES = ['day-14', 'day-21', '21-plus']
const escapeHtml = value => String(value ?? '').replace(/[&<>]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[char]))

export default async function handler(req, res) {
  if (!guardApi(req, res, { maxBytes: 40_000, limit: 20, windowMs: 60_000 })) return
  const user = await requireUser(req, res, { adminOnly: true })
  if (!user) return

  const invoiceId = String(req.body?.invoiceId || '').trim()
  const stage = String(req.body?.stage || '').trim()
  const subject = String(req.body?.subject || '').trim()
  const message = String(req.body?.message || '').trim()
  const alsoWhatsApp = Boolean(req.body?.alsoWhatsApp)
  if (!invoiceId || !VALID_STAGES.includes(stage) || !subject || subject.length > 200 || !message || message.length > 8000) {
    return res.status(400).json({ error: 'Invalid reminder request.' })
  }

  let admin
  try {
    admin = serviceClient()
  } catch {
    return res.status(500).json({ error: 'Secure administration is not configured.' })
  }

  try {
    const { data: staff, error: staffError } = await admin.from('admin_staff').select('active,is_super_admin,permissions').eq('auth_user_id', user.id).maybeSingle()
    if (staffError) throw staffError
    if (!staff?.active || !(staff.is_super_admin || staff.permissions?.invoicesSendReminders)) {
      return res.status(403).json({ error: 'You do not have permission to send reminders.' })
    }

    if (await globalTestMode(admin)) return res.status(200).json(simulatedResult('Reminder'))

    const { data: invoice, error: invoiceError } = await admin.from('invoices').select('*').eq('id', invoiceId).maybeSingle()
    if (invoiceError) throw invoiceError
    if (!invoice) return res.status(404).json({ error: 'Invoice not found.' })
    const { data: customer, error: customerError } = await admin.from('customers').select('*').eq('id', invoice.customer_id).maybeSingle()
    if (customerError) throw customerError
    if (!customer) return res.status(404).json({ error: 'Customer not found.' })
    if (!customer.email) return res.status(400).json({ error: 'This customer has no email address on file.' })

    const { data: staffRow } = await admin.from('admin_staff').select('name').eq('auth_user_id', user.id).maybeSingle()
    const sentByName = staffRow?.name || user.email || 'Admin'

    // Reserve the 24h slot atomically, before anything else happens - a
    // row lock inside the DB function, so two admins racing on the same
    // invoice can never both pass this check.
    const { data: reservation, error: reserveError } = await admin.rpc('reserve_invoice_reminder_slot', { p_invoice_id: invoiceId, p_stage: stage, p_sent_by: sentByName })
    if (reserveError) throw reserveError
    const slot = Array.isArray(reservation) ? reservation[0] : reservation
    if (!slot?.reserved) {
      return res.status(409).json({ error: 'A reminder was already sent for this invoice within the last 24 hours.', nextAllowedAt: slot?.next_allowed_at || null })
    }

    // Only reached if something below fails - releases the reservation so
    // the button is immediately available again for a retry, per the
    // explicit "if sending fails, the button should remain available" requirement.
    const releaseReservation = () => admin.from('invoices').update({ last_reminder_sent_at: slot.previous_sent_at, last_reminder_stage: null, last_reminder_sent_by: null }).eq('id', invoiceId)

    const { data: files, error: filesError } = await admin.from('activity_log').select('customer_name,action,timestamp,created_at').like('customer_name', 'FILE:%')
    if (filesError) { await releaseReservation(); throw filesError }
    const pdf = storedInvoicePdf(files || [], invoice)
    if (!pdf) {
      await releaseReservation()
      return res.status(409).json({ error: `The system-generated PDF for invoice ${invoice.invoice_number} is missing. Generate it first, then retry.` })
    }

    const idempotencyKey = `invoice:${invoiceId}:${stage}:email:${new Date().toISOString().slice(0, 10)}`
    const html = `<div style="white-space:pre-line">${escapeHtml(message)}</div>`
    const sent = await sendTransactionalEmail({ apiKey: process.env.RESEND_API_KEY, category: 'notifications', to: customer.email, subject, html, attachments: [{ filename: pdf.name, content: pdf.base64 }], admin, customerId: customer.id, invoiceId, idempotencyKey, communicationType: `reminder_${stage}`, createdBy: sentByName })

    if (!sent.ok) {
      await releaseReservation()
      await admin.from('notification_logs').insert({ invoice_id: invoiceId, customer_id: customer.id, channel: 'email', status: 'Failed', error: sent.error, reminder_stage: stage, idempotency_key: `${idempotencyKey}:${Date.now()}`, sent_by: sentByName })
      return res.status(502).json({ error: sent.error || 'The reminder email could not be sent.' })
    }

    await admin.from('invoices').update({ last_reminder_recipient: customer.email, last_reminder_provider_message_id: sent.id || null }).eq('id', invoiceId)
    await admin.from('notification_logs').insert({ invoice_id: invoiceId, customer_id: customer.id, channel: 'email', status: 'Sent', sent_at: new Date().toISOString(), reminder_stage: stage, idempotency_key: idempotencyKey, sent_by: sentByName })

    // WhatsApp is strictly best-effort from here on - the email has
    // already succeeded, so nothing below can undo that or block the
    // response; failures are logged internally, never surfaced as if the
    // email failed too.
    if (alsoWhatsApp && customer.phone) {
      const phone = normalizePhone(customer.phone)
      if (phone) {
        try {
          const whatsapp = await sendWhatsAppDocumentServer(process.env.ULTRAMSG_TOKEN, phone, message, pdf, false)
          await admin.from('whatsapp_logs').insert({ customer_id: customer.id, customer_name: customer.company_name, phone, message, type: 'Payment Reminder', status: whatsapp.ok ? 'Sent' : 'Failed', response: whatsapp.response, sent_at: whatsapp.ok ? new Date().toISOString() : null, created_by: sentByName })
          await admin.from('notification_logs').insert({ invoice_id: invoiceId, customer_id: customer.id, channel: 'whatsapp', status: whatsapp.ok ? 'Sent' : 'Failed', sent_at: whatsapp.ok ? new Date().toISOString() : null, error: whatsapp.ok ? null : whatsapp.response, reminder_stage: stage, sent_by: sentByName })
        } catch { /* best-effort only - email already sent successfully */ }
      }
    }

    return res.status(200).json({ ok: true, nextAllowedAt: slot.next_allowed_at, sentAt: new Date().toISOString() })
  } catch (error) {
    console.error('send-reminder failed', error instanceof Error ? error.message : 'Unknown error')
    return res.status(502).json({ error: safeError })
  }
}
