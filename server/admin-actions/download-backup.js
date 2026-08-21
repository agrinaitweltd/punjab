import { guardApi, safeError } from '../security.js'
import { requireSensitiveStaff, writeSystemAudit } from '../sensitive-actions.js'

export default async function handler(req, res) {
  if (!guardApi(req, res, { maxBytes: 4_096, limit: 8, windowMs: 15 * 60_000 })) return
  const context = await requireSensitiveStaff(req, res, { systemDeveloperOnly: true })
  if (!context) return
  const id = String(req.body?.id || '')
  if (!/^[0-9a-f-]{36}$/i.test(id)) return res.status(400).json({ error: 'Select a valid backup.' })
  const { admin, user } = context
  try {
    const backup = await admin.from('system_backups').select('file_path,status').eq('id', id).single()
    if (backup.error || !backup.data?.file_path || !['Completed', 'Partial'].includes(backup.data.status)) return res.status(404).json({ error: 'Backup archive is not available.' })
    const file = await admin.storage.from('system-backups').download(backup.data.file_path)
    if (file.error) throw file.error
    const bytes = Buffer.from(await file.data.arrayBuffer())
    await writeSystemAudit(admin, user.id, 'application_backup_downloaded', 'system_backups', id, {})
    res.setHeader('Content-Type', 'application/gzip')
    res.setHeader('Content-Disposition', `attachment; filename="${backup.data.file_path.split('/').at(-1)}"`)
    res.setHeader('Cache-Control', 'no-store')
    return res.status(200).send(bytes)
  } catch (error) {
    console.error('download-backup failed', error instanceof Error ? error.message : 'Unknown error')
    return res.status(500).json({ error: safeError })
  }
}
