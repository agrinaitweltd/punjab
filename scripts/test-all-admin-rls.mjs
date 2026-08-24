import assert from 'node:assert/strict'
import { createClient } from '@supabase/supabase-js'

const project = process.env.SUPABASE_PROJECT_REF
const token = process.env.SUPABASE_ACCESS_TOKEN
if (!project || !token) throw new Error('Missing Supabase live test environment.')

const management = `https://api.supabase.com/v1/projects/${project}`
const keysResponse = await fetch(`${management}/api-keys?reveal=true`, { headers: { Authorization: `Bearer ${token}` } })
assert.equal(keysResponse.ok, true)
const keys = await keysResponse.json()
const keyValue = name => keys.find(key => key.name === name)?.api_key
const anonKey = keyValue('anon')
const serviceKey = keyValue('service_role')
assert.ok(anonKey && serviceKey)

const url = `https://${project}.supabase.co`
const service = createClient(url, serviceKey, { auth: { persistSession: false } })
const activeResult = await service.from('admin_staff').select('id,email,auth_user_id,active').eq('active', true)
assert.ifError(activeResult.error)
assert.ok(activeResult.data.length > 0)
assert.ok(activeResult.data.every(admin => admin.auth_user_id && admin.email))

const anonymous = createClient(url, anonKey, { auth: { persistSession: false } })
const anonymousCustomers = await anonymous.from('customers').select('id')
assert.deepEqual(anonymousCustomers.data, [])

for (const admin of activeResult.data) {
  const link = await service.auth.admin.generateLink({ type: 'magiclink', email: admin.email })
  assert.ifError(link.error)
  assert.ok(link.data.properties.hashed_token)
  const client = createClient(url, anonKey, { auth: { persistSession: false } })
  const verified = await client.auth.verifyOtp({ type: 'magiclink', token_hash: link.data.properties.hashed_token })
  assert.ifError(verified.error)
  assert.equal(verified.data.user.id, admin.auth_user_id)
  for (const table of ['customers', 'invoices', 'credit_notes', 'admin_staff']) {
    const result = await client.from(table).select('id')
    assert.ifError(result.error)
    if (table === 'admin_staff') assert.equal(result.data.length, activeResult.data.length)
    else assert.equal(result.data.length, 0)
  }
  await client.auth.signOut()
}

console.log(`Live RLS access passed for ${activeResult.data.length} active admin accounts`)
