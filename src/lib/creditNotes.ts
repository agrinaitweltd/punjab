import type { CreditNote, Invoice } from "../types"

/** Outstanding balance still owed on an invoice, accounting for partial
    payments and/or credit already applied. */
export function invoiceOutstanding(invoice: Invoice): number {
  return Math.max(0, invoice.amount - (invoice.amountPaid ?? 0))
}

export function invoiceStatusFor(amount: number, amountPaid: number): Invoice["status"] {
  if (amountPaid <= 0) return "Unpaid"
  if (amountPaid >= amount) return "Paid"
  return "Part Paid"
}

/** Applies as much of a credit note's remaining balance as possible to one
    invoice — capped by both the credit remaining and the invoice's own
    outstanding balance. Returns the resulting numbers for the caller to
    persist (allocation row + invoice update + credit note update), following
    this project's pattern of keeping business logic pure and letting the
    page/portal orchestrate the actual writes. */
export function computeCreditApplication(creditNote: CreditNote, invoice: Invoice, requestedAmount?: number) {
  const outstanding = invoiceOutstanding(invoice)
  const cap = Math.min(creditNote.remainingBalance, outstanding, requestedAmount ?? Infinity)
  const appliedAmount = Math.max(0, Math.round(cap * 100) / 100)
  const newAmountPaid = (invoice.amountPaid ?? 0) + appliedAmount
  return {
    appliedAmount,
    newInvoiceAmountPaid: newAmountPaid,
    newInvoiceStatus: invoiceStatusFor(invoice.amount, newAmountPaid),
    newCreditRemainingBalance: Math.max(0, Math.round((creditNote.remainingBalance - appliedAmount) * 100) / 100),
  }
}

/** CN-YYYY-NNN, sequential per year — same scheme as invoice/payment numbers. */
export function nextCreditNumber(existing: { creditNumber: string }[]): string {
  const year = new Date().getFullYear()
  const max = existing.reduce((m, c) => {
    const n = c.creditNumber.startsWith(`CN-${year}-`) ? parseInt(c.creditNumber.split("-").pop() ?? "0") || 0 : 0
    return n > m ? n : m
  }, 0)
  return `CN-${year}-${String(max + 1).padStart(3, "0")}`
}
