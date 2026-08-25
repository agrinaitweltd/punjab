import assert from 'node:assert/strict'
import fs from 'node:fs'
import ts from 'typescript'

function loadTypeScript(file, replacements) {
  let source = fs.readFileSync(new URL(file, import.meta.url), 'utf8')
  for (const [pattern, replacement] of replacements) source = source.replace(pattern, replacement)
  const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText
  return import(`data:text/javascript;base64,${Buffer.from(output).toString('base64')}`)
}

const accounting = await loadTypeScript('../src/lib/creditNotes.ts', [[/import type[^\n]+\n/, '']])
const matching = await loadTypeScript('../src/lib/importMatching.ts', [[/import type[^\n]+\n/, '']])
const invoice = { id: 'invoice-1', customerId: 'customer-1', invoiceNumber: 'INV-500', amount: 500, amountPaid: 0, dueDate: '2026-08-31', status: 'Unpaid' }

// A: invoice 500, credit 100 => 400.
assert.equal(accounting.invoiceOutstanding(accounting.attachCreditAllocations([invoice], [{ id: 'a', creditNoteId: 'c', invoiceId: invoice.id, amount: 100, date: '2026-08-25' }])[0]), 400)
// B: invoice 500, payment 200, credit 100 => 200, regardless of transaction order.
const paidInvoice = { ...invoice, amountPaid: 200 }
const withCredit = accounting.attachCreditAllocations([paidInvoice], [{ id: 'a', creditNoteId: 'c', invoiceId: invoice.id, amount: 100, date: '2026-08-25' }])[0]
assert.equal(accounting.invoiceOutstanding(withCredit), 200)
assert.equal(accounting.invoiceOutstanding({ ...invoice, creditApplied: 100, amountPaid: 200 }), 200)
// C: full credit closes the invoice without changing its original total.
const fullyCredited = accounting.attachCreditAllocations([invoice], [{ id: 'a', creditNoteId: 'c', invoiceId: invoice.id, amount: 500, date: '2026-08-25' }])[0]
assert.equal(fullyCredited.amount, 500)
assert.equal(fullyCredited.amountPaid, 0)
assert.equal(accounting.invoiceOutstanding(fullyCredited), 0)
assert.equal(accounting.invoiceDisplayStatus(fullyCredited), 'Fully Credited')
// D: only an exact customer + referenced invoice number is suggested.
assert.equal(matching.findCreditInvoiceMatch([invoice], 'customer-1', ' inv 500 ').id, invoice.id)
assert.equal(matching.findCreditInvoiceMatch([invoice], 'another-customer', 'INV-500'), undefined)
// E: an unallocated credit does not silently alter a random invoice.
assert.equal(accounting.invoiceOutstanding(accounting.attachCreditAllocations([invoice], [])[0]), 500)

const migration = fs.readFileSync(new URL('../sql/migrations/015_credit_note_accounting_workflow.sql', import.meta.url), 'utf8')
assert.match(migration, /Credit amount exceeds the invoice outstanding balance/)
assert.match(migration, /note_row\.customer_id is distinct from invoice_row\.customer_id/)
assert.match(migration, /for update/)
assert.match(migration, /credit_note_allocations_customer_select/)
const modal = fs.readFileSync(new URL('../src/pages/admin/CustomerCreditNoteModal.tsx', import.meta.url), 'utf8')
assert.match(modal, /Original invoice not found/)
assert.match(modal, /Save as Unallocated Credit/)
assert.match(modal, /Generated when saved/)

console.log('Credit-note accounting scenarios A-E passed')
