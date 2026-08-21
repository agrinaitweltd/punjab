import assert from 'node:assert/strict'
import cron from '../api/cron-whatsapp-reminders.js'
import login from '../api/login.js'
import requestPasswordReset from '../api/request-password-reset.js'
import { guardApi, requireUser } from '../server/security.js'

function response() {
  return { statusCode: 200, body: null, headers: {}, status(code) { this.statusCode = code; return this }, json(value) { this.body = value; return this }, setHeader(key, value) { this.headers[key] = value } }
}

const previousNodeEnv = process.env.NODE_ENV
process.env.NODE_ENV = 'production'
const blocked = response()
assert.equal(guardApi({ method: 'POST', url: '/api/test', headers: { host: 'punjab.example', origin: 'https://evil.example' } }, blocked), false)
assert.equal(blocked.statusCode, 403)

const allowed = response()
assert.equal(guardApi({ method: 'POST', url: '/api/test-ok', headers: { host: 'punjab.example', origin: 'https://punjab.example' } }, allowed), true)

const blockedLogin = response()
await login({ method: 'POST', url: '/api/login', headers: { host: 'punjab.example', origin: 'https://evil.example' }, body: {} }, blockedLogin)
assert.equal(blockedLogin.statusCode, 403)

const blockedReset = response()
await requestPasswordReset({ method: 'POST', url: '/api/request-password-reset', headers: { host: 'punjab.example', origin: 'https://evil.example' }, body: {} }, blockedReset)
assert.equal(blockedReset.statusCode, 403)

const missingToken = response()
assert.equal(await requireUser({ headers: {} }, missingToken), null)
assert.equal(missingToken.statusCode, 401)

delete process.env.CRON_SECRET
const cronResponse = response()
await cron({ method: 'GET', headers: {} }, cronResponse)
assert.equal(cronResponse.statusCode, 401)
process.env.NODE_ENV = previousNodeEnv

console.log('Security route tests passed')
