import assert from 'node:assert/strict'
import { createClient } from '@supabase/supabase-js'

const origin = process.env.PRODUCTION_ORIGIN
const password = process.env.DEVELOPER_TEST_PASSWORD
const project = process.env.SUPABASE_PROJECT_REF
const pat = process.env.SUPABASE_ACCESS_TOKEN
if (!origin || !password || !project || !pat) throw new Error('Missing PRODUCTION_ORIGIN, DEVELOPER_TEST_PASSWORD, SUPABASE_PROJECT_REF or SUPABASE_ACCESS_TOKEN')

const post = (path, body, token) => fetch(`${origin}${path}`, {
  method: 'POST',
  headers: {
    Origin: origin,
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  },
  body: JSON.stringify(body),
})

// Admin login is a direct Supabase Auth sign-in from the client — no
// /api/login bridge for admins — so the smoke test exercises that directly.
const keysResponse = await fetch(`https://api.supabase.com/v1/projects/${project}/api-keys?reveal=true`, { headers: { Authorization: `Bearer ${pat}` } })
assert.equal(keysResponse.ok, true)
const keys = await keysResponse.json()
const anonEntry = keys.find(key => key.name === 'anon')
const anonKey = anonEntry?.api_key || anonEntry?.key
assert.ok(anonKey)
const authClient = createClient(`https://${project}.supabase.co`, anonKey, { auth: { autoRefreshToken: false, persistSession: false } })

const signIn = await authClient.auth.signInWithPassword({ email: 'info@kavotech.uk', password })
assert.equal(signIn.error, null)
const session = { accessToken: signIn.data.session?.access_token }
assert.ok(session.accessToken)

const wrongSignIn = await authClient.auth.signInWithPassword({ email: 'info@kavotech.uk', password: `${password}-invalid` })
assert.ok(wrongSignIn.error)
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
  login: signIn.data.session ? 200 : 401,
  wrongPassword: wrongSignIn.error ? 401 : 200,
  authenticatedRouteValidation: docValidation.status,
  unauthenticatedSensitiveRoute: unauthenticatedEmail.status,
  securityHeaders: true,
}))
