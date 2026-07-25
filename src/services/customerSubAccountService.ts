import type { CustomerSubAccount } from "../types"
import { databaseService } from "./databaseService"
import { supabaseReady } from "../lib/supabase"

let subAccounts: CustomerSubAccount[] = []

export async function getCustomerSubAccounts(): Promise<CustomerSubAccount[]> {
  if (supabaseReady) return databaseService.getCustomerSubAccounts()
  await new Promise(r => setTimeout(r, 80))
  return [...subAccounts].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export async function createCustomerSubAccount(input: Omit<CustomerSubAccount, "id" | "createdAt" | "status" | "active">): Promise<CustomerSubAccount> {
  if (supabaseReady) return databaseService.createCustomerSubAccount(input)
  await new Promise(r => setTimeout(r, 80))
  const account: CustomerSubAccount = { ...input, id: `sub-${Date.now()}`, status: "Pending", active: true, createdAt: new Date().toISOString() }
  subAccounts.push(account)
  return account
}

export async function updateCustomerSubAccount(id: string, input: Partial<CustomerSubAccount>): Promise<CustomerSubAccount | null> {
  if (supabaseReady) return databaseService.updateCustomerSubAccount(id, input)
  await new Promise(r => setTimeout(r, 80))
  const idx = subAccounts.findIndex(s => s.id === id)
  if (idx === -1) return null
  subAccounts[idx] = { ...subAccounts[idx], ...input }
  return subAccounts[idx]
}

export async function deleteCustomerSubAccount(id: string): Promise<boolean> {
  if (supabaseReady) return databaseService.deleteCustomerSubAccount(id)
  await new Promise(r => setTimeout(r, 80))
  const before = subAccounts.length
  subAccounts = subAccounts.filter(s => s.id !== id)
  return subAccounts.length < before
}
