import { useEffect, useMemo, useRef, useState } from "react"
import type { Customer } from "../../types"
import { Button } from "../../components/ui/Button"
import { Modal } from "../../components/ui/Modal"
import { listFiles, uploadFile, deleteFile, MAX_FILE_BYTES, type StoredFile } from "../../lib/fileService"

const fmtSize = (b: number) => b >= 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`

function fileKind(type: string, name: string) {
  if (type.startsWith("image/")) return { label: "Image", bg: "#e8f8ec", color: "#1f7a3a" }
  if (type === "application/pdf" || name.toLowerCase().endsWith(".pdf")) return { label: "PDF", bg: "#fee2e2", color: "#b91c1c" }
  if (/sheet|excel|csv/.test(type) || /\.(xlsx?|csv)$/i.test(name)) return { label: "Sheet", bg: "#dcfce7", color: "#15803d" }
  if (/word|document/.test(type) || /\.docx?$/i.test(name)) return { label: "Doc", bg: "#dbeafe", color: "#1d4ed8" }
  return { label: "File", bg: "#fef3c7", color: "#b45309" }
}

export function FilesPage({ customers }: { customers: Customer[] }) {
  const [files, setFiles] = useState<StoredFile[]>([])
  const [loading, setLoading] = useState(true)
  const [note, setNote] = useState("")
  const [forCustomer, setForCustomer] = useState<string>("") // "" = internal only
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [preview, setPreview] = useState<StoredFile | null>(null)
  const [query, setQuery] = useState("")
  const [filterCustomer, setFilterCustomer] = useState<string>("all")
  const inputRef = useRef<HTMLInputElement | null>(null)

  const load = async () => {
    setLoading(true)
    setFiles(await listFiles())
    setLoading(false)
  }
  useEffect(() => { load() }, [])

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
      const customer = customers.find(c => c.id === forCustomer)
      await uploadFile(f.name, f.type || "application/octet-stream", f.size, dataUri, note.trim(),
        customer?.id ?? null, customer?.companyName ?? "Internal only")
      setNote("")
      if (inputRef.current) inputRef.current.value = ""
      await load()
    } catch {
      setError("Upload failed — please try again.")
    }
    setBusy(false)
  }

  const remove = async (f: StoredFile) => {
    if (!window.confirm(`Delete "${f.name}"? This cannot be undone.`)) return
    await deleteFile(f.id)
    await load()
  }

  const customerFileCounts = useMemo(() => {
    const m: Record<string, number> = {}
    for (const f of files) m[f.customerId ?? "internal"] = (m[f.customerId ?? "internal"] ?? 0) + 1
    return m
  }, [files])

  const shown = files.filter(f => {
    const q = query.trim().toLowerCase()
    const matchesQuery = !q || `${f.name} ${f.note} ${f.customerName}`.toLowerCase().includes(q)
    const matchesFilter = filterCustomer === "all"
      || (filterCustomer === "internal" && !f.customerId)
      || f.customerId === filterCustomer
    return matchesQuery && matchesFilter
  })

  return (
    <div className="stack">
      <div>
        <p className="control-centre-label">Punjab Exotic Foods Control Centre</p>
        <h2 style={{ fontSize: 22, fontWeight: 800, color: "#0d2b1e" }}>Files &amp; Documents</h2>
        <p style={{ fontSize: 13.5, color: "#6b7a70", marginTop: 3 }}>
          Store invoices and documents for a specific customer, or keep them internal — synced to the database for every admin.
        </p>
      </div>

      {/* upload card */}
      <div className="fl-upload">
        <div className="fl-drop" onClick={() => inputRef.current?.click()}>
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
          <div>
            <strong>{busy ? "Uploading…" : "Click to upload a file"}</strong>
            <small>PDF, images, Word or Excel — up to 2 MB</small>
          </div>
          <input
            ref={inputRef} type="file" style={{ display: "none" }}
            accept=".pdf,.png,.jpg,.jpeg,.webp,.gif,.doc,.docx,.xls,.xlsx,.csv"
            onChange={e => onPick(e.target.files?.[0])}
          />
        </div>
        <label className="form-control" style={{ minWidth: 200 }}>
          <span>For customer</span>
          <select value={forCustomer} onChange={e => setForCustomer(e.target.value)}>
            <option value="">Internal only (staff)</option>
            {customers.map(c => <option key={c.id} value={c.id}>{c.companyName} — {c.customerNumber}</option>)}
          </select>
        </label>
        <label className="form-control" style={{ flex: 1, minWidth: 200 }}>
          <span>Label (optional)</span>
          <input placeholder="e.g. Invoice — March deliveries" value={note} onChange={e => setNote(e.target.value)} />
        </label>
      </div>
      {error && <p style={{ color: "#b91c1c", fontSize: 13, background: "#fef2f2", borderRadius: 8, padding: "8px 12px" }}>{error}</p>}

      {/* file list */}
      <div className="db-quick-section" style={{ margin: 0 }}>
        <div className="db-section-head">
          <h3 className="db-section-title">{files.length} file{files.length !== 1 ? "s" : ""} stored</h3>
          <div className="ps-search-wrap" style={{ maxWidth: 220, padding: "6px 12px" }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input className="ps-search" placeholder="Search files…" value={query} onChange={e => setQuery(e.target.value)} />
          </div>
        </div>

        {/* customer filter chips */}
        <div className="fl-filters">
          <button className={"fl-chip" + (filterCustomer === "all" ? " on" : "")} onClick={() => setFilterCustomer("all")}>
            All <span className="fl-chip-count">{files.length}</span>
          </button>
          <button className={"fl-chip" + (filterCustomer === "internal" ? " on" : "")} onClick={() => setFilterCustomer("internal")}>
            Internal only {customerFileCounts.internal ? <span className="fl-chip-count">{customerFileCounts.internal}</span> : null}
          </button>
          {customers.filter(c => customerFileCounts[c.id]).map(c => (
            <button key={c.id} className={"fl-chip" + (filterCustomer === c.id ? " on" : "")} onClick={() => setFilterCustomer(c.id)}>
              {c.companyName} <span className="fl-chip-count">{customerFileCounts[c.id]}</span>
            </button>
          ))}
        </div>

        {loading ? (
          <div className="db-empty">Loading files…</div>
        ) : shown.length === 0 ? (
          <div className="db-empty">
            {files.length === 0 ? "No files yet — upload your first invoice or document above." : "No files match your search or filter."}
          </div>
        ) : (
          <div className="fl-list">
            {shown.map(f => {
              const kind = fileKind(f.type, f.name)
              const canPreview = f.type.startsWith("image/") || f.type === "application/pdf"
              return (
                <div key={f.id} className="fl-row">
                  <span className="fl-kind" style={{ background: kind.bg, color: kind.color }}>{kind.label}</span>
                  <div className="fl-info">
                    <div className="fl-name">{f.name}</div>
                    <div className="fl-meta">
                      <span className={"fl-owner" + (f.customerId ? "" : " internal")}>{f.customerName}</span>
                      {f.note && <> · {f.note}</>} · {fmtSize(f.size)} · {f.uploadedAt ? new Date(f.uploadedAt).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "—"}
                    </div>
                  </div>
                  <div className="fl-actions">
                    {canPreview && <Button variant="secondary" className="btn-sm" onClick={() => setPreview(f)}>Preview</Button>}
                    <a className="btn btn-secondary btn-sm" href={f.dataUri} download={f.name}>Download</a>
                    <Button variant="danger" className="btn-sm" onClick={() => remove(f)}>Delete</Button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* preview modal */}
      <Modal open={Boolean(preview)} title={preview?.name ?? "Preview"} onClose={() => setPreview(null)}>
        {preview && (
          preview.type.startsWith("image/")
            ? <img src={preview.dataUri} alt={preview.name} style={{ maxWidth: "100%", borderRadius: 10 }} />
            : <iframe src={preview.dataUri} title={preview.name} style={{ width: "100%", height: "62vh", border: "none", borderRadius: 10 }} />
        )}
      </Modal>
    </div>
  )
}
