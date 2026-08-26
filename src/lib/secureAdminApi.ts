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
  if (body.simulated && body.message) window.dispatchEvent(new CustomEvent('test-mode-simulation', { detail: body.message }))
  return body as T
}

export async function verifySensitiveAction(password: string) {
  return api<{ token: string; expiresIn: number }>('/api/admin-security?action=verify-sensitive-action', { method: 'POST', body: JSON.stringify({ password }) })
}

export type ErrorReportInput = {
  code: number; title: string; message: string; technicalDetail: string
  feature?: string; context?: Record<string, unknown>; note?: string
}
export async function reportError(input: ErrorReportInput) {
  return api<{ ok: true }>('/api/admin-security?action=report-error', { method: 'POST', body: JSON.stringify(input) })
}

export type LoggedError = {
  id: string; error_code: number; title: string; message: string; severity: string
  user_email: string | null; feature: string | null; technical_detail: string | null
  context: Record<string, unknown> | null; correlation_id: string | null; resolved: boolean; created_at: string
}
export async function getErrorLog() {
  return api<{ errors: LoggedError[] }>('/api/admin-security?action=error-log', { method: 'GET' })
}
export async function setErrorResolved(id: string, resolved: boolean) {
  return api<{ ok: true }>('/api/admin-security?action=error-log', { method: 'POST', body: JSON.stringify({ id, resolved }) })
}

export type AdminInvitationInput = { name: string; email: string; role: string; jobTitle: string; permissions: PermissionSet; isSalesman: boolean; salesmanIds: string[] }
export async function inviteAdmin(input: AdminInvitationInput, sensitiveToken: string) {
  return api<{ ok: true }>('/api/admin-security?action=invite-admin', { method: 'POST', body: JSON.stringify(input) }, sensitiveToken)
}

export async function inviteCustomer(customerId: string, email: string) {
  return api<{ ok: true; simulated?: boolean; message?: string }>('/api/admin-security?action=invite-customer', { method: 'POST', body: JSON.stringify({ customerId, email }) })
}

export async function manageAdmin(input: Record<string, unknown>, sensitiveToken: string) {
  return api<{ ok: true }>('/api/admin-security?action=manage-admin', { method: 'POST', body: JSON.stringify(input) }, sensitiveToken)
}

export async function resetAdminCredentials(id: string, sensitiveToken: string) {
  return api<{ ok: true; simulated?: boolean; message?: string }>('/api/admin-security?action=reset-admin-credentials', { method: 'POST', body: JSON.stringify({ id }) }, sensitiveToken)
}

export type EmailImportStatus = 'processing' | 'imported' | 'needs_review' | 'failed' | 'duplicate'
export type EmailImportRow = {
  id: string; message_id: string; received_at: string | null; sender: string | null; subject: string | null
  attachment_filename: string; attachment_size: number | null; status: EmailImportStatus
  document_type: 'invoice' | 'credit_note' | null
  detected_customer_id: string | null; detected_customer_name: string | null; detected_invoice_number: string | null
  invoice_id: string | null; credit_note_id: string | null; file_id: string | null
  error_message: string | null; processed_at: string | null; created_at: string
}
export async function getEmailImports() { return api<{ imports: EmailImportRow[] }>('/api/admin-security?action=email-imports', { method: 'GET' }) }
export async function retryEmailImport(id: string, customerId?: string) {
  return api<{ ok: true; status: string }>('/api/admin-security?action=email-imports', { method: 'POST', body: JSON.stringify({ id, customerId }) })
}

export async function getSystemOverview() { return api<SystemOverview>('/api/admin-security?action=system-overview') }
export async function getSystemMode() { return api<{ testMode: boolean; changedAt: string | null; generation?: string | null; startedAt?: string | null }>('/api/admin-security?action=system-mode') }
export async function setSystemMode(enabled: boolean, sensitiveToken: string) {
  return api<{ ok: true; testMode: boolean; snapshot?: { tables?: number; rows?: number } }>('/api/admin-security?action=system-mode', { method: 'POST', body: JSON.stringify({ enabled }) }, sensitiveToken)
}
export async function createApplicationBackup(sensitiveToken: string) {
  return api<{ ok: true; id: string; status: string; sizeBytes: number; tableCount: number; rowCount: number; storageObjectCount: number }>('/api/admin-security?action=application-backup', { method: 'POST', body: '{}' }, sensitiveToken)
}
export type EmailSuiteResult = { category: string; sender: string; ok: boolean; error: string | null; providerMessageId: string | null }
export async function sendEmailTestSuite(sensitiveToken: string) {
  return api<{ ok: boolean; recipient: string; results: EmailSuiteResult[] }>('/api/admin-security?action=test-email-suite', { method: 'POST', body: '{}' }, sensitiveToken)
}
export async function downloadApplicationBackup(id: string, sensitiveToken: string) {
  const token = await accessToken()
  const response = await fetch('/api/admin-security?action=download-backup', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, 'X-Sensitive-Action-Token': sensitiveToken }, body: JSON.stringify({ id }) })
  if (!response.ok) { const body = await response.json().catch(() => ({})); throw new Error(body.error || 'Backup download failed.') }
  const disposition = response.headers.get('Content-Disposition') || ''
  const fileName = disposition.match(/filename="?([^";]+)"?/i)?.[1] || `Punjab-Exotic-Foods-Backup-${id}.zip`
  return { blob: await response.blob(), fileName }
}

export type SystemOverview = {
  health: Record<string, string>
  counts: { customers: number; admins: number; salesUsers: number; systemDevelopers: number; disabled: number }
  users: Array<{ id: string; name: string; email: string; role: string; active: boolean; createdAt: string; lastLoginAt: string | null; invitationStatus: string | null }>
  logins: Array<{ id: string; email: string | null; role: string; login_at: string; success: boolean; failure_code: string | null }>
  audit: Array<{ id: string; action: string; target_type: string | null; target_id: string | null; metadata: Record<string, unknown>; created_at: string }>
  backups: Array<{ id: string; provider: string; backup_type: string; status: string; size_bytes: number | null; requested_at: string; completed_at: string | null; created_by_email: string | null; database_export_status: string | null; storage_export_status: string | null; table_count: number | null; row_count: number | null; checksum_sha256: string | null; file_path: string | null }>
  testMode: boolean; testModeChangedAt: string | null; testIsolationReady: boolean; managedBackupsAvailable: boolean
}
