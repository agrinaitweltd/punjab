/* Credit-control rules.
   A customer is "overdue" when either:
   1. Any unpaid invoice is older than their credit days, or
   2. Their total outstanding balance is over their credit limit (limit > 0) —
      in which case they must pay down enough invoices (oldest first) to get
      back under it. */

import type { Customer, Invoice } from "../types"
import { invoiceOutstanding } from './creditNotes'

export type OverdueInvoice = { invoiceNumber: string; amount: number; daysOverdue: number; id: string }

export type CreditStatus = {
  customer: Customer
  outstanding: number
  unpaidCount: number
  overdueInvoices: OverdueInvoice[]
  overLimitBy: number
  /** Minimum the customer must pay right now: all overdue invoices, plus (if
      still over limit after those) enough of the remaining oldest invoices to
      get back under the limit. */
  minimumDue: number
  isOverdue: boolean
}

const DAY_MS = 24 * 60 * 60 * 1000

function daysPast(dateIso: string, now: Date): number {
  if (!dateIso) return 0
  const d = new Date(dateIso + (dateIso.length === 10 ? "T00:00:00" : ""))
  if (Number.isNaN(d.getTime())) return 0
  return Math.floor((now.getTime() - d.getTime()) / DAY_MS)
}

export function getCreditStatus(customer: Customer, invoices: Invoice[], now = new Date()): CreditStatus {
  const creditDays = customer.creditDays ?? 14
  const creditLimit = customer.creditLimit ?? 0
  const unpaid = invoices
    .filter(i => i.customerId === customer.id && invoiceOutstanding(i) > 0)
    .sort((a, b) => (a.date ?? a.dueDate).localeCompare(b.date ?? b.dueDate)) // oldest first

  const outstanding = unpaid.reduce((s, i) => s + invoiceOutstanding(i), 0)

  // An invoice that has REACHED its agreed credit days (age >= creditDays,
  // not just past it) must be paid — e.g. 14-day terms and an invoice that's
  // exactly 14 days old today already requires payment, not just on day 15.
  const overdueInvoices: OverdueInvoice[] = unpaid
    .map(i => {
      const age = daysPast(i.date || i.dueDate, now)
      return { id: i.id, invoiceNumber: i.invoiceNumber, amount: invoiceOutstanding(i), daysOverdue: age - creditDays }
    })
    .filter(i => i.daysOverdue >= 0)

  const overLimitBy = creditLimit > 0 ? Math.max(0, outstanding - creditLimit) : 0

  // Overdue invoices must all be paid. If that still leaves the balance over
  // the limit, keep adding the next-oldest invoices until back under it.
  const overdueTotal = overdueInvoices.reduce((s, i) => s + i.amount, 0)
  let minimumDue = overdueTotal
  if (creditLimit > 0) {
    const overdueIds = new Set(overdueInvoices.map(i => i.id))
    let remainingBalance = outstanding - overdueTotal
    for (const inv of unpaid) {
      if (remainingBalance <= creditLimit) break
      if (overdueIds.has(inv.id)) continue
      minimumDue += invoiceOutstanding(inv)
      remainingBalance -= invoiceOutstanding(inv)
    }
  }

  return {
    customer,
    outstanding,
    unpaidCount: unpaid.length,
    overdueInvoices,
    overLimitBy,
    minimumDue,
    isOverdue: overdueInvoices.length > 0 || overLimitBy > 0,
  }
}

/** Which condition tripped, for clear warning messaging — "whichever is
    reached first" per the credit-terms spec: days overdue, over limit, or both. */
export function creditWarningReason(status: CreditStatus): "days" | "limit" | "both" | null {
  const daysExceeded = status.overdueInvoices.length > 0
  const limitExceeded = status.overLimitBy > 0
  if (daysExceeded && limitExceeded) return "both"
  if (daysExceeded) return "days"
  if (limitExceeded) return "limit"
  return null
}

export function creditWarningLabel(status: CreditStatus): string | null {
  const reason = creditWarningReason(status)
  if (reason === "both") return "Credit days exceeded & over credit limit"
  if (reason === "days") return "Credit days exceeded"
  if (reason === "limit") return "Over credit limit"
  return null
}

export function getOverdueCustomers(customers: Customer[], invoices: Invoice[], now = new Date()): CreditStatus[] {
  return customers
    .map(c => getCreditStatus(c, invoices, now))
    .filter(s => s.isOverdue)
    .sort((a, b) => b.minimumDue - a.minimumDue)
}
