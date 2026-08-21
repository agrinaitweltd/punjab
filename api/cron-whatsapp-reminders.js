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
  if (daysOverdue === -7) {
    return `Hello ${name}, this is a kind reminder from Punjab Exotic Foods Limited that Invoice ${invoiceNumber} has an outstanding balance of £${amt}. Payment is due in 7 days. If payment has already been arranged, please disregard this message.`
  }
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

async function sendEmail(key, to, subject, html, attachments = []) {
  if (!key || !to) return { ok: false, error: 'Email address or RESEND_API_KEY missing' }
  const r = await fetch('https://api.resend.com/emails', { method:'POST', headers:{ Authorization:`Bearer ${key}`,'Content-Type':'application/json' }, body:JSON.stringify({ from:'Punjab Exotic Foods <info@punjabexoticfoods.com>', to:[to], subject, html, ...(attachments.length ? { attachments } : {}) }) })
  const data=await r.json().catch(()=>({})); return { ok:r.ok, error:r.ok?null:JSON.stringify(data) }
}

async function sendUltraMsgDocument(token, phone, message, file) {
  const body = new URLSearchParams({ token, to: phone, caption: message, filename: file.name, document: file.dataUri })
  const r = await fetch(`${ULTRAMSG_BASE}/messages/document`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: body.toString() })
  const data = await r.json().catch(() => ({}))
  return { ok: r.ok && data?.sent !== false && !data?.error, response: JSON.stringify(data) }
}

function storedInvoicePdf(files, customerId, invoiceNumber) {
  const needle = String(invoiceNumber || '').trim().toLowerCase()
  if (!needle) return null
  const pattern = new RegExp(`(^|[^a-z0-9])${needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}($|[^a-z0-9])`, 'i')
  for (const row of files) {
    let meta = {}
    try { meta = JSON.parse(row.timestamp || '{}') } catch { /* ignore malformed legacy metadata */ }
    if (meta.customerId !== customerId) continue
    if (meta.type !== 'application/pdf' && !String(row.action || '').startsWith('data:application/pdf')) continue
    if (!pattern.test(`${String(row.customer_name || '').slice(5)} ${meta.note || ''}`)) continue
    const dataUri = String(row.action || '')
    return { name: String(row.customer_name || `FILE:Invoice-${invoiceNumber}.pdf`).slice(5), dataUri, base64: dataUri.slice(dataUri.indexOf(',') + 1) }
  }
  return null
}

export default async function handler(req, res) {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret || req.headers?.authorization !== `Bearer ${cronSecret}`) return res.status(401).json({ error: 'Unauthorized' })
  const supabaseUrl = process.env.VITE_SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const ultramsgToken = process.env.ULTRAMSG_TOKEN
  const resendKey = process.env.RESEND_API_KEY
  const adminEmail = process.env.ADMIN_NOTIFY_EMAIL || 'receivables@punjabexoticfoods.com'
  if (!supabaseUrl || !supabaseKey) return res.status(500).json({ error: 'Server-side Supabase credentials not configured' })

  const supabase = createClient(supabaseUrl, supabaseKey)
  const today = new Date().toISOString().slice(0, 10)

  const [{ data: invoices, error: invErr }, { data: customers, error: custErr }, { data: todaysLogs, error: logErr }, { data: emailLogs, error: emailLogErr }, { data: files, error: fileErr }] = await Promise.all([
    supabase.from('invoices').select('*').neq('status', 'Paid'),
    supabase.from('customers').select('id, company_name, contact_person, phone, email, customer_number'),
    supabase.from('whatsapp_logs').select('customer_id, message, created_at').eq('type', 'Payment Reminder').gte('created_at', `${today}T00:00:00Z`),
    supabase.from('notification_logs').select('invoice_id, channel, sent_at, status, error').gte('created_at', `${today}T00:00:00Z`),
    supabase.from('activity_log').select('customer_name, action, timestamp').like('customer_name', 'FILE:%'),
  ])
  if (invErr || custErr || logErr || emailLogErr || fileErr) {
    console.error('Reminder cron database query failed', (invErr || custErr || logErr || emailLogErr || fileErr).message)
    return res.status(502).json({ error: 'Reminder data could not be loaded' })
  }

  const customersById = new Map((customers ?? []).map(c => [c.id, c]))
  const alreadySentToday = new Set((todaysLogs ?? []).map(l => `${l.customer_id}::${l.message}`))
  const emailedToday = new Set((emailLogs ?? []).filter(l=>l.channel==='email').map(l=>l.invoice_id))
  const missingPdfLoggedToday = new Set((emailLogs ?? []).filter(l=>String(l.error || '').includes('Official invoice PDF')).map(l=>l.invoice_id))

  const results = []
  for (const inv of invoices ?? []) {
    if (!inv.due_date) continue
    const daysOverdue = daysBetween(inv.due_date, today)
    const isDueToday = daysOverdue === 0
    const isSevenDayReminder = daysOverdue === -7
    const isBucketDay = OVERDUE_BUCKETS.includes(daysOverdue)
    if (!isSevenDayReminder && !isDueToday && !isBucketDay) continue

    const customer = customersById.get(inv.customer_id)
    const phone = customer?.phone ? normalizePhone(customer.phone) : null
    if (!customer) continue

    const name = customer.contact_person || customer.company_name || 'there'
    const outstanding = Math.max(0, Number(inv.amount || 0) - Number(inv.amount_paid || 0))
    if (outstanding <= 0) continue
    const message = reminderMessage(name, inv.invoice_number, outstanding, daysOverdue)
    const invoicePdf = storedInvoicePdf(files ?? [], inv.customer_id, inv.invoice_number)
    if (!invoicePdf) {
      if (missingPdfLoggedToday.has(inv.id)) continue
      const error = `Official invoice PDF ${inv.invoice_number} is missing; reminder was not sent.`
      const failed = []
      if (customer.email) failed.push({ invoice_id: inv.id, customer_id: inv.customer_id, channel: 'email', status: 'Failed', error })
      if (customer.phone) failed.push({ invoice_id: inv.id, customer_id: inv.customer_id, channel: 'whatsapp', status: 'Failed', error })
      if (failed.length) await supabase.from('notification_logs').insert(failed)
      await sendEmail(resendKey, adminEmail, `Invoice PDF Missing - ${customer.company_name} - ${inv.invoice_number}`, `<p>${error}</p><p>Customer: ${customer.company_name}<br>Account: ${customer.customer_number || ''}<br>Due date: ${inv.due_date}</p>`)
      results.push({ invoice: inv.invoice_number, customer: customer.company_name, daysOverdue, email: false, whatsapp: false, error: 'missing_invoice_pdf' })
      continue
    }

    // Throttle sends so a large overdue list doesn't burst UltraMsg's rate limit.
    let whatsappOk=false
    if (ultramsgToken && phone && !alreadySentToday.has(`${inv.customer_id}::${message}`)) {
      await new Promise(r => setTimeout(r, 1200))
      const sent = await sendUltraMsgDocument(ultramsgToken, phone, message, invoicePdf); whatsappOk=sent.ok
      await supabase.from('whatsapp_logs').insert({ customer_id:inv.customer_id,customer_name:customer.company_name,phone,message,type:'Payment Reminder',status:sent.ok?'Sent':'Failed',response:sent.response,sent_at:sent.ok?new Date().toISOString():null,created_by:'Cron (08:00 daily)' })
      await supabase.from('notification_logs').insert({ invoice_id:inv.id,customer_id:inv.customer_id,channel:'whatsapp',status:sent.ok?'Sent':'Failed',sent_at:sent.ok?new Date().toISOString():null,error:sent.ok?null:sent.response })
    }
    let emailOk=false
    if (!emailedToday.has(inv.id) && customer.email) {
      const subject=isDueToday?`Payment Due Today - Invoice ${inv.invoice_number}`:`Payment Reminder - Invoice ${inv.invoice_number}`
      const body=`<p>Hello ${customer.company_name},</p><p>${isDueToday?'Payment is due today for':'This is a kind reminder that'} Invoice <strong>${inv.invoice_number}</strong> with an outstanding balance of <strong>£${outstanding.toFixed(2)}</strong>.</p><p>Due date: <strong>${inv.due_date}</strong><br>Account Number: <strong>${customer.customer_number||''}</strong></p><p>If payment has already been arranged, please disregard this message.</p><p>Kind regards,<br>Punjab Exotic Foods Limited</p>`
      const sent=await sendEmail(resendKey,customer.email,subject,body,[{ filename: invoicePdf.name, content: invoicePdf.base64 }]);emailOk=sent.ok
      await supabase.from('notification_logs').insert({invoice_id:inv.id,customer_id:inv.customer_id,channel:'email',status:sent.ok?'Sent':'Failed',sent_at:sent.ok?new Date().toISOString():null,error:sent.error})
      if(isDueToday) await sendEmail(resendKey,adminEmail,`Customer Payment Due Today - ${customer.company_name} - ${inv.invoice_number}`,`<p>Customer: ${customer.company_name}<br>Account: ${customer.customer_number||''}<br>Invoice: ${inv.invoice_number}<br>Due: ${inv.due_date}<br>Outstanding: £${outstanding.toFixed(2)}<br>Phone: ${customer.phone||''}<br>Email: ${customer.email||''}</p>`)
    }
    if (isDueToday && !customer.email) await sendEmail(resendKey,adminEmail,`Customer Payment Due Today - ${customer.company_name} - ${inv.invoice_number}`,`<p>Customer: ${customer.company_name}<br>Account: ${customer.customer_number||''}<br>Invoice: ${inv.invoice_number}<br>Due: ${inv.due_date}<br>Outstanding: GBP ${outstanding.toFixed(2)}<br>Phone: ${customer.phone||''}<br>Email: Not supplied</p>`)
    results.push({ invoice:inv.invoice_number,customer:customer.company_name,daysOverdue,email:emailOk,whatsapp:whatsappOk })
  }

  return res.status(200).json({ checked:(invoices??[]).length,sent:results.filter(r=>r.email||r.whatsapp).length,results })
}
