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

const prefix = `all-admin-import-${Date.now()}`
const cleanupIds = activeResult.data.map((_, index) => ({ customer: `${prefix}-c-${index}`, invoice: `${prefix}-i-${index}`, file: `${prefix}-f-${index}` }))
const cleanup = async () => {
  await service.from('test_activity_log').delete().in('id', cleanupIds.map(item => item.file))
  await service.from('test_invoice_items').delete().in('invoice_id', cleanupIds.map(item => item.invoice))
  await service.from('test_invoices').delete().in('id', cleanupIds.map(item => item.invoice))
  await service.from('test_customers').delete().in('id', cleanupIds.map(item => item.customer))
}

await cleanup()
try {
  for (const [index, admin] of activeResult.data.entries()) {
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
    const ids = cleanupIds[index]
    const customer = await client.from('test_customers').insert({ id: ids.customer, company_name: `Admin Import ${index}`, contact_person: '', email: `${ids.customer}@pending.punjab.local`, phone: '', customer_number: `AI${index}`, password: 'not-a-login', address: '', delivery_area: '', payment_terms: '14 Days', balance: 0, status: 'active' })
    assert.ifError(customer.error)
    const invoice = await client.from('test_invoices').insert({ id: ids.invoice, customer_id: ids.customer, invoice_number: `${prefix}-${index}`, amount: 16.5, amount_paid: 0, date: '2026-08-25', due_date: '2026-09-08', status: 'Unpaid' })
    assert.ifError(invoice.error)
    const item = await client.from('test_invoice_items').insert({ invoice_id: ids.invoice, line_number: '1', quantity: 1, product: 'IMPORT ACCESS TEST', price: 16.5, goods_value: 16.5, vat_rate: 0, vat_amount: 0 })
    assert.ifError(item.error)
    const file = await client.from('test_activity_log').insert({ id: ids.file, customer_name: 'FILE:import-access.pdf', action: 'data:application/pdf;base64,JVBERi0=', timestamp: JSON.stringify({ customerId: ids.customer, invoiceId: ids.invoice }) })
    assert.ifError(file.error)
    await client.auth.signOut()
  }
} finally {
  await cleanup()
}

console.log(`Live import access passed for ${activeResult.data.length} active admin accounts`)
