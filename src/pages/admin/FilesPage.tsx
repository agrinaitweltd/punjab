import { useEffect, useMemo, useRef, useState } from "react"
import type { Customer, Invoice } from "../../types"
import { Button } from "../../components/ui/Button"
import { Modal } from "../../components/ui/Modal"
import { listFiles, uploadFile, deleteFile, renameFile, getFileById, MAX_FILE_BYTES, type StoredFile } from "../../lib/fileService"
import { getStatements } from "../../lib/statementsService"
import type { StatementRecord } from "../../lib/secureAdminApi"
import { confirmAction } from "../../lib/appDialogs"
import { supabase } from "../../lib/supabase"
import { runtimeTable } from "../../lib/runtimeMode"

const fmtSize = (b: number) => b >= 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`

function fileKind(type: string, name: string) {
  if (type.startsWith("image/")) return { label: "Image", bg: "#e8f8ec", color: "#1f7a3a" }
  if (type === "application/pdf" || name.toLowerCase().endsWith(".pdf")) return { label: "PDF", bg: "#fee2e2", color: "#b91c1c" }
  if (/sheet|excel|csv/.test(type) || /\.(xlsx?|csv)$/i.test(name)) return { label: "Sheet", bg: "#dcfce7", color: "#15803d" }
  if (/word|document/.test(type) || /\.docx?$/i.test(name)) return { label: "Doc", bg: "#dbeafe", color: "#1d4ed8" }
  return { label: "File", bg: "#fef3c7", color: "#b45309" }
}

const INTERNAL = "__internal__"
const DOCUMENT_CATEGORIES = ['All','Invoices','Statements','Payment Notices','Credit Notes','Delivery Documents','Receipts','Other Documents']
function categoryFor(file: StoredFile) { const text=`${file.name} ${file.note}`.toLowerCase(); if(text.includes('statement'))return 'Statements'; if(text.includes('payment notice'))return 'Payment Notices'; if(text.includes('credit note'))return 'Credit Notes'; if(text.includes('delivery'))return 'Delivery Documents'; if(text.includes('receipt'))return 'Receipts'; if(text.includes('invoice'))return 'Invoices'; return 'Other Documents' }

const documentTypeLabel = (f: StoredFile) => {
  if (f.documentRole === 'canonical_invoice') return 'Generated Invoice'
  if (f.documentRole === 'credit_note_source') return 'Credit Note'
  if (f.documentRole === 'legacy_source' && f.invoiceId) return 'Original Invoice'
  return categoryFor(f)
}
const documentSubtitle = (f: StoredFile) => {
  if (f.documentRole === 'canonical_invoice') return 'Punjab Exotic Foods PDF'
  if (f.documentRole === 'credit_note_source') return 'Source Credit Note'
  if (f.documentRole === 'legacy_source' && f.invoiceId) return 'Source PDF'
  return null
}
const documentReference = (f: StoredFile) => f.invoiceNumber ?? f.creditNoteNumber ?? '—'
/** Email-import writes always tag the source PDF's note with "(email
    import)" (see server/email-import/create-records.js's uploadFileServer
    calls) - the manual "Add Customer via PDF" path never does, so this is a
    reliable enough signal without needing a dedicated column. */
const importSource = (f: StoredFile) => /\(email import\)/i.test(f.note ?? '') ? 'Email' : 'Manual'

export function FilesPage({ customers, invoices = [] }: { customers: Customer[]; invoices?: Invoice[] }) {
  const [files, setFiles] = useState<StoredFile[]>([])
  const [loading, setLoading] = useState(true)
  const [folderQuery, setFolderQuery] = useState("")
  const [selected, setSelected] = useState<string>(INTERNAL)
  const [note, setNote] = useState("")
  const [category, setCategory] = useState('All')
  const [uploadCategory, setUploadCategory] = useState('Other Documents')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [preview, setPreview] = useState<StoredFile | null>(null)
  const [renaming, setRenaming] = useState<StoredFile | null>(null)
  const [renameValue, setRenameValue] = useState("")
  /** "Generated Documents" (item 18) - a flat, cross-customer view of every
      system-created document (canonical invoice PDFs, credit notes,
      statements), as distinct from browsing uploaded source files folder by
      folder below. */
  const [view, setView] = useState<'folders' | 'generated' | 'statements'>('folders')
  const [statements, setStatements] = useState<StatementRecord[]>([])
  const inputRef = useRef<HTMLInputElement | null>(null)

  const load = async (showSpinner = true) => {
    if (showSpinner) setLoading(true)
    const [fileList, statementList] = await Promise.all([listFiles(), getStatements()])
    setFiles(fileList)
    setStatements(statementList)
    if (showSpinner) setLoading(false)
  }
  useEffect(() => { load() }, [])

  /** Documents live as FILE: rows in activity_log (see fileService.ts) rather
      than their own table, so realtime here just triggers a quiet reload of
      the already-scoped listFiles() query on any change to that table -
      cheaper than duplicating listFiles()'s base64/metadata parsing inline,
      and still never touches unrelated tables. Debounced so a burst of
      changes (e.g. several files uploaded at once) reloads once, not per row. */
  useEffect(() => {
    if (!supabase) return
    const client = supabase
    let timer: ReturnType<typeof setTimeout> | null = null
    const channel = client
      .channel(`sync:${runtimeTable('activity_log')}:files`)
      .on('postgres_changes', { event: '*', schema: 'public', table: runtimeTable('activity_log') }, () => {
        if (timer) clearTimeout(timer)
        timer = setTimeout(() => load(false), 400)
      })
      .subscribe()
    return () => { if (timer) clearTimeout(timer); client.removeChannel(channel) }
  }, [])

  const fileCounts = useMemo(() => {
    const m: Record<string, number> = {}
    for (const f of files) m[f.customerId ?? INTERNAL] = (m[f.customerId ?? INTERNAL] ?? 0) + 1
    return m
  }, [files])

  const folders = useMemo(() => {
    const q = folderQuery.trim().toLowerCase()
    return customers.filter(c => {
      if (!q) return true
      const customerInvoices = invoices.filter(i => i.customerId === c.id).map(i => i.invoiceNumber).join(' ')
      return `${c.companyName} ${c.customerNumber} ${c.email} ${c.phone} ${customerInvoices}`.toLowerCase().includes(q)
    })
  }, [customers, invoices, folderQuery])

  const invoiceById = useMemo(() => new Map(invoices.map(i => [i.id, i])), [invoices])
  const customerByIdMap = useMemo(() => new Map(customers.map(c => [c.id, c])), [customers])

  // Every source or generated invoice/credit-note document, customer- and
  // account-labelled, so an incorrect association is easy to spot at a
  // glance - excludes only uncategorised internal uploads ('general'),
  // which have no invoice/credit-note to relate to.
  const generatedDocs = useMemo(
    () => files.filter(f => f.documentRole && f.documentRole !== 'general')
      .filter(f => !folderQuery.trim() || `${f.name} ${f.customerName} ${documentReference(f)}`.toLowerCase().includes(folderQuery.trim().toLowerCase()))
      .sort((a, b) => (b.uploadedAt || '').localeCompare(a.uploadedAt || '')),
    [files, folderQuery],
  )

  const selectedCustomer = selected === INTERNAL ? null : customers.find(c => c.id === selected)
  const folderFiles = files.filter(f => {
    const inFolder = selected === INTERNAL ? !f.customerId : f.customerId === selected
    const q = folderQuery.trim().toLowerCase()
    return inFolder && (category === 'All' || categoryFor(f) === category) && (!q || `${f.name} ${f.note ?? ''}`.toLowerCase().includes(q) || (selected !== INTERNAL && folders.some(c => c.id === selected)))
  })

  const onPick = async (f: File | undefined) => {
    if (!f) return
    setError("")
    if (f.size > MAX_FILE_BYTES) { setError(`"${f.name}" is ${fmtSize(f.size)} — the limit is 2 MB.`); return }
    setBusy(true)
    try {
      const dataUri = await new Promise<string>((resolve, reject) => {
        const r = new FileReader()
        r.onload = () => resolve(String(r.result))
        r.onerror = () => reject(r.error)
        r.readAsDataURL(f)
      })
      await uploadFile(f.name, f.type || "application/octet-stream", f.size, dataUri, `${uploadCategory}: ${note.trim()}`.trim(),
        selectedCustomer?.id ?? null, selectedCustomer?.companyName ?? "Internal only")
      setNote("")
      if (inputRef.current) inputRef.current.value = ""
      await load()
    } catch {
      setError("Upload failed — please try again.")
    }
    setBusy(false)
  }

  const remove = async (f: StoredFile) => {
    if (!await confirmAction(`Delete "${f.name}"? This cannot be undone.`)) return
    await deleteFile(f.id)
    await load()
  }

  const startRename = (f: StoredFile) => { setRenaming(f); setRenameValue(f.name) }
  const submitRename = async () => {
    if (!renaming || !renameValue.trim()) return
    await renameFile(renaming.id, renameValue.trim())
    setRenaming(null)
    await load()
  }

  return (
    <div className="stack">
      <div>
        <p className="control-centre-label">Punjab Exotic Foods Control Centre</p>
        <h2 style={{ fontSize: 22, fontWeight: 800, color: "#0d2b1e" }}>Files &amp; Documents</h2>
        <p style={{ fontSize: 13.5, color: "#6b7a70", marginTop: 3 }}>
          Browse customers like folders — open one to add, rename, or delete their invoices and documents.
        </p>
      </div>

      <div className="invoice-tabs">
        <button className={`invoice-tab${view === 'folders' ? ' active' : ''}`} onClick={() => setView('folders')}>By Customer</button>
        <button className={`invoice-tab${view === 'generated' ? ' active' : ''}`} onClick={() => setView('generated')}>All Invoice/Credit Note Documents</button>
        <button className={`invoice-tab${view === 'statements' ? ' active' : ''}`} onClick={() => setView('statements')}>
          Statements{statements.length > 0 ? ` (${statements.length})` : ''}
        </button>
      </div>

      {view === 'statements' ? (
        <div className="doc-content" style={{ width: '100%' }}>
          <p style={{ fontSize: 12.5, color: "#6b7a70", margin: "0 0 12px" }}>
            Customer statements are kept as documents and reconciliation records only — they never create invoices,
            payments or credit notes, so a statement can't double-count a customer's balance.
          </p>
          <div className="ps-table-wrap">
            <table className="ps-table">
              <thead>
                <tr><th>Customer</th><th>Account No.</th><th>Statement Date</th><th>Invoices</th><th>Outstanding</th><th>Reconciliation</th><th>Source</th><th style={{ textAlign: 'right' }}>Actions</th></tr>
              </thead>
              <tbody>
                {statements.map(st => {
                  const tone = st.reconciliation_status === 'reconciled'
                    ? { background: '#dcfce7', color: '#15803d', label: 'Reconciled' }
                    : st.reconciliation_status === 'unmatched_customer'
                      ? { background: '#fee2e2', color: '#b91c1c', label: 'No customer matched' }
                      : { background: '#fef3c7', color: '#b45309', label: 'Requires review' }
                  return (
                    <tr key={st.id} className="ps-row">
                      <td><div className="fl-name">{st.customer_name ?? 'Unmatched'}</div></td>
                      <td>{st.account_number ?? '—'}</td>
                      <td style={{ whiteSpace: 'nowrap' }}>{st.statement_date ?? '—'}</td>
                      <td>{st.invoice_count}</td>
                      <td><strong>£{Number(st.total_outstanding ?? 0).toFixed(2)}</strong></td>
                      <td>
                        <span className="ps-badge" style={{ background: tone.background, color: tone.color }}>{tone.label}</span>
                        {st.reconciliation_notes?.length > 0 && (
                          <div style={{ fontSize: 11.5, color: '#9ca3af', marginTop: 3, maxWidth: 300 }}>
                            {st.reconciliation_notes.map(n => n.text).join(' ')}
                          </div>
                        )}
                      </td>
                      <td style={{ textTransform: 'capitalize' }}>{st.import_source}</td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                          {st.source_document_id && (
                            <Button variant="secondary" className="btn-sm" onClick={async () => {
                              const file = await getFileById(st.source_document_id!)
                              if (file) setPreview(file)
                            }}>View</Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            {statements.length === 0 && <div className="db-empty">No customer statements received yet.</div>}
          </div>
        </div>
      ) : view === 'generated' ? (
        <div className="doc-content" style={{ width: '100%' }}>
          <div className="ps-search-wrap" style={{ margin: "0 0 12px", maxWidth: 340 }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input className="ps-search" placeholder="Search customer, document or reference…" value={folderQuery} onChange={e => setFolderQuery(e.target.value)} />
          </div>
          <div className="ps-table-wrap">
            <table className="ps-table">
              <thead><tr><th>Document</th><th>Customer</th><th>Account No.</th><th>Reference</th><th>Date</th><th>Source</th><th>Status</th><th style={{ textAlign: 'right' }}>Actions</th></tr></thead>
              <tbody>
                {generatedDocs.map(f => {
                  const invoice = f.invoiceId ? invoiceById.get(f.invoiceId) : undefined
                  const customer = f.customerId ? customerByIdMap.get(f.customerId) : undefined
                  const subtitle = documentSubtitle(f)
                  return (
                  <tr key={f.id}>
                    <td>
                      <span className={`doc-role-badge ${f.documentRole === 'legacy_source' ? 'source' : 'generated'}`}>{documentTypeLabel(f)}</span>
                      {subtitle && <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 2 }}>{subtitle}</div>}
                    </td>
                    <td>{f.customerName || 'Internal'}</td>
                    <td>{customer?.customerNumber || '—'}</td>
                    <td>{documentReference(f)}</td>
                    <td>{f.uploadedAt ? new Date(f.uploadedAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—"}</td>
                    <td>{importSource(f)}</td>
                    <td>{invoice ? invoice.status : (f.creditNoteId ? 'Active' : '—')}</td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                        {(f.type.startsWith("image/") || f.type === "application/pdf") && <Button variant="secondary" className="btn-sm" onClick={() => setPreview(f)}>View</Button>}
                        <a className="btn btn-secondary btn-sm" href={f.dataUri} download={f.name}>Download</a>
                      </div>
                    </td>
                  </tr>
                  )
                })}
              </tbody>
            </table>
            {generatedDocs.length === 0 && <div className="db-empty">No invoice or credit-note documents yet.</div>}
          </div>
        </div>
      ) : (
      <div className="doc-layout">
        {/* Folder list */}
        <div className="doc-sidebar">
          <div className="ps-search-wrap" style={{ margin: "0 0 10px" }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input className="ps-search" placeholder="Search customers…" value={folderQuery} onChange={e => setFolderQuery(e.target.value)} />
          </div>
          <div className="doc-folder-list">
            <button className={"doc-folder" + (selected === INTERNAL ? " active" : "")} onClick={() => setSelected(INTERNAL)}>
              <span className="doc-folder-icon internal">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
              </span>
              <span className="doc-folder-name">Internal Only</span>
              {fileCounts[INTERNAL] ? <span className="fl-chip-count">{fileCounts[INTERNAL]}</span> : null}
            </button>
            {folders.map((c, i) => (
              <button key={c.id} className={"doc-folder" + (selected === c.id ? " active" : "")} onClick={() => setSelected(c.id)}>
                <span className="doc-folder-icon" style={{ background: `hsl(${(i * 47) % 360} 55% 92%)`, color: `hsl(${(i * 47) % 360} 45% 35%)` }}>
                  {c.companyName.slice(0, 2).toUpperCase()}
                </span>
                <span className="doc-folder-name">{c.companyName}<small>{c.customerNumber}</small></span>
                {fileCounts[c.id] ? <span className="fl-chip-count">{fileCounts[c.id]}</span> : null}
              </button>
            ))}
            {folders.length === 0 && (
              <div className="db-empty" style={{ padding: "20px 8px" }}>
                {folderQuery ? "No customers match your search." : "No customers yet — add one from the Customers page."}
              </div>
            )}
          </div>
        </div>

        {/* Selected folder's files */}
        <div className="doc-content">
          <div className="doc-content-head">
            <span className="doc-folder-icon internal" style={selectedCustomer ? { background: "#e8f8ec", color: "#1f7a3a" } : undefined}>
              {selectedCustomer ? selectedCustomer.companyName.slice(0, 2).toUpperCase() : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
              )}
            </span>
            <div>
              <h3 style={{ fontSize: 15, fontWeight: 800, color: "#111827" }}>{selectedCustomer ? selectedCustomer.companyName : "Internal Only"}</h3>
              <p style={{ fontSize: 12, color: "#9ca3af" }}>{selectedCustomer ? `Account ${selectedCustomer.customerNumber} · ` : ''}{folderFiles.length} file{folderFiles.length !== 1 ? "s" : ""}</p>
            </div>
          </div>

          {selectedCustomer && <div className="document-categories">{DOCUMENT_CATEGORIES.map(x=><button key={x} className={category===x?'active':''} onClick={()=>setCategory(x)}>{x}</button>)}</div>}
          <div className="fl-upload" style={{ marginBottom: 16 }}>
            <div className="fl-drop" onClick={() => inputRef.current?.click()}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
              <div>
                <strong>{busy ? "Uploading…" : `Add a file to ${selectedCustomer ? selectedCustomer.companyName : "Internal Only"}`}</strong>
                <small>PDF, images, Word or Excel — up to 2 MB</small>
              </div>
              <input
                ref={inputRef} type="file" style={{ display: "none" }}
                accept=".pdf,.png,.jpg,.jpeg,.webp,.docx,.xlsx,.csv"
                onChange={e => onPick(e.target.files?.[0])}
              />
            </div>
            <label className="form-control" style={{ flex: 1, minWidth: 200 }}>
              <span>Label (optional)</span>
              <input placeholder="e.g. Invoice — March deliveries" value={note} onChange={e => setNote(e.target.value)} />
            </label>
            <label className="form-control" style={{ minWidth: 170 }}><span>Document category</span><select value={uploadCategory} onChange={e=>setUploadCategory(e.target.value)}>{DOCUMENT_CATEGORIES.slice(1).map(x=><option key={x}>{x}</option>)}</select></label>
          </div>
          {error && <p style={{ color: "#b91c1c", fontSize: 13, background: "#fef2f2", borderRadius: 8, padding: "8px 12px", marginBottom: 16 }}>{error}</p>}

          {loading ? (
            <div className="db-empty">Loading files…</div>
          ) : folderFiles.length === 0 ? (
            <div className="db-empty">No files in this folder yet — upload the first one above.</div>
          ) : (
            <div className="fl-list">
              {folderFiles.map(f => {
                const kind = fileKind(f.type, f.name)
                const canPreview = f.type.startsWith("image/") || f.type === "application/pdf"
                return (
                  <div key={f.id} className="fl-row">
                    <span className="fl-kind" style={{ background: kind.bg, color: kind.color }}>{kind.label}</span>
                    <div className="fl-info">
                      <div className="fl-name">
                        {f.name}{" "}
                        {f.documentRole && f.documentRole !== 'general' && (
                          <span className={`doc-role-badge ${f.documentRole === 'legacy_source' ? 'source' : 'generated'}`}>
                            {documentTypeLabel(f)}{documentSubtitle(f) ? ` — ${documentSubtitle(f)}` : ''}
                          </span>
                        )}
                      </div>
                      <div className="fl-meta">
                        {f.note && <>{f.note} · </>}
                        {fmtSize(f.size)} · {f.uploadedAt ? new Date(f.uploadedAt).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "—"}
                      </div>
                    </div>
                    <div className="fl-actions">
                      {canPreview && <Button variant="secondary" className="btn-sm" onClick={() => setPreview(f)}>Preview</Button>}
                      <Button variant="secondary" className="btn-sm" onClick={() => startRename(f)}>Rename</Button>
                      <a className="btn btn-secondary btn-sm" href={f.dataUri} download={f.name}>Download</a>
                      <Button variant="danger" className="btn-sm" onClick={() => remove(f)}>Delete</Button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
      )}

      {/* preview modal */}
      <Modal open={Boolean(preview)} title={preview?.name ?? "Preview"} onClose={() => setPreview(null)}>
        {preview && (
          preview.type.startsWith("image/")
            ? <img src={preview.dataUri} alt={preview.name} style={{ maxWidth: "100%", borderRadius: 10 }} />
            : <iframe src={preview.dataUri} title={preview.name} style={{ width: "100%", height: "62vh", border: "none", borderRadius: 10 }} />
        )}
      </Modal>

      {/* rename modal */}
      <Modal open={Boolean(renaming)} title="Rename File" onClose={() => setRenaming(null)}>
        <label className="form-control">
          <span>File name</span>
          <input value={renameValue} onChange={e => setRenameValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === "Enter") submitRename() }} />
        </label>
        <div className="actions-row" style={{ marginTop: 16 }}>
          <Button onClick={submitRename} disabled={!renameValue.trim()}>Save</Button>
          <Button variant="secondary" onClick={() => setRenaming(null)}>Cancel</Button>
        </div>
      </Modal>
    </div>
  )
}
