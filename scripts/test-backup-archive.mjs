import assert from 'node:assert/strict'
import PizZip from 'pizzip'
import { backupInternals } from '../server/admin-actions/application-backup.js'

const zip = new PizZip()
const activityRows = [{
  id: 'document-1',
  customer_name: 'FILE:invoice 100.pdf',
  action: `data:application/pdf;base64,${Buffer.from('%PDF-1.7 test invoice').toString('base64')}`,
  timestamp: JSON.stringify({ customerId: 'customer-1', invoiceId: 'invoice-1', invoiceNumber: '100', documentRole: 'canonical_invoice', type: 'application/pdf' }),
  api_token: 'must-not-leak',
}]

const { files, exportRows } = backupInternals.extractEmbeddedFiles(zip, activityRows)
assert.equal(files.length, 1)
assert.match(files[0].path, /^invoices\/generated\/customer-1\/document-1-invoice 100\.pdf$/)
assert.ok(zip.file(files[0].path))
assert.equal(exportRows[0].api_token, undefined)
assert.match(exportRows[0].action, /^\[FILE_EXTRACTED:/)

const csv = backupInternals.rowsToCsv([{ id: '1', name: 'Punjab, Foods', password_hash: 'must-not-leak', note: 'A "quoted" value' }])
assert.ok(!csv.includes('password'))
assert.ok(!csv.includes('must-not-leak'))
assert.match(csv, /"Punjab, Foods"/)
assert.match(csv, /"A ""quoted"" value"/)

zip.file('database/activity-log.csv', backupInternals.rowsToCsv(exportRows))
zip.file('backup-manifest.json', JSON.stringify({ manifestVersion: 2, files }))
const archive = zip.generate({ type: 'nodebuffer', compression: 'DEFLATE' })
assert.equal(archive.subarray(0, 2).toString(), 'PK')
const reopened = new PizZip(archive)
assert.ok(reopened.file('backup-manifest.json'))
assert.ok(reopened.file(files[0].path))

console.log('Portable ZIP backup tests passed')
