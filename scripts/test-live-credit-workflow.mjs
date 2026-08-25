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
const anonKey = keyValue('anon'), serviceKey = keyValue('service_role')
assert.ok(anonKey && serviceKey)
const url = `https://${project}.supabase.co`
const service = createClient(url, serviceKey, { auth: { persistSession: false } })
const staff = await service.from('admin_staff').select('id,email,auth_user_id').eq('active', true)
assert.ifError(staff.error)
assert.ok(staff.data.length >= 2)

const customerIds = staff.data.map((_, index) => `credit-workflow-${Date.now()}-${index}`)
const cleanup = async () => {
  const invoiceIds = customerIds.map(id => `${id}-invoice`)
  const creditIds = customerIds.flatMap(id => [`${id}-credit`, `${id}-over-credit`])
  for (const [table, column, ids] of [
    ['test_credit_note_allocations', 'credit_note_id', creditIds],
    ['test_credit_note_items', 'credit_note_id', creditIds],
    ['test_credit_notes', 'id', creditIds],
    ['test_invoice_items', 'invoice_id', invoiceIds],
    ['test_invoices', 'id', invoiceIds],
    ['test_customers', 'id', customerIds],
  ]) {
    const result = await service.from(table).delete().in(column, ids)
    assert.ifError(result.error)
  }
}

await cleanup()
try {
  for (const [index, admin] of staff.data.entries()) {
    const customerId = customerIds[index]
    const invoiceId = `${customerId}-invoice`, creditId = `${customerId}-credit`
    const amountPaid = index === 0 ? 0 : 200
    const expectedOutstanding = 500 - amountPaid - 100
    const link = await service.auth.admin.generateLink({ type: 'magiclink', email: admin.email })
    assert.ifError(link.error)
    const client = createClient(url, anonKey, { auth: { persistSession: false } })
    const verified = await client.auth.verifyOtp({ type: 'magiclink', token_hash: link.data.properties.hashed_token })
    assert.ifError(verified.error)
    assert.equal(verified.data.user.id, admin.auth_user_id)

    const customer = await client.from('test_customers').insert({ id: customerId, company_name: `Credit Workflow ${index}`, contact_person: 'Test', email: `${customerId}@example.test`, phone: '', customer_number: `CW${index}`, password: 'not-a-login', address: '', delivery_area: '', payment_terms: '14 Days', balance: 500, status: 'active' })
    assert.ifError(customer.error)
    const invoice = await client.from('test_invoices').insert({ id: invoiceId, customer_id: customerId, invoice_number: `TEST-INV-${index}-${Date.now()}`, amount: 500, amount_paid: amountPaid, due_date: '2026-09-01', date: '2026-08-25', status: amountPaid ? 'Part Paid' : 'Unpaid' })
    assert.ifError(invoice.error)
    const credit = await client.from('test_credit_notes').insert({ id: creditId, credit_number: `TEST-CN-${index}-${Date.now()}`, customer_id: customerId, amount: 100, remaining_balance: 100, reason: 'Workflow test', date: '2026-08-25', status: 'Active', original_invoice_reference: `TEST-INV-${index}` })
    assert.ifError(credit.error)
    const item = await client.from('test_credit_note_items').insert({ credit_note_id: creditId, line_number: '1', quantity: -2, product: 'BANANAS', price: 16.5, goods_value: -33, vat_rate: 0, vat_amount: 0 })
    assert.ifError(item.error)
    const applied = await client.rpc('apply_test_credit_note', { p_credit_note_id: creditId, p_invoice_id: invoiceId, p_amount: 100, p_date: '2026-08-25' })
    assert.ifError(applied.error)
    assert.equal(Number(applied.data.outstanding), expectedOutstanding)

    const savedInvoice = await client.from('test_invoices').select('amount,amount_paid,status').eq('id', invoiceId).single()
    const savedCredit = await client.from('test_credit_notes').select('remaining_balance,linked_invoice_id').eq('id', creditId).single()
    const savedAllocation = await client.from('test_credit_note_allocations').select('amount').eq('credit_note_id', creditId).single()
    const savedItem = await client.from('test_credit_note_items').select('quantity,goods_value').eq('credit_note_id', creditId).single()
    for (const result of [savedInvoice, savedCredit, savedAllocation, savedItem]) assert.ifError(result.error)
    assert.equal(Number(savedInvoice.data.amount), 500)
    assert.equal(Number(savedInvoice.data.amount_paid), amountPaid)
    assert.equal(Number(savedCredit.data.remaining_balance), 0)
    assert.equal(savedCredit.data.linked_invoice_id, invoiceId)
    assert.equal(Number(savedAllocation.data.amount), 100)
    assert.equal(Number(savedItem.data.quantity), -2)
    assert.equal(Number(savedItem.data.goods_value), -33)
    if (index === 0) {
      const overCreditId = `${customerId}-over-credit`
      const tooLargeCredit = await client.from('test_credit_notes').insert({ id: overCreditId, credit_number: `TEST-OVER-${Date.now()}`, customer_id: customerId, amount: 500, remaining_balance: 500, reason: 'Over-credit test', date: '2026-08-25', status: 'Active' })
      assert.ifError(tooLargeCredit.error)
      const rejected = await client.rpc('apply_test_credit_note', { p_credit_note_id: overCreditId, p_invoice_id: invoiceId, p_amount: 500, p_date: '2026-08-25' })
      assert.ok(rejected.error)
      assert.match(rejected.error.message, /exceeds the invoice outstanding balance/i)
    }
    await client.auth.signOut()
  }
} finally {
  await cleanup()
}

console.log(`Live credit workflow passed for ${staff.data.length} active admin accounts`)
