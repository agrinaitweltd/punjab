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
  customerId: string | null
  customerName: string
}

export const MAX_FILE_BYTES = 2 * 1024 * 1024 // 2 MB
const ALLOWED_TYPES = new Set([
  'application/pdf', 'image/jpeg', 'image/png', 'image/webp',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'text/csv',
])
const ALLOWED_EXTENSIONS = /\.(pdf|jpe?g|png|webp|docx|xlsx|csv)$/i

function safeFileName(name: string): string {
  const withoutControls = [...name].map(character => character.charCodeAt(0) < 32 ? '_' : character).join('')
  const cleaned = withoutControls.replace(/[\\/:*?"<>|]/g, '_').replace(/\.{2,}/g, '.').trim().slice(0, 140)
  if (!cleaned || !ALLOWED_EXTENSIONS.test(cleaned)) throw new Error('That file type is not allowed.')
  return cleaned
}

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
    let meta: { type?: string; size?: number; note?: string; uploadedAt?: string; customerId?: string | null; customerName?: string } = {}
    try { meta = JSON.parse(r.timestamp ?? "{}") } catch { /* legacy row */ }
    return {
      id: r.id,
      name: String(r.customer_name).slice(5),
      type: meta.type ?? "application/octet-stream",
      size: meta.size ?? 0,
      note: meta.note ?? "",
      uploadedAt: meta.uploadedAt ?? r.created_at ?? "",
      dataUri: r.action ?? "",
      customerId: meta.customerId ?? null,
      customerName: meta.customerName ?? "Internal only",
    }
  })
}

export async function listFilesForCustomer(customerId: string): Promise<StoredFile[]> {
  const all = await listFiles()
  return all.filter(f => f.customerId === customerId)
}

export async function findInvoicePdf(customerId: string, invoiceNumber: string): Promise<StoredFile | null> {
  const normalizedInvoice = invoiceNumber.trim().toLowerCase()
  if (!normalizedInvoice) return null
  const invoicePattern = new RegExp(`(^|[^a-z0-9])${normalizedInvoice.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}($|[^a-z0-9])`, 'i')
  const files = await listFilesForCustomer(customerId)
  return files.find(file => {
    if (file.type !== "application/pdf" && !file.dataUri.startsWith("data:application/pdf")) return false
    const searchable = `${file.name} ${file.note}`.toLowerCase()
    return invoicePattern.test(searchable)
  }) ?? null
}

export function dataUriBase64(dataUri: string): string {
  const separator = dataUri.indexOf(',')
  if (separator < 0) throw new Error('Stored invoice PDF is invalid.')
  return dataUri.slice(separator + 1)
}

export async function uploadFile(
  name: string, type: string, size: number, dataUri: string, note: string,
  customerId: string | null, customerName: string,
): Promise<void> {
  const sanitizedName = safeFileName(name)
  if (!Number.isFinite(size) || size <= 0 || size > MAX_FILE_BYTES) throw new Error('File size is outside the allowed range.')
  if (!ALLOWED_TYPES.has(type) || !dataUri.startsWith(`data:${type};base64,`)) throw new Error('That file content type is not allowed.')
  const row = {
    id: `f-${Date.now()}`,
    customer_name: `FILE:${sanitizedName}`,
    action: dataUri,
    timestamp: JSON.stringify({ type, size, note, uploadedAt: new Date().toISOString(), customerId, customerName }),
  }
  const { error } = await db().from("activity_log").insert(row)
  if (error) throw error
}

export async function deleteFile(id: string): Promise<boolean> {
  const { error } = await db().from("activity_log").delete().eq("id", id)
  return !error
}

export async function renameFile(id: string, newName: string): Promise<boolean> {
  const { error } = await db().from("activity_log").update({ customer_name: `FILE:${safeFileName(newName)}` }).eq("id", id)
  return !error
}
