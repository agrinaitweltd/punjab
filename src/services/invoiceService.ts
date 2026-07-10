import type { Invoice, Payment } from "../types"
import { mockInvoices, mockPayments } from "../data/mockData"

let invoices = [...mockInvoices]
let payments = [...mockPayments]

export async function getInvoices(): Promise<Invoice[]> {
  await new Promise(r => setTimeout(r, 100))
  return [...invoices].sort((a, b) => b.dueDate.localeCompare(a.dueDate))
}

export async function getPayments(): Promise<Payment[]> {
  await new Promise(r => setTimeout(r, 100))
  return [...payments].sort((a, b) => b.date.localeCompare(a.date))
}