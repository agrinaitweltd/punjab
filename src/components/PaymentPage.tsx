import { useEffect, useState } from "react"
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js"
import { Button } from "./ui/Button"
import { getStripe } from "../lib/stripeClient"
import { URGENT_SUPPORT_PHONE } from "../lib/emailService"

type Invoice = { id: string; invoiceNumber: string; amount: number }

function CardForm({ amount, verifying, onPaid, onCancel }: {
  amount: number
  verifying: boolean
  onPaid: (paymentIntentId: string) => void
  onCancel: () => void
}) {
  const stripe = useStripe()
  const elements = useElements()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")

  const submit = async () => {
    if (!stripe || !elements) return
    setBusy(true); setError("")
    const { error: submitError } = await elements.submit()
    if (submitError) { setError(submitError.message || "Please check your card details."); setBusy(false); return }

    const { error: confirmError, paymentIntent } = await stripe.confirmPayment({
      elements,
      redirect: "if_required", // stays on this page — only redirects if a bank's 3D Secure genuinely requires it
    })
    if (confirmError) {
      setError(confirmError.message || "Payment failed — please try again.")
      setBusy(false)
      return
    }
    if (paymentIntent?.status === "succeeded") {
      onPaid(paymentIntent.id)
    } else {
      setError("Payment did not complete — please try again.")
      setBusy(false)
    }
  }

  const working = busy || verifying

  return (
    <div>
      <PaymentElement options={{ layout: "tabs" }} />
      {error && (
        <p style={{ marginTop: 14, fontSize: 13, color: "#b91c1c", background: "#fef2f2", borderRadius: 8, padding: "10px 14px" }}>
          {error}
        </p>
      )}
      <Button onClick={submit} disabled={!stripe || working} style={{ width: "100%", marginTop: 20, fontSize: 15, padding: "13px 0" }}>
        {verifying ? "Confirming payment…" : busy ? "Processing…" : `Pay £${amount.toFixed(2)} Securely`}
      </Button>
      <button
        type="button" onClick={onCancel} disabled={working}
        style={{ width: "100%", marginTop: 10, background: "none", border: "none", color: "#6b7280", fontSize: 13, cursor: "pointer", padding: "6px 0" }}
      >
        Cancel and go back
      </button>
    </div>
  )
}

export function PaymentPage({ open, invoices, customerEmail, customerName, onClose, onPaid }: {
  open: boolean
  invoices: Invoice[]
  customerEmail?: string
  customerName: string
  onClose: () => void
  onPaid: (paymentIntentId: string, invoiceIds: string[], amount: number) => void
}) {
  const [clientSecret, setClientSecret] = useState("")
  const [amount, setAmount] = useState(0)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [verifying, setVerifying] = useState(false)

  useEffect(() => {
    if (!open || invoices.length === 0) return
    setClientSecret(""); setError(""); setLoading(true)
    fetch("/api/create-payment-intent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        invoices: invoices.map(i => ({ id: i.id, invoiceNumber: i.invoiceNumber, amount: i.amount })),
        customerEmail,
      }),
    })
      .then(r => r.json())
      .then(data => {
        if (data.clientSecret) { setClientSecret(data.clientSecret); setAmount(data.amount) }
        else setError(data.error || "Card payments aren't available right now — please pay by bank transfer or contact us.")
      })
      .catch(() => setError("Couldn't reach the payment service — please check your connection and try again."))
      .finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, invoices.map(i => i.id).join(",")])

  if (!open) return null

  const invoiceIds = invoices.map(i => i.id)
  const total = invoices.reduce((s, i) => s + i.amount, 0)

  const handlePaid = async (paymentIntentId: string) => {
    // Client confirmation is not enough on its own — verify with Stripe
    // server-side before actually marking invoices paid.
    setVerifying(true)
    try {
      const r = await fetch(`/api/verify-payment?payment_intent=${encodeURIComponent(paymentIntentId)}`)
      const data = await r.json()
      if (data.paid) {
        onPaid(paymentIntentId, data.invoiceIds?.length ? data.invoiceIds : invoiceIds, data.amount ?? amount)
      } else {
        setError("We couldn't confirm this payment went through — if you were charged, contact us and we'll put it right.")
      }
    } catch {
      setError("Payment may have gone through, but we couldn't confirm it — please contact us before paying again.")
    }
    setVerifying(false)
  }

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 1000, background: "#0d2b1e",
        display: "flex", alignItems: "stretch", justifyContent: "center",
        overflowY: "auto",
      }}
    >
      <div style={{ width: "100%", maxWidth: 980, margin: "auto", padding: "40px 20px", display: "flex", flexDirection: "column", gap: 24 }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <img src="/logo.png" alt="Punjab Exotic Foods" style={{ width: 40, height: 40, borderRadius: 8 }}
              onError={e => { (e.target as HTMLImageElement).style.display = "none" }} />
            <div>
              <div style={{ color: "#fff", fontWeight: 800, fontSize: 17 }}>PUNJAB <span style={{ fontWeight: 500 }}>EXOTIC FOODS</span></div>
              <div style={{ color: "#8fae9c", fontSize: 11, letterSpacing: 2, textTransform: "uppercase" }}>Secure Checkout</div>
            </div>
          </div>
          <button
            type="button" onClick={onClose}
            style={{ background: "rgba(255,255,255,0.08)", border: "none", color: "#fff", width: 36, height: 36, borderRadius: 10, cursor: "pointer", fontSize: 16 }}
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Payment card */}
        <div style={{ background: "#fff", borderRadius: 20, overflow: "hidden", boxShadow: "0 20px 60px rgba(0,0,0,0.35)", display: "grid", gridTemplateColumns: "1fr", minHeight: 0 }} className="pay-page-grid">
          <style>{`
            @media (min-width: 760px) {
              .pay-page-grid { grid-template-columns: 1fr 1.2fr !important; }
            }
          `}</style>

          {/* Left: order summary */}
          <div style={{ background: "#f8faf8", padding: "32px 32px", borderRight: "1px solid #eef1ee" }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: "#6b7a70", textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>Paying as</p>
            <p style={{ fontSize: 15, fontWeight: 700, color: "#0d2b1e", marginBottom: 24 }}>{customerName}</p>

            <p style={{ fontSize: 11, fontWeight: 700, color: "#6b7a70", textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>
              {invoices.length} invoice{invoices.length !== 1 ? "s" : ""}
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 18 }}>
              {invoices.map(i => (
                <div key={i.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 13.5, color: "#374151" }}>
                  <span>{i.invoiceNumber}</span>
                  <strong>£{i.amount.toFixed(2)}</strong>
                </div>
              ))}
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", paddingTop: 16, borderTop: "1.5px dashed #d7e3da" }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: "#0d2b1e" }}>Total due</span>
              <span style={{ fontSize: 22, fontWeight: 800, color: "#14532d" }}>£{total.toFixed(2)}</span>
            </div>

            <div style={{ marginTop: 32, display: "flex", gap: 8, alignItems: "flex-start", fontSize: 12, color: "#6b7a70", lineHeight: 1.6 }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#1f7a3a" strokeWidth="2" style={{ flexShrink: 0, marginTop: 1 }}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>
              <span>Payments are processed securely by Stripe. Punjab Exotic Foods never sees or stores your card details.</span>
            </div>

            <p style={{ marginTop: 20, fontSize: 12, color: "#9ca3af" }}>
              Need help? Call us on <strong style={{ color: "#4d7c5f" }}>{URGENT_SUPPORT_PHONE}</strong>
            </p>
          </div>

          {/* Right: payment form */}
          <div style={{ padding: "32px 32px" }}>
            <h2 style={{ fontSize: 18, color: "#111827", marginBottom: 18 }}>Payment details</h2>

            {loading && <p style={{ fontSize: 13.5, color: "#6b7280" }}>Preparing secure payment…</p>}

            {error && !loading && (
              <div>
                <p style={{ fontSize: 13.5, color: "#b91c1c", background: "#fef2f2", borderRadius: 8, padding: "10px 14px" }}>{error}</p>
                <Button variant="secondary" onClick={onClose} style={{ marginTop: 16 }}>Close</Button>
              </div>
            )}

            {!loading && !error && clientSecret && (
              <Elements stripe={getStripe()} options={{ clientSecret, appearance: { theme: "stripe", variables: { colorPrimary: "#1f7a3a", borderRadius: "10px" } } }}>
                <CardForm
                  amount={amount}
                  verifying={verifying}
                  onCancel={onClose}
                  onPaid={handlePaid}
                />
              </Elements>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
