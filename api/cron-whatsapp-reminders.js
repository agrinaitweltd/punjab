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

async function sendEmail(key, to, subject, html) {
  if (!key || !to) return { ok: false, error: 'Email address or RESEND_API_KEY missing' }
  const r = await fetch('https://api.resend.com/emails', { method:'POST', headers:{ Authorization:`Bearer ${key}`,'Content-Type':'application/json' }, body:JSON.stringify({ from:'Punjab Exotic Foods <info@punjabexoticfoods.com>', to:[to], subject, html }) })
  const data=await r.json().catch(()=>({})); return { ok:r.ok, error:r.ok?null:JSON.stringify(data) }
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
  const resendKey = process.env.RESEND_API_KEY
  const adminEmail = process.env.ADMIN_NOTIFY_EMAIL || 'receivables@punjabexoticfoods.com'
  if (!supabaseUrl || !supabaseKey) return res.status(500).json({ error: 'Supabase env vars not configured' })
  if (!ultramsgToken) return res.status(500).json({ error: 'ULTRAMSG_TOKEN not configured' })

  const supabase = createClient(supabaseUrl, supabaseKey)
  const today = new Date().toISOString().slice(0, 10)

  const [{ data: invoices, error: invErr }, { data: customers, error: custErr }, { data: todaysLogs, error: logErr }, { data: emailLogs, error: emailLogErr }] = await Promise.all([
    supabase.from('invoices').select('*').neq('status', 'Paid'),
    supabase.from('customers').select('id, company_name, contact_person, phone, email, customer_number'),
    supabase.from('whatsapp_logs').select('customer_id, message, created_at').eq('type', 'Payment Reminder').gte('created_at', `${today}T00:00:00Z`),
    supabase.from('notification_logs').select('invoice_id, channel, sent_at, status').gte('created_at', `${today}T00:00:00Z`),
  ])
  if (invErr || custErr || logErr || emailLogErr) return res.status(502).json({ error: (invErr || custErr || logErr || emailLogErr).message })

  const customersById = new Map((customers ?? []).map(c => [c.id, c]))
  const alreadySentToday = new Set((todaysLogs ?? []).map(l => `${l.customer_id}::${l.message}`))
  const emailedToday = new Set((emailLogs ?? []).filter(l=>l.channel==='email'&&l.status==='Sent').map(l=>l.invoice_id))

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

    // Throttle sends so a large overdue list doesn't burst UltraMsg's rate limit.
    let whatsappOk=false
    if (phone && !alreadySentToday.has(`${inv.customer_id}::${message}`)) {
      await new Promise(r => setTimeout(r, 1200))
      const sent = await sendUltraMsg(ultramsgToken, phone, message); whatsappOk=sent.ok
      await supabase.from('whatsapp_logs').insert({ customer_id:inv.customer_id,customer_name:customer.company_name,phone,message,type:'Payment Reminder',status:sent.ok?'Sent':'Failed',response:sent.response,sent_at:sent.ok?new Date().toISOString():null,created_by:'Cron (08:00 daily)' })
    }
    let emailOk=false
    if (!emailedToday.has(inv.id) && customer.email) {
      const subject=isDueToday?`Payment Due Today - Invoice ${inv.invoice_number}`:`Payment Reminder - Invoice ${inv.invoice_number}`
      const body=`<p>Hello ${customer.company_name},</p><p>${isDueToday?'Payment is due today for':'This is a kind reminder that'} Invoice <strong>${inv.invoice_number}</strong> with an outstanding balance of <strong>£${outstanding.toFixed(2)}</strong>.</p><p>Due date: <strong>${inv.due_date}</strong><br>Account Number: <strong>${customer.customer_number||''}</strong></p><p>If payment has already been arranged, please disregard this message.</p><p>Kind regards,<br>Punjab Exotic Foods Limited</p>`
      const sent=await sendEmail(resendKey,customer.email,subject,body);emailOk=sent.ok
      await supabase.from('notification_logs').insert({invoice_id:inv.id,customer_id:inv.customer_id,channel:'email',status:sent.ok?'Sent':'Failed',sent_at:sent.ok?new Date().toISOString():null,error:sent.error})
      if(isDueToday) await sendEmail(resendKey,adminEmail,`Customer Payment Due Today - ${customer.company_name} - ${inv.invoice_number}`,`<p>Customer: ${customer.company_name}<br>Account: ${customer.customer_number||''}<br>Invoice: ${inv.invoice_number}<br>Due: ${inv.due_date}<br>Outstanding: £${outstanding.toFixed(2)}<br>Phone: ${customer.phone||''}<br>Email: ${customer.email||''}</p>`)
    }
    results.push({ invoice:inv.invoice_number,customer:customer.company_name,daysOverdue,email:emailOk,whatsapp:whatsappOk })
  }

  return res.status(200).json({ checked:(invoices??[]).length,sent:results.filter(r=>r.email||r.whatsapp).length,results })
}
