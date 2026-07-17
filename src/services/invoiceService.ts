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