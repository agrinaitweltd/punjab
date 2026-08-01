// One-time, idempotent migration: hash any plaintext password still stored in
// admin_staff / customers / customer_sub_accounts. Safe to re-run — rows
// already holding a bcrypt hash (prefix "$2") are skipped untouched.
//
// Run with:  node --env-file=.env scripts/hash-passwords.mjs
//
// This does NOT change anyone's login credentials — the same password still
// works, it's just no longer stored (or readable via the REST API) in the
// clear. No rows are deleted; only the `password` column is updated in place.

import { createClient } from "@supabase/supabase-js"
import bcrypt from "bcryptjs"

const url = process.env.VITE_SUPABASE_URL
const key = process.env.VITE_SUPABASE_ANON_KEY
if (!url || !key) {
  console.error("Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY in environment.")
  process.exit(1)
}
const db = createClient(url, key)

const isHashed = (pw) => typeof pw === "string" && pw.startsWith("$2")

async function hashTable(table, idCol = "id") {
  const { data, error } = await db.from(table).select(`${idCol}, password`)
  if (error) {
    if (error.code === "PGRST205" || /Could not find the table/.test(error.message)) {
      console.log(`  (skipping ${table} — table doesn't exist in this project yet)`)
      return { table, hashed: 0, skipped: 0, failed: 0 }
    }
    console.error(`Failed to read ${table}:`, error.message)
    return { table, hashed: 0, skipped: 0, failed: 1 }
  }

  let hashed = 0, skipped = 0, failed = 0
  for (const row of data ?? []) {
    if (!row.password || isHashed(row.password)) { skipped++; continue }
    const hash = await bcrypt.hash(row.password, 10)
    const { error: updateError } = await db.from(table).update({ password: hash }).eq(idCol, row[idCol])
    if (updateError) { console.error(`  ✗ ${table}.${idCol}=${row[idCol]}:`, updateError.message); failed++ }
    else hashed++
  }
  return { table, hashed, skipped, failed }
}

const results = []
for (const [table, idCol] of [["admin_staff", "id"], ["customers", "id"], ["customer_sub_accounts", "id"]]) {
  results.push(await hashTable(table, idCol))
}

console.table(results)
const totalFailed = results.reduce((s, r) => s + r.failed, 0)
if (totalFailed > 0) {
  console.error(`\n${totalFailed} row(s) failed to hash — investigate before proceeding to auth migration.`)
  process.exit(1)
}
console.log("\nDone. Every password column is now a bcrypt hash (or already was).")
