import type { StockItem } from "../types"
import { mockStock } from "../data/mockData"
import { databaseService } from "./databaseService"
import { supabaseReady } from "../lib/supabase"

let stock = [...mockStock]

function nextId() {
  const max = stock.reduce((m, s) => {
    const n = parseInt(s.id.replace(/[^0-9]/g, "")) || 0
    return n > m ? n : m
  }, 0)
  return `s-${String(max + 1).padStart(3, "0")}`
}

export async function getStock(): Promise<StockItem[]> {
  if (supabaseReady) return databaseService.getStock()
  await new Promise(r => setTimeout(r, 100))
  return [...stock]
}

export async function updateStock(id: string, input: Partial<StockItem>): Promise<StockItem | null> {
  if (supabaseReady) return databaseService.updateStock(id, input)
  await new Promise(r => setTimeout(r, 100))
  const idx = stock.findIndex(s => s.id === id)
  if (idx === -1) return null
  const updated = { ...stock[idx], ...input, lastUpdated: new Date().toISOString() } as StockItem
  stock[idx] = updated
  return updated
}

export async function createStockForProduct(productId: string): Promise<StockItem> {
  await new Promise(r => setTimeout(r, 100))
  const item: StockItem = {
    id: nextId(),
    productId,
    availableQuantity: 0,
    price: 0,
    lastUpdated: new Date().toISOString().slice(0, 10),
    status: "out",
  }
  stock.push(item)
  return item
}