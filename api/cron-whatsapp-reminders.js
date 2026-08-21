import { createClient } from '@supabase/supabase-js'

const ULTRAMSG_BASE = 'https://api.ultramsg.com/instance186201'
const OVERDUE_BUCKETS = [1, 3, 7, 14]

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

function reminderMessage(name, invoiceNumber, amount, daysOverdue) {
  const timing = daysOverdue === -7 ? 'is due in 7 days' : daysOverdue === 0 ? 'is due today' : `is ${daysOverdue} day(s) overdue`
  return `Hello ${name}, this is a reminder that invoice ${invoiceNumber} with an outstanding balance of GBP ${Number(amount).toFixed(2)} ${timing}. The official invoice is attached. Please arrange payment accordingly.`
}

async function sendEmail(key, to, subject, html, attachments, simulated) {
  if (simulated) return { ok: true, simulated: true, error: null }
  if (!key || !to) return { ok: false, error: 'Email address or provider is missing' }
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: 'Punjab Exotic Foods <info@punjabexoticfoods.com>', to: [to], subject, html, ...(attachments?.length ? { attachments } : {}) }),
  })
  const data = await response.json().catch(() => ({}))
  return { ok: response.ok, error: response.ok ? null : JSON.stringify(data) }
}

async function sendWhatsApp(token, phone, message, file, simulated) {
  if (simulated) return { ok: true, response: 'TEST MODE - WhatsApp document simulated. Nothing was sent.' }
  if (!token) return { ok: false, response: 'WhatsApp provider is not configured' }
  const body = new URLSearchParams({ token, to: phone, caption: message, filename: file.name, document: file.dataUri })
  const response = await fetch(`${ULTRAMSG_BASE}/messages/document`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: body.toString() })
  const data = await response.json().catch(() => ({}))
  return { ok: response.ok && data?.sent !== false && !data?.error, response: JSON.stringify(data) }
}

function storedInvoicePdf(files, customerId, invoiceNumber) {
  const needle = String(invoiceNumber || '').trim().toLowerCase()
  if (!needle) return null
  const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const pattern = new RegExp(`(^|[^a-z0-9])${escaped}($|[^a-z0-9])`, 'i')
  const candidates = []
  for (const row of files) {
    let metadata = {}
    try { metadata = JSON.parse(row.timestamp || '{}') } catch { /* legacy metadata */ }
    if (metadata.customerId !== customerId) continue
    if (metadata.type !== 'application/pdf' && !String(row.action || '').startsWith('data:application/pdf')) continue
    if (!pattern.test(`${String(row.customer_name || '').slice(5)} ${metadata.note || ''}`)) continue
    if (metadata.documentRole === 'legacy_source' || /original source/i.test(metadata.note || '')) continue
    const dataUri = String(row.action || '')
    candidates.push({ name: String(row.customer_name || `FILE:Invoice-${invoiceNumber}.pdf`).slice(5), dataUri, base64: dataUri.slice(dataUri.indexOf(',') + 1), canonical: metadata.documentRole === 'canonical_invoice', createdAt: row.created_at || '' })
  }
  return candidates.sort((a, b) => Number(b.canonical) - Number(a.canonical) || b.createdAt.localeCompare(a.createdAt))[0] || null
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
    if (daysOverdue !== -7 && daysOverdue !== 0 && !OVERDUE_BUCKETS.includes(daysOverdue)) continue
    const customer = customers.get(invoice.customer_id)
    if (!customer) continue
    const outstanding = Math.max(0, Number(invoice.amount || 0) - Number(invoice.amount_paid || 0))
    if (!outstanding) continue
    const invoiceAge = invoice.date ? daysBetween(invoice.date, today) : null
    const stage = daysOverdue === 0 && invoiceAge === 21 ? 'day-21' : daysOverdue === 0 ? 'due-today' : daysOverdue === -7 ? 'seven-days-before-due' : `overdue-${daysOverdue}`
    const pdf = storedInvoicePdf(fileResult.data || [], invoice.customer_id, invoice.invoice_number)
    if (!pdf) {
      const missingKey = `${invoice.id}:${stage}:missing-canonical-pdf`
      await admin.from(table('notification_logs')).upsert({ invoice_id: invoice.id, customer_id: invoice.customer_id, channel: 'system', status: 'Failed', error: 'Official generated invoice PDF is missing; no reminder was sent.', reminder_stage: stage, idempotency_key: missingKey }, { onConflict: 'idempotency_key' })
      results.push({ invoice: invoice.invoice_number, stage, error: 'missing_canonical_invoice' })
      continue
    }

    const message = reminderMessage(customer.contact_person || customer.company_name || 'there', invoice.invoice_number, outstanding, daysOverdue)
    let email = false
    let whatsapp = false
    const emailKey = `${invoice.id}:${stage}:email`
    if (customer.email && !sentKeys.has(emailKey)) {
      const subject = stage === 'day-21' ? `Payment Reminder - Invoice ${invoice.invoice_number}` : `Invoice Reminder - ${invoice.invoice_number}`
      const html = `<p>Hello ${customer.company_name},</p><p>This is a reminder that the attached invoice <strong>${invoice.invoice_number}</strong> remains outstanding. Please arrange payment accordingly.</p><p>Outstanding: <strong>&pound;${outstanding.toFixed(2)}</strong><br>Due date: <strong>${invoice.due_date}</strong></p><p>Kind regards,<br>Punjab Exotic Foods Limited</p>`
      const sent = await sendEmail(process.env.RESEND_API_KEY, customer.email, subject, html, [{ filename: pdf.name, content: pdf.base64 }], testMode)
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
