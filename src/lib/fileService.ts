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
  invoiceId?: string
  invoiceNumber?: string
  invoiceAmount?: number
  creditNoteId?: string
  creditNoteNumber?: string
  creditNoteAmount?: number
  documentRole?: 'canonical_invoice' | 'legacy_source' | 'credit_note_source' | 'general'
  templateId?: 'punjab-approved-letterhead-v1'
}

export const APPROVED_INVOICE_TEMPLATE_ID = 'punjab-approved-letterhead-v1' as const

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

/** Verifies the file's actual byte content matches its claimed MIME type -
    the previous check only compared the data-URI's own type prefix against
    itself (`type` supplied the value being "checked"), so any content could
    be uploaded under any allowed label. CSV has no reliable magic bytes
    (plain text) and is skipped - low risk, and the extension check already
    covers it. */
function sniffMatchesType(bytes: Uint8Array, type: string): boolean {
  const hex = (n: number) => bytes[n]?.toString(16).padStart(2, '0') ?? ''
  const ascii = (start: number, len: number) => String.fromCharCode(...bytes.slice(start, start + len))
  if (type === 'application/pdf') return ascii(0, 5) === '%PDF-'
  if (type === 'image/png') return `${hex(0)}${hex(1)}${hex(2)}${hex(3)}` === '89504e47'
  if (type === 'image/jpeg') return `${hex(0)}${hex(1)}${hex(2)}` === 'ffd8ff'
  if (type === 'image/webp') return ascii(0, 4) === 'RIFF' && ascii(8, 4) === 'WEBP'
  if (type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') return ascii(0, 2) === 'PK'
  if (type === 'text/csv') return true
  return false
}

function bytesFromDataUri(dataUri: string): Uint8Array {
  const base64 = dataUri.slice(dataUri.indexOf(',') + 1)
  const binary = atob(base64.slice(0, 64)) // only need the first few bytes for a signature check
  return Uint8Array.from(binary, c => c.charCodeAt(0))
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
    let meta: { type?: string; size?: number; note?: string; uploadedAt?: string; customerId?: string | null; customerName?: string; invoiceId?: string; invoiceNumber?: string; invoiceAmount?: number; creditNoteId?: string; creditNoteNumber?: string; creditNoteAmount?: number; documentRole?: StoredFile['documentRole']; templateId?: StoredFile['templateId'] } = {}
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
      invoiceId: meta.invoiceId,
      invoiceNumber: meta.invoiceNumber,
      invoiceAmount: meta.invoiceAmount,
      creditNoteId: meta.creditNoteId,
      creditNoteNumber: meta.creditNoteNumber,
      creditNoteAmount: meta.creditNoteAmount,
      documentRole: meta.documentRole ?? 'general',
      templateId: meta.templateId,
    }
  })
}

/** One file by its activity_log row id - used by the Email Imports page to
 *  preview/download a stored PDF (including ones still "Needs Review",
 *  which aren't linked to a customer/invoice yet so listFilesForCustomer
 *  wouldn't find them). */
export async function getFileById(id: string): Promise<StoredFile | null> {
  const { data, error } = await db().from("activity_log").select("*").eq("id", id).maybeSingle()
  if (error || !data || !String(data.customer_name ?? '').startsWith('FILE:')) return null
  let meta: { type?: string; size?: number; note?: string; uploadedAt?: string; customerId?: string | null; customerName?: string; invoiceId?: string; invoiceNumber?: string; invoiceAmount?: number; creditNoteId?: string; creditNoteNumber?: string; creditNoteAmount?: number; documentRole?: StoredFile['documentRole']; templateId?: StoredFile['templateId'] } = {}
  try { meta = JSON.parse(data.timestamp ?? "{}") } catch { /* legacy row */ }
  return {
    id: data.id, name: String(data.customer_name).slice(5), type: meta.type ?? "application/octet-stream",
    size: meta.size ?? 0, note: meta.note ?? "", uploadedAt: meta.uploadedAt ?? data.created_at ?? "", dataUri: data.action ?? "",
    customerId: meta.customerId ?? null, customerName: meta.customerName ?? "Internal only",
    invoiceId: meta.invoiceId, invoiceNumber: meta.invoiceNumber, invoiceAmount: meta.invoiceAmount,
    creditNoteId: meta.creditNoteId, creditNoteNumber: meta.creditNoteNumber, creditNoteAmount: meta.creditNoteAmount,
    documentRole: meta.documentRole ?? 'general', templateId: meta.templateId,
  }
}

export async function listFilesForCustomer(customerId: string): Promise<StoredFile[]> {
  const all = await listFiles()
  return all.filter(f => f.customerId === customerId && f.documentRole !== 'legacy_source')
}

export async function findInvoicePdf(customerId: string, invoiceNumber: string, invoiceId?: string, invoiceAmount?: number): Promise<StoredFile | null> {
  const normalizedInvoice = invoiceNumber.trim().toLowerCase()
  if (!normalizedInvoice) return null
  const invoicePattern = new RegExp(`(^|[^a-z0-9])${normalizedInvoice.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}($|[^a-z0-9])`, 'i')
  const files = (await listFiles()).filter(file => file.customerId === customerId)
  const matches = files.filter(file => {
    if (file.type !== "application/pdf" && !file.dataUri.startsWith("data:application/pdf")) return false
    if (file.documentRole === 'legacy_source' || /original source/i.test(file.note)) return false
    if (invoiceId && file.invoiceId === invoiceId) {
      if (file.documentRole !== 'canonical_invoice' || file.templateId !== APPROVED_INVOICE_TEMPLATE_ID) return false
      if (file.invoiceNumber?.trim().toLowerCase() !== normalizedInvoice) return false
      if (invoiceAmount !== undefined && (file.invoiceAmount === undefined || Math.abs(file.invoiceAmount - invoiceAmount) > 0.005)) return false
      return true
    }
    if (invoiceId) return false
    const searchable = `${file.name} ${file.note}`.toLowerCase()
    return file.invoiceNumber?.toLowerCase() === normalizedInvoice || invoicePattern.test(searchable)
  })
  return matches.find(file => file.documentRole === 'canonical_invoice') ?? matches[0] ?? null
}

export function dataUriBase64(dataUri: string): string {
  const separator = dataUri.indexOf(',')
  if (separator < 0) throw new Error('Stored invoice PDF is invalid.')
  return dataUri.slice(separator + 1)
}

export async function uploadFile(
  name: string, type: string, size: number, dataUri: string, note: string,
  customerId: string | null, customerName: string,
  document: { invoiceId?: string; invoiceNumber?: string; invoiceAmount?: number; creditNoteId?: string; creditNoteNumber?: string; creditNoteAmount?: number; documentRole?: StoredFile['documentRole']; templateId?: StoredFile['templateId'] } = {},
): Promise<StoredFile> {
  const sanitizedName = safeFileName(name)
  if (!Number.isFinite(size) || size <= 0 || size > MAX_FILE_BYTES) throw new Error('File size is outside the allowed range.')
  if (!ALLOWED_TYPES.has(type) || !dataUri.startsWith(`data:${type};base64,`)) throw new Error('That file content type is not allowed.')
  if (!sniffMatchesType(bytesFromDataUri(dataUri), type)) throw new Error("This file's content doesn't match its file type - it may be corrupted or mislabelled.")
  const row = {
    id: `f-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`,
    customer_name: `FILE:${sanitizedName}`,
    action: dataUri,
    timestamp: JSON.stringify({ type, size, note, uploadedAt: new Date().toISOString(), customerId, customerName, ...document }),
  }
  const { error } = await db().from("activity_log").insert(row)
  if (error) throw error
  return { id: row.id, name: sanitizedName, type, size, note, uploadedAt: new Date().toISOString(), dataUri, customerId, customerName, ...document }
}

export async function deleteFile(id: string): Promise<boolean> {
  const { error } = await db().from("activity_log").delete().eq("id", id)
  return !error
}

export async function renameFile(id: string, newName: string): Promise<boolean> {
  const { error } = await db().from("activity_log").update({ customer_name: `FILE:${safeFileName(newName)}` }).eq("id", id)
  return !error
}
