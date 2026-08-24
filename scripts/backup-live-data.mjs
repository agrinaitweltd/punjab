import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import PizZip from 'pizzip'

const project = process.env.SUPABASE_PROJECT_REF
const token = process.env.SUPABASE_ACCESS_TOKEN
if (!project || !token) throw new Error('Set SUPABASE_PROJECT_REF and SUPABASE_ACCESS_TOKEN first.')

const management = `https://api.supabase.com/v1/projects/${project}`
async function managementRequest(route, init = {}) {
  const response = await fetch(`${management}${route}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...init.headers },
  })
  if (!response.ok) throw new Error(`${route}: ${response.status} ${await response.text()}`)
  return response.json()
}

const keys = await managementRequest('/api-keys?reveal=true')
const serviceKey = keys.find(key => ['service_role', 'secret'].includes(key.name))?.api_key
if (!serviceKey) throw new Error('Could not retrieve the project service key.')
const supabase = createClient(`https://${project}.supabase.co`, serviceKey, { auth: { persistSession: false } })

const tableResult = await managementRequest('/database/query', {
  method: 'POST',
  body: JSON.stringify({ query: "select table_name from information_schema.tables where table_schema = 'public' and table_type = 'BASE TABLE' order by table_name" }),
})
const tables = tableResult.map(row => row.table_name)
const zip = new PizZip()
const manifest = { createdAt: new Date().toISOString(), project, tables: {}, storage: {} }

for (const table of tables) {
  const rows = []
  for (let from = 0; ; from += 1000) {
    const result = await supabase.from(table).select('*').range(from, from + 999)
    if (result.error) throw new Error(`${table}: ${result.error.message}`)
    rows.push(...(result.data || []))
    if (!result.data || result.data.length < 1000) break
  }
  manifest.tables[table] = rows.length
  zip.file(`database/${table}.json`, JSON.stringify(rows))
}

async function backupStorage(bucket, prefix = '') {
  const result = await supabase.storage.from(bucket).list(prefix, { limit: 1000, sortBy: { column: 'name', order: 'asc' } })
  if (result.error) throw new Error(`${bucket}/${prefix}: ${result.error.message}`)
  let count = 0
  for (const entry of result.data || []) {
    const objectPath = prefix ? `${prefix}/${entry.name}` : entry.name
    if (!entry.id) { count += await backupStorage(bucket, objectPath); continue }
    const downloaded = await supabase.storage.from(bucket).download(objectPath)
    if (downloaded.error) throw new Error(`${bucket}/${objectPath}: ${downloaded.error.message}`)
    zip.file(`storage/${bucket}/${objectPath}`, Buffer.from(await downloaded.data.arrayBuffer()), { binary: true })
    count += 1
  }
  return count
}

for (const bucket of ['customer-documents', 'test-documents']) {
  const bucketResult = await supabase.storage.getBucket(bucket)
  if (bucketResult.error) { manifest.storage[bucket] = { skipped: bucketResult.error.message }; continue }
  manifest.storage[bucket] = { objects: await backupStorage(bucket) }
}

zip.file('manifest.json', JSON.stringify(manifest, null, 2))
const archive = zip.generate({ type: 'nodebuffer', compression: 'DEFLATE', compressionOptions: { level: 6 } })
const backupDirectory = process.env.PUNJAB_BACKUP_DIR || path.join(os.homedir(), 'Punjab Backups')
fs.mkdirSync(backupDirectory, { recursive: true })
const fileName = `punjab-production-before-reset-${manifest.createdAt.replace(/[:.]/g, '-')}.zip`
const outputPath = path.join(backupDirectory, fileName)
fs.writeFileSync(outputPath, archive)
console.log(JSON.stringify({ outputPath, bytes: archive.length, sha256: createHash('sha256').update(archive).digest('hex'), manifest }))
