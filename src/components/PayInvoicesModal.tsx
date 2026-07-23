import { useEffect, useState } from "react"
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js"
import { Modal } from "./ui/Modal"
import { Button } from "./ui/Button"
import { getStripe } from "../lib/stripeClient"

type Invoice = { id: string; invoiceNumber: string; amount: number }

function CardForm({ amount, onPaid, onCancel }: {
  amount: number
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
      redirect: "if_required", // stay in-page — only redirects for banks that require it (e.g. some 3D Secure flows)
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

  return (
    <div>
      <PaymentElement options={{ layout: "tabs" }} />
      {error && (
        <p style={{ marginTop: 12, fontSize: 13, color: "#b91c1c", background: "#fef2f2", borderRadius: 8, padding: "8px 12px" }}>
          {error}
        </p>
      )}
      <div className="actions-row" style={{ marginTop: 18 }}>
        <Button onClick={submit} disabled={!stripe || busy}>{busy ? "Processing…" : `Pay £${amount.toFixed(2)}`}</Button>
        <Button variant="secondary" type="button" onClick={onCancel} disabled={busy}>Cancel</Button>
      </div>
    </div>
  )
}

export function PayInvoicesModal({ open, invoices, customerEmail, onClose, onPaid }: {
  open: boolean
  invoices: Invoice[]
  customerEmail?: string
  onClose: () => void
  onPaid: (paymentIntentId: string, invoiceIds: string[], amount: number) => void
}) {
  const [clientSecret, setClientSecret] = useState("")
  const [amount, setAmount] = useState(0)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

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

  const invoiceIds = invoices.map(i => i.id)

  return (
    <Modal open={open} title="Pay Invoices" onClose={onClose}>
      <div style={{ marginBottom: 14 }}>
        <p style={{ fontSize: 12.5, fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 }}>
          {invoices.length} invoice{invoices.length !== 1 ? "s" : ""} selected
        </p>
        {invoices.map(i => (
          <div key={i.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 13.5, padding: "4px 0", color: "#374151" }}>
            <span>{i.invoiceNumber}</span>
            <strong>£{i.amount.toFixed(2)}</strong>
          </div>
        ))}
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 15, fontWeight: 800, color: "#14532d", marginTop: 8, paddingTop: 8, borderTop: "1px solid #eef1ee" }}>
          <span>Total</span>
          <span>£{invoices.reduce((s, i) => s + i.amount, 0).toFixed(2)}</span>
        </div>
      </div>

      {loading && <p style={{ fontSize: 13.5, color: "#6b7280" }}>Preparing secure payment…</p>}
      {error && (
        <div>
          <p style={{ fontSize: 13.5, color: "#b91c1c", background: "#fef2f2", borderRadius: 8, padding: "10px 14px" }}>{error}</p>
          <Button variant="secondary" onClick={onClose} style={{ marginTop: 12 }}>Close</Button>
        </div>
      )}
      {!loading && !error && clientSecret && (
        <Elements stripe={getStripe()} options={{ clientSecret, appearance: { theme: "stripe", variables: { colorPrimary: "#1f7a3a" } } }}>
          <CardForm
            amount={amount}
            onCancel={onClose}
            onPaid={(paymentIntentId) => onPaid(paymentIntentId, invoiceIds, amount)}
          />
        </Elements>
      )}
    </Modal>
  )
}
