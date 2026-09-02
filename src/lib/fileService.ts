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
  documentRole?: 'canonical_invoice' | 'legacy_source' | 'credit_note_source' | 'statement_source' | 'general'
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapFileRow(r: any): StoredFile {
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
}

/** Every stored document, unbounded - the historical backlog is now over
    1,100 files (~70MB of base64 payload combined), so this is only safe
    for callers that genuinely need to search the complete set server-side
    is not possible (findInvoicePdf, listFilesForCustomer - the metadata
    that would let Postgres filter this is JSON text, not real columns).
    The Files/Documents PAGE itself must never call this directly - use
    listFilesPage()/listFilesForCustomerLive() instead (item 5). */
export async function listFiles(): Promise<StoredFile[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let data: any[] | null, error: unknown
  try {
    ;({ data, error } = await db()
      .from("activity_log")
      .select("*")
      .like("customer_name", "FILE:%")
      .order("created_at", { ascending: false }))
  } catch (caught) {
    // A network hiccup rejects the fetch outright rather than resolving to
    // { error } - every caller (Files/Documents, invoice PDF lookups, the
    // "View Email" attachment section) already treats an empty/failed list
    // as "nothing found yet" and shows a retry-able state, never a crash.
    console.error("listFiles", caught)
    return []
  }
  if (error) { console.error("listFiles", error); return [] }
  return (data ?? []).map(mapFileRow)
}

/** Cursor-paginated by created_at (newest first), for the Files/Documents
    page's own listing - a single unbounded fetch of the whole ~70MB
    backlog was the real cause of Files/Documents loading unreliably (item
    5): slow/mobile connections routinely timed out or dropped mid-download
    before anything rendered. Call again with the last row's uploadedAt as
    `before` for the next page ("Load More"), same pattern as Email Imports. */
export async function listFilesPage(opts: { limit?: number; before?: string } = {}): Promise<{ files: StoredFile[]; hasMore: boolean; nextCursor: string | null }> {
  const limit = opts.limit ?? 150
  let query = db().from("activity_log").select("*").like("customer_name", "FILE:%").order("created_at", { ascending: false }).limit(limit + 1)
  if (opts.before) query = query.lt("created_at", opts.before)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let data: any[] | null, error: unknown
  try {
    ;({ data, error } = await query)
  } catch (caught) {
    console.error("listFilesPage", caught)
    return { files: [], hasMore: false, nextCursor: null }
  }
  if (error) { console.error("listFilesPage", error); return { files: [], hasMore: false, nextCursor: null } }
  const rows = data ?? []
  const hasMore = rows.length > limit
  const page = hasMore ? rows.slice(0, limit) : rows
  return { files: page.map(mapFileRow), hasMore, nextCursor: page.length ? page[page.length - 1].created_at ?? null : null }
}

/** Lightweight per-customer file counts for the Files/Documents sidebar
    badges - selects only the small `timestamp` metadata text, never the
    base64 `action` payload, so computing counts across the whole backlog
    doesn't require pulling ~70MB of file content. Key is the customerId,
    or "__internal__" for files with no customer (matches FilesPage's own
    INTERNAL sentinel). */
export async function getFileCountsByCustomer(): Promise<Record<string, number>> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let data: any[] | null, error: unknown
  try {
    ;({ data, error } = await db().from("activity_log").select("timestamp").like("customer_name", "FILE:%"))
  } catch (caught) {
    console.error("getFileCountsByCustomer", caught)
    return {}
  }
  if (error) { console.error("getFileCountsByCustomer", error); return {} }
  const counts: Record<string, number> = {}
  for (const row of data ?? []) {
    let customerId: string | null = null
    try { customerId = JSON.parse(row.timestamp ?? "{}").customerId ?? null } catch { /* legacy row */ }
    const key = customerId ?? "__internal__"
    counts[key] = (counts[key] ?? 0) + 1
  }
  return counts
}

/** Targeted, bounded fetch of one customer's (or, for null, "Internal
    Only") files - used when an admin opens a folder in the Files/Documents
    page, so browsing one folder is always complete regardless of how far
    "Load More" has been paged on the main listing. Matches on the
    customerId embedded in the JSON metadata text (activity_log has no real
    customer_id column), so this stays a substring filter rather than an
    indexed equality lookup - fine at this scale (bounded per folder, not
    the whole table). Returns every document role (including legacy
    sources), matching what the folder view has always shown. */
export async function listFilesForCustomerLive(customerId: string | null): Promise<StoredFile[]> {
  const pattern = customerId === null
    ? '%"customerId":null%'
    : `%"customerId":"${customerId.replace(/[%_\\]/g, m => `\\${m}`)}"%`
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let data: any[] | null, error: unknown
  try {
    ;({ data, error } = await db().from("activity_log").select("*")
      .like("customer_name", "FILE:%")
      .ilike("timestamp", pattern)
      .order("created_at", { ascending: false }))
  } catch (caught) {
    console.error("listFilesForCustomerLive", caught)
    return []
  }
  if (error) { console.error("listFilesForCustomerLive", error); return [] }
  return (data ?? []).map(mapFileRow).filter(f => f.customerId === customerId)
}


/** One file by its activity_log row id - used by the Email Imports page to
 *  preview/download a stored PDF (including ones still "Needs Review",
 *  which aren't linked to a customer/invoice yet so listFilesForCustomer
 *  wouldn't find them). */
export async function getFileById(id: string): Promise<StoredFile | null> {
  // A network hiccup (brief connectivity drop, backgrounded mobile tab)
  // makes the underlying fetch reject rather than resolve to { error } -
  // every caller treats this as "couldn't load the file" (shows a
  // "missing"/retry state), never as an app-crashing unhandled rejection.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let data: any, error: unknown
  try {
    ;({ data, error } = await db().from("activity_log").select("*").eq("id", id).maybeSingle())
  } catch (caught) {
    console.error("getFileById", caught)
    return null
  }
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
