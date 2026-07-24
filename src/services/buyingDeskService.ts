import type { BuyingPrice, BuyingSession } from "../types"
import { databaseService } from "./databaseService"
import { supabaseReady } from "../lib/supabase"

let sessions: BuyingSession[] = []
let prices: BuyingPrice[] = []

export async function getBuyingSessions(): Promise<BuyingSession[]> {
  if (supabaseReady) return databaseService.getBuyingSessions()
  await new Promise(r => setTimeout(r, 80))
  return [...sessions].sort((a, b) => b.date.localeCompare(a.date))
}

export async function getOrCreateBuyingSession(date: string): Promise<BuyingSession> {
  if (supabaseReady) return databaseService.getOrCreateBuyingSession(date)
  await new Promise(r => setTimeout(r, 80))
  const existing = sessions.find(s => s.date === date)
  if (existing) return existing
  const session: BuyingSession = { id: `bs-${Date.now()}`, date, status: "Open" }
  sessions.push(session)
  return session
}

export async function updateBuyingSession(id: string, input: Partial<BuyingSession>): Promise<BuyingSession | null> {
  if (supabaseReady) return databaseService.updateBuyingSession(id, input)
  await new Promise(r => setTimeout(r, 80))
  const idx = sessions.findIndex(s => s.id === id)
  if (idx === -1) return null
  sessions[idx] = { ...sessions[idx], ...input }
  return sessions[idx]
}

export async function getBuyingPrices(): Promise<BuyingPrice[]> {
  if (supabaseReady) return databaseService.getBuyingPrices()
  await new Promise(r => setTimeout(r, 80))
  return [...prices].sort((a, b) => b.date.localeCompare(a.date))
}

export async function createBuyingPrice(input: Omit<BuyingPrice, "id">): Promise<BuyingPrice> {
  if (supabaseReady) return databaseService.createBuyingPrice(input)
  await new Promise(r => setTimeout(r, 80))
  const price: BuyingPrice = { ...input, id: `bp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}` }
  prices.push(price)
  return price
}

export async function updateBuyingPrice(id: string, input: Partial<BuyingPrice>): Promise<BuyingPrice | null> {
  if (supabaseReady) return databaseService.updateBuyingPrice(id, input)
  await new Promise(r => setTimeout(r, 80))
  const idx = prices.findIndex(p => p.id === id)
  if (idx === -1) return null
  prices[idx] = { ...prices[idx], ...input }
  return prices[idx]
}

export async function deleteBuyingPrice(id: string): Promise<boolean> {
  if (supabaseReady) return databaseService.deleteBuyingPrice(id)
  await new Promise(r => setTimeout(r, 80))
  const before = prices.length
  prices = prices.filter(p => p.id !== id)
  return prices.length < before
}
