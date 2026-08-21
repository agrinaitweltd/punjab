import { useEffect, useMemo, useRef, useState } from "react"
import type { Customer, Invoice } from "../../types"
import { Button } from "../../components/ui/Button"
import { Modal } from "../../components/ui/Modal"
import { listFiles, uploadFile, deleteFile, renameFile, MAX_FILE_BYTES, type StoredFile } from "../../lib/fileService"
import { confirmAction } from "../../lib/appDialogs"

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
  const inputRef = useRef<HTMLInputElement | null>(null)

  const load = async () => {
    setLoading(true)
    setFiles(await listFiles())
    setLoading(false)
  }
  useEffect(() => { load() }, [])

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
                      <div className="fl-name">{f.name}</div>
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
