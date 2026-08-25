import assert from 'node:assert/strict'
import { createClient } from '@supabase/supabase-js'

const project = process.env.SUPABASE_PROJECT_REF
const pat = process.env.SUPABASE_ACCESS_TOKEN
const password = process.env.DEVELOPER_TEST_PASSWORD
if (!project || !pat || !password) throw new Error('Missing live-login test environment')

const management = `https://api.supabase.com/v1/projects/${project}`
const keysResponse = await fetch(`${management}/api-keys?reveal=true`, { headers: { Authorization: `Bearer ${pat}` } })
assert.equal(keysResponse.ok, true)
const keys = await keysResponse.json()
const keyValue = name => {
  const entry = keys.find(key => key.name === name)
  return entry?.api_key || entry?.key
}
const url = `https://${project}.supabase.co`
const anonKey = keyValue('anon')
assert.ok(anonKey)

// Admin login now goes straight to Supabase Auth (supabase.auth.signInWithPassword)
// with no DB-password bridge in between — this exercises exactly that path.
const authClient = createClient(url, anonKey, { auth: { autoRefreshToken: false, persistSession: false } })

const valid = await authClient.auth.signInWithPassword({ email: 'info@kavotech.uk', password })
assert.equal(valid.error, null)
assert.ok(valid.data.session?.access_token)
assert.ok(valid.data.session?.refresh_token)

const invalid = await authClient.auth.signInWithPassword({ email: 'info@kavotech.uk', password: `${password}-invalid` })
assert.ok(invalid.error)
assert.equal(invalid.data.session, null)

console.log('Live login tests passed')
