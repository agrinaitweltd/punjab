import type { ActivityLog } from "../types"
import { mockActivity } from "../data/mockData"

let activity = [...mockActivity]

export async function getActivity(): Promise<ActivityLog[]> {
  await new Promise(r => setTimeout(r, 100))
  return [...activity].sort((a, b) => b.timestamp.localeCompare(a.timestamp))
}