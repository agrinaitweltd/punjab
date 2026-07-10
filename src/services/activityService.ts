import type { ActivityLog } from "../types"
import { mockActivity } from "../data/mockData"
import { databaseService } from "./databaseService"
import { supabaseReady } from "../lib/supabase"

let activity = [...mockActivity]

export async function getActivity(): Promise<ActivityLog[]> {
  if (supabaseReady) return databaseService.getActivity()
  await new Promise(r => setTimeout(r, 100))
  return [...activity].sort((a, b) => b.timestamp.localeCompare(a.timestamp))
}