import { ImapFlow } from 'imapflow'

/** Opens an authenticated IMAP connection to the IONOS receivables mailbox.
 *  Credentials are server-only env vars - never sent to, or read by, the
 *  browser. Caller is responsible for calling client.logout(). */
export function openImapConnection() {
  const host = process.env.IONOS_IMAP_HOST
  const port = Number(process.env.IONOS_IMAP_PORT || 993)
  const secure = process.env.IONOS_IMAP_SECURE !== 'false'
  const user = process.env.IONOS_EMAIL_USER
  const pass = process.env.IONOS_EMAIL_PASSWORD
  if (!host || !user || !pass) throw new Error('The IONOS mailbox is not configured (IONOS_IMAP_HOST/IONOS_EMAIL_USER/IONOS_EMAIL_PASSWORD).')
  return new ImapFlow({
    host, port, secure,
    auth: { user, pass },
    logger: false, // never log IMAP traffic - it can carry the auth exchange
  })
}
