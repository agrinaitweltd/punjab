import type { WhatsAppLog, WhatsAppTemplate } from "../types"
import { databaseService } from "./databaseService"
import { supabaseReady } from "../lib/supabase"

let logs: WhatsAppLog[] = []
let templates: WhatsAppTemplate[] = [
  { id: "wt-invoice", name: "Invoice Created", type: "Invoice Created", message: "Hi {{name}}, invoice {{invoiceNumber}} for £{{amount}} has been raised on your Punjab Exotic Foods account. Due {{dueDate}}." },
  { id: "wt-reminder", name: "Payment Reminder", type: "Payment Reminder", message: "Hi {{name}}, a friendly reminder that invoice {{invoiceNumber}} for £{{amount}} is {{dueLabel}}. Please arrange payment when you can. Thank you — Punjab Exotic Foods." },
  { id: "wt-received", name: "Payment Received", type: "Payment Received", message: "Hi {{name}}, thank you — we've received your payment of £{{amount}}. Your Punjab Exotic Foods account is up to date." },
  { id: "wt-confirmed", name: "Order Confirmed", type: "Order Confirmed", message: "Hi {{name}}, your order {{orderNumber}} (£{{amount}}) has been confirmed and is being prepared. Thank you for ordering with Punjab Exotic Foods." },
  { id: "wt-packed", name: "Order Packed", type: "Order Packed", message: "Hi {{name}}, your order {{orderNumber}} has been packed and will be on its way shortly." },
  { id: "wt-dispatched", name: "Order Dispatched", type: "Order Dispatched", message: "Hi {{name}}, your order {{orderNumber}} is out for delivery." },
  { id: "wt-delivered", name: "Order Delivered", type: "Order Delivered", message: "Hi {{name}}, your order {{orderNumber}} has been delivered. Thank you for choosing Punjab Exotic Foods!" },
  { id: "wt-approved", name: "Account Approved", type: "Account Approved", message: "Hi {{name}}, great news — your Punjab Exotic Foods trade account has been approved. You can now log in and start ordering." },
  { id: "wt-suspended", name: "Account Suspended", type: "Account Suspended", message: "Hi {{name}}, your Punjab Exotic Foods account has been temporarily suspended. Please contact us to resolve this." },
]

export async function getWhatsAppLogs(): Promise<WhatsAppLog[]> {
  if (supabaseReady) return databaseService.getWhatsAppLogs()
  await new Promise(r => setTimeout(r, 60))
  return [...logs].sort((a, b) => (b.sentAt ?? "").localeCompare(a.sentAt ?? ""))
}

export async function createWhatsAppLog(input: Omit<WhatsAppLog, "id">): Promise<WhatsAppLog> {
  if (supabaseReady) return databaseService.createWhatsAppLog(input)
  await new Promise(r => setTimeout(r, 60))
  const log: WhatsAppLog = { ...input, id: `wa-${Date.now()}` }
  logs.push(log)
  return log
}

export async function updateWhatsAppLog(id: string, input: Partial<WhatsAppLog>): Promise<WhatsAppLog | null> {
  if (supabaseReady) return databaseService.updateWhatsAppLog(id, input)
  await new Promise(r => setTimeout(r, 60))
  const idx = logs.findIndex(l => l.id === id)
  if (idx === -1) return null
  logs[idx] = { ...logs[idx], ...input }
  return logs[idx]
}

export async function getWhatsAppTemplates(): Promise<WhatsAppTemplate[]> {
  if (supabaseReady) {
    const rows = await databaseService.getWhatsAppTemplates()
    return rows.length > 0 ? rows : templates
  }
  await new Promise(r => setTimeout(r, 60))
  return [...templates]
}

export async function createWhatsAppTemplate(input: Omit<WhatsAppTemplate, "id">): Promise<WhatsAppTemplate> {
  if (supabaseReady) return databaseService.createWhatsAppTemplate(input)
  await new Promise(r => setTimeout(r, 60))
  const template: WhatsAppTemplate = { ...input, id: `wt-${Date.now()}` }
  templates.push(template)
  return template
}

export async function updateWhatsAppTemplate(id: string, input: Partial<WhatsAppTemplate>): Promise<WhatsAppTemplate | null> {
  if (supabaseReady) return databaseService.updateWhatsAppTemplate(id, input)
  await new Promise(r => setTimeout(r, 60))
  const idx = templates.findIndex(t => t.id === id)
  if (idx === -1) return null
  templates[idx] = { ...templates[idx], ...input }
  return templates[idx]
}
