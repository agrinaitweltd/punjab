import { supabase } from './supabase'
import type { PermissionSet } from '../types'

async function accessToken() {
  const { data } = await supabase?.auth.getSession() ?? { data: { session: null } }
  if (!data.session?.access_token) throw new Error('Your session has expired. Please sign in again.')
  return data.session.access_token
}

async function api<T>(path: string, init: RequestInit = {}, sensitiveToken?: string): Promise<T> {
  const token = await accessToken()
  const response = await fetch(path, { ...init, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...(sensitiveToken ? { 'X-Sensitive-Action-Token': sensitiveToken } : {}), ...init.headers } })
  const body = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(body.error || 'The request could not be completed.')
  return body as T
}

export async function verifySensitiveAction(password: string) {
  return api<{ token: string; expiresIn: number }>('/api/verify-sensitive-action', { method: 'POST', body: JSON.stringify({ password }) })
}

export type AdminInvitationInput = { name: string; email: string; role: string; jobTitle: string; permissions: PermissionSet; isSalesman: boolean; salesmanIds: string[] }
export async function inviteAdmin(input: AdminInvitationInput, sensitiveToken: string) {
  return api<{ ok: true }>('/api/invite-admin', { method: 'POST', body: JSON.stringify(input) }, sensitiveToken)
}

export async function manageAdmin(input: Record<string, unknown>, sensitiveToken: string) {
  return api<{ ok: true }>('/api/manage-admin', { method: 'POST', body: JSON.stringify(input) }, sensitiveToken)
}

export async function getSystemOverview() { return api<SystemOverview>('/api/system-overview') }
export async function getSystemMode() { return api<{ testMode: boolean; changedAt: string | null }>('/api/system-mode') }

export type SystemOverview = {
  health: Record<string, string>
  counts: { customers: number; admins: number; salesUsers: number; systemDevelopers: number; disabled: number }
  users: Array<{ id: string; name: string; email: string; role: string; active: boolean; createdAt: string; lastLoginAt: string | null; invitationStatus: string | null }>
  logins: Array<{ id: string; email: string | null; role: string; login_at: string; success: boolean; failure_code: string | null }>
  audit: Array<{ id: string; action: string; target_type: string | null; target_id: string | null; metadata: Record<string, unknown>; created_at: string }>
  backups: Array<{ id: string; provider: string; backup_type: string; status: string; size_bytes: number | null; requested_at: string; completed_at: string | null }>
  testMode: boolean; testModeChangedAt: string | null; testIsolationReady: boolean; managedBackupsAvailable: boolean
}
