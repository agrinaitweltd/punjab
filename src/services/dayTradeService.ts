import type { DayTrade } from "../types"
import { databaseService } from "./databaseService"
import { supabaseReady } from "../lib/supabase"

let dayTrades: DayTrade[] = []

export async function getDayTrades(): Promise<DayTrade[]> {
  if (supabaseReady) return databaseService.getDayTrades()
  await new Promise(r => setTimeout(r, 80))
  return [...dayTrades].sort((a, b) => b.date.localeCompare(a.date))
}

export async function createDayTrade(input: Omit<DayTrade, "id">): Promise<DayTrade> {
  if (supabaseReady) return databaseService.createDayTrade(input)
  await new Promise(r => setTimeout(r, 80))
  const dayTrade: DayTrade = { ...input, id: `dt-${Date.now()}` }
  dayTrades.push(dayTrade)
  return dayTrade
}
