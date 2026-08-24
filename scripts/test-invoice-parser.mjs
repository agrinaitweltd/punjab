import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import ts from 'typescript'
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs'

const sourcePath = new URL('../src/lib/invoiceImport.ts', import.meta.url)
const source = fs.readFileSync(sourcePath, 'utf8').replace(
  "import { extractDocumentLines } from './statementImport'",
  'declare function extractDocumentLines(file: File, onProgress?: (message: string) => void): Promise<string[]>',
)
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText
const parser = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`)

const synthetic = parser.parseLegacyInvoiceLines([
  'Delivery Acc     Invoice Acc     Salesman     Date/Tax Pt     Num',
  '0/0              1044             2815            17           21/08/2026        828310       1/1',
])
assert.equal(synthetic.customer.accountNumber, '828310')
assert.equal(synthetic.invoice.invoiceAccount, '2815')
assert.equal(synthetic.invoice.invoiceNumber, '2815')
assert.equal(synthetic.invoice.deliveryAccount, '1044')

const explicitInvoiceAccount = parser.parseLegacyInvoiceLines([
  'Invoice Acc: 2815',
  'Delivery Acc     Invoice Acc     Salesman     Date/Tax Pt     Num',
  '0/0              1044                             17           21/08/2026        828310       1/1',
])
assert.equal(explicitInvoiceAccount.invoice.invoiceNumber, '2815')

const multiLineInvoice = parser.parseLegacyInvoiceLines([
  'CBD SUPPLY CHAIN UK CO LTD',
  '1 Market Road',
  'London E1 1AA',
  'Delivery Acc     Invoice Acc     Salesman     Date/Tax Pt     Num',
  '0/0              INV-9001        17           21/08/2026      828310',
  'Line Qty Product Variety Size Price Goods Value VC',
  '1 2 BANANA FYFFES 18KG 16.50 33.00 0',
  '2 5 APPLE GALA 12KG 8.00 40.00 1',
  '3 3 PEAR CONFERENCE 10KG 9.00 27.00 1',
  '4 1 MANGO KENT 4KG 15.00 15.00 0',
  '5 2 RED SEEDLESS GRAPE PUNNET 6.00 12.00 1',
  '6 1 ONION 10KG 5.00 5.00',
  'PACKAGES 13',
  'Total Goods: 127.00',
  'VC %Rate Goods V.A.T',
  '1 20 79.00 15.80',
  'Total V.A.T: 15.80',
  'Grand Total: 142.80',
])
assert.equal(multiLineInvoice.items.length, 6)
assert.deepEqual(multiLineInvoice.items.map(item => item.line), ['1', '2', '3', '4', '5', '6'])
assert.equal(multiLineInvoice.items[1].vatRate, 20)
assert.equal(multiLineInvoice.items[1].vatAmount, 8)
assert.equal(multiLineInvoice.items[5].product, 'ONION')
assert.equal(multiLineInvoice.items[5].variety, '')
assert.equal(multiLineInvoice.items[5].size, '10KG')
assert.equal(multiLineInvoice.items[5].vatCode, '')
assert.equal(multiLineInvoice.invoice.totalGoods, 127)
assert.equal(multiLineInvoice.invoice.grandTotal, 142.8)

const multiLineCredit = parser.parseCreditNoteLines([
  'CREDIT NOTE',
  'Credit Note No: CN-2026-44',
  'Original Invoice: INV-9001',
  'CBD SUPPLY CHAIN UK CO LTD',
  '1 Market Road',
  'London E1 1AA',
  'Delivery Acc     Invoice Acc     Salesman     Date/Tax Pt     Num',
  '0/0              INV-9001        17           22/08/2026      828310',
  'Line Qty Product Variety Size Price Goods Value VC',
  '1 -1 BANANA FYFFES 18KG 16.50 -16.50 0',
  '2 2 APPLE GALA 12KG -8.00 -16.00 1',
  '3 1 MANGO KENT 4KG -15.00 -15.00 0',
  'PACKAGES 4',
  'Total Credit Goods: -47.50',
  'VC %Rate Goods V.A.T',
  '1 20 -16.00 -3.20',
  'Total Credit VAT: -3.20',
  'Credit Total: -50.70',
])
assert.equal(parser.detectImportDocumentType(multiLineCredit.debug.rawLines), 'credit_note')
assert.equal(multiLineCredit.creditNote.creditNumber, 'CN-2026-44')
assert.equal(multiLineCredit.creditNote.originalInvoiceReference, 'INV-9001')
assert.equal(multiLineCredit.items.length, 3)
assert.equal(multiLineCredit.items[0].quantity, -1)
assert.equal(multiLineCredit.items[0].goodsValue, -16.5)
assert.equal(multiLineCredit.creditNote.grandTotal, -50.7)
assert.equal(multiLineCredit.items[1].vatAmount, -3.2)

async function pdfLines(filePath) {
  const document = await pdfjs.getDocument({ data: new Uint8Array(fs.readFileSync(filePath)) }).promise
  const lines = []
  for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
    const page = await document.getPage(pageNumber)
    const content = await page.getTextContent()
    const rows = new Map()
    for (const item of content.items) {
      if (!('str' in item) || !item.str.trim()) continue
      const y = Math.round(item.transform[5] / 3) * 3
      if (!rows.has(y)) rows.set(y, [])
      rows.get(y).push({ x: item.transform[4], str: item.str })
    }
    for (const [, fragments] of [...rows.entries()].sort((a, b) => b[0] - a[0])) {
      fragments.sort((a, b) => a.x - b.x)
      const minX = fragments[0]?.x ?? 0
      let rendered = ''
      for (const fragment of fragments) {
        const target = Math.max(0, Math.round((fragment.x - minX) / 4.8))
        if (target > rendered.length) rendered += ' '.repeat(target - rendered.length)
        if (rendered && !rendered.endsWith(' ') && target <= rendered.length) rendered += ' '
        rendered += fragment.str
      }
      lines.push(rendered)
    }
  }
  return lines
}

const realInvoicePath = path.resolve('invoiceadd.pdf')
if (fs.existsSync(realInvoicePath)) {
  const actual = parser.parseLegacyInvoiceLines(await pdfLines(realInvoicePath))
  assert.equal(actual.customer.accountNumber, '828310')
  assert.equal(actual.invoice.invoiceNumber, '2815')
  assert.equal(actual.invoice.invoiceAccount, '2815')
}

const suppliedCreditNotePath = path.resolve('creditnote.pdf')
if (fs.existsSync(suppliedCreditNotePath)) {
  const lines = await pdfLines(suppliedCreditNotePath)
  const actual = parser.detectImportDocumentType(lines) === 'credit_note'
    ? parser.parseCreditNoteLines(lines)
    : parser.parseLegacyInvoiceLines(lines)
  // The supplied file is named creditnote.pdf but its printed heading says
  // INVOICE / CUSTOMER COPY, so it must not create an accounting credit.
  assert.equal(actual.documentType, 'invoice')
  assert.equal(actual.customer.accountNumber, '828310')
  assert.ok(actual.items.length >= 1)
}

const suppliedMultiLinePath = ['multiperfields.pdf', 'tkt-828012.pdf'].map(name => path.resolve(name)).find(fs.existsSync)
if (suppliedMultiLinePath) {
  const actual = parser.parseLegacyInvoiceLines(await pdfLines(suppliedMultiLinePath))
  assert.equal(actual.documentType, 'invoice')
  assert.equal(actual.items.length, 5)
  assert.deepEqual(actual.items.map(item => item.line), ['262771', '262393', '262763', '262597', '262156'])
  assert.deepEqual(actual.items.map(item => item.quantity), [-2, -1, 10, -3, 3])
  assert.deepEqual(actual.items.map(item => item.goodsValue), [-16, -8.5, 110, -33, 34.5])
  assert.equal(actual.invoice.totalGoods, 87)
  assert.equal(actual.invoice.grandTotal, 87)
}

console.log('Invoice and credit-note parser tests passed')
