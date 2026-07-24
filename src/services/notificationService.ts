import type { NotificationLog } from "../types"
import { databaseService } from "./databaseService"
import { supabaseReady } from "../lib/supabase"

let logs: NotificationLog[] = []

export async function getNotificationLogs(): Promise<NotificationLog[]> {
  if (supabaseReady) return databaseService.getNotificationLogs()
  await new Promise(r => setTimeout(r, 80))
  return [...logs].sort((a, b) => (b.sentAt ?? b.scheduledFor ?? "").localeCompare(a.sentAt ?? a.scheduledFor ?? ""))
}

export async function createNotificationLog(input: Omit<NotificationLog, "id">): Promise<NotificationLog> {
  if (supabaseReady) return databaseService.createNotificationLog(input)
  await new Promise(r => setTimeout(r, 80))
  const log: NotificationLog = { ...input, id: `nl-${Date.now()}-${Math.random().toString(36).slice(2, 7)}` }
  logs.push(log)
  return log
}

export async function updateNotificationLog(id: string, input: Partial<NotificationLog>): Promise<NotificationLog | null> {
  if (supabaseReady) return databaseService.updateNotificationLog(id, input)
  await new Promise(r => setTimeout(r, 80))
  const idx = logs.findIndex(l => l.id === id)
  if (idx === -1) return null
  logs[idx] = { ...logs[idx], ...input }
  return logs[idx]
}
