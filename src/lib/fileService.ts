import { supabase } from "./supabase"

/* Document storage (customer invoices, delivery notes, etc.).
   Files are stored as data-URIs in the shared database so every admin
   sees the same library. Rows live in activity_log with a FILE: marker
   and are filtered out of the normal activity feed. */

export type StoredFile = {
  id: string
  name: string
  type: string
  size: number
  note: string
  uploadedAt: string
  dataUri: string
}

export const MAX_FILE_BYTES = 2 * 1024 * 1024 // 2 MB

function db() {
  if (!supabase) throw new Error("Not connected to the database")
  return supabase
}

export async function listFiles(): Promise<StoredFile[]> {
  const { data, error } = await db()
    .from("activity_log")
    .select("*")
    .like("customer_name", "FILE:%")
    .order("created_at", { ascending: false })
  if (error) { console.error("listFiles", error); return [] }
  return (data ?? []).map(r => {
    let meta: { type?: string; size?: number; note?: string; uploadedAt?: string } = {}
    try { meta = JSON.parse(r.timestamp ?? "{}") } catch { /* legacy row */ }
    return {
      id: r.id,
      name: String(r.customer_name).slice(5),
      type: meta.type ?? "application/octet-stream",
      size: meta.size ?? 0,
      note: meta.note ?? "",
      uploadedAt: meta.uploadedAt ?? r.created_at ?? "",
      dataUri: r.action ?? "",
    }
  })
}

export async function uploadFile(name: string, type: string, size: number, dataUri: string, note: string): Promise<void> {
  const row = {
    id: `f-${Date.now()}`,
    customer_name: `FILE:${name}`,
    action: dataUri,
    timestamp: JSON.stringify({ type, size, note, uploadedAt: new Date().toISOString() }),
  }
  const { error } = await db().from("activity_log").insert(row)
  if (error) throw error
}

export async function deleteFile(id: string): Promise<boolean> {
  const { error } = await db().from("activity_log").delete().eq("id", id)
  return !error
}
