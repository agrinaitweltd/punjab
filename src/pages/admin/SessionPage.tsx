import { useEffect, useMemo, useState } from "react"
import { createProduct, getProducts } from "../../api/productsApi"
import { getStock, updateStock } from "../../api/stockApi"
import type { Product } from "../../types"
import { Button } from "../../components/ui/Button"
import { GmtClock } from "../../components/GmtClock"
import { LONDON_TZ } from "../../lib/stockCycle"

/* Full fresh-produce catalogue, organised category → group → items */
const PRODUCE: Record<string, Record<string, string[]>> = {
  Fruits: {
    Apples: ["Gala", "Granny Smith", "Fuji", "Pink Lady", "Golden Delicious", "Red Delicious", "Braeburn", "Jazz", "Honeycrisp", "Empire", "Cox", "Bramley"],
    Bananas: ["Cavendish", "Plantain", "Baby Bananas", "Red Bananas", "Matooke (Cooking Bananas)"],
    Citrus: ["Oranges", "Blood Oranges", "Mandarins", "Clementines", "Tangerines", "Satsumas", "Lemons", "Limes", "Grapefruit", "Pomelo", "Sweet Lime", "Kumquat"],
    "Tropical Fruits": ["Mango", "Pineapple", "Papaya (Pawpaw)", "Avocado", "Passion Fruit", "Guava", "Jackfruit", "Dragon Fruit", "Lychee", "Rambutan", "Mangosteen", "Durian", "Breadfruit", "Soursop", "Star Fruit", "Sapodilla", "Custard Apple", "Longan"],
    "Stone Fruits": ["Peach", "Nectarine", "Plum", "Apricot", "Cherry", "Greengage", "Damson"],
    Berries: ["Strawberry", "Blueberry", "Raspberry", "Blackberry", "Cranberry", "Gooseberry", "Redcurrant", "Blackcurrant"],
    Grapes: ["Red Seedless", "Green Seedless", "Black Grapes", "Muscat", "Cotton Candy Grapes"],
    Melons: ["Watermelon", "Cantaloupe", "Honeydew", "Galia Melon", "Charentais Melon"],
    Pears: ["Conference", "Bartlett", "Packham", "Bosc", "Comice"],
    "Exotic Fruits": ["Fig", "Pomegranate", "Kiwi", "Golden Kiwi", "Coconut", "Dates", "Medjool Dates", "Tamarind", "Persimmon", "Quince", "Prickly Pear", "Cherimoya"],
  },
  Vegetables: {
    "Leafy Greens": ["Lettuce", "Romaine", "Iceberg", "Little Gem", "Spinach", "Kale", "Swiss Chard", "Pak Choi", "Bok Choy", "Cabbage", "Red Cabbage", "Chinese Cabbage", "Watercress", "Rocket (Arugula)", "Collard Greens", "Mustard Greens", "Sorrel"],
    "Root Vegetables": ["Carrots", "Baby Carrots", "Beetroot", "Radish", "Turnip", "Parsnip", "Sweet Potato", "Cassava", "Yam", "Taro", "Ginger", "Turmeric", "Celeriac", "Jerusalem Artichoke"],
    Potatoes: ["White Potatoes", "Red Potatoes", "Baby Potatoes", "Purple Potatoes", "Fingerling Potatoes", "Maris Piper", "King Edward"],
    "Onions & Alliums": ["White Onion", "Red Onion", "Brown Onion", "Spring Onion", "Shallots", "Garlic", "Leeks", "Chives", "Pearl Onions"],
    "Fruiting Vegetables": ["Tomatoes", "Cherry Tomatoes", "Beef Tomatoes", "Roma Tomatoes", "Vine Tomatoes", "Bell Peppers", "Chillies", "Jalapeños", "Habaneros", "Eggplant (Aubergine)", "Baby Aubergine", "Okra", "Cucumbers", "Gherkins", "Courgettes (Zucchini)", "Pumpkin", "Squash", "Butternut Squash", "Acorn Squash"],
    Brassicas: ["Broccoli", "Tenderstem Broccoli", "Cauliflower", "Brussels Sprouts", "Kohlrabi", "Romanesco"],
    Legumes: ["French Beans", "Green Beans", "Runner Beans", "Snow Peas", "Sugar Snap Peas", "Garden Peas", "Broad Beans", "Edamame"],
    Mushrooms: ["Button", "Portobello", "Chestnut", "Oyster", "Shiitake", "Enoki", "King Oyster"],
  },
  "Peppers & Chillies": {
    "Peppers & Chillies": ["Green Pepper", "Red Pepper", "Yellow Pepper", "Orange Pepper", "Scotch Bonnet", "Bird's Eye Chilli", "Cayenne", "Habanero", "Jalapeño", "Serrano", "Poblano", "Ghost Pepper"],
  },
  Herbs: {
    Herbs: ["Basil", "Thai Basil", "Coriander (Cilantro)", "Parsley", "Mint", "Rosemary", "Thyme", "Dill", "Oregano", "Sage", "Tarragon", "Curry Leaves", "Lemongrass", "Chervil", "Bay Leaves"],
  },
  "Other Produce": {
    "Other Produce": ["Sweet Corn", "Baby Corn", "Celery", "Asparagus", "Rhubarb", "Artichoke", "Fennel", "Bamboo Shoots", "Sugar Cane", "Water Chestnuts", "Bean Sprouts", "Samphire"],
  },
}

type CatalogItem = { name: string; group: string; category: string; size: string }
const CATALOG: CatalogItem[] = Object.entries(PRODUCE).flatMap(([category, groups]) =>
  Object.entries(groups).flatMap(([group, names]) =>
    names.map(name => ({ name, group, category, size: "box" }))))

const CATEGORIES = Object.keys(PRODUCE)
const CAT_COLORS: Record<string, string> = {
  Fruits: "#e05c2a", Vegetables: "#22913f", "Peppers & Chillies": "#d93025",
  Herbs: "#0ea5e9", "Other Produce": "#b8860b",
}

const PACKAGING = ["Box", "Crate", "Sack", "Tray", "Bag", "Bunch", "Punnet", "Loose (per kg)"]

type SessionItem = {
  name: string; group: string; category: string; size: string
  packaging: string; unitSize: string
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
  const [activeCat, setActiveCat] = useState<string>(CATEGORIES[0])
  const [items, setItems]         = useState<SessionItem[]>([])
  const [saving, setSaving]       = useState(false)
  const [error, setError]         = useState("")
  const [extraCatalog, setExtraCatalog] = useState<CatalogItem[]>([])
  const [carriedForward, setCarriedForward] = useState(0)

  const lastSession = loadJson<{ startedAt?: string } | null>(SESSION_KEY, null)

  /* On open, pull in whatever is currently live so nothing already stocked
     gets silently dropped just because today's session starts from scratch —
     and so custom products created in past sessions stay pickable here too. */
  useEffect(() => {
    (async () => {
      const [products, stock] = await Promise.all([getProducts(), getStock()])
      const inCatalog = (p: Product) => CATALOG.some(c => c.name.toLowerCase() === p.productName.toLowerCase())
      const extras: CatalogItem[] = products.filter(p => !inCatalog(p)).map(p => ({
        name: p.productName,
        group: p.variety || "Previously Stocked",
        category: (CATEGORIES as string[]).includes(p.category) ? p.category : "Other Produce",
        size: p.size || "box",
      }))
      setExtraCatalog(extras)

      const live = stock.filter(s => s.status !== "out" && s.availableQuantity > 0)
      const carried: SessionItem[] = live.map(s => {
        const product = products.find(p => p.id === s.productId)
        const catalogMatch = CATALOG.find(c => c.name.toLowerCase() === product?.productName.toLowerCase())
        return {
          name: product?.productName ?? "Unknown",
          group: catalogMatch?.group ?? product?.variety ?? "Previously Stocked",
          category: catalogMatch?.category ?? ((CATEGORIES as string[]).includes(product?.category ?? "") ? product!.category : "Other Produce"),
          size: product?.size ?? "box",
          packaging: "Box", unitSize: "",
          supplier: suppliers[0] ?? "",
          purchasePrice: "",
          sellingPrice: s.price > 0 ? s.price.toFixed(2) : "",
          qty: String(s.availableQuantity),
        }
      }).filter(i => i.name !== "Unknown")
      if (carried.length) { setItems(carried); setCarriedForward(carried.length) }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const fullCatalog = useMemo(() => [...CATALOG, ...extraCatalog], [extraCatalog])

  /* Searching looks across every category; otherwise browse the active one */
  const q = search.trim().toLowerCase()
  const visibleCatalog = useMemo(() => {
    if (q) return fullCatalog.filter(c => `${c.name} ${c.group} ${c.category}`.toLowerCase().includes(q))
    return fullCatalog.filter(c => c.category === activeCat)
  }, [q, activeCat, fullCatalog])

  const visibleGroups = useMemo(() => {
    const map = new Map<string, CatalogItem[]>()
    for (const c of visibleCatalog) {
      if (!map.has(c.group)) map.set(c.group, [])
      map.get(c.group)!.push(c)
    }
    return [...map.entries()]
  }, [visibleCatalog])

  const isSelected = (name: string, group: string) => items.some(i => i.name === name && i.group === group)
  const toggleItem = (c: CatalogItem) => {
    setItems(prev => isSelected(c.name, c.group)
      ? prev.filter(i => !(i.name === c.name && i.group === c.group))
      : [...prev, { ...c, packaging: "Box", unitSize: "", supplier: suppliers[0] ?? "", purchasePrice: "", sellingPrice: "", qty: "10" }])
  }
  const countInCat = (cat: string) => items.filter(i => i.category === cat).length
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
          const size = [item.unitSize.trim(), item.packaging.toLowerCase()].filter(Boolean).join(" ") || "box"
          await createProduct({
            productName: item.name, category: item.category, variety: item.group,
            size, boxesPerPallet: 0, productImage: "",
            sku: item.name.toUpperCase().replace(/[^A-Z0-9]+/g, "-").slice(0, 24) + "-" + Date.now().toString().slice(-4),
          })
        }
      }
      products = await getProducts()
      const stock = await getStock()
      const todaysProductIds = new Set<string>()
      for (const item of items) {
        const product = products.find(p => p.productName.toLowerCase() === item.name.toLowerCase())
        const stockRow = product && stock.find(s => s.productId === product.id)
        if (stockRow) {
          if (product) todaysProductIds.add(product.id)
          const qty = Math.max(0, Number(item.qty) || 0)
          await updateStock(stockRow.id, {
            availableQuantity: qty,
            price: Number(item.sellingPrice) || 0,
            status: qty === 0 ? "out" : qty <= 10 ? "low" : "available",
          })
        }
      }
      // Anything that was live before but isn't part of today's session is
      // explicitly retired (not deleted) so Stock Management never shows
      // stale numbers for produce that's no longer actually available.
      for (const s of stock) {
        if (s.status !== "out" && !todaysProductIds.has(s.productId)) {
          await updateStock(s.id, { status: "out", availableQuantity: 0 })
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
  const progressPct = step === 0 ? 0 : step >= 4 ? 100 : (step / 3) * 100

  return (
    <div className="ss-wrap">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div>
          <p className="control-centre-label">Daily Selling Session</p>
          <h2 style={{ fontSize: 22, fontWeight: 800, color: "#0d2b1e" }}>
            {step === 0 ? "Let's set up today's fresh stock" : step === 4 ? "Today's session is live" : "Building Today's Session"}
          </h2>
        </div>
        <GmtClock />
      </div>

      <div className="ss-progress-track"><div className="ss-progress-fill" style={{ width: `${progressPct}%` }} /></div>
      <div className="ss-steps">
        {stepChip(1, "Select Products")}
        {stepChip(2, "Suppliers & Purchase Price")}
        {stepChip(3, "Selling Prices")}
      </div>

      {/* ── Step 0: session window config ── */}
      {step === 0 && (
        <div className="ss-card ss-anim" key="step0">
          <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 6 }}>When does your selling day run?</h3>
          <p style={{ fontSize: 13, color: "#6b7280", marginBottom: 16 }}>
            One session covers a full selling day (default 23:00 → 09:00 UK time). Set your hours below, then walk through three quick steps to publish today's produce, prices and quantities to every customer.
            {lastSession?.startedAt && <> Last session started {new Date(lastSession.startedAt).toLocaleString("en-GB", { timeZone: LONDON_TZ })} UK time.</>}
            {carriedForward > 0 && <> We've carried forward <strong>{carriedForward}</strong> item{carriedForward !== 1 ? "s" : ""} still in stock — just confirm or adjust them in the next steps. Anything you don't reselect will be marked out of stock.</>}
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
        <div className="ss-card ss-anim" key="step1">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
            <h3 style={{ fontSize: 15, fontWeight: 700 }}>Select today's produce <span style={{ color: "#6b7280", fontWeight: 500 }}>({items.length} selected)</span></h3>
            <div className="ps-search-wrap" style={{ maxWidth: 260 }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              <input className="ps-search" placeholder="Search produce…" value={search} onChange={e => setSearch(e.target.value)} />
            </div>
          </div>
          {/* Step 1a: pick a category first */}
          {!q && (
            <div className="ss-cats">
              {CATEGORIES.map(cat => (
                <button key={cat} type="button" className={"ss-cat" + (activeCat === cat ? " on" : "")} onClick={() => setActiveCat(cat)}
                  style={activeCat === cat ? { borderColor: CAT_COLORS[cat], color: CAT_COLORS[cat] } : undefined}>
                  <span className="ss-cat-dot" style={{ background: CAT_COLORS[cat] }} />
                  {cat}
                  {countInCat(cat) > 0 && <span className="ss-cat-count">{countInCat(cat)}</span>}
                </button>
              ))}
            </div>
          )}

          {/* Step 1b: grouped items within the category (or search results) */}
          <div className="ss-scroll">
            {visibleGroups.map(([group, groupItems]) => (
              <div key={group}>
                <p className="ss-group-title">{group} <span>({groupItems.length})</span></p>
                <div className="ss-grid">
                  {groupItems.map((c, ci) => (
                    <button key={c.group + c.name} type="button" className={"ss-item" + (isSelected(c.name, c.group) ? " sel" : "")} style={{ animationDelay: `${Math.min(ci, 14) * 0.02}s` }} onClick={() => toggleItem(c)}>
                      <span className="ss-item-av" style={{ background: CAT_COLORS[c.category] ?? "#22913f" }}>{c.name.slice(0, 2).toUpperCase()}</span>
                      <span style={{ minWidth: 0 }}>
                        <span className="ss-item-name">{c.name}</span>
                        <span className="ss-item-meta">{c.group}</span>
                      </span>
                      {isSelected(c.name, c.group) && (
                        <span className="ss-item-check">
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6"><polyline points="20 6 9 17 4 12"/></svg>
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            ))}
            {visibleCatalog.length === 0 && <div className="db-empty">No produce matches “{search}”.</div>}
          </div>
          <div className="ss-foot">
            <Button variant="secondary" onClick={() => setStep(0)}>← Back</Button>
            <Button onClick={() => setStep(2)} disabled={items.length === 0}>Next: Suppliers ({items.length}) →</Button>
          </div>
        </div>
      )}

      {/* ── Step 2: supplier + purchase price ── */}
      {step === 2 && (
        <div className="ss-card ss-anim" key="step2">
          <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>How is each item packaged, and where's it from?</h3>
          <p style={{ fontSize: 13, color: "#6b7280", marginBottom: 4 }}>Tell us the packaging, the supplier, and what you paid — we'll suggest a selling price next.</p>
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
              <div key={i.name} className="ss-row ss-row-6">
                <div className="ss-row-name">{i.name}<small>{i.group} · {i.category}</small></div>
                <select value={i.packaging} title="How is it packaged?" onChange={e => setItem(i.name, { packaging: e.target.value })}>
                  {PACKAGING.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
                <input placeholder="Unit size e.g. 5kg" value={i.unitSize} title="Weight or count per unit"
                  onChange={e => setItem(i.name, { unitSize: e.target.value })} />
                <select value={i.supplier} title="Supplier" onChange={e => setItem(i.name, { supplier: e.target.value })}>
                  {suppliers.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                <input type="number" min="0.01" step="0.01" placeholder="Buy £/unit" value={i.purchasePrice}
                  onChange={e => setItem(i.name, { purchasePrice: e.target.value })} />
                <input type="number" min="1" placeholder="Qty" value={i.qty}
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
        <div className="ss-card ss-anim" key="step3">
          <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>Almost there — what's today's selling price?</h3>
          <p style={{ fontSize: 13, color: "#6b7280", marginBottom: 14 }}>We've suggested a +30% margin on your purchase price for each item — adjust anything before going live.</p>
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
        <div className="ss-card ss-done ss-anim" key="step4">
          <div className="ss-done-ico po-done-pop">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
          </div>
          <h3 style={{ fontSize: 18, fontWeight: 800, color: "#0d2b1e" }}>Today's produce is live!</h3>
          <p style={{ fontSize: 13.5, color: "#6b7280", margin: "8px 0 20px" }}>
            {items.length} product{items.length !== 1 ? "s" : ""} published with today's stock and prices.
            Customers can now browse and order this produce until {config.end} UK time.
          </p>
          <Button onClick={onFinished}>View Stock Page</Button>
        </div>
      )}
    </div>
  )
}
