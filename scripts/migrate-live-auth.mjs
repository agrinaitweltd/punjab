const project = process.env.SUPABASE_PROJECT_REF
const pat = process.env.SUPABASE_ACCESS_TOKEN
if (!project || !pat) throw new Error('Missing SUPABASE_PROJECT_REF or SUPABASE_ACCESS_TOKEN')

const management = `https://api.supabase.com/v1/projects/${project}`
const managementHeaders = { Authorization: `Bearer ${pat}`, 'Content-Type': 'application/json' }

async function query(sql) {
  const response = await fetch(`${management}/database/query`, {
    method: 'POST', headers: managementHeaders, body: JSON.stringify({ query: sql }),
  })
  if (!response.ok) throw new Error(`Database query failed (${response.status}): ${await response.text()}`)
  return response.json()
}

const keysResponse = await fetch(`${management}/api-keys?reveal=true`, { headers: { Authorization: `Bearer ${pat}` } })
if (!keysResponse.ok) throw new Error(`API key lookup failed (${keysResponse.status})`)
const serviceEntry = (await keysResponse.json()).find(key => key.name === 'service_role')
const serviceKey = serviceEntry?.api_key || serviceEntry?.key
if (!serviceKey) throw new Error('Service role key unavailable')
const authHeaders = { Authorization: `Bearer ${serviceKey}`, apikey: serviceKey, 'Content-Type': 'application/json' }

async function auth(path, method = 'GET', body) {
  const response = await fetch(`https://${project}.supabase.co/auth/v1/${path}`, {
    method, headers: authHeaders, ...(body ? { body: JSON.stringify(body) } : {}),
  })
  if (!response.ok) throw new Error(`Auth request failed (${response.status}): ${await response.text()}`)
  return response.json()
}

const sqlLiteral = value => `'${String(value).replaceAll("'", "''")}'`
const accounts = await query(`
  select 'admin_staff' source_table,id,email,password,'admin' auth_role from public.admin_staff where auth_user_id is null
  union all select 'customers',id,email,password,'customer' from public.customers where auth_user_id is null
  order by source_table,id
`)

let linked = 0
for (const account of accounts) {
  const authEmail = account.auth_role === 'customer'
    ? `info+${account.id.replace(/[^a-zA-Z0-9]/g, '')}@punjabexoticfoods.co.uk`
    : account.email
  const existing = await query(`select id::text from auth.users where lower(email)=lower(${sqlLiteral(authEmail)}) limit 1`)
  let userId = existing[0]?.id
  if (!userId) {
    const user = await auth('admin/users', 'POST', {
      email: authEmail, password: account.password, email_confirm: true,
      app_metadata: { role: account.auth_role, legacy_id: account.id },
    })
    userId = user.id
  }
  await query(`update public.${account.source_table} set auth_user_id=${sqlLiteral(userId)}::uuid where id=${sqlLiteral(account.id)} and auth_user_id is null`)
  linked += 1
}

const admins = await query('select id,auth_user_id::text from public.admin_staff where auth_user_id is not null')
for (const admin of admins) {
  await auth(`admin/users/${admin.auth_user_id}`, 'PUT', { app_metadata: { role: 'admin', legacy_id: admin.id } })
}

await query(`
  create extension if not exists pgcrypto;
  update public.admin_staff set password=crypt(password, gen_salt('bf',12)) where password not like '$2%';
  update public.customers set password=crypt(password, gen_salt('bf',12)) where password not like '$2%';
`)

const [verification] = await query(`
  select
    (select count(*) from public.admin_staff)::bigint admins,
    (select count(*) from public.admin_staff where auth_user_id is not null)::bigint admins_mapped,
    (select count(*) from public.customers)::bigint customers,
    (select count(*) from public.customers where auth_user_id is not null)::bigint customers_mapped,
    (select count(*) from public.admin_staff where password not like '$2%')::bigint admin_plaintext,
    (select count(*) from public.customers where password not like '$2%')::bigint customer_plaintext,
    (select count(*) from public.admin_staff where lower(email)='info@kavotech.uk' and active and is_super_admin)::bigint developer_ready
`)
console.log(JSON.stringify({ newly_linked: linked, ...verification }))
