import { timingSafeEqual } from 'node:crypto'
import { serviceClient, globalTestMode } from '../server/runtime-mode.js'
import { runHealthCheck, ukLocalParts } from '../server/health-check.js'
import { brandedEmail, sendTransactionalEmail, summaryTable, sectionHeading, alertBox, dataTable } from '../server/email-system.js'

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
 *  Pass ?force=1 to run immediately regardless of time/day, for testing.
 *  Pass ?test=1 to additionally send the summary only to info@kavotech.uk
 *  (never the real business inbox) and skip health_check_runs entirely, so
 *  a manual test send never blocks or gets blocked by tonight's real run. */
export default async function handler(req, res) {
  const cronSecret = process.env.CRON_SECRET
  const headerToken = String(req.headers?.authorization || '').replace(/^Bearer\s+/i, '')
  const queryToken = typeof req.query?.key === 'string' ? req.query.key : ''
  const authorized = Boolean(cronSecret) && (safeEqual(headerToken, cronSecret) || safeEqual(queryToken, cronSecret))
  if (!authorized) return res.status(401).json({ error: 'Unauthorized' })

  const testSend = req.query?.test === '1'
  const force = req.query?.force === '1' || testSend
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
    const { summary, issues, details } = await runHealthCheck(admin, table)
    if (!testSend) await admin.from('health_check_runs').upsert({ id: dateKey, ran_at: new Date().toISOString(), summary })

    const fixed = issues.filter(item => item.severity === 'fixed')
    const review = issues.filter(item => item.severity === 'review')
    const money = n => `£${Number(n || 0).toFixed(2)}`

    const overviewRows = [
      ['Date', dateKey],
      ['System Health', review.length === 0 ? 'Healthy' : `${review.length} item(s) need review`],
      ['New Customers', String(summary.newCustomers)],
      ['Invoices Imported', String(summary.invoicesImported)],
      ['Credit Notes Imported', String(summary.creditNotesImported)],
      ['Payments Recorded', String(summary.paymentsRecorded)],
      ['Emails Sent', String(summary.emailsSent)],
      ['Documents Processed', String(summary.documentsReceived)],
      ['Errors Found', String(summary.errorsFound)],
      ['Errors Repaired', String(fixed.length)],
    ]

    const newCustomersHtml = details.newCustomers.length
      ? dataTable(['Customer', 'Account No.', 'Invoices Received', 'Balance'], details.newCustomers.map(c => [c.name, c.accountNumber, String(c.invoiceCount), money(c.balance)]))
      : '<p style="font-size:13px;color:#818b85;margin:6px 0 18px">No new customers today.</p>'

    const invoiceSummaryRows = [
      ['Imported Today', String(summary.invoicesImported)],
      ['Paid (total)', String(summary.paidInvoices)],
      ['Open (total)', String(summary.outstandingInvoices)],
      ['Needing Review', String(review.length)],
    ]
    // Item 11: explicit generated-PDF backlog stats, separate from the
    // generic invoice summary above.
    const pdfBacklogRows = [
      ['Missing PDFs Detected', String(summary.pdfsMissingDetected)],
      ['Successfully Regenerated', String(summary.pdfsRegenerated)],
      ['Still Failed', String(summary.pdfsStillFailed)],
      ['Needs Review', String(summary.pdfsStillFailed)],
    ]
    const problemInvoicesHtml = details.problemInvoices.length
      ? dataTable(['Customer', 'Account No.', 'Invoice No.', 'Amount', 'Status', 'Issue'], details.problemInvoices.slice(0, 30).map(i => [i.customerName, i.accountNumber, i.invoiceNumber, money(i.amount), i.status, i.issue]))
      : '<p style="font-size:13px;color:#818b85;margin:6px 0 18px">No problem invoices today.</p>'

    const creditNotesHtml = details.creditNotes.length
      ? dataTable(['Customer', 'Credit Note No.', 'Amount', 'Allocated'], details.creditNotes.map(c => [c.customerName, c.creditNumber, money(c.amount), c.allocated ? 'Yes' : 'No']))
      : '<p style="font-size:13px;color:#818b85;margin:6px 0 18px">No credit notes today.</p>'
    const creditNotesTotal = details.creditNotes.reduce((sum, c) => sum + c.amount, 0)

    const paymentsHtml = details.payments.length
      ? dataTable(['Customer', 'Reference', 'Amount'], details.payments.map(p => [p.customerName, p.reference, money(p.amount)]))
      : '<p style="font-size:13px;color:#818b85;margin:6px 0 18px">No payments recorded today.</p>'
    const paymentsTotal = details.payments.reduce((sum, p) => sum + p.amount, 0)
    const largePaymentAlert = details.largePayments.length
      ? alertBox(`${details.largePayments.length} payment(s) of £500 or more today: ${details.largePayments.slice(0, 5).map(p => `${p.customerName} (${money(p.amount)})`).join(', ')}`, 'good')
      : ''

    const emailActivityHtml = details.emailActivity.length
      ? dataTable(['Type', 'Sent', 'Failed'], details.emailActivity.map(e => [e.type, String(e.sent), String(e.failed)]))
      : '<p style="font-size:13px;color:#818b85;margin:6px 0 18px">No email activity today.</p>'

    const documentsRows = [
      ['Documents Received', String(summary.documentsReceived)],
      ['Generated PDFs Created/Repaired', String(summary.pdfsGenerated)],
      ['Documents Needing Review', String(details.documentsNeedingReview.length)],
    ]
    const documentsReviewHtml = details.documentsNeedingReview.length
      ? dataTable(['Filename', 'Customer', 'Reason'], details.documentsNeedingReview.slice(0, 20).map(d => [d.filename, d.customerName, d.reason]))
      : ''

    const errorsHtml = review.length
      ? dataTable(['Issue', 'Auto-Repaired?'], review.slice(0, 40).map(item => [item.text, 'No — admin action required']))
      : '<p style="font-size:13px;color:#818b85;margin:6px 0 18px">No unresolved errors today.</p>'
    const fixedHtml = fixed.length
      ? dataTable(['Issue', 'Auto-Repaired?'], fixed.slice(0, 40).map(item => [item.text, 'Yes']))
      : '<p style="font-size:13px;color:#818b85;margin:6px 0 18px">Nothing needed automatic repair today.</p>'

    const securityHtml = summaryTable([
      ['Scheduled Job Status', 'Ran successfully'],
      ['Supabase Connectivity', 'OK - this check itself ran against the live database'],
      ['Email Provider (Resend)', summary.emailsFailed > 0 ? `${summary.emailsFailed} send(s) failed today - see Email Activity above` : 'No failures detected today'],
      ['Backup Status', 'Not covered by this automated check - see Backup & Recovery in System Developer tools'],
    ])

    const contentHtml = [
      sectionHeading('Daily Overview'),
      summaryTable(overviewRows),
      review.length > 0 ? alertBox(`${review.length} item(s) need admin review today - see System Errors below.`, 'warn') : alertBox('No issues need admin attention today.', 'good'),

      sectionHeading('New Customers'),
      newCustomersHtml,

      sectionHeading('Invoices'),
      summaryTable(invoiceSummaryRows),
      problemInvoicesHtml,

      sectionHeading('Generated PDF Backlog'),
      summaryTable(pdfBacklogRows),

      sectionHeading('Credit Notes'),
      summaryTable([['Total Credit Value', money(creditNotesTotal)], ['Customers Affected', String(new Set(details.creditNotes.map(c => c.customerName)).size)]]),
      creditNotesHtml,

      sectionHeading('Payments'),
      summaryTable([['Number of Payments', String(details.payments.length)], ['Total Payment Value', money(paymentsTotal)]]),
      largePaymentAlert,
      paymentsHtml,

      sectionHeading('Email Activity'),
      emailActivityHtml,

      sectionHeading('Documents'),
      summaryTable(documentsRows),
      documentsReviewHtml,

      sectionHeading('System Errors', review.length ? 'bad' : 'good'),
      errorsHtml,
      sectionHeading('Automatically Fixed', 'good'),
      fixedHtml,

      sectionHeading('Security / System Health'),
      securityHtml,
    ].join('')

    const html = brandedEmail({
      heading: testSend ? 'Daily System Summary (MANUAL TEST SEND)' : 'Daily System Summary', preheader: `${dateKey} - ${summary.errorsFound} issue(s), ${fixed.length} auto-fixed`,
      intro: `${testSend ? 'TEST SEND - this is a manual trigger, not the automated 21:00 UK run. ' : ''}Production summary for ${dateKey}${testMode ? ' (Test Mode - sandbox data)' : ''}.`,
      contentHtml,
    })
    const recipients = testSend ? ['info@kavotech.uk'] : SUMMARY_RECIPIENTS
    const subject = `${testSend ? '[TEST] ' : ''}Punjab Exotic Foods - Daily System Summary (${dateKey})`
    const sent = await sendTransactionalEmail({ category: 'system', to: recipients, subject, html, admin, createdBy: testSend ? 'Manual health check test' : 'Nightly health check' })

    return res.status(200).json({ ok: true, dateKey, testMode, testSend, summary, issueCount: issues.length, emailSent: sent.ok })
  } catch (error) {
    console.error('cron-nightly-health-check failed', error instanceof Error ? error.message : 'Unknown error')
    return res.status(502).json({ error: 'The health check could not complete. See server logs for detail.' })
  }
}
