import { timingSafeEqual } from 'node:crypto'
import { serviceClient, globalTestMode } from '../server/runtime-mode.js'
import { runHealthCheck, ukLocalParts } from '../server/health-check.js'
import { brandedEmail, sendTransactionalEmail, summaryTable } from '../server/email-system.js'

export const config = { maxDuration: 60 }

function safeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false
  return timingSafeEqual(Buffer.from(a), Buffer.from(b))
}

const SUMMARY_RECIPIENTS = ['info@punjabexoticfoods.co.uk', 'info@kavotech.uk']

/** Nightly production health check - Vercel Cron is UTC-only with no DST
 *  awareness, so this is scheduled to fire every hour and only actually
 *  runs its logic once the Europe/London wall clock reads 21:00 (9pm,
 *  correct for GMT or BST automatically via ukLocalParts), and only once
 *  per UK-local calendar day (tracked in health_check_runs) even if the
 *  hourly fire and the 21:00 check line up more than once due to retries.
 *  Pass ?force=1 to run immediately regardless of time/day, for testing. */
export default async function handler(req, res) {
  const cronSecret = process.env.CRON_SECRET
  const headerToken = String(req.headers?.authorization || '').replace(/^Bearer\s+/i, '')
  const queryToken = typeof req.query?.key === 'string' ? req.query.key : ''
  const authorized = Boolean(cronSecret) && (safeEqual(headerToken, cronSecret) || safeEqual(queryToken, cronSecret))
  if (!authorized) return res.status(401).json({ error: 'Unauthorized' })

  const force = req.query?.force === '1'
  const { hour, dateKey } = ukLocalParts()
  if (!force && hour !== 21) return res.status(200).json({ skipped: true, reason: `not 21:00 Europe/London (currently ${hour}:00 there)` })

  let admin
  try {
    admin = serviceClient()
  } catch {
    return res.status(500).json({ error: 'Server-side Supabase is not configured' })
  }

  const { data: already } = await admin.from('health_check_runs').select('id').eq('id', dateKey).maybeSingle()
  if (already && !force) return res.status(200).json({ skipped: true, reason: 'already ran for this UK-local date' })

  const testMode = await globalTestMode(admin).catch(() => false)
  const table = name => (testMode ? `test_${name}` : name)

  try {
    const { summary, issues } = await runHealthCheck(admin, table)
    await admin.from('health_check_runs').upsert({ id: dateKey, ran_at: new Date().toISOString(), summary })

    const fixed = issues.filter(item => item.severity === 'fixed')
    const review = issues.filter(item => item.severity === 'review')
    const rows = [
      ['New Customers', String(summary.newCustomers)],
      ['Customers Auto-Created (Email)', String(summary.customersAutoCreated)],
      ['Invoices Imported', String(summary.invoicesImported)],
      ['Credit Notes Imported', String(summary.creditNotesImported)],
      ['System PDFs Generated', String(summary.pdfsGenerated)],
      ['Payments Recorded', String(summary.paymentsRecorded)],
      ['Paid Invoices (total)', String(summary.paidInvoices)],
      ['Outstanding Invoices (total)', String(summary.outstandingInvoices)],
      ['Emails Sent', String(summary.emailsSent)],
      ['Payment Reminders Sent', String(summary.remindersSent)],
      ['Emails Failed', String(summary.emailsFailed)],
      ['Documents Received', String(summary.documentsReceived)],
      ['Errors Found', String(summary.errorsFound)],
      ['Automatically Fixed', String(fixed.length)],
      ['Needs Review', String(review.length)],
    ]
    const exceptionsHtml = review.length
      ? `<p style="margin:18px 0 6px;font-weight:700;color:#a16207">Needs Review</p><ul style="margin:0;padding-left:20px;color:#3e4b43;font-size:13px">${review.slice(0, 25).map(item => `<li>${item.text}</li>`).join('')}</ul>${review.length > 25 ? `<p style="font-size:12px;color:#818b85">+ ${review.length - 25} more - see Email Imports and Customers for detail.</p>` : ''}`
      : ''
    const fixedHtml = fixed.length
      ? `<p style="margin:18px 0 6px;font-weight:700;color:#15803d">Automatically Fixed</p><ul style="margin:0;padding-left:20px;color:#3e4b43;font-size:13px">${fixed.slice(0, 25).map(item => `<li>${item.text}</li>`).join('')}</ul>`
      : ''

    const html = brandedEmail({
      heading: 'Daily System Summary', preheader: `${dateKey} - ${summary.errorsFound} issue(s), ${fixed.length} auto-fixed`,
      intro: `Production summary for ${dateKey}${testMode ? ' (Test Mode - sandbox data)' : ''}.`,
      contentHtml: `${summaryTable(rows)}${fixedHtml}${exceptionsHtml}`,
    })
    const sent = await sendTransactionalEmail({ category: 'system', to: SUMMARY_RECIPIENTS, subject: `Punjab Exotic Foods - Daily System Summary (${dateKey})`, html, admin, createdBy: 'Nightly health check' })

    return res.status(200).json({ ok: true, dateKey, testMode, summary, issueCount: issues.length, emailSent: sent.ok })
  } catch (error) {
    console.error('cron-nightly-health-check failed', error instanceof Error ? error.message : 'Unknown error')
    return res.status(502).json({ error: 'The health check could not complete. See server logs for detail.' })
  }
}
