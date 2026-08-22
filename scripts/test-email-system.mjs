import assert from 'node:assert/strict'
import { brandedEmail, EMAIL_REPLY_TO, EMAIL_SENDERS, sendTransactionalEmail } from '../server/email-system.js'
import { emailTestInternals } from '../server/admin-actions/test-email-suite.js'

const calls = []
const originalFetch = globalThis.fetch
globalThis.fetch = async (_url, init) => {
  calls.push(JSON.parse(init.body))
  return new Response(JSON.stringify({ id: `email-${calls.length}` }), { status: 200, headers: { 'Content-Type': 'application/json' } })
}

try {
  for (const category of Object.keys(EMAIL_SENDERS)) {
    const html = brandedEmail({ heading: 'Email system test', intro: 'Safe automated test.', contentHtml: '<p>Content</p>' })
    const result = await sendTransactionalEmail({ apiKey: 'test-key', category, to: 'info@kavotech.uk', subject: `[TEST] ${category}`, html })
    assert.equal(result.ok, true)
    const payload = calls.at(-1)
    assert.equal(payload.from, `${EMAIL_SENDERS[category].name} <${EMAIL_SENDERS[category].email}>`)
    assert.equal(payload.reply_to, EMAIL_REPLY_TO)
    assert.match(payload.html, /Please do not reply directly/)
    assert.match(payload.html, /020 8558 2867/)
  }
  assert.equal(calls.length, 9)
  const invoicePdf = await emailTestInternals.testInvoicePdf()
  assert.equal(Buffer.from(invoicePdf, 'base64').subarray(0, 4).toString(), '%PDF')
  const suite = emailTestInternals.suite(invoicePdf)
  assert.equal(suite.length, 9)
  assert.deepEqual(suite.map(message => message.category), Object.keys(EMAIL_SENDERS))
  assert.ok(suite.every(message => message.subject.startsWith('[TEST]')))
  assert.equal(suite[0].attachments.length, 1)
  assert.match(suite[0].attachments[0].filename, /TEST-DEMO-NOT-PAYABLE/)
  assert.ok(suite.slice(1).every(message => !message.attachments))
  console.log('Automated email system tests passed')
} finally {
  globalThis.fetch = originalFetch
}
