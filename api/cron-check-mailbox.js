import { timingSafeEqual } from 'node:crypto'
import { serviceClient, globalTestMode } from '../server/runtime-mode.js'
import { processMailbox } from '../server/email-import/process-mailbox.js'

function safeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false
  return timingSafeEqual(Buffer.from(a), Buffer.from(b))
}

// Vercel Hobby's max for a single function invocation - processMailbox's own
// internal time budget (see TIME_BUDGET_MS in process-mailbox.js) stops
// picking up new messages well before this, so a burst of many forwarded
// invoices spreads across several polls instead of one invocation timing
// out mid-batch.
export const config = { maxDuration: 60 }

/** Polls receivables@punjabexoticfoods.com (IONOS IMAP) for new PDF invoices/
 *  credit notes and imports them through the same pipeline the manual
 *  uploader uses. Machine-triggered only - accepts the CRON_SECRET either as
 *  an `Authorization: Bearer <secret>` header (same pattern as
 *  cron-whatsapp-reminders.js) or as a `?key=<secret>` query parameter.
 *  The query-param form exists because several external cron schedulers'
 *  custom-header UIs have proven unreliable to configure correctly (wrong
 *  field, silently not saved, etc.) - putting the secret straight in the
 *  URL field is a single, unambiguous text box. Safe to call as often as
 *  you like (every attachment is deduped by message-id + filename, and by
 *  content hash). */
export default async function handler(req, res) {
  const cronSecret = process.env.CRON_SECRET
  const headerToken = String(req.headers?.authorization || '').replace(/^Bearer\s+/i, '')
  const queryToken = typeof req.query?.key === 'string' ? req.query.key : ''
  const authorized = Boolean(cronSecret) && (safeEqual(headerToken, cronSecret) || safeEqual(queryToken, cronSecret))
  if (!authorized) return res.status(401).json({ error: 'Unauthorized' })

  let admin
  try {
    admin = serviceClient()
  } catch {
    return res.status(500).json({ error: 'Server-side Supabase is not configured' })
  }

  let testMode = false
  try {
    testMode = await globalTestMode(admin)
  } catch {
    return res.status(502).json({ error: 'System mode could not be loaded' })
  }
  const table = name => (testMode ? `test_${name}` : name)

  try {
    const summary = await processMailbox(admin, table, testMode)
    return res.status(200).json({ testMode, ...summary })
  } catch (error) {
    console.error('cron-check-mailbox failed', error instanceof Error ? error.message : 'Unknown error')
    return res.status(502).json({ error: 'The mailbox could not be checked. See server logs for detail.' })
  }
}
