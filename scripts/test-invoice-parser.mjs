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

console.log('Invoice parser tests passed')
