import { supabase } from './supabase'
import type { PermissionSet } from '../types'
import type { ImportedFinancialDocument } from './invoiceImport'

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
export async function inviteAdmin(input: AdminInvitationInput, sensitiveToken?: string) {
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

export type SendReminderInput = { invoiceId: string; stage: 'day-14' | 'day-21' | '21-plus'; subject: string; message: string; alsoWhatsApp: boolean }
/** The sole path a reminder email is sent through (item 2) - the server
    enforces the 24h cooldown atomically before doing anything else, so a
    409 here means another send (possibly from a different admin) already
    happened within the last 24 hours. */
export async function sendInvoiceReminder(input: SendReminderInput) {
  return api<{ ok: true; simulated?: boolean; nextAllowedAt?: string; sentAt?: string }>('/api/admin-security?action=send-reminder', { method: 'POST', body: JSON.stringify(input) })
}

/** Backlog of invoices whose generated PDF is missing, broken, or was
    produced by the fallback renderer while the Word-to-PDF converter was
    down (items 2/3/14) - available to any authorised admin, not just
    System Developer (item 12). GET reports without changing anything;
    POST processes one batch so a large backlog can't time out a single
    request (item 3) - call again while `remaining > 0`. */
export async function getPdfBacklogReport() {
  return api<{ ok: true; totalChecked: number; alreadyHavePdf: number; needingRepair: number }>('/api/admin-security?action=repair-pdf-backlog', { method: 'GET' })
}
// System-Developer-only trusted-device lock (items 6-16) - re-verifies an
// already-authenticated session on a saved device via WebAuthn or a 6-digit
// passcode. Never a login path: server-gated to System Developer only via
// requireSystemDeveloper() on every call (see server/admin-actions/trusted-device.js).
export type TrustedDeviceSummary = { id: string; label: string | null; hasWebAuthn: boolean; hasPasscode: boolean; createdAt: string; lastUsedAt: string | null }
function trustedDeviceApi<T>(body: Record<string, unknown>) {
  return api<T>('/api/admin-security?action=trusted-device', { method: 'POST', body: JSON.stringify(body) })
}
export async function listTrustedDevices() {
  return api<{ ok: true; devices: TrustedDeviceSummary[] }>('/api/admin-security?action=trusted-device', { method: 'GET' })
}
export async function saveTrustedDevice(deviceId: string, label: string) {
  return trustedDeviceApi<{ ok: true }>({ op: 'save-device', deviceId, label })
}
export async function revokeTrustedDevice(deviceId: string) {
  return trustedDeviceApi<{ ok: true }>({ op: 'revoke', deviceId })
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function webauthnRegisterOptions(deviceId: string) {
  return trustedDeviceApi<{ ok: true; options: any }>({ op: 'webauthn-register-options', deviceId })
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function webauthnRegisterVerify(deviceId: string, response: any) {
  return trustedDeviceApi<{ ok: true }>({ op: 'webauthn-register-verify', deviceId, response })
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function webauthnAuthOptions(deviceId: string) {
  return trustedDeviceApi<{ ok: true; options: any }>({ op: 'webauthn-auth-options', deviceId })
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function webauthnAuthVerify(deviceId: string, response: any) {
  return trustedDeviceApi<{ ok: true }>({ op: 'webauthn-auth-verify', deviceId, response })
}
export async function setDevicePasscode(deviceId: string, passcode: string) {
  return trustedDeviceApi<{ ok: true }>({ op: 'passcode-set', deviceId, passcode })
}
export async function verifyDevicePasscode(deviceId: string, passcode: string) {
  return trustedDeviceApi<{ ok: boolean; error?: string; locked?: boolean; lockedUntil?: string; attemptsRemaining?: number }>({ op: 'passcode-verify', deviceId, passcode })
}

export async function repairPdfBacklogBatch(batchSize = 20) {
  return api<{
    ok: true; simulated?: boolean; totalChecked: number; alreadyHavePdf: number; processed: number
    regenerated: number; stillFailed: number; remaining: number
    results: Array<{ invoiceNumber: string; ok: boolean; reason?: string }>
  }>('/api/admin-security?action=repair-pdf-backlog', { method: 'POST', body: JSON.stringify({ batchSize }) })
}

export type EmailImportStatus = 'processing' | 'imported' | 'needs_review' | 'failed' | 'duplicate' | 'rejected'
export type EmailImportRow = {
  id: string; message_id: string; received_at: string | null; sender: string | null; subject: string | null
  /** Recipient and plain-text body (item 4) - only populated for emails
      received after this feature shipped; null on historical rows, which
      the UI must say plainly rather than invent content for. */
  recipient: string | null; body_text: string | null
  attachment_filename: string; attachment_size: number | null; status: EmailImportStatus
  document_type: 'invoice' | 'credit_note' | 'statement' | null
  detected_customer_id: string | null; detected_customer_name: string | null; detected_invoice_number: string | null
  invoice_id: string | null; credit_note_id: string | null; statement_id: string | null; file_id: string | null; customer_created: boolean
  error_message: string | null; processed_at: string | null; created_at: string
}
export type EmailImportStats = { total: number; invoices: number; creditNotes: number; statements: number; missingPdfs: number }
export type EmailImportsPage = { imports: EmailImportRow[]; hasMore: boolean; counts: Partial<Record<EmailImportStatus, number>>; total: number; stats: EmailImportStats }
/** Cursor-paginated by received_at (newest first) via `before`; `search`
    switches to a full-table server-side search instead (never limited to
    already-loaded rows). `counts`/`total` always reflect the FULL table,
    independent of how many rows are currently loaded. */
export async function getEmailImports(opts: { before?: string; beforeId?: string; limit?: number; search?: string } = {}) {
  const params = new URLSearchParams()
  if (opts.search) params.set('search', opts.search)
  else {
    if (opts.before) params.set('before', opts.before)
    if (opts.beforeId) params.set('beforeId', opts.beforeId)
    if (opts.limit) params.set('limit', String(opts.limit))
  }
  const qs = params.toString()
  return api<EmailImportsPage>(`/api/admin-security?action=email-imports${qs ? `&${qs}` : ''}`, { method: 'GET' })
}
export async function retryEmailImport(id: string, customerId?: string) {
  return api<{ ok: true; status: string }>('/api/admin-security?action=email-imports', { method: 'POST', body: JSON.stringify({ id, customerId }) })
}

export async function getReviewDocument(id: string) {
  return api<{ ok: true; row: EmailImportRow; document: ImportedFinancialDocument; sourcePdfDataUri: string }>(
    '/api/admin-security?action=email-imports', { method: 'POST', body: JSON.stringify({ op: 'get-review', id }) },
  )
}
export async function approveReviewedDocument(id: string, document: ImportedFinancialDocument, customerId?: string) {
  return api<{ ok: true; status: string; invoiceId?: string; creditNoteId?: string; changes: Array<{ field: string; from: unknown; to: unknown }> }>(
    '/api/admin-security?action=email-imports', { method: 'POST', body: JSON.stringify({ op: 'approve', id, document, customerId }) },
  )
}
export async function rejectReviewedDocument(id: string, reason?: string) {
  return api<{ ok: true; status: string }>('/api/admin-security?action=email-imports', { method: 'POST', body: JSON.stringify({ op: 'reject', id, reason }) })
}

export type LoginActivityEvent = {
  id: string
  event_type: string
  email: string | null
  role: string | null
  login_at: string
  success: boolean
  failure_code: string | null
  user_agent_summary: string | null
  ip_hash: string | null
  details: Record<string, unknown>
  recorded_by: string
  account_id: string | null
}
export async function getLoginActivity(filters: { eventType?: string; email?: string; success?: string; from?: string; to?: string } = {}) {
  const params = new URLSearchParams({ action: 'login-activity' })
  for (const [key, value] of Object.entries(filters)) if (value) params.set(key, value)
  return api<{ events: LoginActivityEvent[]; suspicious: Array<{ email: string; failedCount: number }> }>(
    `/api/admin-security?${params.toString()}`, { method: 'GET' },
  )
}

export type StatementRecord = {
  id: string
  customer_id: string | null
  customer_name: string | null
  account_number: string | null
  statement_date: string | null
  total_invoiced: number | null
  total_paid: number | null
  total_outstanding: number | null
  invoice_count: number
  reconciliation_status: 'reconciled' | 'needs_review' | 'unmatched_customer'
  reconciliation_notes: Array<{ type: string; text: string }>
  source_document_id: string | null
  source_file_name: string | null
  import_source: string
  created_at: string
}

export type DatabaseResetStatus = { pinConfigured: boolean; pinSetAt: string | null; tables: string[] }
export async function getDatabaseResetStatus() { return api<DatabaseResetStatus>('/api/admin-security?action=database-reset', { method: 'GET' }) }
export async function setDatabaseResetPin(pin: string, sensitiveToken: string) {
  return api<{ ok: true }>('/api/admin-security?action=database-reset', { method: 'POST', body: JSON.stringify({ step: 'set-pin', pin }) }, sensitiveToken)
}
export async function verifyDatabaseResetPin(pin: string) {
  return api<{ ok: true }>('/api/admin-security?action=database-reset', { method: 'POST', body: JSON.stringify({ step: 'verify-pin', pin }) })
}
export async function requestDatabaseResetCode() {
  return api<{ ok: true; sentTo: string }>('/api/admin-security?action=database-reset', { method: 'POST', body: JSON.stringify({ step: 'request-code' }) })
}
export async function executeDatabaseReset(emailCode: string, pin: string) {
  return api<{ ok: true; testMode: boolean; counts: Record<string, number> }>('/api/admin-security?action=database-reset', { method: 'POST', body: JSON.stringify({ step: 'execute', emailCode, pin }) })
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
