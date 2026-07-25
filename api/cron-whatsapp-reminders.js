// Vercel Cron — runs daily at 08:00 (see vercel.json). Finds invoices due
// today or overdue by 1/3/7/14 days and sends a WhatsApp reminder for each,
// via the single Punjab Exotic Foods Ltd UltraMsg account. Every attempt is
// logged to whatsapp_logs, and today's log is checked first so a re-run (or
// a slow cron retry) never double-sends the same reminder.
import { createClient } from '@supabase/supabase-js'

const ULTRAMSG_BASE = 'https://api.ultramsg.com/instance186201'
const OVERDUE_BUCKETS = [1, 3, 7, 14]

function normalizePhone(raw) {
  let digits = String(raw || '').replace(/[^\d+]/g, '')
  if (digits.startsWith('+')) digits = digits.slice(1)
  if (digits.startsWith('0')) digits = '44' + digits.slice(1)
  return /^\d{8,15}$/.test(digits) ? digits : null
}

function daysBetween(dueDateIso, todayIso) {
  const due = new Date(dueDateIso + 'T00:00:00')
  const today = new Date(todayIso + 'T00:00:00')
  return Math.round((today.getTime() - due.getTime()) / 86400000)
}

function reminderMessage(name, invoiceNumber, amount, daysOverdue) {
  const amt = Number(amount).toFixed(2)
  if (daysOverdue <= 0) {
    return `Hi ${name}, a friendly reminder that invoice ${invoiceNumber} for £${amt} is due today. Please arrange payment when you can. Thank you — Punjab Exotic Foods.`
  }
  if (daysOverdue < 3) {
    return `Hi ${name}, invoice ${invoiceNumber} for £${amt} is now ${daysOverdue} day(s) overdue. Please settle this as soon as possible. Thank you — Punjab Exotic Foods.`
  }
  if (daysOverdue < 7) {
    return `Hi ${name}, invoice ${invoiceNumber} for £${amt} is ${daysOverdue} days overdue. Please arrange payment urgently to keep your account in good standing — Punjab Exotic Foods.`
  }
  if (daysOverdue < 14) {
    return `Hi ${name}, invoice ${invoiceNumber} for £${amt} is now ${daysOverdue} days overdue. This requires immediate attention — please contact us to arrange payment — Punjab Exotic Foods.`
  }
  return `Hi ${name}, invoice ${invoiceNumber} for £${amt} is ${daysOverdue} days overdue. Your account may be restricted if payment isn't received shortly. Please contact us urgently — Punjab Exotic Foods.`
}

async function sendUltraMsg(token, phone, message) {
  const body = new URLSearchParams({ token, to: phone, body: message })
  const r = await fetch(`${ULTRAMSG_BASE}/messages/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  })
  const data = await r.json().catch(() => ({}))
  const ok = r.ok && data?.sent !== false && !data?.error
  return { ok, response: JSON.stringify(data) }
}

export default async function handler(req, res) {
  const supabaseUrl = process.env.VITE_SUPABASE_URL
  const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY
  const ultramsgToken = process.env.ULTRAMSG_TOKEN
  if (!supabaseUrl || !supabaseKey) return res.status(500).json({ error: 'Supabase env vars not configured' })
  if (!ultramsgToken) return res.status(500).json({ error: 'ULTRAMSG_TOKEN not configured' })

  const supabase = createClient(supabaseUrl, supabaseKey)
  const today = new Date().toISOString().slice(0, 10)

  const [{ data: invoices, error: invErr }, { data: customers, error: custErr }, { data: todaysLogs, error: logErr }] = await Promise.all([
    supabase.from('invoices').select('*').neq('status', 'Paid'),
    supabase.from('customers').select('id, company_name, contact_person, phone'),
    supabase.from('whatsapp_logs').select('customer_id, message, created_at').eq('type', 'Payment Reminder').gte('created_at', `${today}T00:00:00Z`),
  ])
  if (invErr || custErr || logErr) return res.status(502).json({ error: (invErr || custErr || logErr).message })

  const customersById = new Map((customers ?? []).map(c => [c.id, c]))
  const alreadySentToday = new Set((todaysLogs ?? []).map(l => `${l.customer_id}::${l.message}`))

  const results = []
  for (const inv of invoices ?? []) {
    if (!inv.due_date) continue
    const daysOverdue = daysBetween(inv.due_date, today)
    const isDueToday = daysOverdue === 0
    const isBucketDay = OVERDUE_BUCKETS.includes(daysOverdue)
    if (!isDueToday && !isBucketDay) continue

    const customer = customersById.get(inv.customer_id)
    const phone = customer?.phone ? normalizePhone(customer.phone) : null
    if (!customer || !phone) continue

    const name = customer.contact_person || customer.company_name || 'there'
    const message = reminderMessage(name, inv.invoice_number, inv.amount, Math.max(daysOverdue, 0))
    if (alreadySentToday.has(`${inv.customer_id}::${message}`)) continue

    // Throttle sends so a large overdue list doesn't burst UltraMsg's rate limit.
    await new Promise(r => setTimeout(r, 1200))
    const { ok, response } = await sendUltraMsg(ultramsgToken, phone, message)
    await supabase.from('whatsapp_logs').insert({
      customer_id: inv.customer_id, customer_name: customer.company_name, phone, message,
      type: 'Payment Reminder', status: ok ? 'Sent' : 'Failed', response,
      sent_at: ok ? new Date().toISOString() : null, created_by: 'Cron (08:00 daily)',
    })
    results.push({ invoice: inv.invoice_number, customer: customer.company_name, daysOverdue, sent: ok })
  }

  return res.status(200).json({ checked: (invoices ?? []).length, sent: results.filter(r => r.sent).length, results })
}
