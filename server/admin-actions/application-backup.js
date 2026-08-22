import { createHash } from 'node:crypto'
import PizZip from 'pizzip'
import { guardApi, safeError } from '../security.js'
import { requireSensitiveStaff, writeSystemAudit } from '../sensitive-actions.js'

const BACKUP_TABLES = [
  'activity_log', 'admin_roles', 'admin_staff', 'application_settings', 'assigned_tasks', 'buying_prices', 'buying_sessions',
  'communication_logs', 'credit_note_allocations', 'credit_notes', 'customer_applications',
  'customer_sub_accounts', 'customers', 'day_trades', 'delivery_areas', 'expenses', 'finance_settings',
  'generated_documents', 'invoice_items', 'invoices', 'notification_logs', 'orders', 'payments',
  'portal_invitations', 'products', 'salesmen', 'stock_items', 'suppliers', 'support_tickets',
  'system_audit_log', 'system_settings', 'user_login_audit', 'whatsapp_logs', 'whatsapp_templates',
]

const sensitiveField = key => /(^|_)(password|token|secret|api_key|service_role|private_key)($|_)/i.test(key)
const safeSegment = value => [...String(value || 'file')].map(character => character.charCodeAt(0) < 32 || '\\/:*?"<>|'.includes(character) ? '_' : character).join('').replace(/\.\.+/g, '.').trim().slice(0, 160) || 'file'
const checksum = bytes => createHash('sha256').update(bytes).digest('hex')

async function allRows(admin, table) {
  const rows = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await admin.from(table).select('*').range(from, from + 999)
    if (error) throw error
    rows.push(...(data || []))
    if (!data || data.length < 1000) return rows
  }
}

function sanitizedRow(row) { return Object.fromEntries(Object.entries(row).filter(([key]) => !sensitiveField(key))) }
function csvValue(value) {
  if (value === null || value === undefined) return ''
  const text = typeof value === 'object' ? JSON.stringify(value) : String(value)
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text
}
function rowsToCsv(rows) {
  if (!rows.length) return 'id\r\n'
  const columns = [...new Set(rows.flatMap(row => Object.keys(row)).filter(key => !sensitiveField(key)))]
  return [columns.join(','), ...rows.map(row => columns.map(column => csvValue(row[column])).join(','))].join('\r\n') + '\r\n'
}
function documentFolder(metadata, fileName) {
  const searchable = `${metadata.note || ''} ${fileName}`.toLowerCase()
  if (metadata.documentRole === 'canonical_invoice') return 'invoices/generated'
  if (metadata.documentRole === 'legacy_source') return 'invoices/source-archives'
  if (/statement/.test(searchable)) return 'statements'
  if (/deliver/.test(searchable)) return 'delivery-documents'
  return 'customer-files'
}
function extractEmbeddedFiles(zip, activityRows) {
  const files = []
  const exportRows = activityRows.map(row => {
    if (!String(row.customer_name || '').startsWith('FILE:') || !String(row.action || '').startsWith('data:')) return sanitizedRow(row)
    let metadata = {}
    try { metadata = JSON.parse(row.timestamp || '{}') } catch { /* legacy metadata remains in CSV */ }
    const separator = row.action.indexOf(',')
    const header = row.action.slice(0, separator)
    if (separator < 0 || !/;base64$/i.test(header)) return sanitizedRow(row)
    const bytes = Buffer.from(row.action.slice(separator + 1), 'base64')
    const originalName = safeSegment(String(row.customer_name).slice(5))
    const path = `${documentFolder(metadata, originalName)}/${safeSegment(metadata.customerId || 'unassigned')}/${safeSegment(row.id)}-${originalName}`
    zip.file(path, bytes, { binary: true })
    files.push({ path, source: 'activity_log', recordId: row.id, customerId: metadata.customerId || null, invoiceId: metadata.invoiceId || null, invoiceNumber: metadata.invoiceNumber || null, documentRole: metadata.documentRole || 'general', originalName, contentType: metadata.type || header.slice(5).replace(/;base64$/i, ''), size: bytes.length, checksumSha256: checksum(bytes) })
    return { ...sanitizedRow(row), action: `[FILE_EXTRACTED:${path}]` }
  })
  return { files, exportRows }
}

export const backupInternals = { extractEmbeddedFiles, rowsToCsv, sanitizedRow }

async function storageObjects(admin, bucket, prefix = '') {
  const result = []
  const { data, error } = await admin.storage.from(bucket).list(prefix, { limit: 1000, sortBy: { column: 'name', order: 'asc' } })
  if (error) throw error
  for (const entry of data || []) {
    const path = prefix ? `${prefix}/${entry.name}` : entry.name
    if (!entry.id) { result.push(...await storageObjects(admin, bucket, path)); continue }
    const downloaded = await admin.storage.from(bucket).download(path)
    if (downloaded.error) throw downloaded.error
    result.push({ path, bytes: Buffer.from(await downloaded.data.arrayBuffer()), contentType: entry.metadata?.mimetype || 'application/octet-stream' })
  }
  return result
}

export default async function handler(req, res) {
  if (!guardApi(req, res, { maxBytes: 4_096, limit: 3, windowMs: 60 * 60_000 })) return
  const context = await requireSensitiveStaff(req, res, { systemDeveloperOnly: true })
  if (!context) return
  const { admin, user, staff } = context
  let backupId = null
  try {
    const created = await admin.from('system_backups').insert({ provider: 'Application Export', backup_type: 'Full Application Backup (ZIP)', status: 'Preparing', requested_by: user.id, created_by_email: user.email || staff.email, database_export_status: 'Preparing', storage_export_status: 'Preparing' }).select('id').single()
    if (created.error) throw created.error
    backupId = created.data.id
    const running = await admin.from('system_backups').update({ status: 'Running', database_export_status: 'Running', storage_export_status: 'Running' }).eq('id', backupId)
    if (running.error) throw running.error

    const tables = {}
    let rowCount = 0
    for (const table of BACKUP_TABLES) { tables[table] = await allRows(admin, table); rowCount += tables[table].length }
    const zip = new PizZip()
    const embedded = extractEmbeddedFiles(zip, tables.activity_log || [])
    const tableCounts = {}
    for (const table of BACKUP_TABLES) {
      const rows = table === 'activity_log' ? embedded.exportRows : tables[table].map(sanitizedRow)
      tableCounts[table] = rows.length
      zip.file(`database/${table.replaceAll('_', '-')}.csv`, rowsToCsv(rows))
    }

    let storageStatus = 'Completed', storageError = null, storedFiles = []
    try {
      storedFiles = await storageObjects(admin, 'customer-documents')
      for (const file of storedFiles) zip.file(`customer-files/supabase-storage/${safeSegment(file.path)}`, file.bytes, { binary: true })
    } catch (error) { storageStatus = 'Failed'; storageError = error instanceof Error ? error.message.slice(0, 180) : 'Storage export failed' }

    const createdAt = new Date().toISOString()
    const storageManifest = storedFiles.map(file => ({ path: `customer-files/supabase-storage/${safeSegment(file.path)}`, source: 'customer-documents', originalPath: file.path, contentType: file.contentType, size: file.bytes.length, checksumSha256: checksum(file.bytes) }))
    const manifest = {
      backupFormat: 'Punjab Exotic Foods portable ZIP', manifestVersion: 2, createdAt, environment: 'production', applicationVersion: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 12) || 'local', schemaVersion: 10,
      database: { status: 'Completed', tableCount: BACKUP_TABLES.length, rowCount, tableCounts },
      files: { status: storageStatus, count: embedded.files.length + storageManifest.length, embedded: embedded.files, storage: storageManifest, error: storageError },
      security: { credentialsIncluded: false, note: 'Password, token, secret and API-key fields are intentionally omitted.' },
    }
    zip.file('backup-manifest.json', JSON.stringify(manifest, null, 2))
    zip.file('README.txt', 'Punjab Exotic Foods full application backup\r\n\r\nDatabase tables are CSV files under database/. Documents are extracted into their relevant folders. backup-manifest.json links files to source records. Credentials and API keys are not included.\r\n')
    const archive = zip.generate({ type: 'nodebuffer', compression: 'DEFLATE', compressionOptions: { level: 6 } })
    const archiveChecksum = checksum(archive)
    const filePath = `${createdAt.slice(0, 10)}/Punjab-Exotic-Foods-Backup-${createdAt.replace(/[:.]/g, '-')}-${backupId}.zip`
    const uploaded = await admin.storage.from('system-backups').upload(filePath, archive, { contentType: 'application/zip', upsert: false })
    if (uploaded.error) throw uploaded.error
    const finalStatus = storageStatus === 'Completed' ? 'Completed' : 'Partial'
    const completed = await admin.from('system_backups').update({ status: finalStatus, size_bytes: archive.length, completed_at: new Date().toISOString(), database_export_status: 'Completed', storage_export_status: storageStatus, file_path: filePath, checksum_sha256: archiveChecksum, table_count: BACKUP_TABLES.length, row_count: rowCount, metadata: { archiveFormat: 'zip', manifestVersion: 2, fileCount: manifest.files.count, embeddedFileCount: embedded.files.length, storageObjectCount: storedFiles.length, tableCounts, storageError } }).eq('id', backupId)
    if (completed.error) throw completed.error
    await writeSystemAudit(admin, user.id, 'application_backup_created', 'system_backups', backupId, { status: finalStatus, archiveFormat: 'zip', sizeBytes: archive.length, tableCount: BACKUP_TABLES.length, rowCount, fileCount: manifest.files.count })
    return res.status(200).json({ ok: true, id: backupId, status: finalStatus, sizeBytes: archive.length, tableCount: BACKUP_TABLES.length, rowCount, fileCount: manifest.files.count, storageObjectCount: storedFiles.length })
  } catch (error) {
    if (backupId) await admin.from('system_backups').update({ status: 'Failed', completed_at: new Date().toISOString(), error_code: 'APPLICATION_BACKUP_FAILED' }).eq('id', backupId)
    console.error('application-backup failed', error instanceof Error ? error.message : 'Unknown error')
    return res.status(500).json({ error: safeError })
  }
}
