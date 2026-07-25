import { useMemo, useState } from "react"
import type { Order } from "../../types"
import { Button } from "../../components/ui/Button"

function todayIso() { return new Date().toISOString().slice(0, 10) }

export function InvoiceNumbersPage({ orders, onSave }: {
  orders: Order[]
  onSave: (orderId: string, officialInvoiceNumber: string) => Promise<void>
}) {
  const [date, setDate] = useState(todayIso())
  const [query, setQuery] = useState("")
  const [customerFilter, setCustomerFilter] = useState("")
  const [missingOnly, setMissingOnly] = useState(false)
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [savingId, setSavingId] = useState<string | null>(null)
  const [bulkBusy, setBulkBusy] = useState(false)

  const dayOrders = useMemo(() => orders.filter(o => o.date === date), [orders, date])
  const customers = useMemo(() => [...new Set(dayOrders.map(o => o.customerName))].sort(), [dayOrders])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return dayOrders.filter(o =>
      (!q || `${o.customerName} ${o.orderNumber}`.toLowerCase().includes(q)) &&
      (!customerFilter || o.customerName === customerFilter) &&
      (!missingOnly || !o.officialInvoiceNumber)
    ).sort((a, b) => a.orderNumber.localeCompare(b.orderNumber))
  }, [dayOrders, query, customerFilter, missingOnly])

  const valueFor = (o: Order) => drafts[o.id] ?? o.officialInvoiceNumber ?? ""
  const setDraft = (id: string, value: string) => setDrafts(prev => ({ ...prev, [id]: value }))

  const saveOne = async (o: Order) => {
    setSavingId(o.id)
    try { await onSave(o.id, valueFor(o).trim()) } finally { setSavingId(null) }
  }

  const bulkSave = async () => {
    const pending = filtered.filter(o => drafts[o.id] !== undefined && drafts[o.id] !== (o.officialInvoiceNumber ?? ""))
    if (pending.length === 0) return
    setBulkBusy(true)
    try {
      for (const o of pending) await onSave(o.id, drafts[o.id].trim())
    } finally { setBulkBusy(false) }
  }

  const missingCount = dayOrders.filter(o => !o.officialInvoiceNumber).length

  return (
    <div className="stack">
      <div>
        <p className="control-centre-label">Punjab Exotic Foods Control Centre</p>
        <h2 style={{ fontSize: 22, fontWeight: 800, color: "#0d2b1e" }}>Invoice Numbers</h2>
        <p style={{ fontSize: 13.5, color: "#6b7a70", marginTop: 3 }}>
          At the end of each trading day, enter the company's official invoice numbers against the sales created that day.
        </p>
      </div>

      <div className="ps-stats-row">
        <div className="ps-stat"><p className="ps-stat-label">Sales This Day</p><p className="ps-stat-value">{dayOrders.length}</p></div>
        <div className="ps-stat"><p className="ps-stat-label">Missing Invoice Numbers</p><p className="ps-stat-value" style={{ color: missingCount ? "#b91c1c" : undefined }}>{missingCount}</p></div>
      </div>

      <div className="ps-table-card">
        <div className="ps-toolbar" style={{ flexWrap: "wrap" }}>
          <div className="ps-toolbar-left" style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <label className="form-control" style={{ marginBottom: 0 }}>
              <span>Date</span>
              <input type="date" value={date} onChange={e => setDate(e.target.value)} />
            </label>
            <label className="form-control" style={{ marginBottom: 0 }}>
              <span>Customer</span>
              <select value={customerFilter} onChange={e => setCustomerFilter(e.target.value)}>
                <option value="">All customers</option>
                {customers.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, marginTop: 18 }}>
              <input type="checkbox" checked={missingOnly} onChange={e => setMissingOnly(e.target.checked)} />
              Missing invoice numbers only
            </label>
          </div>
          <div className="ps-toolbar-right">
            <div className="ps-search-wrap">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              <input className="ps-search" placeholder="Search sale number or customer…" value={query} onChange={e => setQuery(e.target.value)} />
            </div>
            <Button className="btn-sm" onClick={bulkSave} disabled={bulkBusy}>{bulkBusy ? "Saving…" : "Bulk Save"}</Button>
          </div>
        </div>
        <div className="ps-table-wrap">
          <table className="ps-table">
            <thead><tr><th>Customer</th><th>Sale Number</th><th>Date</th><th>Total</th><th>Invoice Number</th><th>Actions</th></tr></thead>
            <tbody>
              {filtered.map(o => (
                <tr key={o.id} className="ps-row">
                  <td>{o.customerName}</td>
                  <td><code className="ps-code">{o.orderNumber}</code></td>
                  <td style={{ color: "#6b7280" }}>{o.date}</td>
                  <td>£{o.amount.toFixed(2)}</td>
                  <td>
                    <input type="text" placeholder="e.g. INV-59382" value={valueFor(o)}
                      onChange={e => setDraft(o.id, e.target.value)}
                      style={{ padding: "6px 10px", border: "1.5px solid var(--border)", borderRadius: 8, fontFamily: "inherit", fontSize: 13, width: 160 }} />
                  </td>
                  <td>
                    <Button className="btn-sm" onClick={() => saveOne(o)} disabled={savingId === o.id}>
                      {savingId === o.id ? "Saving…" : "Save"}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div style={{ padding: "48px 24px", textAlign: "center", color: "#9ca3af" }}>
              No sales match this date/filter.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
