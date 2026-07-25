/* WhatsApp messaging via UltraMsg — instance186201, the single Punjab Exotic
   Foods Ltd WhatsApp Business account. Staff never connect their own
   WhatsApp; every message goes out through this one account via the
   /api/send-whatsapp serverless function (keeps the UltraMsg token server-side).
   Every attempt — success or failure — is logged to whatsapp_logs. */
import type { Customer, Invoice, Order, WhatsAppLog, WhatsAppMessageType, WhatsAppTemplate } from "../types"
import { getCustomers } from "../api/customersApi"
import { getWhatsAppTemplates, createWhatsAppLog, updateWhatsAppLog, getWhatsAppLogs } from "../api/miscApi"

/** Fallback copy — used if the whatsapp_templates migration hasn't run yet,
    or a template was deleted, so sending never hard-fails on missing copy. */
const DEFAULT_TEMPLATES: Record<WhatsAppMessageType, string> = {
  "Invoice Created": "Hi {{name}}, invoice {{invoiceNumber}} for £{{amount}} has been raised on your Punjab Exotic Foods account. Due {{dueDate}}.",
  "Payment Reminder": "Hi {{name}}, a friendly reminder that invoice {{invoiceNumber}} for £{{amount}} is {{dueLabel}}. Please arrange payment when you can. Thank you — Punjab Exotic Foods.",
  "Payment Received": "Hi {{name}}, thank you — we've received your payment of £{{amount}}. Your Punjab Exotic Foods account is up to date.",
  "Order Confirmed": "Hi {{name}}, your order {{orderNumber}} (£{{amount}}) has been confirmed and is being prepared. Thank you for ordering with Punjab Exotic Foods.",
  "Order Packed": "Hi {{name}}, your order {{orderNumber}} has been packed and will be on its way shortly.",
  "Order Dispatched": "Hi {{name}}, your order {{orderNumber}} is out for delivery.",
  "Order Delivered": "Hi {{name}}, your order {{orderNumber}} has been delivered. Thank you for choosing Punjab Exotic Foods!",
  "Account Approved": "Hi {{name}}, great news — your Punjab Exotic Foods trade account has been approved. You can now log in and start ordering.",
  "Account Suspended": "Hi {{name}}, your Punjab Exotic Foods account has been temporarily suspended. Please contact us to resolve this.",
  "Custom": "{{message}}",
}

/** UK-first normalisation: strips spaces/dashes, turns a leading 0 into the
    +44 country code, and accepts numbers that already include a country
    code. Returns null if what's left doesn't look like a real number. */
export function normalizePhone(raw: string): string | null {
  let digits = raw.replace(/[^\d+]/g, "")
  if (digits.startsWith("+")) digits = digits.slice(1)
  if (digits.startsWith("0")) digits = "44" + digits.slice(1)
  if (!/^\d{8,15}$/.test(digits)) return null
  return digits
}

export function isValidPhone(raw: string): boolean {
  return normalizePhone(raw) !== null
}

export function fillTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? "")
}

let templateCache: WhatsAppTemplate[] | null = null
export async function getTemplateFor(type: WhatsAppMessageType): Promise<string> {
  if (!templateCache) {
    try { templateCache = await getWhatsAppTemplates() } catch { templateCache = [] }
  }
  return templateCache?.find(t => t.type === type)?.message ?? DEFAULT_TEMPLATES[type]
}
/** Templates are edited rarely — call after a save so the next send picks it up. */
export function invalidateTemplateCache() { templateCache = null }

// ── Throttling — UltraMsg (and WhatsApp itself) rate-limits sends; a fixed
// gap between messages is simpler and safer than trying to burst them. ──
const MIN_GAP_MS = 1200
let lastSendAt = 0
async function throttle() {
  const wait = lastSendAt + MIN_GAP_MS - Date.now()
  if (wait > 0) await new Promise(r => setTimeout(r, wait))
  lastSendAt = Date.now()
}

/** Core send — validates the number, throttles, calls UltraMsg via the
    serverless proxy, and always logs the attempt (sent or failed). */
export async function sendWhatsAppMessage(
  phone: string,
  message: string,
  opts: { type: WhatsAppMessageType; customerId?: string; customerName?: string; createdBy: string },
): Promise<WhatsAppLog> {
  const normalized = normalizePhone(phone)
  if (!normalized) {
    return createWhatsAppLog({
      customerId: opts.customerId, customerName: opts.customerName, phone,
      message, type: opts.type, status: "Failed", response: "Invalid phone number", createdBy: opts.createdBy,
    })
  }

  await throttle()
  let status: WhatsAppLog["status"] = "Failed"
  let response = ""
  try {
    const r = await fetch("/api/send-whatsapp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone: normalized, message }),
    })
    const data = await r.json().catch(() => ({}))
    response = JSON.stringify(data)
    status = r.ok && data?.sent !== false && !data?.error ? "Sent" : "Failed"
  } catch (e) {
    response = String(e)
  }

  return createWhatsAppLog({
    customerId: opts.customerId, customerName: opts.customerName, phone: normalized,
    message, type: opts.type, status, response,
    sentAt: status === "Sent" ? new Date().toISOString() : undefined, createdBy: opts.createdBy,
  })
}

export async function retryWhatsAppMessage(log: WhatsAppLog, createdBy: string): Promise<void> {
  const result = await sendWhatsAppMessage(log.phone, log.message, {
    type: log.type, customerId: log.customerId, customerName: log.customerName, createdBy,
  })
  // Fold the retry's outcome back into the original row rather than leaving
  // two rows for one logical reminder — keeps the log list one-per-attempt-story.
  await updateWhatsAppLog(log.id, { status: result.status, response: result.response, sentAt: result.sentAt })
}

async function resolveCustomer(customerId: string, given?: Customer): Promise<Customer | undefined> {
  if (given) return given
  const all = await getCustomers()
  return all.find(c => c.id === customerId)
}

// ── Trigger-specific builders ──────────────────────────────────────────
export async function sendInvoiceMessage(invoice: Invoice, customer?: Customer, createdBy = "System") {
  const c = await resolveCustomer(invoice.customerId, customer)
  if (!c?.phone) return null
  const tpl = await getTemplateFor("Invoice Created")
  const message = fillTemplate(tpl, {
    name: c.contactPerson || c.companyName, invoiceNumber: invoice.invoiceNumber,
    amount: invoice.amount.toFixed(2), dueDate: invoice.dueDate,
  })
  return sendWhatsAppMessage(c.phone, message, { type: "Invoice Created", customerId: c.id, customerName: c.companyName, createdBy })
}

export async function sendPaymentReminder(invoice: Invoice, customer?: Customer, daysOverdue = 0, createdBy = "System") {
  const c = await resolveCustomer(invoice.customerId, customer)
  if (!c?.phone) return null
  const tpl = await getTemplateFor("Payment Reminder")
  const dueLabel = daysOverdue <= 0 ? "due today" : `now ${daysOverdue} day${daysOverdue !== 1 ? "s" : ""} overdue`
  const message = fillTemplate(tpl, {
    name: c.contactPerson || c.companyName, invoiceNumber: invoice.invoiceNumber,
    amount: invoice.amount.toFixed(2), dueLabel,
  })
  return sendWhatsAppMessage(c.phone, message, { type: "Payment Reminder", customerId: c.id, customerName: c.companyName, createdBy })
}

export async function sendPaymentReceived(invoice: Invoice, customer?: Customer, amount?: number, createdBy = "System") {
  const c = await resolveCustomer(invoice.customerId, customer)
  if (!c?.phone) return null
  const tpl = await getTemplateFor("Payment Received")
  const message = fillTemplate(tpl, { name: c.contactPerson || c.companyName, amount: (amount ?? invoice.amount).toFixed(2) })
  return sendWhatsAppMessage(c.phone, message, { type: "Payment Received", customerId: c.id, customerName: c.companyName, createdBy })
}

async function sendOrderStage(order: Order, type: WhatsAppMessageType, customer?: Customer, createdBy = "System") {
  const c = await resolveCustomer(order.customerId, customer)
  if (!c?.phone) return null
  const tpl = await getTemplateFor(type)
  const message = fillTemplate(tpl, { name: c.contactPerson || c.companyName, orderNumber: order.orderNumber, amount: order.amount.toFixed(2) })
  return sendWhatsAppMessage(c.phone, message, { type, customerId: c.id, customerName: c.companyName, createdBy })
}
export const sendOrderConfirmed  = (order: Order, customer?: Customer, createdBy = "System") => sendOrderStage(order, "Order Confirmed", customer, createdBy)
export const sendOrderPacked     = (order: Order, customer?: Customer, createdBy = "System") => sendOrderStage(order, "Order Packed", customer, createdBy)
export const sendOrderDispatched = (order: Order, customer?: Customer, createdBy = "System") => sendOrderStage(order, "Order Dispatched", customer, createdBy)
export const sendOrderDelivered  = (order: Order, customer?: Customer, createdBy = "System") => sendOrderStage(order, "Order Delivered", customer, createdBy)

export async function sendAccountApproved(customer: Customer, createdBy = "System") {
  if (!customer.phone) return null
  const tpl = await getTemplateFor("Account Approved")
  const message = fillTemplate(tpl, { name: customer.contactPerson || customer.companyName })
  return sendWhatsAppMessage(customer.phone, message, { type: "Account Approved", customerId: customer.id, customerName: customer.companyName, createdBy })
}

export async function sendAccountSuspended(customer: Customer, createdBy = "System") {
  if (!customer.phone) return null
  const tpl = await getTemplateFor("Account Suspended")
  const message = fillTemplate(tpl, { name: customer.contactPerson || customer.companyName })
  return sendWhatsAppMessage(customer.phone, message, { type: "Account Suspended", customerId: customer.id, customerName: customer.companyName, createdBy })
}

export async function sendCustomMessage(customerOrPhone: Customer | string, message: string, createdBy: string) {
  if (typeof customerOrPhone === "string") {
    return sendWhatsAppMessage(customerOrPhone, message, { type: "Custom", createdBy })
  }
  if (!customerOrPhone.phone) return null
  return sendWhatsAppMessage(customerOrPhone.phone, message, {
    type: "Custom", customerId: customerOrPhone.id, customerName: customerOrPhone.companyName, createdBy,
  })
}

/** True if a reminder of this type was already sent to this invoice today —
    prevents the daily cron (or a re-run) from double-sending. */
export async function alreadyRemindedToday(customerId: string, invoiceNumber: string): Promise<boolean> {
  const logs = await getWhatsAppLogs()
  const today = new Date().toISOString().slice(0, 10)
  return logs.some(l =>
    l.customerId === customerId && l.type === "Payment Reminder" && l.status === "Sent" &&
    l.message.includes(invoiceNumber) && (l.sentAt ?? "").slice(0, 10) === today
  )
}
