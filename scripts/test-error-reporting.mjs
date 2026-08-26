import assert from 'node:assert/strict'
import { createClient } from '@supabase/supabase-js'
process.env.NODE_ENV = 'test'
import reportError from '../server/admin-actions/report-error.js'
import errorLog from '../server/admin-actions/error-log.js'

const admin = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } })

function response() {
  return {
    statusCode: 200, headers: {}, body: null,
    status(c) { this.statusCode = c; return this },
    setHeader(k, v) { this.headers[k] = v },
    json(v) { this.body = v; return this },
  }
}

const testUser = { id: '00000000-0000-4000-8000-000000000001', email: 'qa-error-test@example.test', app_metadata: { role: 'admin' } }

const req = {
  method: 'POST', headers: {}, testUser,
  body: {
    code: 213, title: 'Credit Note Could Not Be Allocated', message: 'Test message',
    technicalDetail: 'Credit amount exceeds the invoice outstanding balance. password=hunter2 apiKey=sk_live_secret',
    feature: 'Apply Credit Note', context: { creditNumber: 'CN-TEST-1', invoiceNumber: 'INV-TEST-1', token: 'should-be-redacted' },
    note: 'QA regression test - safe to delete',
  },
}
const res = response()
await reportError(req, res)
assert.equal(res.statusCode, 200, JSON.stringify(res.body))

// Regression guard: an insert failure (e.g. a non-UUID user id) must
// surface as a 500, never a silent 200 - the whole point of this endpoint
// is an accurate record of what happened.
const badReq = { method: 'POST', headers: {}, testUser: { ...testUser, id: 'not-a-valid-uuid' }, body: req.body }
const badRes = response()
await reportError(badReq, badRes)
assert.equal(badRes.statusCode, 500, 'insert failures must not be reported as success')

void errorLog

// Regression guard: secrets embedded as free text inside technicalDetail
// (not just as object keys) must be redacted too, since a thrown error's
// message can legitimately contain a stringified request body.
const secretReq = {
  method: 'POST', headers: {}, testUser,
  body: {
    code: 801, title: 'Unexpected System Error', message: 'x',
    technicalDetail: 'Request failed: password=hunter2, apiKey: "sk_live_abc123", Authorization: Bearer eyJhbGciOi.abc.def, token=xyz789',
    feature: 'QA secret-redaction test',
  },
}
const secretRes = response()
await reportError(secretReq, secretRes)
assert.equal(secretRes.statusCode, 200, JSON.stringify(secretRes.body))

const stored = await admin.from('application_error_log').select('technical_detail').eq('feature', 'QA secret-redaction test').order('created_at', { ascending: false }).limit(1).single()
assert.equal(stored.error, null)
const detail = stored.data.technical_detail
for (const leaked of ['hunter2', 'sk_live_abc123', 'eyJhbGciOi.abc.def', 'xyz789']) {
  assert.ok(!detail.includes(leaked), `secret leaked into stored technical_detail: "${leaked}" found in "${detail}"`)
}

// Cleanup this run's QA rows so they don't accumulate in the real error log.
await admin.from('application_error_log').delete().or('user_email.eq.qa-error-test@example.test,feature.eq.QA secret-redaction test')

console.log('Error report handler: success path returns 200, insert failures correctly surface as 500, secrets fully redacted from free text')
