import { useMemo, useState } from "react"
import { createProduct, getProducts } from "../../api/productsApi"
import { getStock, updateStock } from "../../api/stockApi"
import { Button } from "../../components/ui/Button"
import { GmtClock } from "../../components/GmtClock"

/* Fresh produce catalogue for daily sessions */
const CATALOG: { name: string; category: string; size: string }[] = [
  { name: "Alphonso Mangoes", category: "Fruits", size: "5kg box" },
  { name: "Kesar Mangoes", category: "Fruits", size: "5kg box" },
  { name: "Pineapples", category: "Fruits", size: "8 per box" },
  { name: "Papayas", category: "Fruits", size: "9 per box" },
  { name: "Watermelons", category: "Fruits", size: "4 per box" },
  { name: "Galia Melons", category: "Fruits", size: "8 per box" },
  { name: "Honeydew Melons", category: "Fruits", size: "8 per box" },
  { name: "Red Grapes", category: "Fruits", size: "4.5kg box" },
  { name: "Lychees", category: "Fruits", size: "2kg box" },
  { name: "Passion Fruit", category: "Fruits", size: "2kg box" },
  { name: "Pomegranates", category: "Fruits", size: "4kg box" },
  { name: "Guavas", category: "Fruits", size: "3kg box" },
  { name: "Fresh Coconuts", category: "Fruits", size: "12 per sack" },
  { name: "Limes", category: "Fruits", size: "4.5kg box" },
  { name: "Lemons", category: "Fruits", size: "5kg box" },
  { name: "Plantain", category: "Vegetables", size: "15kg box" },
  { name: "Green Bananas", category: "Vegetables", size: "18kg box" },
  { name: "Cassava", category: "Vegetables", size: "18kg box" },
  { name: "Sweet Potatoes", category: "Vegetables", size: "15kg box" },
  { name: "Yams", category: "Vegetables", size: "18kg sack" },
  { name: "Okra", category: "Vegetables", size: "5kg box" },
  { name: "Karela (Bitter Gourd)", category: "Vegetables", size: "5kg box" },
  { name: "Dudhi (Bottle Gourd)", category: "Vegetables", size: "10kg box" },
  { name: "Tinda", category: "Vegetables", size: "5kg box" },
  { name: "Baby Aubergines", category: "Vegetables", size: "5kg box" },
  { name: "Green Chillies", category: "Vegetables", size: "3kg box" },
  { name: "Scotch Bonnets", category: "Vegetables", size: "3kg box" },
  { name: "Fresh Ginger", category: "Vegetables", size: "13.6kg box" },
  { name: "Garlic", category: "Vegetables", size: "10kg box" },
  { name: "Red Onions", category: "Vegetables", size: "20kg sack" },
  { name: "Fresh Coriander", category: "Herbs", size: "kg bunch" },
  { name: "Fresh Mint", category: "Herbs", size: "kg bunch" },
  { name: "Curry Leaves", category: "Herbs", size: "1kg box" },
  { name: "Fenugreek (Methi)", category: "Herbs", size: "kg bunch" },
  { name: "Thai Basil", category: "Herbs", size: "1kg box" },
  { name: "Lemongrass", category: "Herbs", size: "2kg box" },
]

const CAT_COLORS: Record<string, string> = { Fruits: "#e05c2a", Vegetables: "#22913f", Herbs: "#0ea5e9" }

type SessionItem = {
  name: string; category: string; size: string
  supplier: string; purchasePrice: string; sellingPrice: string; qty: string
}

const CONFIG_KEY = "punjab-session-config"
const SUPPLIERS_KEY = "punjab-suppliers"
const SESSION_KEY = "punjab-session-active"

function loadJson<T>(key: string, fallback: T): T {
  try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) as T : fallback } catch { return fallback }
}
function saveJson(key: string, value: unknown) {
  try { localStorage.setItem(key, JSON.stringify(value)) } catch { /* ignore */ }
}

export function SessionPage({ onFinished }: { onFinished: () => void }) {
  const [config, setConfig]       = useState(() => loadJson(CONFIG_KEY, { start: "23:00", end: "09:00" }))
  const [suppliers, setSuppliers] = useState<string[]>(() => loadJson<string[]>(SUPPLIERS_KEY, ["Birmingham Wholesale Market", "New Spitalfields Market", "Western International Market"]))
  const [newSupplier, setNewSupplier] = useState("")
  const [step, setStep]           = useState(0)
  const [search, setSearch]       = useState("")
  const [items, setItems]         = useState<SessionItem[]>([])
  const [saving, setSaving]       = useState(false)
  const [error, setError]         = useState("")

  const lastSession = loadJson<{ startedAt?: string } | null>(SESSION_KEY, null)

  const filteredCatalog = useMemo(() => {
    const q = search.trim().toLowerCase()
    return CATALOG.filter(c => !q || `${c.name} ${c.category}`.toLowerCase().includes(q))
  }, [search])

  const isSelected = (name: string) => items.some(i => i.name === name)
  const toggleItem = (c: typeof CATALOG[number]) => {
    setItems(prev => isSelected(c.name)
      ? prev.filter(i => i.name !== c.name)
      : [...prev, { ...c, supplier: suppliers[0] ?? "", purchasePrice: "", sellingPrice: "", qty: "10" }])
  }
  const setItem = (name: string, patch: Partial<SessionItem>) =>
    setItems(prev => prev.map(i => i.name === name ? { ...i, ...patch } : i))

  const addSupplier = () => {
    const s = newSupplier.trim()
    if (!s || suppliers.includes(s)) return
    const next = [...suppliers, s]
    setSuppliers(next); saveJson(SUPPLIERS_KEY, next); setNewSupplier("")
  }

  const step2Valid = items.every(i => i.supplier && Number(i.purchasePrice) > 0)
  const step3Valid = items.every(i => Number(i.sellingPrice) > 0 && Number(i.qty) > 0)

  /** Push the session's products + prices into Supabase so customers see them. */
  const finishSession = async () => {
    setSaving(true); setError("")
    try {
      let products = await getProducts()
      for (const item of items) {
        const existing = products.find(p => p.productName.toLowerCase() === item.name.toLowerCase())
        if (!existing) {
          await createProduct({
            productName: item.name, category: item.category, variety: "",
            size: item.size, boxesPerPallet: 0, productImage: "",
            sku: item.name.toUpperCase().replace(/[^A-Z0-9]+/g, "-").slice(0, 24) + "-" + Date.now().toString().slice(-4),
          })
        }
      }
      products = await getProducts()
      const stock = await getStock()
      for (const item of items) {
        const product = products.find(p => p.productName.toLowerCase() === item.name.toLowerCase())
        const stockRow = product && stock.find(s => s.productId === product.id)
        if (stockRow) {
          const qty = Math.max(0, Number(item.qty) || 0)
          await updateStock(stockRow.id, {
            availableQuantity: qty,
            price: Number(item.sellingPrice) || 0,
            status: qty === 0 ? "out" : qty <= 10 ? "low" : "available",
          })
        }
      }
      saveJson(SESSION_KEY, { startedAt: new Date().toISOString(), ...config, items })
      setStep(4)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save session — please try again.")
    }
    setSaving(false)
  }

  const stepChip = (n: number, label: string) => (
    <span className={"ss-step" + (step === n ? " on" : step > n ? " done" : "")}>
      <span className="ss-step-n">{step > n ? "✓" : n}</span>{label}
    </span>
  )

  return (
    <div className="ss-wrap">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div>
          <p className="control-centre-label">Daily Selling Session</p>
          <h2 style={{ fontSize: 22, fontWeight: 800, color: "#0d2b1e" }}>
            {step === 0 ? "Start Today's Session" : step === 4 ? "Session Live" : "Session Setup"}
          </h2>
        </div>
        <GmtClock />
      </div>

      <div className="ss-steps">
        {stepChip(1, "Select Products")}
        {stepChip(2, "Suppliers & Purchase Price")}
        {stepChip(3, "Selling Prices")}
      </div>

      {/* ── Step 0: session window config ── */}
      {step === 0 && (
        <div className="ss-card">
          <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 6 }}>Session window</h3>
          <p style={{ fontSize: 13, color: "#6b7280", marginBottom: 16 }}>
            One session covers a full selling day (default 23:00 → 09:00 GMT). Adjust the times if needed, then start today's session.
            {lastSession?.startedAt && <> Last session started {new Date(lastSession.startedAt).toLocaleString("en-GB", { timeZone: "UTC" })} GMT.</>}
          </p>
          <div className="ss-config">
            <label className="form-control">
              <span>Session starts</span>
              <input type="time" value={config.start} onChange={e => { const c = { ...config, start: e.target.value }; setConfig(c); saveJson(CONFIG_KEY, c) }} />
            </label>
            <label className="form-control">
              <span>Session ends</span>
              <input type="time" value={config.end} onChange={e => { const c = { ...config, end: e.target.value }; setConfig(c); saveJson(CONFIG_KEY, c) }} />
            </label>
            <Button onClick={() => setStep(1)}>Start Session →</Button>
          </div>
        </div>
      )}

      {/* ── Step 1: select products ── */}
      {step === 1 && (
        <div className="ss-card">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
            <h3 style={{ fontSize: 15, fontWeight: 700 }}>Select today's produce <span style={{ color: "#6b7280", fontWeight: 500 }}>({items.length} selected)</span></h3>
            <div className="ps-search-wrap" style={{ maxWidth: 260 }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              <input className="ps-search" placeholder="Search produce…" value={search} onChange={e => setSearch(e.target.value)} />
            </div>
          </div>
          <div className="ss-grid">
            {filteredCatalog.map(c => (
              <button key={c.name} type="button" className={"ss-item" + (isSelected(c.name) ? " sel" : "")} onClick={() => toggleItem(c)}>
                <span className="ss-item-av" style={{ background: CAT_COLORS[c.category] ?? "#22913f" }}>{c.name.slice(0, 2).toUpperCase()}</span>
                <span style={{ minWidth: 0 }}>
                  <span className="ss-item-name">{c.name}</span>
                  <span className="ss-item-meta">{c.category} · {c.size}</span>
                </span>
                {isSelected(c.name) && (
                  <span className="ss-item-check">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6"><polyline points="20 6 9 17 4 12"/></svg>
                  </span>
                )}
              </button>
            ))}
            {filteredCatalog.length === 0 && <div className="db-empty" style={{ gridColumn: "1 / -1" }}>No produce matches “{search}”.</div>}
          </div>
          <div className="ss-foot">
            <Button variant="secondary" onClick={() => setStep(0)}>← Back</Button>
            <Button onClick={() => setStep(2)} disabled={items.length === 0}>Next: Suppliers ({items.length}) →</Button>
          </div>
        </div>
      )}

      {/* ── Step 2: supplier + purchase price ── */}
      {step === 2 && (
        <div className="ss-card">
          <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>Pick a supplier and purchase price for each item</h3>
          <div style={{ display: "flex", gap: 8, margin: "12px 0 16px", flexWrap: "wrap" }}>
            <input
              style={{ padding: "8px 12px", border: "1.5px solid var(--border)", borderRadius: 8, fontFamily: "inherit", fontSize: 13, outline: "none", flex: 1, minWidth: 180 }}
              placeholder="Add a new supplier…" value={newSupplier}
              onChange={e => setNewSupplier(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addSupplier() } }}
            />
            <Button variant="secondary" onClick={addSupplier}>+ Add Supplier</Button>
          </div>
          <div className="ss-rows">
            {items.map(i => (
              <div key={i.name} className="ss-row">
                <div className="ss-row-name">{i.name}<small>{i.size}</small></div>
                <select value={i.supplier} onChange={e => setItem(i.name, { supplier: e.target.value })}>
                  {suppliers.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                <input type="number" min="0.01" step="0.01" placeholder="Buy £/box" value={i.purchasePrice}
                  onChange={e => setItem(i.name, { purchasePrice: e.target.value })} />
                <input type="number" min="1" placeholder="Qty (boxes)" value={i.qty}
                  onChange={e => setItem(i.name, { qty: e.target.value })} />
              </div>
            ))}
          </div>
          <div className="ss-foot">
            <Button variant="secondary" onClick={() => setStep(1)}>← Back</Button>
            <Button onClick={() => { setItems(prev => prev.map(i => ({ ...i, sellingPrice: i.sellingPrice || (Number(i.purchasePrice) * 1.3).toFixed(2) }))); setStep(3) }} disabled={!step2Valid}>
              Next: Selling Prices →
            </Button>
          </div>
        </div>
      )}

      {/* ── Step 3: selling prices ── */}
      {step === 3 && (
        <div className="ss-card">
          <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 14 }}>Set today's selling prices <span style={{ color: "#6b7280", fontWeight: 500 }}>(suggested at +30% margin)</span></h3>
          <div className="ss-rows">
            {items.map(i => {
              const buy = Number(i.purchasePrice) || 0
              const sell = Number(i.sellingPrice) || 0
              const margin = buy > 0 && sell > 0 ? ((sell - buy) / buy) * 100 : 0
              return (
                <div key={i.name} className="ss-row">
                  <div className="ss-row-name">{i.name}<small>{i.supplier} · buy £{buy.toFixed(2)}</small></div>
                  <input type="number" min="0.01" step="0.01" placeholder="Sell £/box" value={i.sellingPrice}
                    onChange={e => setItem(i.name, { sellingPrice: e.target.value })} />
                  <div className="ss-row-name" style={{ fontWeight: 500 }}><small style={{ fontSize: 12 }}>{i.qty} boxes</small></div>
                  <span className={"ss-margin " + (margin >= 0 ? "pos" : "neg")}>{margin >= 0 ? "+" : ""}{margin.toFixed(0)}% margin</span>
                </div>
              )
            })}
          </div>
          {error && <p style={{ color: "#b91c1c", fontSize: 13, marginTop: 12, background: "#fef2f2", borderRadius: 8, padding: "8px 12px" }}>{error}</p>}
          <div className="ss-foot">
            <Button variant="secondary" onClick={() => setStep(2)}>← Back</Button>
            <Button onClick={finishSession} disabled={!step3Valid || saving}>
              {saving ? "Publishing…" : `Go Live — publish ${items.length} products`}
            </Button>
          </div>
        </div>
      )}

      {/* ── Step 4: done ── */}
      {step === 4 && (
        <div className="ss-card ss-done">
          <div className="ss-done-ico">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
          </div>
          <h3 style={{ fontSize: 18, fontWeight: 800, color: "#0d2b1e" }}>Session is live</h3>
          <p style={{ fontSize: 13.5, color: "#6b7280", margin: "8px 0 20px" }}>
            {items.length} product{items.length !== 1 ? "s" : ""} published with today's stock and prices.
            Customers can now see and order today's produce until {config.end} GMT.
          </p>
          <Button onClick={onFinished}>View Stock Page</Button>
        </div>
      )}
    </div>
  )
}
