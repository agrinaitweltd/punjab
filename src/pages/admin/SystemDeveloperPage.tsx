import { useEffect, useMemo, useState } from 'react'
import { Button } from '../../components/ui/Button'
import { EmptyState } from '../../components/ui/EmptyState'
import { getSystemOverview, type SystemOverview } from '../../lib/secureAdminApi'

const SECTION_TITLES: Record<string, { title: string; subtitle: string }> = {
  'system-overview': { title: 'System Overview', subtitle: 'Production health, account totals and security status.' },
  'system-users': { title: 'System Users', subtitle: 'Authorised staff accounts and recent authentication state.' },
  'login-activity': { title: 'Login Activity', subtitle: 'Restricted, non-sensitive authentication audit information.' },
  'audit-logs': { title: 'Security Audit Log', subtitle: 'Important administrative and system actions.' },
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
  const title = SECTION_TITLES[section] ?? SECTION_TITLES['system-overview']
  const load = () => {
    setError('')
    getSystemOverview().then(setData).catch(reason => setError(reason instanceof Error ? reason.message : 'System status could not be loaded.'))
  }
  useEffect(load, [section])
  const users = useMemo(() => data?.users.filter(user => filter === 'All' || user.role === filter) ?? [], [data?.users, filter])

  return <div className="system-page stack">
    <header className="system-page-head">
      <div><span className="control-centre-label">Restricted Technical Administration</span><h2>{title.title}</h2><p>{title.subtitle}</p></div>
      <Button variant="secondary" onClick={load} disabled={!data}>Refresh</Button>
    </header>
    {error && <div className="system-error" role="alert">{error}<Button className="btn-sm" variant="secondary" onClick={load}>Retry</Button></div>}
    {!data && !error && <div className="system-skeleton-grid">{Array.from({ length: 5 }, (_, index) => <span key={index} />)}</div>}

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

    {data && section === 'test-mode' && <section className="system-panel mode-panel">
      <div className={data.testMode ? 'mode-indicator test' : 'mode-indicator live'}><span>{data.testMode ? 'TEST' : 'LIVE'}</span><strong>{data.testMode ? 'Test Mode' : 'Live Mode'}</strong></div>
      <div><h3>System Test Mode</h3><p>{data.testIsolationReady ? 'A separate test data environment is configured.' : 'Test Mode is locked because a separate Supabase test environment and completed data adapter are not configured. This prevents test transactions from entering production.'}</p><Button disabled={!data.testIsolationReady}>{data.testMode ? 'Disable Test Mode' : 'Enable Test Mode'}</Button></div>
    </section>}

    {data && section === 'backup-recovery' && <>
      <section className="system-panel backup-panel"><div><span className="control-centre-label">Supabase Managed Backups</span><h3>Data Backup & Recovery</h3><p>Database backups and restoration remain controlled by Supabase. Restore is intentionally unavailable inside this application.</p></div><Button disabled={!data.managedBackupsAvailable}>Create Managed Backup</Button></section>
      <div className="system-callout">Storage objects require a separate export strategy because database backups contain Storage metadata, not deleted file contents. No unsafe row-copy backup is presented here.</div>
      {data.backups.length > 0 && <section className="system-panel"><header><h3>Backup Requests</h3></header>{data.backups.map(item => <div className="health-row" key={item.id}><span>{item.backup_type}</span><strong>{item.status}</strong></div>)}</section>}
    </>}

    {data && section === 'system-health' && <div className="system-metrics health-metrics">{Object.entries(data.health).map(([label, value]) => <div className="system-metric" key={label}><span>{prettyAction(label)}</span><strong className="metric-text">{value}</strong></div>)}</div>}

    {data && section === 'security' && <div className="security-checks">
      {['Supabase Auth sessions protect production access', 'Row Level Security is enabled on private business tables', 'Sensitive user actions require current-password verification', 'Privileged Supabase keys remain server-side', 'System Developer access is enforced by the database roster', 'Production Test Mode refuses activation without isolated infrastructure'].map(item => <div key={item}><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 6 9 17l-5-5"/></svg><span>{item}</span></div>)}
    </div>}
  </div>
}
