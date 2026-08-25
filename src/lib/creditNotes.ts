import type { CreditNote, CreditNoteAllocation, Invoice } from "../types"

const money = (value: number) => Math.round(value * 100) / 100

export function creditAppliedToInvoice(invoiceId: string, allocations: CreditNoteAllocation[]): number {
  return money(allocations.filter(allocation => allocation.invoiceId === invoiceId).reduce((sum, allocation) => sum + allocation.amount, 0))
}

export function attachCreditAllocations(invoices: Invoice[], allocations: CreditNoteAllocation[]): Invoice[] {
  const byInvoice = new Map<string, number>()
  for (const allocation of allocations) byInvoice.set(allocation.invoiceId, money((byInvoice.get(allocation.invoiceId) ?? 0) + allocation.amount))
  return invoices.map(invoice => ({ ...invoice, creditApplied: byInvoice.get(invoice.id) ?? 0 }))
}

/** Outstanding balance still owed on an invoice, accounting for partial
    payments and/or credit already applied. */
export function invoiceOutstanding(invoice: Invoice): number {
  return money(Math.max(0, invoice.amount - (invoice.amountPaid ?? 0) - (invoice.creditApplied ?? 0)))
}

export function invoiceStatusFor(amount: number, amountPaid: number, creditApplied = 0): Invoice["status"] {
  if (amountPaid + creditApplied >= amount) return "Paid"
  if (amountPaid <= 0 && creditApplied <= 0) return "Unpaid"
  return "Part Paid"
}

export function invoiceDisplayStatus(invoice: Invoice): string {
  if (invoiceOutstanding(invoice) <= 0 && (invoice.creditApplied ?? 0) >= invoice.amount && (invoice.amountPaid ?? 0) <= 0) return "Fully Credited"
  return invoiceStatusFor(invoice.amount, invoice.amountPaid ?? 0, invoice.creditApplied ?? 0)
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
  const newCreditApplied = (invoice.creditApplied ?? 0) + appliedAmount
  return {
    appliedAmount,
    newInvoiceCreditApplied: newCreditApplied,
    newInvoiceStatus: invoiceStatusFor(invoice.amount, invoice.amountPaid ?? 0, newCreditApplied),
    newCreditRemainingBalance: Math.max(0, Math.round((creditNote.remainingBalance - appliedAmount) * 100) / 100),
  }
}

/** CN-000001, sequential and unique across all credit notes ever issued —
    every credit note keeps its number forever, matching a real financial
    document rather than resetting each year. */
export function nextCreditNumber(existing: { creditNumber: string }[]): string {
  const max = existing.reduce((m, c) => {
    const match = /^CN-(\d+)$/.exec(c.creditNumber)
    const n = match ? parseInt(match[1], 10) || 0 : 0
    return n > m ? n : m
  }, 0)
  return `CN-${String(max + 1).padStart(6, "0")}`
}
