import { useMemo, useState } from "react"
import type { Product, StockItem } from "../../types"
import { Button } from "../../components/ui/Button"
import { Modal } from "../../components/ui/Modal"
import { createOrder } from "../../api/ordersApi"
import { sendEmail, orderReceivedEmailHtml, URGENT_SUPPORT_PHONE, COLLECTION_ADDRESS, ADMIN_NOTIFY_EMAIL } from "../../lib/emailService"
import { lookupPostcode, matchDeliveryArea, buildAddressCandidates, lookupFullAddresses } from "../../lib/postcode"
import { mockDeliveryAreas } from "../../data/mockData"
import { isOrderingClosed } from "../../lib/stockCycle"

type Fulfilment = "Delivery" | "Collection"

const CAT_COLORS: Record<string, string> = {
  Fruits: "#e05c2a", Vegetables: "#22913f", "Peppers & Chillies": "#d93025",
  Herbs: "#0ea5e9", "Other Produce": "#b8860b",
}
export const catColor = (c: string) => CAT_COLORS[c] ?? "#1f7a3a"

export function PlaceOrderModal({
  open, onClose, products, stock, customerId, customerName, customerEmail, salesmanId, salesmanName, onPlaced, initialSearch, tradingDate,
}: {
  open: boolean
  onClose: () => void
  products: Product[]
  stock: StockItem[]
  customerId: string
  customerName: string
  customerEmail?: string
  /** Inherited automatically from the customer's assigned salesman. */
  salesmanId?: string
  salesmanName?: string
  onPlaced: () => void
  initialSearch?: string
  /** The date this order should be recorded against — the current trading
      day, which moves forward once an admin closes trading via Day End,
      independent of the real calendar date. */
  tradingDate?: string
}) {
  const [step, setStep] = useState<"browse" | "review" | "done">("browse")
  const [cart, setCart] = useState<Record<string, number>>({})
  const [search, setSearch] = useState(initialSearch ?? "")
  const [category, setCategory] = useState("All")
  const [placing, setPlacing] = useState(false)
  const [error, setError] = useState("")
  const [placedNumber, setPlacedNumber] = useState("")
  const [fulfilment, setFulfilment] = useState<Fulfilment>("Delivery")
  const [postcode, setPostcode] = useState("")
  const [checkingPostcode, setCheckingPostcode] = useState(false)
  const [postcodeStatus, setPostcodeStatus] = useState<"idle" | "found" | "failed">("idle")
  const [postcodeError, setPostcodeError] = useState("")
  const [deliveryArea, setDeliveryArea] = useState<string | null>(null)
  const [addressCandidates, setAddressCandidates] = useState<string[]>([])
  const [selectedLocality, setSelectedLocality] = useState("")
  const [houseAndStreet, setHouseAndStreet] = useState("")
  const [manualAddress, setManualAddress] = useState("")
  const [resolvedPostcode, setResolvedPostcode] = useState("")
  const [realAddresses, setRealAddresses] = useState<string[]>([])
  const [selectedRealAddress, setSelectedRealAddress] = useState("")

  const fullDeliveryAddress = postcodeStatus === "found"
    ? (realAddresses.length > 0 ? selectedRealAddress : [houseAndStreet, selectedLocality, resolvedPostcode].filter(Boolean).join(", "))
    : manualAddress

  const checkPostcode = async () => {
    setCheckingPostcode(true)
    setPostcodeStatus("idle")
    setPostcodeError("")
    setRealAddresses([])
    const outcome = await lookupPostcode(postcode)
    if (!outcome.ok) {
      setPostcodeStatus("failed")
      setPostcodeError(outcome.error)
      setAddressCandidates([])
    } else {
      const area = matchDeliveryArea(outcome.result, mockDeliveryAreas.map(a => a.name))
      const candidates = buildAddressCandidates(outcome.result)
      setDeliveryArea(area)
      setAddressCandidates(candidates)
      setSelectedLocality(candidates[0] ?? "")
      setResolvedPostcode(outcome.result.postcode)
      setPostcodeStatus("found")

      const addressLookup = await lookupFullAddresses(postcode)
      if (addressLookup.ok) {
        const full = addressLookup.addresses.map(a => a.full)
        setRealAddresses(full)
        setSelectedRealAddress(full[0] ?? "")
      }
    }
    setCheckingPostcode(false)
  }

  const stockMap = useMemo(() => {
    const m: Record<string, StockItem> = {}
    for (const s of stock) m[s.productId] = s
    return m
  }, [stock])

  const orderable = useMemo(
    () => products.filter(p => stockMap[p.id] && stockMap[p.id].status !== "out" && stockMap[p.id].price > 0),
    [products, stockMap],
  )
  const categories = useMemo(() => ["All", ...Array.from(new Set(orderable.map(p => p.category)))], [orderable])

  const shown = orderable.filter(p => {
    const q = search.trim().toLowerCase()
    return (category === "All" || p.category === category) && (!q || `${p.productName} ${p.variety}`.toLowerCase().includes(q))
  })

  const cartLines = Object.entries(cart)
    .filter(([, qty]) => qty > 0)
    .map(([pid, qty]) => ({ product: products.find(p => p.id === pid), stock: stockMap[pid], qty }))
    .filter((l): l is { product: Product; stock: StockItem; qty: number } => Boolean(l.product && l.stock))
  const cartTotal = cartLines.reduce((s, l) => s + l.qty * l.stock.price, 0)
  const cartCount = cartLines.reduce((s, l) => s + l.qty, 0)

  const setQty = (pid: string, qty: number) => {
    const max = stockMap[pid]?.availableQuantity ?? 0
    setCart(c => ({ ...c, [pid]: Math.max(0, Math.min(max, qty)) }))
  }
  const addOne = (pid: string) => setQty(pid, (cart[pid] ?? 0) + 1)
  const removeLine = (pid: string) => setCart(c => { const n = { ...c }; delete n[pid]; return n })

  const reset = () => {
    setCart({}); setStep("browse"); setSearch(""); setCategory("All"); setError("")
    setFulfilment("Delivery"); setPostcode(""); setPostcodeStatus("idle"); setPostcodeError("")
    setDeliveryArea(null); setAddressCandidates([]); setSelectedLocality("")
    setHouseAndStreet(""); setManualAddress(""); setResolvedPostcode("")
    setRealAddresses([]); setSelectedRealAddress("")
  }
  const handleClose = () => { onClose(); if (step === "done") reset() }

  const confirmOrder = async () => {
    if (cartLines.length === 0) return
    if (isOrderingClosed()) { setError("Ordering is closed 05:00–08:00 UK time while stock is being counted — please try again after 08:00."); return }
    setPlacing(true); setError("")
    try {
      const order = await createOrder({
        customerId,
        customerName,
        amount: cartTotal,
        items: cartLines.map(l => ({ productId: l.product.id, quantity: l.qty, unitPrice: l.stock.price })),
        fulfilment,
        deliveryAddress: fulfilment === "Delivery" ? fullDeliveryAddress : "",
        salesmanId, salesmanName,
        date: tradingDate,
      })
      setPlacedNumber(order.orderNumber)
      setStep("done")
      onPlaced()
      if (customerEmail) {
        void sendEmail(customerEmail, `Order ${order.orderNumber} received — Punjab Exotic Foods`,
          orderReceivedEmailHtml(order.orderNumber, customerName,
            cartLines.map(l => ({ name: l.product.productName, qty: l.qty, unitPrice: l.stock.price })), cartTotal, fulfilment,
            fulfilment === "Delivery" ? fullDeliveryAddress : undefined), undefined, { category: 'orders', customerId, idempotencyKey: `order:${order.id}:received:customer`, communicationType: 'order_received' })
      }
      void sendEmail(ADMIN_NOTIFY_EMAIL, `New order ${order.orderNumber} — ${customerName} (£${cartTotal.toFixed(2)})`,
        orderReceivedEmailHtml(order.orderNumber, customerName,
          cartLines.map(l => ({ name: l.product.productName, qty: l.qty, unitPrice: l.stock.price })), cartTotal, fulfilment,
          fulfilment === "Delivery" ? fullDeliveryAddress : undefined), undefined, { category: 'orders', customerId, idempotencyKey: `order:${order.id}:received:admin`, communicationType: 'order_received_admin' })
    } catch {
      setError("We couldn't place your order — please try again or contact support.")
    }
    setPlacing(false)
  }

  return (
    <Modal
      open={open}
      title={step === "done" ? "Order Placed" : step === "review" ? "Review Your Order" : "Place a New Order"}
      onClose={handleClose}
      wide={step === "browse"}
    >
      {step === "browse" && (
        <div className="po-shop">
          <div className="po-browse">
            <div className="po-toolbar">
              <div className="po-search-wrap">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                <input placeholder="Search produce…" value={search} onChange={e => setSearch(e.target.value)} />
              </div>
            </div>
            <div className="po-cats">
              {categories.map(c => (
                <button key={c} className={"po-cat" + (category === c ? " on" : "")} onClick={() => setCategory(c)}
                  style={category === c && c !== "All" ? { borderColor: catColor(c), color: catColor(c) } : undefined}>
                  {c !== "All" && <span className="po-cat-dot" style={{ background: catColor(c) }} />}
                  {c}
                </button>
              ))}
            </div>
            <div className="po-grid">
              {shown.map((p, i) => {
                const s = stockMap[p.id]
                const inCart = cart[p.id] ?? 0
                return (
                  <div key={p.id} className={"po-card" + (inCart > 0 ? " in-cart" : "")} style={{ animationDelay: `${Math.min(i, 12) * 0.03}s` }}>
                    <div className="po-card-av" style={{ background: catColor(p.category) + "1f", color: catColor(p.category) }}>
                      {p.productName.slice(0, 2).toUpperCase()}
                    </div>
                    <div className="po-card-name">{p.productName}</div>
                    <div className="po-card-meta">{p.size || p.variety || p.category}</div>
                    <div className="po-card-price">£{s.price.toFixed(2)}<span>/ box</span></div>
                    {p.boxesPerPallet > 0 && <div className="po-card-stock" style={{ fontSize: 10.5 }}>{p.boxesPerPallet} boxes per pallet</div>}
                    {inCart > 0 ? (
                      <div className="po-stepper">
                        <button onClick={() => setQty(p.id, Math.max(0, inCart - 1))} aria-label="Decrease">−</button>
                        <input
                          type="number" min="0" step="0.1" value={inCart}
                          onChange={e => setQty(p.id, parseFloat(e.target.value) || 0)}
                          style={{ width: 44, textAlign: "center", border: "none", background: "none", fontWeight: 700, fontFamily: "inherit" }}
                        />
                        <button onClick={() => setQty(p.id, inCart + 1)} disabled={inCart >= s.availableQuantity} aria-label="Increase">+</button>
                      </div>
                    ) : (
                      <button className="po-add-btn" onClick={() => addOne(p.id)}>+ Add</button>
                    )}
                  </div>
                )
              })}
              {shown.length === 0 && (
                <div className="db-empty" style={{ gridColumn: "1 / -1" }}>
                  {orderable.length === 0 ? "No produce available to order right now — check back once today's stock is live." : `Nothing matches "${search}".`}
                </div>
              )}
            </div>
          </div>

          <div className="po-cart">
            <div className="po-cart-head">
              <span>Your Order</span>
              {cartCount > 0 && <span className="po-cart-count">{cartCount} item{cartCount !== 1 ? "s" : ""}</span>}
            </div>
            {cartLines.length === 0 ? (
              <div className="po-cart-empty">
                <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#c3c9d2" strokeWidth="1.6"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>
                <p>Your order is empty.<br />Add produce from the list to get started.</p>
              </div>
            ) : (
              <div className="po-cart-lines">
                {cartLines.map(l => (
                  <div key={l.product.id} className="po-cart-line">
                    <div className="po-cart-line-info">
                      <div className="po-cart-line-name">{l.product.productName}</div>
                      <div className="po-cart-line-meta">{l.qty} × £{l.stock.price.toFixed(2)}</div>
                    </div>
                    <strong>£{(l.qty * l.stock.price).toFixed(2)}</strong>
                    <button className="po-cart-remove" onClick={() => removeLine(l.product.id)} aria-label="Remove">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="po-cart-total">
              <span>Total</span>
              <strong>£{cartTotal.toFixed(2)}</strong>
            </div>
            <Button className="po-cart-cta" disabled={cartLines.length === 0} onClick={() => setStep("review")}>
              Review Order →
            </Button>
          </div>
        </div>
      )}

      {step === "review" && (
        <div>
          <div className="ord-items">
            {cartLines.map(l => (
              <div key={l.product.id} className="ord-item-row">
                <div className="po-card-av" style={{ background: catColor(l.product.category) + "1f", color: catColor(l.product.category), width: 34, height: 34, fontSize: 11 }}>
                  {l.product.productName.slice(0, 2).toUpperCase()}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 13.5, color: "#111827" }}>{l.product.productName}</div>
                  <div style={{ fontSize: 12, color: "#9ca3af" }}>{l.qty} × £{l.stock.price.toFixed(2)}</div>
                </div>
                <strong>£{(l.qty * l.stock.price).toFixed(2)}</strong>
              </div>
            ))}
          </div>
          <div className="ord-review" style={{ marginTop: 14 }}>
            <div className="ord-row"><span>Ordered by</span><strong>{customerName}</strong></div>
            <div className="ord-row ord-total"><span>Total</span><strong>£{cartTotal.toFixed(2)}</strong></div>
          </div>

          <div style={{ margin: "16px 0" }}>
            <div style={{ fontSize: 12.5, fontWeight: 700, color: "#374151", marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 }}>
              Delivery or Collection?
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              {(["Delivery", "Collection"] as Fulfilment[]).map(f => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFulfilment(f)}
                  style={{
                    flex: 1, padding: "10px 14px", borderRadius: 10, cursor: "pointer",
                    border: fulfilment === f ? "2px solid #1f7a3a" : "1.5px solid #e5e7eb",
                    background: fulfilment === f ? "#f0fdf4" : "#fff",
                    color: fulfilment === f ? "#14532d" : "#374151",
                    fontWeight: fulfilment === f ? 700 : 500, fontSize: 13.5,
                  }}
                >
                  {f}
                </button>
              ))}
            </div>
            {fulfilment === "Collection" && (
              <div style={{ marginTop: 10, border: "1.5px dashed #f2790f", borderRadius: 10, padding: "12px 16px", background: "#fff8ef", fontSize: 13, color: "#374151", lineHeight: 1.6 }}>
                <strong style={{ color: "#111827" }}>{COLLECTION_ADDRESS.line1}</strong><br />
                {COLLECTION_ADDRESS.line2}<br />
                {COLLECTION_ADDRESS.line3}<br />
                {COLLECTION_ADDRESS.line4}<br />
                {COLLECTION_ADDRESS.city} {COLLECTION_ADDRESS.postcode}
              </div>
            )}
            {fulfilment === "Delivery" && (
              <div style={{ marginTop: 10 }}>
                <div style={{ display: "flex", gap: 8 }}>
                  <input
                    placeholder="Enter your postcode, e.g. E10 5SQ"
                    value={postcode}
                    onChange={e => { setPostcode(e.target.value); setPostcodeStatus("idle") }}
                    style={{ flex: 1, padding: "9px 12px", borderRadius: 8, border: "1.5px solid #e5e7eb", fontSize: 13.5 }}
                  />
                  <Button variant="secondary" disabled={!postcode.trim() || checkingPostcode} onClick={checkPostcode}>
                    {checkingPostcode ? "Checking…" : "Find address"}
                  </Button>
                </div>

                {postcodeStatus === "failed" && (
                  <div style={{ marginTop: 10 }}>
                    <p style={{ fontSize: 12.5, color: "#b91c1c", marginBottom: 6 }}>{postcodeError} Please enter your address manually.</p>
                    <textarea
                      placeholder="Full delivery address (house/flat number, street, city, postcode)"
                      value={manualAddress}
                      onChange={e => setManualAddress(e.target.value)}
                      rows={3}
                      style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: "1.5px solid #e5e7eb", fontSize: 13.5, resize: "vertical" }}
                    />
                  </div>
                )}

                {postcodeStatus === "found" && (
                  <div style={{ marginTop: 10 }}>
                    <p style={{ fontSize: 12.5, color: deliveryArea ? "#15803d" : "#b45309", marginBottom: 8 }}>
                      {deliveryArea
                        ? `${resolvedPostcode} is within our ${deliveryArea} delivery zone.`
                        : `${resolvedPostcode} is a valid UK postcode, outside our standard zones — our team will confirm delivery availability directly.`}
                    </p>
                    {realAddresses.length > 0 ? (
                      <>
                        <label style={{ fontSize: 11.5, fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: 0.5 }}>Select your address</label>
                        <select
                          value={selectedRealAddress}
                          onChange={e => setSelectedRealAddress(e.target.value)}
                          style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: "1.5px solid #e5e7eb", fontSize: 13.5, marginTop: 4 }}
                        >
                          {realAddresses.map(a => <option key={a} value={a}>{a}</option>)}
                        </select>
                      </>
                    ) : (
                      <>
                        <p style={{ fontSize: 12, color: "#9ca3af", marginBottom: 8 }}>We couldn't find a full address list for this postcode — please enter your address manually.</p>
                        {addressCandidates.length > 0 && (
                          <>
                            <label style={{ fontSize: 11.5, fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: 0.5 }}>Select your area</label>
                            <select
                              value={selectedLocality}
                              onChange={e => setSelectedLocality(e.target.value)}
                              style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: "1.5px solid #e5e7eb", fontSize: 13.5, marginTop: 4, marginBottom: 8 }}
                            >
                              {addressCandidates.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                          </>
                        )}
                        <label style={{ fontSize: 11.5, fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: 0.5 }}>House/flat number & street</label>
                        <input
                          placeholder="e.g. 14 Orchard Road"
                          value={houseAndStreet}
                          onChange={e => setHouseAndStreet(e.target.value)}
                          style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: "1.5px solid #e5e7eb", fontSize: 13.5, marginTop: 4 }}
                        />
                      </>
                    )}
                    {fullDeliveryAddress && (
                      <p style={{ marginTop: 8, fontSize: 12, color: "#6b7280" }}>Full address to be sent: <strong style={{ color: "#374151" }}>{fullDeliveryAddress}</strong></p>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          <p className="ord-note">Please double-check your order — once confirmed, it's sent to Punjab Exotic Foods for processing.</p>
          <p style={{ fontSize: 12, color: "#9ca3af", marginTop: -6, marginBottom: 12 }}>Urgent Support: <strong style={{ color: "#4d7c5f" }}>{URGENT_SUPPORT_PHONE}</strong></p>
          {error && <p style={{ color: "#b91c1c", fontSize: 13, background: "#fef2f2", borderRadius: 8, padding: "8px 12px", marginBottom: 12 }}>{error}</p>}
          <div className="actions-row">
            <Button disabled={placing || isOrderingClosed()} onClick={confirmOrder}>{placing ? "Placing order…" : `Confirm Order — £${cartTotal.toFixed(2)}`}</Button>
            <Button variant="secondary" onClick={() => setStep("browse")}>← Back to Shopping</Button>
          </div>
        </div>
      )}

      {step === "done" && (
        <div className="ord-done">
          <div className="ord-done-ico po-done-pop">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
          </div>
          <h3>Thank you — order {placedNumber} received!</h3>
          <p>We'll confirm it shortly. You can track its progress any time in <strong>My Orders</strong>.</p>
          {fulfilment === "Collection" ? (
            <div style={{ margin: "0 auto 14px", maxWidth: 280, border: "1.5px dashed #f2790f", borderRadius: 10, padding: "12px 16px", background: "#fff8ef", fontSize: 13, color: "#374151", lineHeight: 1.6, textAlign: "left" }}>
              <strong style={{ color: "#111827" }}>{COLLECTION_ADDRESS.line1}</strong><br />
              {COLLECTION_ADDRESS.line2}<br />
              {COLLECTION_ADDRESS.line3}<br />
              {COLLECTION_ADDRESS.line4}<br />
              {COLLECTION_ADDRESS.city} {COLLECTION_ADDRESS.postcode}
            </div>
          ) : null}
          <p style={{ fontSize: 12, color: "#9ca3af" }}>Urgent Support: <strong style={{ color: "#4d7c5f" }}>{URGENT_SUPPORT_PHONE}</strong></p>
          <div className="actions-row" style={{ justifyContent: "center" }}>
            <Button onClick={() => { reset(); onClose() }}>Done</Button>
            <Button variant="secondary" onClick={reset}>Place Another Order</Button>
          </div>
        </div>
      )}
    </Modal>
  )
}
