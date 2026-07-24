import { useEffect, useState } from "react"
import type { FormEvent } from "react"
import type { AdminRole, AdminStaff, PermissionSet } from "../../types"
import { Button } from "../../components/ui/Button"
import { Input, Select } from "../../components/ui/Input"
import { Modal } from "../../components/ui/Modal"
import { EMPTY_PERMISSIONS, FALLBACK_ROLE_TEMPLATES } from "../../lib/permissions"

const ALL_PERMISSIONS = Object.keys(EMPTY_PERMISSIONS) as (keyof PermissionSet)[]

const basePermissions: PermissionSet = { ...EMPTY_PERMISSIONS }

/* Grouped by function so the permission picker reads like a real access
   policy rather than a flat checkbox dump. */
const PERM_GROUPS: { label: string; keys: (keyof PermissionSet)[] }[] = [
  { label: "Trading",  keys: ["customers", "customersCreate", "customersDelete", "orders", "stock", "products", "prices"] },
  { label: "Finance",  keys: ["payments", "paymentsRecord", "paymentsAllocate", "paymentsDelete", "invoicesDelete", "buyingPricesEdit", "creditNotesIssue", "extracts"] },
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
        {PERM_GROUPS.map(group => (
          <div key={group.label} className="adm-perm-group">
            <p className="adm-perm-group-title">{group.label}</p>
            <div className="adm-perm-chips">
              {group.keys.map(key => (
                <button
                  key={key} type="button"
                  className={"adm-perm-chip" + (perms[key] ? " on" : "")}
                  onClick={() => onChange({ ...perms, [key]: !perms[key] })}
                >
                  {perms[key] && (
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
                  )}
                  {key}
                </button>
              ))}
            </div>
          </div>
        ))}
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
  loadRoles,
}: {
  admins: AdminStaff[]
  onCreate: (name: string, email: string, password: string, role: string, jobTitle: string, permissions: PermissionSet) => Promise<void>
  onUpdate?: (id: string, data: Partial<AdminStaff>) => Promise<void>
  onDelete?: (id: string) => Promise<void>
  onToggleActive?: (id: string, active: boolean) => Promise<void>
  loadRoles?: () => Promise<AdminRole[]>
}) {
  const [showCreate, setShowCreate] = useState(false)
  const [editing, setEditing]       = useState<AdminStaff | null>(null)
  const [name, setName]             = useState("")
  const [email, setEmail]           = useState("")
  const [password, setPassword]     = useState("")
  const [phone, setPhone]           = useState("")
  const [jobTitle, setJobTitle]     = useState("")
  const [role, setRole]             = useState("Staff")
  const [perms, setPerms]           = useState<PermissionSet>(basePermissions)
  const [roleTemplates, setRoleTemplates] = useState<AdminRole[]>(FALLBACK_ROLE_TEMPLATES)
  const [formError, setFormError]   = useState("")

  useEffect(() => {
    loadRoles?.().then(setRoleTemplates).catch(() => setRoleTemplates(FALLBACK_ROLE_TEMPLATES))
  }, [loadRoles])

  const resetForm = () => {
    setName(""); setEmail(""); setPassword(""); setPhone(""); setJobTitle(""); setRole("Staff"); setPerms(basePermissions); setFormError("")
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
    if (!name.trim() || !email.trim() || !password.trim()) { setFormError("Name, email and password are required."); return }
    if (password.trim().length < 8) { setFormError("Password must be at least 8 characters."); return }
    if (admins.some(a => a.email.toLowerCase() === email.trim().toLowerCase())) { setFormError("An admin with that email already exists."); return }
    await onCreate(name.trim(), email.trim(), password, role, jobTitle.trim(), perms)
    resetForm(); setShowCreate(false)
  }

  const submitEdit = async (e: FormEvent) => {
    e.preventDefault()
    if (!editing || !onUpdate) return
    if (!editing.name.trim() || !editing.email.trim()) return
    await onUpdate(editing.id, editing)
    setEditing(null)
  }

  return (
    <div className="stack">
      {/* Page header */}
      <div>
        <p className="control-centre-label">Punjab Exotic Foods Control Centre</p>
        <h2 style={{ fontSize: 22, fontWeight: 800, color: "#111827" }}>Admin Users</h2>
        <p style={{ fontSize: 13.5, color: "#6b7280", marginTop: 3 }}>
          Super-admin only. Create and manage staff login accounts and permissions.
        </p>
      </div>

      {/* Super-admin notice */}
      <div className="adm-super-notice">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#22913f" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
        <span>You are logged in as <strong>Super Admin</strong>. You have full control over all admin accounts.</span>
      </div>

      {/* Admin table card */}
      <div className="card">
        <div className="card-header">
          <h3>Admin Accounts ({admins.length})</h3>
          <Button onClick={() => { resetForm(); setShowCreate(true) }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Add Admin
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
                  const permCount = ALL_PERMISSIONS.filter(k => admin.permissions[k]).length
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
                        <label className="adm-toggle-wrap" title={admin.active ? "Active — click to deactivate" : "Inactive — click to activate"}>
                          <input
                            type="checkbox"
                            checked={admin.active !== false}
                            disabled={admin.isSuperAdmin}
                            onChange={e => onToggleActive?.(admin.id, e.target.checked)}
                            style={{ display: "none" }}
                          />
                          <div className={"adm-toggle" + (admin.active !== false ? " on" : "")}>
                            <div className="adm-toggle-knob" />
                          </div>
                          <span style={{ fontSize: 12, color: admin.active !== false ? "#15803d" : "#9ca3af" }}>
                            {admin.active !== false ? "Active" : "Inactive"}
                          </span>
                        </label>
                      </td>
                      <td>
                        <div style={{ display: "flex", gap: 6 }}>
                          {!admin.isSuperAdmin && (
                            <>
                              <button className="ps-action-btn" title="Edit" onClick={() => setEditing({ ...admin })}>
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                              </button>
                              <button className="ps-action-btn ps-action-danger" title="Delete" onClick={() => onDelete?.(admin.id)}>
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
      <Modal open={showCreate} title="Create Admin Account" onClose={() => setShowCreate(false)}>
        <form className="form-grid" onSubmit={submitCreate}>
          <Input label="Full Name" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Warehouse Manager" required />
          <Input label="Email" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="staff@punjabexoticfoods.com" required />
          <Input label="Username / Login" value={phone} onChange={e => setPhone(e.target.value)} placeholder="e.g. warehouse1" />
          <Input label="Password" type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Minimum 8 characters" required />
          <Input label="Job Title" value={jobTitle} onChange={e => setJobTitle(e.target.value)} placeholder="e.g. Sales Executive" />
          <Select label="Role" options={["Staff", "Manager", "Supervisor", "Owner"]} value={role} onChange={setRole} />
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
            <Button type="submit">Create Admin</Button>
            <Button type="button" variant="secondary" onClick={() => setShowCreate(false)}>Cancel</Button>
          </div>
        </form>
      </Modal>

      {/* Edit modal */}
      <Modal open={Boolean(editing)} title="Edit Admin Account" onClose={() => setEditing(null)}>
        {editing && (
          <form className="form-grid" onSubmit={submitEdit}>
            <Input label="Full Name" value={editing.name} onChange={e => setEditing({ ...editing, name: e.target.value })} required />
            <Input label="Email" type="email" value={editing.email} onChange={e => setEditing({ ...editing, email: e.target.value })} required />
            <Input label="New Password" type="password" value={editing.password} onChange={e => setEditing({ ...editing, password: e.target.value })} placeholder="Leave blank to keep current" />
            <Input label="Job Title" value={editing.jobTitle ?? ""} onChange={e => setEditing({ ...editing, jobTitle: e.target.value })} placeholder="e.g. Sales Executive" />
            <Select label="Role" options={["Staff", "Manager", "Supervisor", "Owner"]} value={editing.role} onChange={v => setEditing({ ...editing, role: v })} />
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
    </div>
  )
}