import assert from 'node:assert/strict'
import { createClient } from '@supabase/supabase-js'

const project = process.env.SUPABASE_PROJECT_REF
const pat = process.env.SUPABASE_ACCESS_TOKEN
const origin = process.env.PRODUCTION_ORIGIN
const password = process.env.DEVELOPER_TEST_PASSWORD
if (!project || !pat || !origin || !password) throw new Error('Missing live RLS test environment')

const management = `https://api.supabase.com/v1/projects/${project}`
const keysResponse = await fetch(`${management}/api-keys?reveal=true`, { headers: { Authorization: `Bearer ${pat}` } })
assert.equal(keysResponse.ok, true)
const keys = await keysResponse.json()
const anonEntry = keys.find(key => key.name === 'anon')
const anonKey = anonEntry?.api_key || anonEntry?.key
assert.ok(anonKey)

// Admin login is a direct Supabase Auth sign-in — no /api/login bridge for admins.
const authClient = createClient(`https://${project}.supabase.co`, anonKey, { auth: { autoRefreshToken: false, persistSession: false } })
const signIn = await authClient.auth.signInWithPassword({ email: 'info@kavotech.uk', password })
assert.equal(signIn.error, null)
const accessToken = signIn.data.session?.access_token
assert.ok(accessToken)

const rest = async (table, token) => {
  const response = await fetch(`https://${project}.supabase.co/rest/v1/${table}?select=id`, {
    headers: { apikey: anonKey, ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  })
  assert.equal(response.status, 200, `${table} returned ${response.status}`)
  return response.json()
}

const expectedAdminCounts = { customers: 0, invoices: 0, admin_staff: 3, products: 0, activity_log: 0 }
for (const [table, expectedCount] of Object.entries(expectedAdminCounts)) {
  assert.deepEqual(await rest(table), [], `Anonymous access exposed ${table}`)
  const adminRows = await rest(table, accessToken)
  assert.equal(adminRows.length, expectedCount, `Unexpected production row count for ${table}`)
}

for (const table of ['invoice_items', 'expenses', 'finance_settings', 'portal_invitations', 'generated_documents', 'communication_logs']) {
  assert.deepEqual(await rest(table), [], `Anonymous access exposed ${table}`)
  await rest(table, accessToken)
}

console.log('Live RLS tests passed')
