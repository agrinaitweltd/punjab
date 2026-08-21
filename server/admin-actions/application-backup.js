import { createHash } from 'node:crypto'
import { gzipSync } from 'node:zlib'
import { guardApi, safeError } from '../security.js'
import { requireSensitiveStaff, writeSystemAudit } from '../sensitive-actions.js'

const BACKUP_TABLES = [
  'activity_log', 'admin_roles', 'admin_staff', 'assigned_tasks', 'buying_prices',
  'buying_sessions', 'communication_logs', 'credit_note_allocations', 'credit_notes',
  'customer_applications', 'customer_sub_accounts', 'customers', 'day_trades',
  'delivery_areas', 'expenses', 'finance_settings', 'generated_documents',
  'invoice_items', 'invoices', 'notification_logs', 'orders', 'payments',
  'portal_invitations', 'products', 'salesmen', 'stock_items', 'suppliers',
  'support_tickets', 'system_audit_log', 'system_settings', 'user_login_audit',
  'whatsapp_logs', 'whatsapp_templates',
]

async function allRows(admin, table) {
  const rows = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await admin.from(table).select('*').range(from, from + 999)
    if (error) throw error
    rows.push(...(data || []))
    if (!data || data.length < 1000) return rows
  }
}

async function storageObjects(admin, bucket, prefix = '') {
  const result = []
  const { data, error } = await admin.storage.from(bucket).list(prefix, { limit: 1000, sortBy: { column: 'name', order: 'asc' } })
  if (error) throw error
  for (const entry of data || []) {
    const path = prefix ? `${prefix}/${entry.name}` : entry.name
    if (!entry.id) {
      result.push(...await storageObjects(admin, bucket, path))
      continue
    }
    const downloaded = await admin.storage.from(bucket).download(path)
    if (downloaded.error) throw downloaded.error
    const bytes = Buffer.from(await downloaded.data.arrayBuffer())
    result.push({ path, size: bytes.length, contentType: entry.metadata?.mimetype || 'application/octet-stream', base64: bytes.toString('base64') })
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
    const created = await admin.from('system_backups').insert({
      provider: 'Application Export', backup_type: 'Full Application Backup', status: 'Preparing',
      requested_by: user.id, created_by_email: user.email || staff.email,
      database_export_status: 'Preparing', storage_export_status: 'Preparing',
    }).select('id').single()
    if (created.error) throw created.error
    backupId = created.data.id
    const running = await admin.from('system_backups').update({ status: 'Running', database_export_status: 'Running', storage_export_status: 'Running' }).eq('id', backupId)
    if (running.error) throw running.error

    const tables = {}
    let rowCount = 0
    for (const table of BACKUP_TABLES) {
      const rows = await allRows(admin, table)
      tables[table] = rows
      rowCount += rows.length
    }

    let storedFiles = []
    let storageStatus = 'Completed'
    let storageError = null
    try {
      storedFiles = await storageObjects(admin, 'customer-documents')
    } catch (error) {
      storageStatus = 'Failed'
      storageError = error instanceof Error ? error.message.slice(0, 180) : 'Storage export failed'
    }

    const createdAt = new Date().toISOString()
    const archive = {
      manifestVersion: 1, createdAt, environment: 'production', projectRef: process.env.SUPABASE_PROJECT_REF || null,
      database: { status: 'Completed', tableCount: BACKUP_TABLES.length, rowCount, tables },
      storage: { status: storageStatus, bucket: 'customer-documents', objectCount: storedFiles.length, objects: storedFiles, error: storageError },
    }
    const compressed = gzipSync(Buffer.from(JSON.stringify(archive)), { level: 9 })
    const checksum = createHash('sha256').update(compressed).digest('hex')
    const safeDate = createdAt.replace(/[:.]/g, '-')
    const filePath = `${createdAt.slice(0, 10)}/punjab-full-backup-${safeDate}-${backupId}.json.gz`
    const uploaded = await admin.storage.from('system-backups').upload(filePath, compressed, { contentType: 'application/gzip', upsert: false })
    if (uploaded.error) throw uploaded.error
    const finalStatus = storageStatus === 'Completed' ? 'Completed' : 'Partial'
    const completed = await admin.from('system_backups').update({
      status: finalStatus, size_bytes: compressed.length, completed_at: new Date().toISOString(),
      database_export_status: 'Completed', storage_export_status: storageStatus,
      file_path: filePath, checksum_sha256: checksum, table_count: BACKUP_TABLES.length, row_count: rowCount,
      metadata: { storageObjectCount: storedFiles.length, storageError },
    }).eq('id', backupId)
    if (completed.error) throw completed.error
    await writeSystemAudit(admin, user.id, 'application_backup_created', 'system_backups', backupId, { status: finalStatus, sizeBytes: compressed.length, tableCount: BACKUP_TABLES.length, rowCount, storageObjectCount: storedFiles.length })
    return res.status(200).json({ ok: true, id: backupId, status: finalStatus, sizeBytes: compressed.length, tableCount: BACKUP_TABLES.length, rowCount, storageObjectCount: storedFiles.length })
  } catch (error) {
    if (backupId) await admin.from('system_backups').update({ status: 'Failed', completed_at: new Date().toISOString(), error_code: 'APPLICATION_BACKUP_FAILED' }).eq('id', backupId)
    console.error('application-backup failed', error instanceof Error ? error.message : 'Unknown error')
    return res.status(500).json({ error: safeError })
  }
}
