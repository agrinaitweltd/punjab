import { createClient } from '@supabase/supabase-js'
import { brandedEmail, EMAIL_SENDERS, sendTransactionalEmail } from '../server/email-system.js'
import { emailTestInternals } from '../server/admin-actions/test-email-suite.js'

if (process.env.CONFIRM_EMAIL_SUITE !== 'SEND_TO_INFO_AT_KAVOTECH') throw new Error('Live email suite confirmation is required')
const required = ['RESEND_API_KEY', 'VITE_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY']
for (const name of required) if (!process.env[name]) throw new Error(`${name} is not configured`)

const admin = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } })
const recipient = 'info@kavotech.uk'
const runId = new Date().toISOString().replace(/[:.]/g, '-')
const messages = emailTestInternals.suite(await emailTestInternals.testInvoicePdf())
const results = []
for (const message of messages) {
  const result = await sendTransactionalEmail({
    category: message.category, to: recipient, subject: message.subject,
    html: brandedEmail({ heading: message.heading, intro: message.intro, contentHtml: message.content, cta: message.cta, preheader: message.subject }),
    attachments: message.attachments || [], admin, idempotencyKey: `email-suite:${runId}:${message.category}`,
    communicationType: 'email_template_test', createdBy: 'Codex production readiness test',
  })
  results.push({ category: message.category, sender: EMAIL_SENDERS[message.category].email, ok: result.ok, status: result.status || null, providerMessageId: result.id || null, error: result.error || null })
}
console.log(JSON.stringify({ recipient, successful: results.filter(item => item.ok).length, failed: results.filter(item => !item.ok).length, results }))
if (results.some(item => !item.ok)) process.exitCode = 1
