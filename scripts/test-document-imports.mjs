import assert from 'node:assert/strict'
import fs from 'node:fs'
import ts from 'typescript'

function loadModule(file, replacements = []) {
  let source = fs.readFileSync(new URL(file, import.meta.url), 'utf8')
  for (const [pattern, replacement] of replacements) source = source.replace(pattern, replacement)
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText
  return import(`data:text/javascript;base64,${Buffer.from(output).toString('base64')}`)
}

const matching = await loadModule('../src/lib/importMatching.ts', [
  ["import type { Customer, CreditNote, Invoice } from '../types'", ''],
])

const customers = [
  { id: 'customer-a', customerNumber: '828310', companyName: 'CBD Supply Chain UK Co. Ltd' },
  { id: 'customer-b', customerNumber: '990011', companyName: 'Punjab Retail Limited' },
]
assert.equal(matching.matchImportedCustomer(customers, { accountNumber: '828 310', companyName: 'DIFFERENT NAME' }).id, 'customer-a')
assert.equal(matching.matchImportedCustomer(customers, { companyName: 'CBD SUPPLY CHAIN UK CO LTD' }).id, 'customer-a')
assert.equal(matching.matchImportedCustomer(customers, { existingCustomerId: 'customer-b' }).id, 'customer-b')

const invoices = [{ id: 'invoice-a', customerId: 'customer-a', invoiceNumber: 'INV-1', date: '2026-08-21' }]
assert.equal(matching.findDuplicateInvoice(invoices, { customerId: 'customer-a', invoiceNumber: ' inv-1 ', date: '2026-08-21' }).id, 'invoice-a')
assert.equal(matching.findDuplicateInvoice(invoices, { customerId: 'customer-b', invoiceNumber: 'INV-1', date: '2026-08-21' }), undefined)

const credits = [{ id: 'credit-a', customerId: 'customer-a', creditNumber: 'CN-1', date: '2026-08-22' }]
assert.equal(matching.findDuplicateCreditNote(credits, { customerId: 'customer-a', creditNumber: 'cn-1', date: '2026-08-22' }).id, 'credit-a')

const migration = fs.readFileSync(new URL('../sql/migrations/013_admin_imports_and_credit_note_documents.sql', import.meta.url), 'utf8')
assert.match(migration, /from public\.admin_staff staff[\s\S]*staff\.auth_user_id = \(select auth\.uid\(\)\)[\s\S]*staff\.active/i)
assert.doesNotMatch(migration, /info@kavotech|oliver/i)
assert.match(migration, /credit_note_items_admin_all[\s\S]*public\.is_admin\(\)/i)
assert.match(migration, /credit_notes_import_identity_uidx/i)

const login = fs.readFileSync(new URL('../api/login.js', import.meta.url), 'utf8')
assert.match(login, /updateUserById\(authUser\.id,[\s\S]*app_metadata/i)
assert.doesNotMatch(login, /info@kavotech|oliver/i)

console.log('Document import matching, duplicate, and multi-admin authorization tests passed')
