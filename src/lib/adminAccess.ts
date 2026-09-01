import type { PermissionSet } from '../types/index.js'

/** Permission flags that grant meaningful control over other accounts or
    the wider application, not just visibility into one operational module.
    Granting any of these (or an elevated role) to a new/edited admin is
    treated as a genuinely sensitive action requiring password
    re-verification; a routine, low-privilege staff invite is not. Shared
    between the client (AdminsPage.tsx) and the server
    (server/admin-actions/invite-admin.js, via server-dist) so both sides of
    the check agree on what counts as "sensitive". */
const ELEVATED_PERMISSION_KEYS: (keyof PermissionSet)[] = ['usersManage', 'applicationsManage', 'admins']

export function isSensitiveAdminGrant(role: string, permissions: Partial<PermissionSet> | null | undefined): boolean {
  if (role === 'System Developer' || role === 'Owner') return true
  return ELEVATED_PERMISSION_KEYS.some(key => Boolean(permissions?.[key]))
}
