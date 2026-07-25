import type { Salesman } from "../types"
import { databaseService } from "./databaseService"
import { supabaseReady } from "../lib/supabase"
import { SALESMEN } from "../lib/salesmen"

let salesmen: Salesman[] = [...SALESMEN]

export async function getSalesmen(): Promise<Salesman[]> {
  if (supabaseReady) {
    const rows = await databaseService.getSalesmen()
    return rows.length > 0 ? rows : SALESMEN
  }
  await new Promise(r => setTimeout(r, 80))
  return [...salesmen].sort((a, b) => a.number.localeCompare(b.number))
}

export async function createSalesman(input: Omit<Salesman, "id">): Promise<Salesman> {
  if (supabaseReady) return databaseService.createSalesman(input)
  await new Promise(r => setTimeout(r, 80))
  const salesman: Salesman = { ...input, id: `sm-${Date.now()}` }
  salesmen.push(salesman)
  return salesman
}

export async function updateSalesman(id: string, input: Partial<Salesman>): Promise<Salesman | null> {
  if (supabaseReady) return databaseService.updateSalesman(id, input)
  await new Promise(r => setTimeout(r, 80))
  const idx = salesmen.findIndex(s => s.id === id)
  if (idx === -1) return null
  salesmen[idx] = { ...salesmen[idx], ...input }
  return salesmen[idx]
}

export async function deleteSalesman(id: string): Promise<boolean> {
  if (supabaseReady) return databaseService.deleteSalesman(id)
  await new Promise(r => setTimeout(r, 80))
  const before = salesmen.length
  salesmen = salesmen.filter(s => s.id !== id)
  return salesmen.length < before
}
