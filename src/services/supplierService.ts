import type { Supplier } from "../types"
import { databaseService } from "./databaseService"
import { supabaseReady } from "../lib/supabase"

let suppliers: Supplier[] = []

export async function getSuppliers(): Promise<Supplier[]> {
  if (supabaseReady) return databaseService.getSuppliers()
  await new Promise(r => setTimeout(r, 80))
  return [...suppliers].sort((a, b) => a.name.localeCompare(b.name))
}

export async function createSupplier(input: Omit<Supplier, "id">): Promise<Supplier> {
  if (supabaseReady) return databaseService.createSupplier(input)
  await new Promise(r => setTimeout(r, 80))
  const supplier: Supplier = { ...input, id: `sup-${Date.now()}` }
  suppliers.push(supplier)
  return supplier
}

export async function updateSupplier(id: string, input: Partial<Supplier>): Promise<Supplier | null> {
  if (supabaseReady) return databaseService.updateSupplier(id, input)
  await new Promise(r => setTimeout(r, 80))
  const idx = suppliers.findIndex(s => s.id === id)
  if (idx === -1) return null
  suppliers[idx] = { ...suppliers[idx], ...input }
  return suppliers[idx]
}

export async function deleteSupplier(id: string): Promise<boolean> {
  if (supabaseReady) return databaseService.deleteSupplier(id)
  await new Promise(r => setTimeout(r, 80))
  const before = suppliers.length
  suppliers = suppliers.filter(s => s.id !== id)
  return suppliers.length < before
}
