import { guardApi, safeError } from '../security.js'
import { requireSystemDeveloper } from '../sensitive-actions.js'

export default async function handler(req, res) {
  if (!guardApi(req, res, { methods: ['GET'], maxBytes: 2_048, limit: 30 })) return
  const context = await requireSystemDeveloper(req, res)
  if (!context) return
  const { admin } = context
  try {
    const [admins, customers, sales, logins, audit, backups, settings, authUsers] = await Promise.all([
      admin.from('admin_staff').select('id,name,email,role,active,created_at,auth_user_id,invitation_status,last_invited_at').order('name'),
      admin.from('customers').select('id,status', { count: 'exact', head: true }),
      admin.from('salesmen').select('id', { count: 'exact', head: true }),
      admin.from('user_login_audit').select('id,user_id,email,role,login_at,success,failure_code').order('login_at', { ascending: false }).limit(50),
      admin.from('system_audit_log').select('id,actor_user_id,action,target_type,target_id,metadata,created_at').order('created_at', { ascending: false }).limit(50),
      admin.from('system_backups').select('id,provider,backup_type,status,size_bytes,requested_at,completed_at,error_code,created_by_email,database_export_status,storage_export_status,table_count,row_count,checksum_sha256,file_path').order('requested_at', { ascending: false }).limit(20),
      admin.from('system_settings').select('test_mode,test_mode_changed_at').eq('id', true).maybeSingle(),
      admin.auth.admin.listUsers({ page: 1, perPage: 1000 }),
    ])
    const failure = [admins.error, customers.error, sales.error, logins.error, audit.error, backups.error, settings.error, authUsers.error].find(Boolean)
    if (failure) throw failure
    const authMap = new Map((authUsers.data?.users || []).map(user => [user.id, user]))
    const staffRows = (admins.data || []).map(row => {
      const authUser = row.auth_user_id ? authMap.get(row.auth_user_id) : null
      return { id: row.id, name: row.name, email: row.email, role: row.role, active: row.active, createdAt: row.created_at, lastLoginAt: authUser?.last_sign_in_at || null, invitationStatus: row.invitation_status, lastInvitedAt: row.last_invited_at }
    })
    const developers = staffRows.filter(row => row.role === 'System Developer').length
    const disabled = staffRows.filter(row => !row.active).length
    res.setHeader('Cache-Control', 'no-store')
    return res.status(200).json({
      health: { database: 'Operational', authentication: 'Operational', environment: process.env.VERCEL_ENV || process.env.NODE_ENV || 'unknown', email: process.env.RESEND_API_KEY ? 'Configured' : 'Not configured', whatsapp: process.env.ULTRAMSG_TOKEN ? 'Configured' : 'Not configured' },
      counts: { customers: customers.count || 0, admins: staffRows.length - developers, salesUsers: sales.count || 0, systemDevelopers: developers, disabled },
      users: staffRows, logins: logins.data || [], audit: audit.data || [], backups: backups.data || [],
      testMode: Boolean(settings.data?.test_mode), testModeChangedAt: settings.data?.test_mode_changed_at || null,
      testIsolationReady: true,
      managedBackupsAvailable: Boolean(process.env.SUPABASE_ACCESS_TOKEN && process.env.SUPABASE_PROJECT_REF),
    })
  } catch (error) {
    console.error('system-overview failed', error instanceof Error ? error.message : 'Unknown error')
    return res.status(500).json({ error: safeError })
  }
}
