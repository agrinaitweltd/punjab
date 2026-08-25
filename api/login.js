import bcrypt from 'bcryptjs'
import { createHash, createHmac } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import { guardApi, safeError } from '../server/security.js'

const customerAuthEmail = id => `info+${String(id).replace(/[^a-zA-Z0-9]/g, '')}@punjabexoticfoods.co.uk`
const passwordMatches = (stored, attempt) =>
  String(stored || '').startsWith('$2') ? bcrypt.compare(attempt, stored) : String(stored || '') === attempt
const authBridgePassword = (role, id, password) => {
  const secret = process.env.SUPABASE_AUTH_BRIDGE_SECRET || process.env.SENSITIVE_ACTION_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY
  return `Pef1!${createHmac('sha256', String(secret || 'punjab-auth')).update(`${role}:${id}:${password}`).digest('base64url')}`
}

export default async function handler(req, res) {
  if (!guardApi(req, res, { maxBytes: 8_192, limit: 30, windowMs: 15 * 60_000 })) return

  const role = req.body?.role
  const identifier = String(req.body?.identifier || '').trim()
  const password = String(req.body?.password || '')
  const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(identifier)
  if (!['admin', 'customer'].includes(role) || !identifier || identifier.length > 254 || !password || password.length > 256) {
    return res.status(400).json({ error: 'Invalid login request' })
  }
  if (role === 'admin' && !isEmail) return res.status(400).json({ error: 'Invalid login request' })

  const url = process.env.VITE_SUPABASE_URL
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !anonKey || !serviceKey) return res.status(500).json({ error: 'Authentication is not configured' })

  const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } })
  const authClient = createClient(url, anonKey, { auth: { autoRefreshToken: false, persistSession: false } })

  try {
    let account = null
    let table = ''
    if (role === 'admin') {
      table = 'admin_staff'
      const { data, error } = await admin.from(table).select('id,email,password,active,auth_user_id').ilike('email', identifier).maybeSingle()
      if (error) throw error
      if (data?.active) account = data
    } else {
      table = 'customers'
      const byNumber = await admin.from(table).select('id,email,password,status,blocked,auth_user_id').eq('customer_number', identifier).maybeSingle()
      if (byNumber.error) throw byNumber.error
      account = byNumber.data
      if (!account && isEmail) {
        const byEmail = await admin.from(table).select('id,email,password,status,blocked,auth_user_id').ilike('email', identifier).maybeSingle()
        if (byEmail.error) throw byEmail.error
        account = byEmail.data
      }
      if (!account && isEmail) {
        table = 'customer_sub_accounts'
        const subAccount = await admin.from(table).select('id,email,password,status,active,auth_user_id,customer_id').ilike('email', identifier).maybeSingle()
        if (subAccount.error) throw subAccount.error
        if (subAccount.data?.active && subAccount.data.status === 'Approved') account = subAccount.data
      }
      if (account?.blocked || String(account?.status || '').toLowerCase() === 'inactive') account = null
    }

    const recordLogin = async (success, failureCode, userId) => {
      const ip = String(req.headers?.['x-forwarded-for'] || req.socket?.remoteAddress || '').split(',')[0].trim()
      await admin.from('user_login_audit').insert({
        user_id: userId || null, account_id: account?.id || null,
        email: isEmail ? identifier.toLowerCase() : null, role, success,
        failure_code: failureCode || null,
        ip_hash: ip ? createHash('sha256').update(`${process.env.SENSITIVE_ACTION_SECRET || 'audit'}:${ip}`).digest('hex') : null,
        user_agent_summary: String(req.headers?.['user-agent'] || '').slice(0, 180) || null,
      }).then(() => {}).catch(() => {})
    }

    if (!account) { await recordLogin(false, 'invalid_credentials'); return res.status(401).json({ error: 'Invalid credentials' }) }
    if (!(await passwordMatches(account.password, password))) {
      await recordLogin(false, 'invalid_credentials')
      return res.status(401).json({ error: 'Invalid credentials' })
    }

    const bridgePassword = authBridgePassword(role, account.id, password)

    let authUser = null
    if (account.auth_user_id) {
      const { data, error } = await admin.auth.admin.getUserById(account.auth_user_id)
      if (error) throw error
      authUser = data.user
    } else {
      const authEmail = role === 'admin' ? account.email : customerAuthEmail(account.id)
      const { data, error } = await admin.auth.admin.createUser({
        email: authEmail,
        password: bridgePassword,
        email_confirm: true,
        app_metadata: { role, legacy_id: account.id },
      })
      if (error) throw error
      authUser = data.user
      const linked = await admin.from(table).update({
        auth_user_id: authUser.id,
        password: await bcrypt.hash(password, 12),
      }).eq('id', account.id).is('auth_user_id', null)
      if (linked.error) throw linked.error
    }

    const expectedMetadata = { ...(authUser?.app_metadata || {}), role, legacy_id: account.id }
    if (authUser && (authUser.app_metadata?.role !== role || authUser.app_metadata?.legacy_id !== account.id)) {
      const { data, error } = await admin.auth.admin.updateUserById(authUser.id, { app_metadata: expectedMetadata })
      if (error) throw error
      authUser = data.user
    }

    if (!authUser?.email) throw new Error('Linked Auth user has no email address')
    let { data: signedIn, error: signInError } = await authClient.auth.signInWithPassword({ email: authUser.email, password: bridgePassword })
    if (signInError || !signedIn.session) {
      const synchronized = await admin.auth.admin.updateUserById(authUser.id, { password: bridgePassword })
      if (synchronized.error) throw synchronized.error
      ;({ data: signedIn, error: signInError } = await authClient.auth.signInWithPassword({ email: authUser.email, password: bridgePassword }))
    }
    if (signInError || !signedIn.session) { await recordLogin(false, 'invalid_credentials', authUser.id); return res.status(401).json({ error: 'Invalid credentials' }) }

    await recordLogin(true, null, authUser.id)

    res.setHeader('Cache-Control', 'no-store')
    return res.status(200).json({
      accessToken: signedIn.session.access_token,
      refreshToken: signedIn.session.refresh_token,
    })
  } catch (error) {
    console.error('login failed', error instanceof Error ? error.message : 'Unknown error')
    return res.status(500).json({ error: safeError })
  }
}
