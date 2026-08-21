import { readFile } from 'node:fs/promises'
import { resolve, relative } from 'node:path'

const project = process.env.SUPABASE_PROJECT_REF
const token = process.env.SUPABASE_ACCESS_TOKEN
const files = process.argv.slice(2)
if (!project || !token || !files.length) {
  throw new Error('Usage: SUPABASE_PROJECT_REF=... SUPABASE_ACCESS_TOKEN=... node scripts/apply-live-migrations.mjs sql/migrations/file.sql [...]')
}

const migrationRoot = resolve('sql/migrations')
for (const file of files) {
  const absolute = resolve(file)
  if (relative(migrationRoot, absolute).startsWith('..')) throw new Error(`Refusing file outside sql/migrations: ${file}`)
  const sql = await readFile(absolute, 'utf8')
  const response = await fetch(`https://api.supabase.com/v1/projects/${project}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: `begin;\n${sql}\ncommit;` }),
  })
  if (!response.ok) throw new Error(`${file} failed (${response.status}): ${await response.text()}`)
  console.log(`Applied ${file}`)
}
