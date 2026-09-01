// Shared helpers for anything that sends an invoice reminder server-side -
// the (now unscheduled, kept for future use) daily cron in
// api/cron-whatsapp-reminders.js and the manual send-reminder admin action
// both need to find the stored canonical invoice PDF and send a WhatsApp
// document the same way, so that logic lives here once instead of being
// duplicated (and risking drifting apart) between the two.

const ULTRAMSG_BASE = 'https://api.ultramsg.com/instance186201'
export const APPROVED_INVOICE_TEMPLATE_ID = 'punjab-approved-letterhead-v1'

/** UK-first normalisation, matching src/lib/whatsapp.ts's normalizePhone()
    exactly (kept in sync by hand since this is plain server JS and can't
    import the browser .ts module). */
export function normalizePhone(raw) {
  let digits = String(raw || '').replace(/[^\d+]/g, '')
  if (digits.startsWith('+')) digits = digits.slice(1)
  if (digits.startsWith('0')) digits = '44' + digits.slice(1)
  return /^\d{8,15}$/.test(digits) ? digits : null
}

/** Finds the most recent system-generated ("canonical") invoice PDF for one
    invoice from a set of activity_log FILE: rows - exact match on
    customerId/invoiceId/invoiceNumber/amount plus the approved template id,
    so a stray similarly-named file can never be attached to the wrong
    invoice. `invoice` uses snake_case (id, customer_id, invoice_number,
    amount) to match a raw Supabase row. */
export function storedInvoicePdf(files, invoice) {
  const expectedNumber = String(invoice?.invoice_number || '').trim().toLowerCase()
  const expectedAmount = Number(invoice?.amount)
  if (!invoice?.id || !invoice?.customer_id || !expectedNumber || !Number.isFinite(expectedAmount)) return null
  const candidates = []
  for (const row of files) {
    let metadata = {}
    try { metadata = JSON.parse(row.timestamp || '{}') } catch { /* legacy metadata */ }
    if (metadata.customerId !== invoice.customer_id || metadata.invoiceId !== invoice.id) continue
    if (String(metadata.invoiceNumber || '').trim().toLowerCase() !== expectedNumber) continue
    if (!Number.isFinite(Number(metadata.invoiceAmount)) || Math.abs(Number(metadata.invoiceAmount) - expectedAmount) > 0.005) continue
    if (metadata.documentRole !== 'canonical_invoice' || metadata.templateId !== APPROVED_INVOICE_TEMPLATE_ID) continue
    if (metadata.type !== 'application/pdf' && !String(row.action || '').startsWith('data:application/pdf')) continue
    const dataUri = String(row.action || '')
    if (!dataUri.startsWith('data:application/pdf;base64,') || dataUri.indexOf(',') < 0) continue
    candidates.push({ name: String(row.customer_name || `FILE:Invoice-${invoice.invoice_number}.pdf`).slice(5), dataUri, base64: dataUri.slice(dataUri.indexOf(',') + 1), createdAt: row.created_at || '' })
  }
  return candidates.sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0] || null
}

/** Sends a WhatsApp document via UltraMsg directly (not through
    /api/send-whatsapp, since this already runs server-side with the token
    available). Never throws - always resolves to { ok, response }, so a
    WhatsApp failure can never take down a caller's email-already-sent
    result (item 19 from the previous pass, preserved here). */
export async function sendWhatsAppDocumentServer(token, phone, message, file, simulated) {
  if (simulated) return { ok: true, response: 'TEST MODE - WhatsApp document simulated. Nothing was sent.' }
  if (!token) return { ok: false, response: 'WhatsApp provider is not configured' }
  try {
    const body = new URLSearchParams({ token, to: phone, caption: message, filename: file.name, document: file.dataUri })
    const response = await fetch(`${ULTRAMSG_BASE}/messages/document`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: body.toString() })
    const data = await response.json().catch(() => ({}))
    return { ok: response.ok && data?.sent !== false && !data?.error, response: JSON.stringify(data) }
  } catch (error) {
    return { ok: false, response: error instanceof Error ? error.message : 'WhatsApp request failed' }
  }
}
