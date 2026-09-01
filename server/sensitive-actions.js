import { createHmac, timingSafeEqual } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import { requireUser } from './security.js'

const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url')
const secret = () => process.env.SENSITIVE_ACTION_SECRET || ''
const signature = payload => createHmac('sha256', secret()).update(payload).digest('base64url')

export function issueSensitiveToken(user) {
  if (!secret()) throw new Error('Sensitive-action verification is not configured')
  const payload = encode({ sub: user.id, exp: Math.floor(Date.now() / 1000) + 600, purpose: 'sensitive-action' })
  return `${payload}.${signature(payload)}`
}

export function verifySensitiveToken(token, userId) {
  if (!secret() || !token) return false
  const [payload, supplied] = String(token).split('.')
  if (!payload || !supplied) return false
  const expected = signature(payload)
  if (supplied.length !== expected.length || !timingSafeEqual(Buffer.from(supplied), Buffer.from(expected))) return false
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'))
    return data.sub === userId && data.purpose === 'sensitive-action' && data.exp > Math.floor(Date.now() / 1000)
  } catch { return false }
}

export async function requireSensitiveStaff(req, res, { systemDeveloperOnly = false, requireToken = true } = {}) {
  const user = await requireUser(req, res, { adminOnly: true })
  if (!user) return null
  if (requireToken && !verifySensitiveToken(req.headers?.['x-sensitive-action-token'], user.id)) {
    res.status(401).json({ error: 'Please verify your password again to continue.' })
    return null
  }
  const url = process.env.VITE_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) { res.status(500).json({ error: 'Secure administration is not configured.' }); return null }
  const admin = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
  const { data: staff, error } = await admin.from('admin_staff').select('id,name,email,role,active,is_super_admin,permissions').eq('auth_user_id', user.id).maybeSingle()
  const canManage = staff?.active && (staff.is_super_admin || staff.permissions?.usersManage)
  if (error || !canManage || (systemDeveloperOnly && staff.role !== 'System Developer')) {
    res.status(403).json({ error: systemDeveloperOnly ? 'System Developer access required.' : 'User management access required.' })
    return null
  }
  return { user, staff, admin }
}

export async function requireSystemDeveloper(req, res) {
  const user = await requireUser(req, res, { adminOnly: true })
  if (!user) return null
  const url = process.env.VITE_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) { res.status(500).json({ error: 'System administration is not configured.' }); return null }
  const admin = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
  const { data: staff, error } = await admin.from('admin_staff').select('id,name,email,role,active').eq('auth_user_id', user.id).maybeSingle()
  if (error || !staff?.active || staff.role !== 'System Developer') { res.status(403).json({ error: 'System Developer access required.' }); return null }
  return { user, staff, admin }
}

export async function writeSystemAudit(admin, actorUserId, action, targetType, targetId, metadata = {}) {
  const safeMetadata = Object.fromEntries(Object.entries(metadata).filter(([key]) => !/password|token|secret|link/i.test(key)))
  await admin.from('system_audit_log').insert({ actor_user_id: actorUserId, action, target_type: targetType, target_id: targetId, metadata: safeMetadata })
}
