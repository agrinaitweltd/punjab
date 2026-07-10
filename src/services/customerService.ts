import type { Customer } from "../types"
import { mockCustomers } from "../data/mockData"
import { databaseService } from "./databaseService"
import { supabaseReady } from "../lib/supabase"

let customers = [...mockCustomers]

function nextId(prefix: string) {
  const max = customers.reduce((m, c) => {
    const n = parseInt(c.id.replace(/[^0-9]/g, "")) || 0
    return n > m ? n : m
  }, 0)
  return `${prefix}-${String(max + 1).padStart(3, "0")}`
}

export async function getCustomers(): Promise<Customer[]> {
  if (supabaseReady) return databaseService.getCustomers()
  await new Promise(r => setTimeout(r, 100))
  return [...customers].sort((a, b) => a.companyName.localeCompare(b.companyName))
}

export async function createCustomer(input: Omit<Customer, "id" | "lastActivity" | "status" | "balance">): Promise<Customer> {
  if (supabaseReady) return databaseService.createCustomer(input)
  await new Promise(r => setTimeout(r, 150))
  const now = new Date().toISOString().replace("T", " ").slice(0, 16)
  const customer: Customer = {
    ...input,
    id: nextId("c"),
    lastActivity: now,
    status: "active",
    balance: 0,
  }
  customers.push(customer)
  return customer
}

export async function updateCustomer(id: string, input: Partial<Customer>): Promise<Customer | null> {
  if (supabaseReady) return databaseService.updateCustomer(id, input)
  await new Promise(r => setTimeout(r, 100))
  const idx = customers.findIndex(c => c.id === id)
  if (idx === -1) return null
  const updated = { ...customers[idx], ...input } as Customer
  customers[idx] = updated
  return updated
}

export async function deleteCustomer(id: string): Promise<boolean> {
  if (supabaseReady) return databaseService.deleteCustomer(id)
  await new Promise(r => setTimeout(r, 100))
  customers = customers.filter(c => c.id !== id)
  return true
}