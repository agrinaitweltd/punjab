import { supabase } from "./supabase"
import type { AppNotification, NotificationTargetType } from "../types"

/* Admin notification feed (bell icon). Rows are written directly by the
   client at the moment something notification-worthy happens (same pattern
   as logActivity's activity_log rows), or server-side by the email-import
   worker / nightly health check using the service-role client - both write
   to the same table, RLS just requires is_admin() either way. supabase.from
   already routes to test_notifications under Test Mode via the Proxy in
   supabase.ts, so no runtimeTable() call is needed here. */

function db() {
  if (!supabase) throw new Error("Not connected to the database")
  return supabase
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mapNotificationRow(r: Record<string, any>): AppNotification {
  return {
    id: r.id, type: r.type, title: r.title, message: r.message ?? undefined,
    targetType: (r.target_type as NotificationTargetType) ?? undefined, targetId: r.target_id ?? undefined,
    read: r.read, createdBy: r.created_by ?? undefined, createdAt: r.created_at,
  }
}

export async function getNotifications(limit = 100): Promise<AppNotification[]> {
  const { data, error } = await db().from("notifications").select("*").order("created_at", { ascending: false }).limit(limit)
  if (error) { console.error("getNotifications", error); return [] }
  return (data ?? []).map(mapNotificationRow)
}

export async function createNotification(input: { type: string; title: string; message?: string; targetType?: NotificationTargetType; targetId?: string; createdBy?: string }): Promise<void> {
  const { error } = await db().from("notifications").insert({
    type: input.type, title: input.title, message: input.message ?? null,
    target_type: input.targetType ?? null, target_id: input.targetId ?? null, created_by: input.createdBy ?? null,
  })
  if (error) console.error("createNotification", error)
}

export async function markNotificationRead(id: string): Promise<void> {
  const { error } = await db().from("notifications").update({ read: true }).eq("id", id)
  if (error) console.error("markNotificationRead", error)
}

export async function markAllNotificationsRead(): Promise<void> {
  const { error } = await db().from("notifications").update({ read: true }).eq("read", false)
  if (error) console.error("markAllNotificationsRead", error)
}
