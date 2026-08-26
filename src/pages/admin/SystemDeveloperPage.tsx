import { useEffect, useMemo, useState } from 'react'
import { Button } from '../../components/ui/Button'
import { EmptyState } from '../../components/ui/EmptyState'
import { Modal } from '../../components/ui/Modal'
import { SensitiveActionDialog } from '../../components/SensitiveActionDialog'
import { createApplicationBackup, downloadApplicationBackup, getErrorLog, getSystemOverview, sendEmailTestSuite, setErrorResolved, setSystemMode, type EmailSuiteResult, type LoggedError, type SystemOverview } from '../../lib/secureAdminApi'

const SECTION_TITLES: Record<string, { title: string; subtitle: string }> = {
  'system-overview': { title: 'System Overview', subtitle: 'Production health, account totals and security status.' },
  'system-users': { title: 'System Users', subtitle: 'Authorised staff accounts and recent authentication state.' },
  'login-activity': { title: 'Login Activity', subtitle: 'Restricted, non-sensitive authentication audit information.' },
  'audit-logs': { title: 'Security Audit Log', subtitle: 'Important administrative and system actions.' },
  'error-log': { title: 'Error Log', subtitle: 'Application errors reported by users and caught automatically.' },
  'test-mode': { title: 'Global Test Mode', subtitle: 'Production-safe workflow isolation controls.' },
  'backup-recovery': { title: 'Backup & Recovery', subtitle: 'Supabase backup availability and recovery safeguards.' },
  'system-health': { title: 'Integrations & Health', subtitle: 'Safe connectivity checks without exposing credentials.' },
  security: { title: 'Security', subtitle: 'Authentication, authorization and environment safeguards.' },
}

const dateTime = (value?: string | null) => value ? new Date(value).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' }) : 'Never'
const prettyAction = (value: string) => value.replaceAll('_', ' ').replace(/\b\w/g, letter => letter.toUpperCase())

export function SystemDeveloperPage({ section }: { section: string }) {
  const [data, setData] = useState<SystemOverview | null>(null)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState('All')
  const [sensitiveAction, setSensitiveAction] = useState<'mode' | 'backup' | 'download' | 'email-test' | null>(null)
  const [emailResults, setEmailResults] = useState<EmailSuiteResult[]>([])
  const [selectedBackupId, setSelectedBackupId] = useState('')
  const [restoreInfo, setRestoreInfo] = useState(false)
  const [errors, setErrors] = useState<LoggedError[] | null>(null)
  const [errorFilter, setErrorFilter] = useState<'unresolved' | 'all'>('unresolved')
  const title = SECTION_TITLES[section] ?? SECTION_TITLES['system-overview']
  const load = () => {
    setError('')
    if (section === 'error-log') {
      getErrorLog().then(result => setErrors(result.errors)).catch(reason => setError(reason instanceof Error ? reason.message : 'Error log could not be loaded.'))
      return
    }
    getSystemOverview().then(setData).catch(reason => setError(reason instanceof Error ? reason.message : 'System status could not be loaded.'))
  }
  useEffect(load, [section])
  const visibleErrors = useMemo(() => (errors ?? []).filter(item => errorFilter === 'all' || !item.resolved), [errors, errorFilter])
  const toggleResolved = async (item: LoggedError) => {
    await setErrorResolved(item.id, !item.resolved)
    setErrors(list => list?.map(row => row.id === item.id ? { ...row, resolved: !row.resolved } : row) ?? null)
  }
  const users = useMemo(() => data?.users.filter(user => filter === 'All' || user.role === filter) ?? [], [data?.users, filter])
  const bytes = (value?: number | null) => value ? `${(value / 1024 / 1024).toFixed(2)} MB` : '-'
  const finishSensitiveAction = async (token: string) => {
    if (!data) return
    if (sensitiveAction === 'mode') {
      await setSystemMode(!data.testMode, token)
      setSensitiveAction(null)
      window.location.reload()
      return
    }
    if (sensitiveAction === 'backup') {
      await createApplicationBackup(token)
      setSensitiveAction(null)
      load()
      return
    }
    if (sensitiveAction === 'email-test') {
      const result = await sendEmailTestSuite(token)
      setEmailResults(result.results)
      setSensitiveAction(null)
      load()
      return
    }
    if (sensitiveAction === 'download' && selectedBackupId) {
      const download = await downloadApplicationBackup(selectedBackupId, token)
      const url = URL.createObjectURL(download.blob)
      const anchor = document.createElement('a'); anchor.href = url; anchor.download = download.fileName; anchor.click()
      window.setTimeout(() => URL.revokeObjectURL(url), 500)
      setSensitiveAction(null)
    }
  }

  return <div className="system-page stack">
    <header className="system-page-head">
      <div><span className="control-centre-label">Restricted Technical Administration</span><h2>{title.title}</h2><p>{title.subtitle}</p></div>
      <Button variant="secondary" onClick={load} disabled={section === 'error-log' ? !errors : !data}>Refresh</Button>
    </header>
    {error && <div className="system-error" role="alert">{error}<Button className="btn-sm" variant="secondary" onClick={load}>Retry</Button></div>}
    {section !== 'error-log' && !data && !error && <div className="system-skeleton-grid">{Array.from({ length: 5 }, (_, index) => <span key={index} />)}</div>}
    {section === 'error-log' && !errors && !error && <div className="system-skeleton-grid">{Array.from({ length: 5 }, (_, index) => <span key={index} />)}</div>}

    {data && section === 'system-overview' && <>
      <div className="system-status-strip"><span className="status-dot good" />Production systems operational <small>Environment: {data.health.environment}</small></div>
      <div className="system-metrics">
        {[
          ['Customers', data.counts.customers], ['Administrators', data.counts.admins], ['Sales Users', data.counts.salesUsers],
          ['System Developers', data.counts.systemDevelopers], ['Disabled Accounts', data.counts.disabled],
        ].map(([label, value]) => <div className="system-metric" key={label}><span>{label}</span><strong>{value}</strong></div>)}
      </div>
      <div className="system-grid-two">
        <section className="system-panel">
          <header><h3>Service Health</h3><span>Live checks</span></header>
          {Object.entries(data.health).map(([name, status]) => <div className="health-row" key={name}><span>{prettyAction(name)}</span><strong className={status === 'Operational' || status === 'Configured' || name === 'environment' ? 'good' : 'warn'}>{status}</strong></div>)}
        </section>
        <section className="system-panel">
          <header><h3>Recent Security Activity</h3><span>{data.audit.length} entries</span></header>
          {data.audit.slice(0, 6).map(item => <div className="audit-row" key={item.id}><span>{prettyAction(item.action)}<small>{item.target_type || 'System'}</small></span><time>{dateTime(item.created_at)}</time></div>)}
          {!data.audit.length && <EmptyState title="No security events yet" />}
        </section>
      </div>
    </>}

    {data && section === 'system-users' && <section className="system-panel system-table-panel">
      <div className="system-table-tools"><div><strong>Authorised Staff</strong><span>{users.length} accounts</span></div><select value={filter} onChange={event => setFilter(event.target.value)}><option>All</option><option>System Developer</option><option>Owner</option><option>Manager</option><option>Staff</option></select></div>
      <div className="table-wrap"><table><thead><tr><th>User</th><th>Role</th><th>Status</th><th>Last Login</th><th>Created</th></tr></thead><tbody>{users.map(user => <tr key={user.id}><td><strong>{user.name}</strong><small className="table-sub">{user.email}</small></td><td><span className="badge badge-blue">{user.role}</span></td><td><span className={user.active ? 'sys-status active' : 'sys-status disabled'}>{user.active ? 'Active' : 'Disabled'}</span></td><td>{dateTime(user.lastLoginAt)}</td><td>{dateTime(user.createdAt)}</td></tr>)}</tbody></table></div>
    </section>}

    {data && section === 'login-activity' && <section className="system-panel system-table-panel">
      <div className="system-table-tools"><div><strong>Recent Login Attempts</strong><span>Passwords, tokens and sessions are never recorded</span></div></div>
      <div className="table-wrap"><table><thead><tr><th>Account</th><th>Role</th><th>Result</th><th>Time</th></tr></thead><tbody>{data.logins.map(item => <tr key={item.id}><td>{item.email || 'Account identifier protected'}</td><td>{item.role}</td><td><span className={item.success ? 'sys-status active' : 'sys-status disabled'}>{item.success ? 'Successful' : 'Failed'}</span></td><td>{dateTime(item.login_at)}</td></tr>)}</tbody></table>{!data.logins.length && <EmptyState title="No application login events recorded yet" />}</div>
    </section>}

    {data && section === 'audit-logs' && <section className="system-panel system-table-panel">
      <div className="system-table-tools"><div><strong>Restricted Audit Trail</strong><span>Administrative actions are append-only for normal users</span></div></div>
      <div className="table-wrap"><table><thead><tr><th>Action</th><th>Target</th><th>Time</th></tr></thead><tbody>{data.audit.map(item => <tr key={item.id}><td><strong>{prettyAction(item.action)}</strong></td><td>{item.target_type || 'System'}{item.target_id ? ' / ' + item.target_id : ''}</td><td>{dateTime(item.created_at)}</td></tr>)}</tbody></table></div>
    </section>}

    {errors && section === 'error-log' && <section className="system-panel system-table-panel">
      <div className="system-table-tools">
        <div><strong>Application Errors</strong><span>{visibleErrors.length} {errorFilter === 'unresolved' ? 'unresolved' : 'total'}</span></div>
        <select value={errorFilter} onChange={event => setErrorFilter(event.target.value as 'unresolved' | 'all')}><option value="unresolved">Unresolved only</option><option value="all">All errors</option></select>
      </div>
      <div className="table-wrap"><table><thead><tr><th>Code</th><th>Title</th><th>Feature</th><th>Reported By</th><th>Time</th><th>Status</th><th>Actions</th></tr></thead><tbody>
        {visibleErrors.map(item => <tr key={item.id}>
          <td><strong>{item.error_code}</strong></td>
          <td>{item.title}</td>
          <td>{item.feature || '—'}</td>
          <td>{item.user_email || '—'}</td>
          <td>{dateTime(item.created_at)}</td>
          <td><span className={item.resolved ? 'sys-status active' : 'sys-status disabled'}>{item.resolved ? 'Resolved' : 'Unresolved'}</span></td>
          <td><Button className="btn-sm" variant="secondary" onClick={() => toggleResolved(item)}>{item.resolved ? 'Reopen' : 'Mark Resolved'}</Button></td>
        </tr>)}
      </tbody></table>{!visibleErrors.length && <EmptyState title={errorFilter === 'unresolved' ? 'No unresolved errors' : 'No errors logged yet'} />}</div>
    </section>}

    {data && section === 'test-mode' && <section className="system-panel mode-panel">
      <div className={data.testMode ? 'mode-indicator test' : 'mode-indicator live'}><span>{data.testMode ? 'TEST' : 'LIVE'}</span><strong>{data.testMode ? 'Test Mode' : 'Live Mode'}</strong></div>
      <div><h3>System Test Mode</h3><p>{data.testMode ? 'All operational workflows are currently routed to RLS-protected sandbox tables. Communications are simulated and live company rows remain unchanged.' : 'Enabling Test Mode creates a fresh isolated snapshot of operational data. All users then work against sandbox tables until Test Mode is disabled and the snapshot is discarded.'}</p><Button onClick={() => setSensitiveAction('mode')}>{data.testMode ? 'Return to Live Mode' : 'Enable Test Mode'}</Button></div>
    </section>}

    {data && section === 'backup-recovery' && <>
      <div className="backup-types-grid">
        <section className="system-panel backup-panel"><div><span className="control-centre-label">Application Backup</span><h3>Portable ZIP Package</h3><p>Creates CSV table exports, extracted invoice and customer documents, file-to-record metadata, a manifest, and checksums in the restricted system-backups bucket.</p></div><Button onClick={() => setSensitiveAction('backup')}>Create Full Backup</Button></section>
        <section className="system-panel backup-panel"><div><span className="control-centre-label">Supabase Managed Database Backup</span><h3>Provider-managed Recovery</h3><p>Native database backup schedules and production restoration remain controlled in Supabase. They are separate from application exports.</p></div><span className="sys-status active">Provider controlled</span></section>
      </div>
      <div className="system-callout"><strong>Restore protection:</strong> no backup can overwrite production from this screen. Restore requires backup selection, checksum validation, an impact review, fresh password verification and a separately approved server procedure.</div>
      <section className="system-panel system-table-panel"><div className="system-table-tools"><div><strong>Application Backup History</strong><span>{data.backups.length} backup records</span></div><Button variant="secondary" onClick={() => setRestoreInfo(true)}>Review Restore Requirements</Button></div><div className="table-wrap"><table><thead><tr><th>Date & Time</th><th>Type</th><th>Status</th><th>Size</th><th>Created By</th><th>Database</th><th>Storage</th><th>Actions</th></tr></thead><tbody>{data.backups.map(item => <tr key={item.id}><td>{dateTime(item.requested_at)}</td><td>{item.backup_type}</td><td><span className={`sys-status ${item.status === 'Completed' ? 'active' : item.status === 'Failed' ? 'disabled' : ''}`}>{item.status}</span></td><td>{bytes(item.size_bytes)}</td><td>{item.created_by_email || 'System Developer'}</td><td>{item.database_export_status || '-'}</td><td>{item.storage_export_status || '-'}</td><td><Button className="btn-sm" variant="secondary" disabled={!['Completed', 'Partial'].includes(item.status)} onClick={() => { setSelectedBackupId(item.id); setSensitiveAction('download') }}>Download</Button></td></tr>)}</tbody></table>{!data.backups.length && <EmptyState title="No application backups have been created" />}</div></section>
    </>}

    {data && section === 'system-health' && <><div className="system-metrics health-metrics">{Object.entries(data.health).map(([label, value]) => <div className="system-metric" key={label}><span>{prettyAction(label)}</span><strong className="metric-text">{value}</strong></div>)}</div><section className="system-panel email-test-panel"><div><span className="control-centre-label">Restricted Delivery Test</span><h3>Automated Email Suite</h3><p>Sends nine branded messages only to info@kavotech.uk. The invoice preview is marked TEST / DEMO - NOT PAYABLE and no operational records or balances are created.</p></div><Button onClick={() => setSensitiveAction('email-test')}>Send Nine Test Emails</Button></section>{emailResults.length > 0 && <section className="system-panel system-table-panel"><div className="system-table-tools"><div><strong>Latest Email Test</strong><span>{emailResults.filter(item => item.ok).length} of {emailResults.length} accepted by the provider</span></div></div><div className="table-wrap"><table><thead><tr><th>Sender</th><th>Category</th><th>Status</th><th>Provider Result</th></tr></thead><tbody>{emailResults.map(item => <tr key={item.category}><td>{item.sender}</td><td>{prettyAction(item.category)}</td><td><span className={`sys-status ${item.ok ? 'active' : 'disabled'}`}>{item.ok ? 'Sent' : 'Failed'}</span></td><td>{item.error || item.providerMessageId || 'Accepted'}</td></tr>)}</tbody></table></div></section>}</>}

    {data && section === 'security' && <div className="security-checks">
      {['Supabase Auth sessions protect production access', 'Row Level Security is enabled on private business tables', 'Sensitive user actions require current-password verification', 'Privileged Supabase keys remain server-side', 'System Developer access is enforced by the database roster', 'Production Test Mode refuses activation without isolated infrastructure'].map(item => <div key={item}><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 6 9 17l-5-5"/></svg><span>{item}</span></div>)}
    </div>}
    <SensitiveActionDialog open={Boolean(sensitiveAction)} title={sensitiveAction === 'mode' ? `${data?.testMode ? 'Disable' : 'Enable'} Test Mode` : sensitiveAction === 'backup' ? 'Create Full Application Backup' : sensitiveAction === 'email-test' ? 'Send Automated Email Test Suite' : 'Download Application Backup'} warning={sensitiveAction === 'mode' && data?.testMode ? 'Returning to Live Mode discards all sandbox changes and reloads production data. Live records are not deleted or changed.' : sensitiveAction === 'mode' ? 'A fresh operational snapshot will be created. All users will be moved to isolated sandbox data.' : sensitiveAction === 'email-test' ? 'Exactly nine test emails will be sent to info@kavotech.uk. No customer, invoice, payment, stock or reporting data will be created.' : 'Backup archives contain sensitive company information and must be stored securely.'} actionLabel={sensitiveAction === 'mode' ? data?.testMode ? 'Verify & Return to Live' : 'Verify & Enable Test Mode' : sensitiveAction === 'backup' ? 'Verify & Create Backup' : sensitiveAction === 'email-test' ? 'Verify & Send Test Emails' : 'Verify & Download'} onClose={() => setSensitiveAction(null)} onVerified={finishSensitiveAction} />
    <Modal open={restoreInfo} title="Protected Restore Workflow" onClose={() => setRestoreInfo(false)}><div className="restore-requirements"><p>Production restore is not executed automatically. A future approved restore must complete every safeguard below.</p>{['Select a completed backup archive', 'Validate the SHA-256 checksum and manifest version', 'Review database and Storage export status', 'Create a fresh pre-restore backup', 'Verify System Developer password again', 'Type an explicit production confirmation phrase', 'Write the restore decision and result to the audit log'].map(item => <div key={item}><span>Required</span>{item}</div>)}<Button variant="secondary" onClick={() => setRestoreInfo(false)}>Close Review</Button></div></Modal>
  </div>
}
