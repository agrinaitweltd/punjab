// One-time, idempotent migration: create a real Supabase Auth user for every
// admin_staff / customers row that doesn't have one yet, and link it via the
// auth_user_id column added in sql/migrations/001_add_auth_user_id.sql.
//
// SAFE: only inserts new auth.users rows and sets auth_user_id on existing
// rows — never deletes, never overwrites an existing auth_user_id, never
// touches any other column. Re-running skips anything already linked.
//
// The bcrypt hash already stored in `password` cannot be reused as a Supabase
// Auth password (different hashing scheme), so each new auth user gets a
// random temporary password nobody knows, immediately paired with a one-time
// recovery link so the real owner can set their own password. Login keeps
// working via the legacy bcrypt path until they do — see authService.ts.
//
// Run with:  node --env-file=.env scripts/backfill-auth-users.mjs

import { createClient } from "@supabase/supabase-js"
import { randomBytes } from "node:crypto"

const url = process.env.VITE_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !serviceKey) {
  console.error("Missing VITE_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY in environment.")
  process.exit(1)
}
const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } })

async function backfill(table, role) {
  const { data: rows, error } = await admin.from(table).select("id, email, auth_user_id").is("auth_user_id", null)
  if (error) { console.error(`Failed to read ${table}:`, error.message); return [] }

  const results = []
  for (const row of rows ?? []) {
    if (!row.email) { console.warn(`  ! ${table}.id=${row.id} has no email — skipped, can't create an auth user.`); continue }

    const tempPassword = randomBytes(24).toString("base64url")
    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email: row.email,
      password: tempPassword,
      email_confirm: true,
      app_metadata: { role, legacy_id: row.id },
    })

    if (createError) {
      // Most likely cause: an auth user with this email already exists from
      // something else — link to it instead of failing, rather than erroring
      // out and leaving the row unlinked.
      if (/already been registered|already exists/i.test(createError.message)) {
        const { data: list } = await admin.auth.admin.listUsers()
        const existing = list?.users.find(u => u.email?.toLowerCase() === row.email.toLowerCase())
        if (existing) {
          await admin.from(table).update({ auth_user_id: existing.id }).eq("id", row.id)
          results.push({ table, id: row.id, email: row.email, auth_user_id: existing.id, note: "linked to pre-existing auth user" })
          continue
        }
      }
      console.error(`  ✗ ${table}.id=${row.id} (${row.email}):`, createError.message)
      continue
    }

    await admin.from(table).update({ auth_user_id: created.user.id }).eq("id", row.id)

    const { data: link, error: linkError } = await admin.auth.admin.generateLink({
      type: "recovery",
      email: row.email,
    })

    results.push({
      table, id: row.id, email: row.email, auth_user_id: created.user.id,
      recoveryLink: linkError ? `(couldn't generate: ${linkError.message})` : link.properties.action_link,
    })
  }
  return results
}

const adminResults = await backfill("admin_staff", "admin")
const customerResults = await backfill("customers", "customer")

console.log("\n=== admin_staff ===")
for (const r of adminResults) console.log(r)
console.log("\n=== customers ===")
for (const r of customerResults) console.log(r)
if (adminResults.length === 0 && customerResults.length === 0) console.log("\nNothing to do — every row already has an auth_user_id.")
