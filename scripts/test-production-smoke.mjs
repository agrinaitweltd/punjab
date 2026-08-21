import assert from 'node:assert/strict'

const origin = process.env.PRODUCTION_ORIGIN
const password = process.env.DEVELOPER_TEST_PASSWORD
if (!origin || !password) throw new Error('Missing PRODUCTION_ORIGIN or DEVELOPER_TEST_PASSWORD')

const post = (path, body, token) => fetch(`${origin}${path}`, {
  method: 'POST',
  headers: {
    Origin: origin,
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  },
  body: JSON.stringify(body),
})

const login = await post('/api/login', { role: 'admin', identifier: 'info@kavotech.uk', password })
assert.equal(login.status, 200)
const session = await login.json()
assert.ok(session.accessToken)

const wrong = await post('/api/login', { role: 'admin', identifier: 'info@kavotech.uk', password: `${password}-invalid` })
assert.equal(wrong.status, 401)
const docValidation = await post('/api/generate-invoice-docx', {}, session.accessToken)
assert.equal(docValidation.status, 400)
const unauthenticatedEmail = await post('/api/send-email', {})
assert.equal(unauthenticatedEmail.status, 401)

const home = await fetch(origin)
assert.equal(home.status, 200)
assert.ok(home.headers.get('content-security-policy'))
assert.ok(home.headers.get('strict-transport-security'))
assert.equal(home.headers.get('x-content-type-options'), 'nosniff')

console.log(JSON.stringify({
  login: login.status,
  wrongPassword: wrong.status,
  authenticatedRouteValidation: docValidation.status,
  unauthenticatedSensitiveRoute: unauthenticatedEmail.status,
  securityHeaders: true,
}))
