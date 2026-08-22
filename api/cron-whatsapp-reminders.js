import { createClient } from '@supabase/supabase-js'
import { brandedEmail, sendTransactionalEmail, summaryTable } from '../server/email-system.js'

const ULTRAMSG_BASE = 'https://api.ultramsg.com/instance186201'
const OVERDUE_BUCKETS = [1, 3, 7, 14]
const APPROVED_INVOICE_TEMPLATE_ID = 'punjab-approved-letterhead-v1'

function normalizePhone(raw) {
  let digits = String(raw || '').replace(/[^\d+]/g, '')
  if (digits.startsWith('+')) digits = digits.slice(1)
  if (digits.startsWith('0')) digits = '44' + digits.slice(1)
  return /^\d{8,15}$/.test(digits) ? digits : null
}

function daysBetween(firstIso, secondIso) {
  const first = new Date(`${firstIso}T00:00:00`)
  const second = new Date(`${secondIso}T00:00:00`)
  return Math.round((second.getTime() - first.getTime()) / 86_400_000)
}

function reminderMessage(name, invoiceNumber, amount, daysOverdue, stage) {
  const timing = stage === 'day-14' ? 'is approaching its payment due date' : daysOverdue === 0 ? 'is due today' : `is ${daysOverdue} day(s) overdue`
  return `Hello ${name}, this is a reminder that invoice ${invoiceNumber} with an outstanding balance of GBP ${Number(amount).toFixed(2)} ${timing}. The official invoice is attached. Please arrange payment accordingly.`
}

async function sendEmail(key, to, subject, html, attachments, simulated, options) {
  if (simulated) return { ok: true, simulated: true, error: null }
  return sendTransactionalEmail({ apiKey: key, category: 'notifications', to, subject, html, attachments, ...options })
}

async function sendWhatsApp(token, phone, message, file, simulated) {
  if (simulated) return { ok: true, response: 'TEST MODE - WhatsApp document simulated. Nothing was sent.' }
  if (!token) return { ok: false, response: 'WhatsApp provider is not configured' }
  const body = new URLSearchParams({ token, to: phone, caption: message, filename: file.name, document: file.dataUri })
  const response = await fetch(`${ULTRAMSG_BASE}/messages/document`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: body.toString() })
  const data = await response.json().catch(() => ({}))
  return { ok: response.ok && data?.sent !== false && !data?.error, response: JSON.stringify(data) }
}

export function reminderStage(invoice, today) {
  if (!invoice?.date || !invoice?.due_date) return null
  const invoiceAge = daysBetween(invoice.date, today)
  const daysOverdue = daysBetween(invoice.due_date, today)
  if (invoiceAge === 14) return 'day-14'
  if (invoiceAge === 21) return 'day-21'
  if (daysOverdue === 0) return 'due-today'
  if (daysOverdue === -7) return 'seven-days-before-due'
  return OVERDUE_BUCKETS.includes(daysOverdue) ? `overdue-${daysOverdue}` : null
}

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

export default async function handler(req, res) {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret || req.headers?.authorization !== `Bearer ${cronSecret}`) return res.status(401).json({ error: 'Unauthorized' })
  const url = process.env.VITE_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return res.status(500).json({ error: 'Server-side Supabase is not configured' })
  const admin = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
  const today = new Date().toISOString().slice(0, 10)
  const mode = await admin.from('system_settings').select('test_mode').eq('id', true).single()
  if (mode.error) return res.status(502).json({ error: 'System mode could not be loaded' })
  const testMode = Boolean(mode.data.test_mode)
  const table = name => testMode ? `test_${name}` : name

  const [invoiceResult, customerResult, logResult, fileResult] = await Promise.all([
    admin.from(table('invoices')).select('*').neq('status', 'Paid'),
    admin.from(table('customers')).select('id,company_name,contact_person,phone,email,customer_number'),
    admin.from(table('notification_logs')).select('idempotency_key,status,error'),
    admin.from(table('activity_log')).select('customer_name,action,timestamp,created_at').like('customer_name', 'FILE:%'),
  ])
  const failure = [invoiceResult.error, customerResult.error, logResult.error, fileResult.error].find(Boolean)
  if (failure) return res.status(502).json({ error: 'Reminder data could not be loaded' })
  const customers = new Map((customerResult.data || []).map(customer => [customer.id, customer]))
  const sentKeys = new Set((logResult.data || []).filter(log => log.status === 'Sent').map(log => log.idempotency_key).filter(Boolean))
  const results = []

  for (const invoice of invoiceResult.data || []) {
    if (!invoice.due_date) continue
    const daysOverdue = daysBetween(invoice.due_date, today)
    const stage = reminderStage(invoice, today)
    if (!stage) continue
    const customer = customers.get(invoice.customer_id)
    if (!customer) continue
    const outstanding = Math.max(0, Number(invoice.amount || 0) - Number(invoice.amount_paid || 0))
    if (!outstanding) continue
    const pdf = storedInvoicePdf(fileResult.data || [], invoice)
    if (!pdf) {
      const missingKey = `${invoice.id}:${stage}:missing-canonical-pdf`
      await admin.from(table('notification_logs')).upsert({ invoice_id: invoice.id, customer_id: invoice.customer_id, channel: 'system', status: 'Failed', error: 'Official generated invoice PDF is missing; no reminder was sent.', reminder_stage: stage, idempotency_key: missingKey }, { onConflict: 'idempotency_key' })
      results.push({ invoice: invoice.invoice_number, stage, error: 'missing_canonical_invoice' })
      continue
    }

    const message = reminderMessage(customer.contact_person || customer.company_name || 'there', invoice.invoice_number, outstanding, daysOverdue, stage)
    let email = false
    let whatsapp = false
    const emailKey = `${invoice.id}:${stage}:email`
    if (customer.email && !sentKeys.has(emailKey)) {
      const subject = stage === 'day-21' ? `Payment Reminder - Invoice ${invoice.invoice_number}` : `Invoice Reminder - ${invoice.invoice_number}`
      const html = brandedEmail({ heading: stage === 'day-21' || stage === 'due-today' ? 'Payment due today' : daysOverdue > 0 ? 'Your invoice is overdue' : 'Payment reminder', intro: `Invoice ${invoice.invoice_number} for ${customer.company_name} remains outstanding.`, contentHtml: `${summaryTable([['Invoice number', invoice.invoice_number], ['Outstanding', `£${outstanding.toFixed(2)}`], ['Due date', invoice.due_date]])}<p style="margin:0;text-align:center;color:#59655d">The original approved invoice PDF is attached. If payment has already been made, please allow a short time for it to appear on your account.</p>` })
      const sent = await sendEmail(process.env.RESEND_API_KEY, customer.email, subject, html, [{ filename: pdf.name, content: pdf.base64 }], testMode, { admin, customerId: invoice.customer_id, invoiceId: invoice.id, idempotencyKey: `automation:${emailKey}`, communicationType: 'payment_reminder', createdBy: 'Daily reminder automation' })
      email = sent.ok
      await admin.from(table('notification_logs')).upsert({ invoice_id: invoice.id, customer_id: invoice.customer_id, channel: 'email', status: sent.ok ? 'Sent' : 'Failed', sent_at: sent.ok ? new Date().toISOString() : null, error: sent.error, reminder_stage: stage, idempotency_key: emailKey }, { onConflict: 'idempotency_key' })
    }
    const phone = normalizePhone(customer.phone)
    const whatsappKey = `${invoice.id}:${stage}:whatsapp`
    if (phone && !sentKeys.has(whatsappKey)) {
      if (!testMode) await new Promise(resolve => setTimeout(resolve, 1200))
      const sent = await sendWhatsApp(process.env.ULTRAMSG_TOKEN, phone, message, pdf, testMode)
      whatsapp = sent.ok
      await admin.from(table('whatsapp_logs')).insert({ customer_id: invoice.customer_id, customer_name: customer.company_name, phone, message, type: 'Payment Reminder', status: sent.ok ? 'Sent' : 'Failed', response: sent.response, sent_at: sent.ok ? new Date().toISOString() : null, created_by: testMode ? 'Cron simulation (Test Mode)' : 'Cron (08:00 daily)' })
      await admin.from(table('notification_logs')).upsert({ invoice_id: invoice.id, customer_id: invoice.customer_id, channel: 'whatsapp', status: sent.ok ? 'Sent' : 'Failed', sent_at: sent.ok ? new Date().toISOString() : null, error: sent.ok ? null : sent.response, reminder_stage: stage, idempotency_key: whatsappKey }, { onConflict: 'idempotency_key' })
    }
    results.push({ invoice: invoice.invoice_number, stage, email, whatsapp, simulated: testMode })
  }
  return res.status(200).json({ testMode, checked: (invoiceResult.data || []).length, sent: results.filter(result => result.email || result.whatsapp).length, results })
}
