import assert from 'node:assert/strict'
import PizZip from 'pizzip'
process.env.NODE_ENV = 'test'
import generateDocx from '../api/generate-invoice-docx.js'

function response() {
  return {
    statusCode: 200, headers: {}, body: null,
    status(c) { this.statusCode = c; return this },
    setHeader(k, v) { this.headers[k] = v },
    json(v) { this.body = v; return this },
    send(v) { this.body = v; return this },
  }
}

const payload = {
  customer: { name: 'Multi Line Test Customer', accountNumber: '828012', address: '1 Market Road, London, E1 1AA', addressLine1: '1 Market Road', addressLine2: 'London', postcode: 'E1 1AA', phone: '', balance: 0 },
  invoice: { invoiceNumber: 'TEST-DOCX-1', date: '2026-08-25', packages: 5, totalGoods: 87, vatTotal: 0, grandTotal: 87 },
  items: [
    { line: '1', qty: -2, product: 'AUBERGINE', variety: 'DUTCH', size: '400+', price: 8, vatRate: 0 },
    { line: '2', qty: -1, product: 'CARROT', variety: 'CHINA', size: 'BOX 10KG', price: 8.5, vatRate: 0 },
    { line: '3', qty: 10, product: 'GARLIC', variety: 'CHINA', size: 'LOOSE 7KG', price: 11, vatRate: 0 },
    { line: '4', qty: -3, product: 'PEACH', variety: 'FLAT', size: 'PREPACK 10X1', price: 11, vatRate: 0 },
    { line: '5', qty: 3, product: 'PLUM', variety: 'YELLOW', size: '10x750', price: 11.5, vatRate: 0 },
  ],
}

const req = { method: 'POST', headers: {}, body: payload, testUser: { id: 'test-user', app_metadata: { role: 'admin' } } }
const res = response()
await generateDocx(req, res)
assert.equal(res.statusCode, 200)

// Regression guard: a naive lastIndexOf('<w:tr', ...) also matches sibling
// tags like <w:trPr>/<w:trHeight> that share the prefix, silently truncating
// the cloned row and leaving the OOXML unbalanced (extra </w:tr> per row) -
// which Word/ConvertAPI reject outright, so every real invoice silently fell
// back to the plain, non-letterhead PDF renderer.
const zip = new PizZip(res.body)
const xml = zip.file('word/document.xml').asText()
const opens = (xml.match(/<w:tr[ >]/g) || []).length
const closes = (xml.match(/<\/w:tr>/g) || []).length
assert.equal(opens, closes, `unbalanced <w:tr> tags: ${opens} open vs ${closes} close - the master template row was cloned incorrectly`)
assert.equal((xml.match(/AUBERGINE/g) || []).length, 1)
assert.equal((xml.match(/-2/g) || []).length >= 1, true)

console.log('Invoice DOCX generation (multi-line, negative qty) tests passed')
