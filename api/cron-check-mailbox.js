import { serviceClient, globalTestMode } from '../server/runtime-mode.js'
import { processMailbox } from '../server/email-import/process-mailbox.js'

// Vercel Hobby's max for a single function invocation - processMailbox's own
// internal time budget (see TIME_BUDGET_MS in process-mailbox.js) stops
// picking up new messages well before this, so a burst of many forwarded
// invoices spreads across several polls instead of one invocation timing
// out mid-batch.
export const config = { maxDuration: 60 }

/** Polls receivables@punjabexoticfoods.com (IONOS IMAP) for new PDF invoices/
 *  credit notes and imports them through the same pipeline the manual
 *  uploader uses. Machine-triggered only - same CRON_SECRET bearer-token
 *  pattern as cron-whatsapp-reminders.js, so a random caller can't trigger a
 *  mailbox scan. Safe to call as often as you like (every attachment is
 *  deduped by message-id + filename, and by content hash), so this works
 *  whether it's invoked by Vercel Cron or an external scheduler. */
export default async function handler(req, res) {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret || req.headers?.authorization !== `Bearer ${cronSecret}`) return res.status(401).json({ error: 'Unauthorized' })

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
