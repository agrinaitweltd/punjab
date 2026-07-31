import { useMemo, useState } from "react"
import type { FormEvent } from "react"
import type { Product, StockItem } from "../../types"
import { Button } from "../../components/ui/Button"
import { Input, Select } from "../../components/ui/Input"
import { Modal } from "../../components/ui/Modal"
import { EmptyState } from "../../components/ui/EmptyState"
import { exportToCsv } from "../../lib/exportCsv"

const PAGE_SIZE = 10

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    available: { label: "In Stock",    cls: "ps-badge ps-badge-green" },
    low:       { label: "Low Stock",   cls: "ps-badge ps-badge-yellow" },
    out:       { label: "Out of Stock",cls: "ps-badge ps-badge-red" },
  }
  const s = map[status] ?? { label: status, cls: "ps-badge ps-badge-gray" }
  return <span className={s.cls}>{s.label}</span>
}

const initialForm = {
  productName: "", category: "", variety: "", size: "", sku: "", boxesPerPallet: "0", costPrice: "0",
}

export function ProductsPage({
  products,
  stock,
  onCreate,
  onUpdate,
  onDelete,
}: {
  products: Product[]
  stock: StockItem[]
  onCreate: (input: Omit<Product, "id">) => Promise<void>
  onUpdate: (id: string, input: Partial<Product>) => Promise<void>
  onDelete: (id: string) => Promise<void>
}) {
  const [query, setQuery]           = useState("")
  const [selected, setSelected]     = useState<Set<string>>(new Set())
  const [showStats, setShowStats]   = useState(true)
  const [page, setPage]             = useState(1)
  const [showAdd, setShowAdd]       = useState(false)
  const [editTarget, setEditTarget] = useState<Product | null>(null)
  const [form, setForm]             = useState(initialForm)

  const stockMap = useMemo(() => {
    const m: Record<string, StockItem> = {}
    for (const s of stock) m[s.productId] = s
    return m
  }, [stock])

  const filtered = useMemo(() =>
    products.filter((p) => {
      const q = query.toLowerCase()
      return !q || `${p.productName} ${p.sku} ${p.variety} ${p.category}`.toLowerCase().includes(q)
    }),
    [products, query]
  )

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const paginated  = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const toggleRow = (id: string) => {
    const next = new Set(selected)
    if (next.has(id)) next.delete(id); else next.add(id)
    setSelected(next)
  }
  const toggleAll = () => {
    if (selected.size === paginated.length) setSelected(new Set())
    else setSelected(new Set(paginated.map((p) => p.id)))
  }

  const exportProducts = () => {
    exportToCsv(
      "products",
      ["Product", "Variety", "SKU", "Size", "Category", "Boxes/Pallet", "Has Stock Line"],
      filtered.map(p => [p.productName, p.variety, p.sku, p.size, p.category, p.boxesPerPallet, stockMap[p.id] ? "Yes" : "No"]),
    )
  }

  const parseMoney = (value: string) => Math.round((parseFloat(value) || 0) * 100) / 100

  const submitCreate = async (e: FormEvent) => {
    e.preventDefault()
    await onCreate({ ...form, boxesPerPallet: Number(form.boxesPerPallet), costPrice: parseMoney(form.costPrice), productImage: "" })
    setForm(initialForm)
    setShowAdd(false)
  }

  const submitEdit = async (e: FormEvent) => {
    e.preventDefault()
    if (!editTarget) return
    await onUpdate(editTarget.id, editTarget)
    setEditTarget(null)
  }

  const bulkApplyCategory = async () => {
    const category = window.prompt(`Apply a category to ${selected.size} selected product(s):`)
    if (!category || !category.trim()) return
    await Promise.all([...selected].map(id => onUpdate(id, { category: category.trim() })))
    setSelected(new Set())
  }

  const bulkEditInfo = () => {
    if (selected.size !== 1) {
      window.alert("Select exactly one product to edit its info.")
      return
    }
    const product = products.find(p => p.id === [...selected][0])
    if (product) setEditTarget(product)
  }

  const bulkDelete = async () => {
    if (!window.confirm(`Delete ${selected.size} selected product(s)? This cannot be undone.`)) return
    await Promise.all([...selected].map(id => onDelete(id)))
    setSelected(new Set())
  }

  return (
    <div className="ps-wrap">
      {/* ── Page Header ── */}
      <div className="ps-header">
        <div>
          <p className="control-centre-label">Punjab Exotic Foods Control Centre</p>
          <h2 className="ps-title">Products</h2>
        </div>
        <div className="ps-header-actions">
          <button className="ps-icon-btn" title="Customise">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M19.07 4.93A10 10 0 0 0 4.93 19.07M4.93 4.93a10 10 0 0 0 14.14 14.14"/></svg>
          </button>
          <button className="ps-icon-btn" title="Notifications">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0"/></svg>
          </button>
          <Button variant="primary" onClick={() => setShowAdd(true)}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Add New Product
          </Button>
        </div>
      </div>

      {/* ── Toolbar ── */}
      <div className="ps-toolbar">
        <div className="ps-toolbar-left">
          <button className="ps-tool-btn">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
            Table View
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9"/></svg>
          </button>
          <div className="ps-toolbar-divider" />
          <button className="ps-tool-btn">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>
            Filter
          </button>
          <button className="ps-tool-btn">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
            Sort
          </button>
          <label className="ps-toggle-row">
            Show Statistics
            <button
              className={"ps-toggle" + (showStats ? " on" : "")}
              onClick={() => setShowStats((v) => !v)}
              type="button"
              aria-label="Toggle statistics"
            >
              <span className="ps-toggle-knob" />
            </button>
          </label>
        </div>
        <div className="ps-toolbar-right">
          <div className="ps-search-wrap">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input className="ps-search" placeholder="Search product, SKU, variety…" value={query} onChange={(e) => { setQuery(e.target.value); setPage(1) }} />
          </div>
          <button className="ps-tool-btn">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"/></svg>
            Customise
          </button>
          <button className="ps-tool-btn" onClick={exportProducts} title="Download products as CSV">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            Export
          </button>
        </div>
      </div>

      {/* ── Stats Row ── */}
      {showStats && (
        <div className="ps-stats-row">
          <div className="ps-stat">
            <p className="ps-stat-label">Total Products</p>
            <p className="ps-stat-value">{products.length}</p>
            <p className="ps-stat-sub"><span className="ps-delta-pos">+{Math.ceil(products.length * 0.12)} products</span> vs last month</p>
          </div>
          <div className="ps-stat">
            <p className="ps-stat-label">Categories</p>
            <p className="ps-stat-value">{new Set(products.map(p => p.category)).size}</p>
          </div>
          <div className="ps-stat">
            <p className="ps-stat-label">With Stock Set Up</p>
            <p className="ps-stat-value">{stock.length}</p>
          </div>
        </div>
      )}

      {/* ── Table ── */}
      <div className="ps-table-card">
        <div className="ps-table-wrap">
          <table className="ps-table">
            <thead>
              <tr>
                <th className="ps-th-check">
                  <input type="checkbox" checked={selected.size === paginated.length && paginated.length > 0} onChange={toggleAll} />
                </th>
                <th>Product</th>
                <th>SKU</th>
                <th>Size</th>
                <th>Boxes/Pallet</th>
                <th>Stock Status</th>
                <th>Category</th>
                <th className="ps-th-plus">+</th>
              </tr>
            </thead>
            <tbody>
              {paginated.map((product) => {
                const s = stockMap[product.id]
                const isSelected = selected.has(product.id)
                return (
                  <tr key={product.id} className={isSelected ? "ps-row ps-row-selected" : "ps-row"}>
                    <td className="ps-td-check">
                      <input type="checkbox" checked={isSelected} onChange={() => toggleRow(product.id)} />
                    </td>
                    <td>
                      <div className="ps-product-cell">
                        <div className="ps-product-avatar">{product.productName.slice(0, 2).toUpperCase()}</div>
                        <div>
                          <div className="ps-product-name">{product.productName}</div>
                          <div className="ps-product-variety">{product.variety}</div>
                        </div>
                      </div>
                    </td>
                    <td><code className="ps-code">{product.sku}</code></td>
                    <td>{product.size}</td>
                    <td>{product.boxesPerPallet}</td>
                    <td>{s ? <StatusBadge status={s.status} /> : <span className="ps-badge ps-badge-gray">Not stocked yet</span>}</td>
                    <td>{product.category}</td>
                    <td>
                      <div className="ps-row-actions">
                        <button className="ps-action-btn" onClick={() => setEditTarget(product)} title="Edit">
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                        </button>
                        <button className="ps-action-btn ps-action-danger" onClick={() => onDelete(product.id)} title="Delete">
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {paginated.length === 0 && (
            <EmptyState title="No products yet" description='Click "Add New Product" to create your first product.' />
          )}
        </div>

        {/* ── Bottom Selection Bar ── */}
        {selected.size > 0 && (
          <div className="ps-selection-bar">
            <span className="ps-sel-count">{selected.size} Selected</span>
            <div className="ps-sel-divider" />
            <button className="ps-sel-btn" onClick={bulkApplyCategory}>Apply Code</button>
            <div className="ps-sel-divider" />
            <button className="ps-sel-btn" onClick={bulkEditInfo}>Edit Info</button>
            <div className="ps-sel-divider" />
            <button className="ps-sel-btn ps-sel-danger" onClick={bulkDelete}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
              Delete
            </button>
            <div className="ps-sel-divider" />
            <button className="ps-sel-btn" onClick={exportProducts} title="Export selected as CSV">•••</button>
            <button className="ps-sel-close" onClick={() => setSelected(new Set())}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>
        )}

        {/* ── Pagination ── */}
        <div className="ps-pagination">
          <div className="ps-page-size">
            Showing per page
            <select className="ps-page-select" defaultValue={PAGE_SIZE}>
              <option>10</option><option>25</option><option>50</option>
            </select>
          </div>
          <div className="ps-page-nav">
            <button className="ps-pager" onClick={() => setPage(1)} disabled={page === 1}>&laquo;</button>
            <button className="ps-pager" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>&lsaquo;</button>
            {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => i + 1).map((n) => (
              <button key={n} className={"ps-pager" + (n === page ? " ps-pager-active" : "")} onClick={() => setPage(n)}>{n}</button>
            ))}
            {totalPages > 5 && <span className="ps-pager-ellipsis">…</span>}
            {totalPages > 5 && (
              <button className={"ps-pager" + (page === totalPages ? " ps-pager-active" : "")} onClick={() => setPage(totalPages)}>{totalPages}</button>
            )}
            <button className="ps-pager" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}>&rsaquo;</button>
            <button className="ps-pager" onClick={() => setPage(totalPages)} disabled={page === totalPages}>&raquo;</button>
          </div>
          <div className="ps-go-page">
            Go to page
            <input className="ps-go-input" type="number" min={1} max={totalPages} defaultValue={page} onBlur={(e) => setPage(Math.min(totalPages, Math.max(1, Number(e.target.value))))} />
            <button className="ps-go-btn" onClick={() => {}}>Go</button>
          </div>
        </div>
      </div>

      {/* ── Add Product Modal ── */}
      <Modal open={showAdd} title="Add New Product" onClose={() => setShowAdd(false)}>
        <form className="form-grid" onSubmit={submitCreate}>
          <Input label="Product Name" value={form.productName} onChange={(e) => setForm({ ...form, productName: e.target.value })} required />
          <Select label="Category" options={["Vegetables", "Fruits", "Herbs", "Other"]} value={form.category || "Vegetables"} onChange={(v) => setForm({ ...form, category: v })} />
          <Input label="Variety" value={form.variety} onChange={(e) => setForm({ ...form, variety: e.target.value })} required />
          <Input label="Size" value={form.size} onChange={(e) => setForm({ ...form, size: e.target.value })} placeholder="e.g. 5kg box" required />
          <Input label="SKU" value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} placeholder="e.g. RED-CAP-5KG" required />
          <Input label="Boxes Per Pallet" type="number" value={form.boxesPerPallet} onChange={(e) => setForm({ ...form, boxesPerPallet: e.target.value })} required />
          <p className="wide" style={{ fontSize: 12.5, color: "#6b7a70", margin: 0 }}>Selling price is set later, in Stock — this just creates the product for future use.</p>
          <div className="wide actions-row">
            <Button type="submit">Create Product</Button>
            <Button type="button" variant="secondary" onClick={() => setShowAdd(false)}>Cancel</Button>
          </div>
        </form>
      </Modal>

      {/* ── Edit Product Modal ── */}
      <Modal open={Boolean(editTarget)} title="Edit Product" onClose={() => setEditTarget(null)}>
        {editTarget && (
          <form className="form-grid" onSubmit={submitEdit}>
            <Input label="Product Name" value={editTarget.productName} onChange={(e) => setEditTarget({ ...editTarget, productName: e.target.value })} required />
            <Input label="Category" value={editTarget.category} onChange={(e) => setEditTarget({ ...editTarget, category: e.target.value })} />
            <Input label="Variety" value={editTarget.variety} onChange={(e) => setEditTarget({ ...editTarget, variety: e.target.value })} />
            <Input label="Size" value={editTarget.size} onChange={(e) => setEditTarget({ ...editTarget, size: e.target.value })} />
            <Input label="SKU" value={editTarget.sku} onChange={(e) => setEditTarget({ ...editTarget, sku: e.target.value })} />
            <Input label="Boxes Per Pallet" type="number" value={String(editTarget.boxesPerPallet)} onChange={(e) => setEditTarget({ ...editTarget, boxesPerPallet: Number(e.target.value) })} />
            <Input label="Cost Price (£ per unit, optional)" type="number" min="0" step="0.01" value={String(editTarget.costPrice ?? 0)} onChange={(e) => setEditTarget({ ...editTarget, costPrice: parseMoney(e.target.value) })} />
            <div className="wide actions-row">
              <Button type="submit">Save Changes</Button>
              <Button type="button" variant="secondary" onClick={() => setEditTarget(null)}>Cancel</Button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  )
}