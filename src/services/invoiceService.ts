import type { Invoice, Payment } from "../types"
import { mockInvoices, mockPayments } from "../data/mockData"
import { databaseService } from "./databaseService"
import { supabaseReady } from "../lib/supabase"

let invoices = [...mockInvoices]
let payments = [...mockPayments]

export async function getInvoices(): Promise<Invoice[]> {
  if (supabaseReady) return databaseService.getInvoices()
  await new Promise(r => setTimeout(r, 100))
  return [...invoices].sort((a, b) => b.dueDate.localeCompare(a.dueDate))
}

export async function getPayments(): Promise<Payment[]> {
  if (supabaseReady) return databaseService.getPayments()
  await new Promise(r => setTimeout(r, 100))
  return [...payments].sort((a, b) => b.date.localeCompare(a.date))
}

function nextNum(list: { invoiceNumber?: string; paymentReference?: string }[], key: "invoiceNumber" | "paymentReference", prefix: string) {
  const year = new Date().getFullYear()
  const max = list.reduce((m, x) => {
    const v = x[key] ?? ""
    const n = v.startsWith(`${prefix}-${year}-`) ? parseInt(v.split("-").pop() ?? "0") || 0 : 0
    return n > m ? n : m
  }, 0)
  return `${prefix}-${year}-${String(max + 1).padStart(3, "0")}`
}

export async function createInvoice(input: Omit<Invoice, "id" | "invoiceNumber"> & { invoiceNumber?: string }): Promise<Invoice> {
  let invoiceNumber = input.invoiceNumber
  if (!invoiceNumber) {
    const existing = supabaseReady ? await databaseService.getInvoices() : invoices
    invoiceNumber = nextNum(existing, "invoiceNumber", "INV")
  }
  const full = { ...input, invoiceNumber }
  if (supabaseReady) return databaseService.createInvoice(full)
  await new Promise(r => setTimeout(r, 100))
  const invoice: Invoice = { ...full, id: `inv-${Date.now()}` }
  invoices.push(invoice)
  return invoice
}

export async function updateInvoice(id: string, input: Partial<Invoice>): Promise<Invoice | null> {
  if (supabaseReady) return databaseService.updateInvoice(id, input)
  await new Promise(r => setTimeout(r, 100))
  const idx = invoices.findIndex(i => i.id === id)
  if (idx === -1) return null
  invoices[idx] = { ...invoices[idx], ...input }
  return invoices[idx]
}

/** One-time statement migration: saves the reviewed statement rows as unpaid
    invoices for one customer. dueDate = issue date + the customer's credit days. */
export async function importStatementInvoices(
  customerId: string,
  rows: { date: string; invoiceNumber: string; amount: number; amountPaid?: number; outstandingAmount?: number; status?: Invoice["status"] }[],
  creditDays: number,
): Promise<{ created: number; updated: number; failed: string[] }> {
  let created = 0
  let updated = 0
  const failed: string[] = []
  const existing = supabaseReady ? await databaseService.getInvoices() : invoices
  for (const row of rows) {
    const due = new Date(row.date + "T00:00:00")
    due.setDate(due.getDate() + creditDays)
    const status = row.status ?? ((row.outstandingAmount ?? row.amount) <= 0 ? "Paid" : (row.amountPaid ?? 0) > 0 ? "Part Paid" : "Unpaid")
    try {
      const duplicate = existing.find(i => i.customerId === customerId && i.invoiceNumber === row.invoiceNumber)
      if (duplicate) {
        await updateInvoice(duplicate.id, {
          amountPaid: row.amountPaid ?? duplicate.amountPaid ?? 0,
          status,
          dueDate: duplicate.dueDate || due.toISOString().slice(0, 10),
        })
        updated++
        continue
      }
      await createInvoice({
        customerId,
        invoiceNumber: row.invoiceNumber,
        amount: row.amount,
        date: row.date,
        dueDate: due.toISOString().slice(0, 10),
        amountPaid: row.amountPaid ?? 0,
        status,
      })
      created++
    } catch {
      failed.push(row.invoiceNumber) // usually a duplicate invoice number
    }
  }
  return { created, updated, failed }
}

export async function createPayment(input: Omit<Payment, "id" | "paymentReference">): Promise<Payment> {
  const existing = supabaseReady ? await databaseService.getPayments() : payments
  const paymentReference = nextNum(existing, "paymentReference", "PAY")
  const full = { ...input, paymentReference }
  if (supabaseReady) return databaseService.createPayment(full)
  await new Promise(r => setTimeout(r, 100))
  const payment: Payment = { ...full, id: `pay-${Date.now()}` }
  payments.push(payment)
  return payment
}
