import { useMemo } from "react"
import type { Customer, CreditNote, CreditNoteAllocation, Invoice, Payment } from "../../types"
import { Modal } from "../../components/ui/Modal"
import { Button } from "../../components/ui/Button"
import { invoiceOutstanding } from "../../lib/creditNotes"

type LedgerEntry = {
  date: string
  type: "Invoice" | "Payment" | "Credit Applied"
  ref: string
  debit: number
  credit: number
}

export function CustomerStatementModal({
  open, onClose, customer, invoices, payments, creditNotes, allocations,
}: {
  open: boolean
  onClose: () => void
  customer: Customer | null
  invoices: Invoice[]
  payments: Payment[]
  creditNotes: CreditNote[]
  allocations: CreditNoteAllocation[]
}) {
  const myInvoices = useMemo(() => customer ? invoices.filter(i => i.customerId === customer.id) : [], [customer, invoices])
  const myPayments = useMemo(() => customer ? payments.filter(p => p.customerId === customer.id) : [], [customer, payments])
  const myCreditNotes = useMemo(() => customer ? creditNotes.filter(c => c.customerId === customer.id) : [], [customer, creditNotes])
  const myAllocations = useMemo(
    () => allocations.filter(a => myCreditNotes.some(c => c.id === a.creditNoteId)),
    [allocations, myCreditNotes],
  )

  const invoiceNumber = (id: string) => invoices.find(i => i.id === id)?.invoiceNumber ?? id

  const ledger = useMemo(() => {
    const entries: LedgerEntry[] = []
    for (const inv of myInvoices) entries.push({ date: inv.date || inv.dueDate, type: "Invoice", ref: inv.invoiceNumber, debit: inv.amount, credit: 0 })
    for (const p of myPayments) entries.push({ date: p.date, type: "Payment", ref: p.paymentReference, debit: 0, credit: p.amount })
    for (const a of myAllocations) {
      const note = myCreditNotes.find(c => c.id === a.creditNoteId)
      entries.push({ date: a.date, type: "Credit Applied", ref: `${note?.creditNumber ?? a.creditNoteId} → ${invoiceNumber(a.invoiceId)}`, debit: 0, credit: a.amount })
    }
    entries.sort((a, b) => a.date.localeCompare(b.date))
    let running = 0
    return entries.map(e => { running += e.debit - e.credit; return { ...e, balance: running } })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myInvoices, myPayments, myAllocations, myCreditNotes])

  const totalCreditApplied = myAllocations.reduce((s, a) => s + a.amount, 0)
  const remainingCredit = myCreditNotes.filter(c => c.status === "Active").reduce((s, c) => s + c.remainingBalance, 0)
  const outstandingBalance = myInvoices.filter(i => i.status !== "Paid").reduce((s, i) => s + invoiceOutstanding(i), 0)

  const printStatement = () => {
    if (!customer) return
    const w = window.open("", "_blank", "width=800,height=900")
    if (!w) return
    const rows = ledger.map(e => `
      <tr>
        <td>${e.date}</td><td>${e.type}</td><td>${e.ref}</td>
        <td style="text-align:right">${e.debit ? "£" + e.debit.toFixed(2) : ""}</td>
        <td style="text-align:right">${e.credit ? "£" + e.credit.toFixed(2) : ""}</td>
        <td style="text-align:right">£${e.balance.toFixed(2)}</td>
      </tr>`).join("")
    w.document.write(`
      <html><head><title>Statement — ${customer.companyName}</title>
      <style>body{font-family:Segoe UI,Arial,sans-serif;padding:40px;color:#111827}
      h1{font-size:20px;margin-bottom:4px}.muted{color:#6b7280;font-size:13px}
      table{width:100%;border-collapse:collapse;margin-top:20px;font-size:13px}
      th,td{padding:7px 6px;border-bottom:1px solid #eee;text-align:left}
      th{color:#6b7280;font-size:11px;text-transform:uppercase}
      .summary{margin-top:20px;font-size:14px}.summary strong{display:inline-block;width:220px}</style></head>
      <body>
        <h1>Punjab Exotic Foods — Customer Statement</h1>
        <p class="muted">Gate 9, Stand 1B–1D, New Spitalfields Market, Sherrin Road, London E10 5SQ</p>
        <p class="muted">Customer: <strong>${customer.companyName}</strong> · ${customer.customerNumber}</p>
        <table><thead><tr><th>Date</th><th>Type</th><th>Reference</th><th style="text-align:right">Debit</th><th style="text-align:right">Credit</th><th style="text-align:right">Balance</th></tr></thead>
        <tbody>${rows}</tbody></table>
        <div class="summary">
          <p><strong>Outstanding Balance</strong> £${outstandingBalance.toFixed(2)}</p>
          <p><strong>Credit Applied</strong> £${totalCreditApplied.toFixed(2)}</p>
          <p><strong>Remaining Customer Credit</strong> £${remainingCredit.toFixed(2)}</p>
        </div>
        <script>window.print()</script>
      </body></html>
    `)
    w.document.close()
  }

  return (
    <Modal open={open} title={customer ? `Statement — ${customer.companyName}` : "Statement"} onClose={onClose} wide>
      {customer && (
        <div>
          <div className="ps-stats-row">
            <div className="ps-stat"><p className="ps-stat-label">Outstanding Balance</p><p className="ps-stat-value">£{outstandingBalance.toFixed(2)}</p></div>
            <div className="ps-stat"><p className="ps-stat-label">Credit Applied</p><p className="ps-stat-value">£{totalCreditApplied.toFixed(2)}</p></div>
            <div className="ps-stat"><p className="ps-stat-label">Remaining Customer Credit</p><p className="ps-stat-value" style={{ color: remainingCredit > 0 ? "#15803d" : undefined }}>£{remainingCredit.toFixed(2)}</p></div>
          </div>

          <p style={{ fontSize: 12.5, fontWeight: 700, color: "#6b7280", margin: "18px 0 8px", textTransform: "uppercase", letterSpacing: 0.5 }}>
            Statement Ledger
          </p>
          <div className="ps-table-wrap">
            <table className="ps-table">
              <thead><tr><th>Date</th><th>Type</th><th>Reference</th><th style={{ textAlign: "right" }}>Debit</th><th style={{ textAlign: "right" }}>Credit</th><th style={{ textAlign: "right" }}>Balance</th></tr></thead>
              <tbody>
                {ledger.map((e, i) => (
                  <tr key={i}>
                    <td style={{ color: "#6b7280" }}>{e.date}</td>
                    <td>
                      <span className="ps-badge" style={
                        e.type === "Invoice" ? { background: "#fef9c3", color: "#a16207" }
                        : e.type === "Payment" ? { background: "#dcfce7", color: "#15803d" }
                        : { background: "#dbeafe", color: "#1d4ed8" }
                      }>{e.type}</span>
                    </td>
                    <td>{e.ref}</td>
                    <td style={{ textAlign: "right" }}>{e.debit ? `£${e.debit.toFixed(2)}` : ""}</td>
                    <td style={{ textAlign: "right", color: "#15803d" }}>{e.credit ? `£${e.credit.toFixed(2)}` : ""}</td>
                    <td style={{ textAlign: "right", fontWeight: 700 }}>£{e.balance.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {ledger.length === 0 && <div style={{ padding: 24, textAlign: "center", color: "#9ca3af" }}>No activity yet</div>}
          </div>

          <p style={{ fontSize: 12.5, fontWeight: 700, color: "#6b7280", margin: "18px 0 8px", textTransform: "uppercase", letterSpacing: 0.5 }}>
            Invoice Detail
          </p>
          <div className="ord-items">
            {myInvoices.map(inv => {
              const paid = inv.amountPaid ?? 0
              const invPayments = myPayments.filter(p => p.invoiceId === inv.id)
              const invAllocations = myAllocations.filter(a => a.invoiceId === inv.id)
              return (
                <div key={inv.id} style={{ borderBottom: "1px solid #eef1ee", padding: "10px 0" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <strong style={{ fontSize: 13.5 }}>{inv.invoiceNumber}</strong>
                    <span className="ps-badge" style={inv.status === "Paid" ? { background: "#dcfce7", color: "#15803d" } : inv.status === "Part Paid" ? { background: "#dbeafe", color: "#1d4ed8" } : { background: "#fef9c3", color: "#a16207" }}>{inv.status}</span>
                  </div>
                  <div style={{ display: "flex", gap: 18, fontSize: 12.5, color: "#374151", marginTop: 4, flexWrap: "wrap" }}>
                    <span>Total: <strong>£{inv.amount.toFixed(2)}</strong></span>
                    <span>Paid: <strong style={{ color: "#15803d" }}>£{paid.toFixed(2)}</strong></span>
                    <span>Outstanding: <strong style={{ color: invoiceOutstanding(inv) > 0 ? "#b91c1c" : "#9ca3af" }}>£{invoiceOutstanding(inv).toFixed(2)}</strong></span>
                  </div>
                  {(invPayments.length > 0 || invAllocations.length > 0) && (
                    <div style={{ marginTop: 6, fontSize: 12, color: "#6b7280" }}>
                      {invPayments.map(p => <div key={p.id}>· {p.date} — Payment {p.paymentReference} £{p.amount.toFixed(2)}</div>)}
                      {invAllocations.map(a => <div key={a.id}>· {a.date} — Credit applied £{a.amount.toFixed(2)}</div>)}
                    </div>
                  )}
                </div>
              )
            })}
            {myInvoices.length === 0 && <p style={{ color: "#9ca3af", fontSize: 13 }}>No invoices yet</p>}
          </div>

          <div className="actions-row" style={{ marginTop: 18 }}>
            <Button variant="secondary" onClick={printStatement}>Print Statement</Button>
            <Button variant="secondary" onClick={onClose}>Close</Button>
          </div>
        </div>
      )}
    </Modal>
  )
}
