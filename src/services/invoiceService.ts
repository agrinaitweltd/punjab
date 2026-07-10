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