import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { reminderStage, storedInvoicePdf } from '../api/cron-whatsapp-reminders.js'

const today = '2026-08-22'
const invoice = {
  id: 'invoice-42',
  customer_id: 'customer-7',
  invoice_number: 'PEF-1042',
  amount: 1260.5,
  date: '2026-08-08',
  due_date: '2026-08-29',
}

const canonicalMetadata = {
  type: 'application/pdf',
  customerId: invoice.customer_id,
  invoiceId: invoice.id,
  invoiceNumber: invoice.invoice_number,
  invoiceAmount: invoice.amount,
  documentRole: 'canonical_invoice',
  templateId: 'punjab-approved-letterhead-v1',
}

const file = (name, metadata, body, createdAt = '2026-08-08T12:00:00.000Z') => ({
  customer_name: `FILE:${name}`,
  action: `data:application/pdf;base64,${Buffer.from(body).toString('base64')}`,
  timestamp: JSON.stringify(metadata),
  created_at: createdAt,
})

assert.equal(reminderStage(invoice, today), 'day-14', '14-day invoice must use the day-14 reminder stage')
assert.equal(
  reminderStage({ ...invoice, date: '2026-08-01', due_date: today }, today),
  'day-21',
  '21-day invoice must use the day-21 reminder stage',
)

const wrongCustomer = file('wrong-customer.pdf', { ...canonicalMetadata, customerId: 'customer-8' }, 'wrong customer')
const wrongInvoice = file('wrong-invoice.pdf', { ...canonicalMetadata, invoiceId: 'invoice-99' }, 'wrong invoice')
const wrongAmount = file('wrong-amount.pdf', { ...canonicalMetadata, invoiceAmount: 1200 }, 'wrong amount')
const genericNotice = file('Payment-Due-Notice.pdf', { ...canonicalMetadata, documentRole: 'general', templateId: undefined }, 'generic reminder')
const oldApproved = file('Invoice-PEF-1042.pdf', canonicalMetadata, 'approved original', '2026-08-08T12:00:00.000Z')
const latestApproved = file('Invoice-PEF-1042-approved.pdf', canonicalMetadata, 'approved replacement', '2026-08-08T13:00:00.000Z')

const selected = storedInvoicePdf([wrongCustomer, wrongInvoice, wrongAmount, genericNotice, oldApproved, latestApproved], invoice)
assert.ok(selected, 'an exact approved invoice must be found')
assert.equal(selected.name, 'Invoice-PEF-1042-approved.pdf', 'only the latest exact approved invoice is selected')
assert.equal(Buffer.from(selected.base64, 'base64').toString(), 'approved replacement', 'the existing stored PDF bytes are reused')

for (const rejected of [wrongCustomer, wrongInvoice, wrongAmount, genericNotice]) {
  assert.equal(storedInvoicePdf([rejected], invoice), null, `${rejected.customer_name} must never be attached`)
}

const source = await readFile(new URL('../api/cron-whatsapp-reminders.js', import.meta.url), 'utf8')
assert.doesNotMatch(source, /pdf-lib|generateCanonicalInvoice|Payment Due Notice/, 'reminders must not generate a separate PDF')
assert.match(source, /attachments,/, 'the selected stored invoice must be passed as the sole attachment collection')
assert.match(source, /\[\{ filename: pdf\.name, content: pdf\.base64 \}\]/, 'exactly one existing invoice PDF must be attached')

console.log('Payment reminder checks passed: day 14, day 21, exact stored invoice, amount match, and no generated notice PDF.')
