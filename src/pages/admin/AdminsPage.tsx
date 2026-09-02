import { useEffect, useState } from "react"
import type { FormEvent } from "react"
import type { AdminRole, AdminStaff, PermissionSet } from "../../types"
import { Button } from "../../components/ui/Button"
import { Input, Select } from "../../components/ui/Input"
import { Modal } from "../../components/ui/Modal"
import { EMPTY_PERMISSIONS, FALLBACK_ROLE_TEMPLATES, PERMISSION_LABELS } from "../../lib/permissions"
import { isSensitiveAdminGrant } from "../../lib/adminAccess"
import { SensitiveActionDialog } from "../../components/SensitiveActionDialog"

const ALL_PERMISSIONS = Object.keys(EMPTY_PERMISSIONS) as (keyof PermissionSet)[]

const basePermissions: PermissionSet = { ...EMPTY_PERMISSIONS }

/* Grouped by function so the permission picker reads like a real access
   policy rather than a flat checkbox dump. */
const PERM_GROUPS: { label: string; keys: (keyof PermissionSet)[] }[] = [
  { label: "Customers",  keys: ["customers", "customersEdit", "customersCreate", "customersDelete"] },
  { label: "Invoices",  keys: ["invoicesView", "invoicesSendReminders", "invoicesViewPdfs", "invoicesDelete"] },
  { label: "Payments",  keys: ["payments", "paymentsRecord", "paymentsAllocate", "paymentsDelete"] },
  { label: "Email Imports", keys: ["emailImportsView", "emailImportsReview"] },
  { label: "Files / Documents", keys: ["filesView", "filesDownload"] },
  { label: "Communications", keys: ["communicationsView", "communicationsSend"] },
  { label: "Credit Notes & Statements", keys: ["creditNotesIssue", "statementsView"] },
  { label: "Trading",  keys: ["orders", "stock", "products", "prices", "buyingPricesEdit", "extracts"] },
  { label: "Support",  keys: ["tickets", "complaints", "enquiries", "applicationsManage"] },
  { label: "Insights & Admin", keys: ["stats", "admins", "usersManage"] },
]

function PermGrid({ perms, onChange }: { perms: PermissionSet; onChange: (p: PermissionSet) => void }) {
  const allOn = ALL_PERMISSIONS.every(k => perms[k])
  return (
    <div className="wide">
      <div className="adm-perm-head">
        <span>Permissions</span>
        <button type="button" className={"adm-perm-all" + (allOn ? " on" : "")} onClick={() => {
          const v = !allOn
          const all = {} as PermissionSet
          ALL_PERMISSIONS.forEach(k => (all[k] = v))
          onChange(all)
        }}>
          {allOn ? "Clear all" : "Select all"}
        </button>
      </div>
      <div className="adm-perm-groups">
        {PERM_GROUPS.map(group => {
          const groupOn = group.keys.filter(k => perms[k]).length
          return (
            <div key={group.label} className="adm-perm-group">
              <p className="adm-perm-group-title">
                <span>{group.label}</span>
                <span className="adm-perm-group-count">{groupOn}/{group.keys.length}</span>
              </p>
              <div className="adm-perm-grid">
                {group.keys.map(key => (
                  <label key={key} className={"adm-perm-check" + (perms[key] ? " on" : "")}>
                    <input type="checkbox" checked={Boolean(perms[key])} onChange={() => onChange({ ...perms, [key]: !perms[key] })} />
                    <span>{PERMISSION_LABELS[key]}</span>
                  </label>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export function AdminsPage({
  admins,
  onCreate,
  onUpdate,
  onDelete,
  onToggleActive,
  onResetCredentials,
  loadRoles,
  currentUserIsSystemDeveloper = false,
  currentUserIsSuperAdmin = false,
}: {
  admins: AdminStaff[]
  onCreate: (name: string, email: string, role: string, jobTitle: string, permissions: PermissionSet, isSalesman: boolean, salesmanIds: string[], sensitiveToken?: string) => Promise<void>
  onUpdate?: (id: string, data: Partial<AdminStaff>, sensitiveToken: string) => Promise<void>
  onDelete?: (id: string, sensitiveToken: string) => Promise<void>
  onToggleActive?: (id: string, active: boolean, sensitiveToken: string) => Promise<void>
  onResetCredentials?: (id: string, sensitiveToken: string) => Promise<void>
  loadRoles?: () => Promise<AdminRole[]>
  currentUserIsSystemDeveloper?: boolean
  currentUserIsSuperAdmin?: boolean
}) {
  const [showCreate, setShowCreate] = useState(false)
  const [editing, setEditing]       = useState<AdminStaff | null>(null)
  const [name, setName]             = useState("")
  const [email, setEmail]           = useState("")
  const [jobTitle, setJobTitle]     = useState("")
  const [role, setRole]             = useState("Staff")
  const [perms, setPerms]           = useState<PermissionSet>(basePermissions)
  const [roleTemplates, setRoleTemplates] = useState<AdminRole[]>(FALLBACK_ROLE_TEMPLATES)
  const [formError, setFormError]   = useState("")
  const [creating, setCreating]     = useState(false)
  const [sensitiveAction, setSensitiveAction] = useState<null | {
    title: string; warning?: string; actionLabel: string; run: (token: string) => Promise<void>
  }>(null)

  useEffect(() => {
    loadRoles?.().then(setRoleTemplates).catch(() => setRoleTemplates(FALLBACK_ROLE_TEMPLATES))
  }, [loadRoles])

  const resetForm = () => {
    setName(""); setEmail(""); setJobTitle(""); setRole("Staff"); setPerms(basePermissions)
    setFormError("")
  }

  const applyTemplate = (templateId: string, target: "create" | "edit") => {
    const template = roleTemplates.find(t => t.id === templateId)
    if (!template) return
    if (target === "create") {
      setRole(template.name)
      setPerms({ ...basePermissions, ...template.permissions })
    } else if (editing) {
      setEditing({ ...editing, role: template.name, permissions: { ...basePermissions, ...template.permissions } })
    }
  }

  const submitCreate = async (e: FormEvent) => {
    e.preventDefault()
    setFormError("")
    if (!name.trim() || !email.trim()) { setFormError("Name and email are required."); return }
    if (admins.some(a => a.email.toLowerCase() === email.trim().toLowerCase())) { setFormError("An admin with that email already exists."); return }

    // Routine, low-privilege invites (the common case) go straight through -
    // only granting an elevated role or a user/app-management permission
    // needs a fresh password re-check. Keeps this in sync with the same
    // check the server enforces in invite-admin.js.
    if (!isSensitiveAdminGrant(role, perms)) {
      setCreating(true)
      try {
        await onCreate(name.trim(), email.trim(), role, jobTitle.trim(), perms, false, [])
        resetForm(); setShowCreate(false)
      } catch (error) {
        setFormError(error instanceof Error ? error.message : "Couldn't send the invitation — please try again.")
      } finally { setCreating(false) }
      return
    }

    setSensitiveAction({
      title: "Send administrator invitation",
      warning: "A one-time account setup link will be emailed to " + email.trim() + ". No password will be created or sent by you.",
      actionLabel: "Verify & Send Invitation",
      run: async token => {
        await onCreate(name.trim(), email.trim(), role, jobTitle.trim(), perms, false, [], token)
        resetForm(); setShowCreate(false); setSensitiveAction(null)
      },
    })
  }

  const submitEdit = (e: FormEvent) => {
    e.preventDefault()
    if (!editing || !onUpdate) return
    if (!editing.name.trim() || !editing.email.trim()) return
    setSensitiveAction({
      title: "Update administrator access",
      warning: "This changes the account's role or permissions and takes effect across the system.",
      actionLabel: "Verify & Save Changes",
      run: async token => { await onUpdate(editing.id, editing, token); setEditing(null); setSensitiveAction(null) },
    })
  }

  return (
    <div className="stack">
      {/* Page header */}
      <div>
        <p className="control-centre-label">Punjab Exotic Foods Control Centre</p>
        <h2 style={{ fontSize: 22, fontWeight: 800, color: "#111827" }}>Admin Users</h2>
        <p style={{ fontSize: 13.5, color: "#6b7280", marginTop: 3 }}>
          Invite and manage staff accounts through secure, one-time setup links.
        </p>
      </div>

      {/* Access notice - reflects the actual signed-in viewer, not assumed */}
      <div className="adm-super-notice">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#22913f" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
        <span>You are logged in as <strong>{currentUserIsSystemDeveloper ? "System Developer" : currentUserIsSuperAdmin ? "Super Admin" : "Administrator"}</strong>.{" "}
          {currentUserIsSystemDeveloper || currentUserIsSuperAdmin ? "You have full control over all admin accounts." : "You can invite and manage accounts covered by your own permissions."}</span>
      </div>

      {/* Admin table card */}
      <div className="card">
        <div className="card-header">
          <h3>Admin Accounts ({admins.length})</h3>
          <Button onClick={() => { resetForm(); setShowCreate(true) }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Invite Admin
          </Button>
        </div>
        <div style={{ padding: 0 }}>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Job Title</th>
                  <th>Role</th>
                  <th>Permissions</th>
                  <th>Status</th>
                  <th style={{ width: 120 }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {admins.map(admin => {
                  // Super admins bypass the granular permission checks entirely
                  // (see lib/permissions.ts can()) — always show 22/22 for them
                  // rather than whatever happens to be stored on the row.
                  const permCount = admin.isSuperAdmin ? ALL_PERMISSIONS.length : ALL_PERMISSIONS.filter(k => admin.permissions[k]).length
                  const isPending = admin.invitationStatus === 'Sent' || admin.invitationStatus === 'Pending'
                  return (
                    <tr key={admin.id}>
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                          <div className="adm-avatar">{admin.name.slice(0,2).toUpperCase()}</div>
                          <div>
                            <div style={{ fontWeight: 600, color: "#111827", fontSize: 13.5 }}>{admin.name}</div>
                            {admin.isSuperAdmin && (
                              <span className="adm-super-badge">
                                <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" style={{ marginRight: 3, verticalAlign: "-1px" }}><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
                                Super Admin
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td style={{ color: "#6b7280" }}>{admin.email}</td>
                      <td style={{ color: "#6b7280" }}>{admin.jobTitle || "—"}</td>
                      <td>
                        <span className="badge badge-blue">{admin.role}</span>
                      </td>
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <div className="adm-perm-bar">
                            <div className="adm-perm-fill" style={{ width: `${(permCount/ALL_PERMISSIONS.length)*100}%` }} />
                          </div>
                          <span style={{ fontSize: 12, color: "#6b7280" }}>{permCount}/{ALL_PERMISSIONS.length}</span>
                        </div>
                      </td>
                      <td>
                        {isPending ? (
                          <span className="ps-badge" style={{ background: "#fef3c7", color: "#b45309" }}>Pending Invitation</span>
                        ) : (
                          <label className="adm-toggle-wrap" title={admin.active ? "Active — click to deactivate" : "Disabled — click to activate"}>
                            <input
                              type="checkbox"
                              checked={admin.active !== false}
                              disabled={admin.isSuperAdmin}
                              onChange={e => {
                                const active = e.target.checked
                                setSensitiveAction({
                                  title: active ? "Enable administrator account" : "Disable administrator account",
                                  warning: active ? "The user will regain access immediately." : "The user's Supabase Auth access will be revoked.",
                                  actionLabel: active ? "Verify & Enable" : "Verify & Disable",
                                  run: async token => { await onToggleActive?.(admin.id, active, token); setSensitiveAction(null) },
                                })
                              }}
                              style={{ display: "none" }}
                            />
                            <div className={"adm-toggle" + (admin.active !== false ? " on" : "")}>
                              <div className="adm-toggle-knob" />
                            </div>
                            <span style={{ fontSize: 12, color: admin.active !== false ? "#15803d" : "#9ca3af" }}>
                              {admin.active !== false ? "Active" : "Disabled"}
                            </span>
                          </label>
                        )}
                      </td>
                      <td>
                        <div style={{ display: "flex", gap: 6 }}>
                          {!admin.isSuperAdmin && (
                            <>
                              <button className="ps-action-btn" title="Edit Permissions" onClick={() => setEditing({ ...admin })}>
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                              </button>
                              {onResetCredentials && (
                                <button className="ps-action-btn" title={isPending ? "Resend Invite" : "Reset & Resend Setup Link"} onClick={() => setSensitiveAction({
                                  title: isPending ? "Resend invitation" : "Reset & resend setup link",
                                  warning: isPending ? "A fresh one-time setup link will be emailed to them; the previous link stops working." : "This immediately revokes their current password and any active sessions. They'll receive a new one-time setup link by email.",
                                  actionLabel: isPending ? "Verify & Resend Invite" : "Verify & Reset Access",
                                  run: async token => { await onResetCredentials(admin.id, token); setSensitiveAction(null) },
                                })}>
                                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>
                                </button>
                              )}
                              <button className="ps-action-btn ps-action-danger" title={isPending ? "Cancel Invite" : "Remove access"} onClick={() => setSensitiveAction({
                                title: isPending ? "Cancel invitation" : "Remove administrator access",
                                warning: isPending ? "This cancels the pending invitation and revokes the setup link. It can be re-invited later." : "This safely disables the account and revokes sign-in access. Historical audit records are preserved.",
                                actionLabel: isPending ? "Verify & Cancel Invite" : "Verify & Remove Access",
                                run: async token => { await onDelete?.(admin.id, token); setSensitiveAction(null) },
                              })}>
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
                              </button>
                            </>
                          )}
                          {admin.isSuperAdmin && (
                            <span style={{ fontSize: 11.5, color: "#9ca3af", padding: "6px 0" }}>Protected</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Create modal */}
      <Modal open={showCreate} title="Invite Admin" onClose={() => setShowCreate(false)}>
        <form className="form-grid" onSubmit={submitCreate}>
          <Input label="Full Name" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Warehouse Manager" required />
          <Input label="Email" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="staff@punjabexoticfoods.com" required />
          <Input label="Job Title" value={jobTitle} onChange={e => setJobTitle(e.target.value)} placeholder="e.g. Sales Executive" />
          <Select label="Role" options={currentUserIsSystemDeveloper ? ["Staff", "Manager", "Supervisor", "Super Admin", "System Developer"] : ["Staff", "Manager", "Supervisor", "Super Admin"]} value={role} onChange={setRole} />
          <p className="wide invite-explainer">The recipient will receive a secure one-time link and choose their own password. Passwords are never created by administrators.</p>
          <div className="wide">
            <label className="form-control">
              <span>Apply Role Template (optional — fills permissions below, still editable)</span>
              <select onChange={e => e.target.value && applyTemplate(e.target.value, "create")} defaultValue="">
                <option value="" disabled>Select a template…</option>
                {roleTemplates.map(t => <option key={t.id} value={t.id}>{t.name} — {t.description}</option>)}
              </select>
            </label>
          </div>
          <PermGrid perms={perms} onChange={setPerms} />
          {formError && <p className="wide" style={{ color: "#b91c1c", fontSize: 13, background: "#fef2f2", borderRadius: 8, padding: "8px 12px", margin: 0 }}>{formError}</p>}
          <div className="wide actions-row">
            <Button type="submit" disabled={creating}>
              {creating ? "Sending Invitation…" : isSensitiveAdminGrant(role, perms) ? "Continue to Verification" : "Send Invitation"}
            </Button>
            <Button type="button" variant="secondary" onClick={() => setShowCreate(false)} disabled={creating}>Cancel</Button>
          </div>
        </form>
      </Modal>

      {/* Edit modal */}
      <Modal open={Boolean(editing)} title="Edit Admin Account" onClose={() => setEditing(null)}>
        {editing && (
          <form className="form-grid" onSubmit={submitEdit}>
            <Input label="Full Name" value={editing.name} onChange={e => setEditing({ ...editing, name: e.target.value })} required />
            <Input label="Email" type="email" value={editing.email} onChange={e => setEditing({ ...editing, email: e.target.value })} required />
            <Input label="Job Title" value={editing.jobTitle ?? ""} onChange={e => setEditing({ ...editing, jobTitle: e.target.value })} placeholder="e.g. Sales Executive" />
            <Select label="Role" options={currentUserIsSystemDeveloper ? ["Staff", "Manager", "Supervisor", "Super Admin", "System Developer"] : ["Staff", "Manager", "Supervisor", "Super Admin"]} value={editing.role} onChange={v => setEditing({ ...editing, role: v })} />
            <div className="wide">
              <label className="form-control">
                <span>Apply Role Template (optional — fills permissions below, still editable)</span>
                <select onChange={e => e.target.value && applyTemplate(e.target.value, "edit")} defaultValue="">
                  <option value="" disabled>Select a template…</option>
                  {roleTemplates.map(t => <option key={t.id} value={t.id}>{t.name} — {t.description}</option>)}
                </select>
              </label>
            </div>
            <PermGrid perms={editing.permissions} onChange={p => setEditing({ ...editing, permissions: p })} />
            <div className="wide actions-row">
              <Button type="submit">Save Changes</Button>
              <Button type="button" variant="secondary" onClick={() => setEditing(null)}>Cancel</Button>
            </div>
          </form>
        )}
      </Modal>
      <SensitiveActionDialog
        open={Boolean(sensitiveAction)}
        title={sensitiveAction?.title ?? "Sensitive action"}
        warning={sensitiveAction?.warning}
        actionLabel={sensitiveAction?.actionLabel}
        onClose={() => setSensitiveAction(null)}
        onVerified={async token => sensitiveAction?.run(token)}
      />
    </div>
  )
}
