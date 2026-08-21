/* Sends email through the /api/send-email serverless function (Resend).
   Works on the Vercel deployment; in local dev the call fails gracefully
   and callers can fall back (e.g. show the OTP code on screen). */

export async function sendEmail(to: string | string[], subject: string, html: string, attachments?: { filename: string; content: string }[]): Promise<{ ok: boolean; error?: string }> {
  try {
    const r = await fetch("/api/send-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ to, subject, html, attachments }),
    })
    if (!r.ok) return { ok: false, error: `HTTP ${r.status}` }
    return { ok: true }
  } catch (e) {
    return { ok: false, error: String(e) }
  }
}

export const URGENT_SUPPORT_PHONE = "07364 219332"
// Notification-only recipients. These addresses do not create dashboard accounts.
export const ADMIN_NOTIFY_EMAIL = [
  "contact@punjabexoticfoods.co.uk",
  "info@punjabexoticfoods.co.uk",
]
export const COLLECTION_ADDRESS = {
  line1: "Punjab Exotic Foods",
  line2: "Gate 9, Stand 1B–1D",
  line3: "New Spitalfields Market",
  line4: "Sherrin Road",
  city: "London",
  postcode: "E10 5SQ",
}

const logoUrl = () => {
  try { return `${window.location.origin}/logo.png` } catch { return "/logo.png" }
}

const wrap = (inner: string) => `
<div style="background:#f4f6f4;padding:32px 16px;font-family:Segoe UI,Arial,sans-serif">
  <div style="max-width:520px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08)">
    <div style="height:6px;background:linear-gradient(90deg,#1f7a3a,#f5c518,#f2790f,#d93025)"></div>
    <div style="padding:28px 32px 8px;display:flex;align-items:center;gap:12px">
      <img src="${logoUrl()}" alt="Punjab Exotic Foods" width="40" height="40" style="display:block;border-radius:8px" />
      <div>
        <p style="margin:0;font-size:18px;font-weight:800;color:#0d2b1e">PUNJAB <span style="font-weight:500">EXOTIC FOODS</span></p>
        <p style="margin:2px 0 0;font-size:11px;letter-spacing:2px;color:#8a9a8f;text-transform:uppercase">Freshness Starts Here</p>
      </div>
    </div>
    <div style="padding:16px 32px 28px;color:#374151;font-size:14px;line-height:1.65">${inner}</div>
    <div style="padding:16px 32px;background:#fafbfa;border-top:1px solid #eef1ee;font-size:11.5px;color:#9aa79e">
      Punjab Exotic Foods Ltd · Wholesale exotic fruit &amp; veg · Urgent Support: <strong style="color:#4d7c5f">${URGENT_SUPPORT_PHONE}</strong><br/>
      This is an automated message.
    </div>
  </div>
</div>`

export function welcomeEmailHtml(name: string, role: "customer" | "admin", portalUrl: string) {
  return wrap(`
    <h2 style="margin:0 0 12px;font-size:19px;color:#111827">Welcome aboard, ${name}!</h2>
    <p>An account has been created for you on the <strong>Punjab Exotic Foods ${role === "admin" ? "Admin" : "Customer"} Portal</strong>.</p>
    <p>To activate it, open the portal, choose <strong>“First time here?”</strong> and enter this email address.
    We'll send you a 6-digit verification code to finish setting up your login.</p>
    <p style="text-align:center;margin:24px 0">
      <a href="${portalUrl}" style="display:inline-block;background:#1f7a3a;color:#fff;text-decoration:none;font-weight:700;padding:12px 28px;border-radius:10px">Activate my account</a>
    </p>
    <p style="color:#6b7280;font-size:12.5px">If you weren't expecting this email you can safely ignore it.</p>`)
}

export function orderReceivedEmailHtml(
  orderNumber: string, customerName: string,
  items: { name: string; qty: number; unitPrice: number }[], total: number,
  fulfilment: "Delivery" | "Collection" = "Delivery",
  deliveryAddress?: string,
) {
  const fulfilmentBlock = fulfilment === "Collection" ? `
    <div style="border:1.5px dashed #f2790f;border-radius:12px;padding:16px 20px;margin:16px 0;background:#fff8ef">
      <p style="margin:0 0 6px;font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#b25c0a;font-weight:700">Collection Details</p>
      <p style="margin:0;font-weight:700;color:#111827">${COLLECTION_ADDRESS.line1}</p>
      <p style="margin:0;color:#374151">${COLLECTION_ADDRESS.line2}</p>
      <p style="margin:0;color:#374151">${COLLECTION_ADDRESS.line3}</p>
      <p style="margin:0;color:#374151">${COLLECTION_ADDRESS.line4}</p>
      <p style="margin:0;color:#374151">${COLLECTION_ADDRESS.city} ${COLLECTION_ADDRESS.postcode}</p>
    </div>` : `
    <div style="border-radius:12px;padding:12px 20px;margin:16px 0;background:#f0fdf4">
      <p style="margin:0 0 4px;font-size:13px;color:#14532d"><strong>Fulfilment:</strong> Delivery</p>
      ${deliveryAddress ? `<p style="margin:0;font-size:13px;color:#14532d">${deliveryAddress}</p>` : ""}
    </div>`
  const rows = items.map(it => `
    <tr>
      <td style="padding:8px 0;border-bottom:1px solid #eef1ee;color:#374151">${it.name}</td>
      <td style="padding:8px 0;border-bottom:1px solid #eef1ee;text-align:center;color:#6b7280">${it.qty}</td>
      <td style="padding:8px 0;border-bottom:1px solid #eef1ee;text-align:right;color:#111827;font-weight:600">£${(it.qty * it.unitPrice).toFixed(2)}</td>
    </tr>`).join("")
  return wrap(`
    <h2 style="margin:0 0 6px;font-size:19px;color:#111827">Thanks, ${customerName} — your order has been received!</h2>
    <p style="margin:0 0 16px">Order <strong>${orderNumber}</strong> is now with our team. We'll confirm it shortly and be in touch soon.</p>
    ${fulfilmentBlock}
    <table style="width:100%;border-collapse:collapse;font-size:13.5px;margin-bottom:10px">
      <thead><tr>
        <th style="text-align:left;padding-bottom:6px;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;color:#9aa79e">Item</th>
        <th style="text-align:center;padding-bottom:6px;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;color:#9aa79e">Qty</th>
        <th style="text-align:right;padding-bottom:6px;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;color:#9aa79e">Amount</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <div style="display:flex;justify-content:space-between;padding:12px 0;font-size:16px;font-weight:800;color:#14532d">
      <span>Total</span><span>£${total.toFixed(2)}</span>
    </div>
    <p style="color:#6b7280;font-size:12.5px;margin-top:12px">This is your order confirmation and invoice reference. We'll email you again once payment is confirmed.</p>`)
}

export function orderPaymentRequiredEmailHtml(
  customerName: string, orderNumber: string, amount: number, dueDate: string,
) {
  return wrap(`
    <h2 style="margin:0 0 12px;font-size:19px;color:#111827">Payment needed to continue — ${customerName}</h2>
    <p>Your order <strong>${orderNumber}</strong> has been confirmed, but it needs to be paid before we can keep processing it
    or take any further orders from your account.</p>
    <div style="border:1.5px dashed #fca5a5;border-radius:12px;padding:20px;margin:20px 0;background:#fef2f2">
      <p style="margin:0 0 4px;font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#b91c1c;font-weight:700">Amount Due</p>
      <p style="margin:0;font-size:26px;font-weight:800;color:#7f1d1d">£${amount.toFixed(2)}</p>
      <p style="margin:8px 0 0;font-size:13px;color:#374151">Due: ${dueDate}</p>
    </div>
    <p style="text-align:center;margin:24px 0">
      <span style="display:inline-block;background:#1f7a3a;color:#fff;text-decoration:none;font-weight:700;padding:12px 28px;border-radius:10px">Pay in your Punjab Exotic Foods account — Balance tab</span>
    </p>
    <p style="color:#6b7280;font-size:12.5px">Sign in to the portal and go to <strong>Balance</strong> to pay securely by card. Your account won't be able to place new orders until this is settled.</p>`)
}

export function paymentProofSubmittedEmailHtml(
  customerName: string, invoiceNumbers: string[], amount: number,
) {
  return wrap(`
    <h2 style="margin:0 0 12px;font-size:19px;color:#111827">Payment proof received — thanks, ${customerName}</h2>
    <p>We've received your bank transfer screenshot for invoice${invoiceNumbers.length !== 1 ? "s" : ""}
    <strong>${invoiceNumbers.join(", ")}</strong> (£${amount.toFixed(2)}). Our team will check it against our bank
    statement and confirm shortly — you'll get an email as soon as it's approved.</p>
    <p style="color:#6b7280;font-size:12.5px">No action needed from you right now.</p>`)
}

export function paymentProofAdminAlertEmailHtml(
  customerName: string, invoiceNumbers: string[], amount: number,
) {
  return wrap(`
    <h2 style="margin:0 0 12px;font-size:19px;color:#111827">New payment proof to review</h2>
    <p><strong>${customerName}</strong> has uploaded a bank transfer screenshot for invoice${invoiceNumbers.length !== 1 ? "s" : ""}
    <strong>${invoiceNumbers.join(", ")}</strong>, totalling <strong>£${amount.toFixed(2)}</strong>.</p>
    <p>Check it against the bank statement, then approve or reject it from <strong>Payment Proofs</strong> in the admin portal.</p>`)
}

export function paymentApprovedEmailHtml(
  customerName: string, invoiceNumbers: string[], amount: number,
) {
  return wrap(`
    <h2 style="margin:0 0 12px;font-size:19px;color:#111827">Payment confirmed — thanks, ${customerName}!</h2>
    <p>We've checked your bank transfer and confirmed payment of <strong>£${amount.toFixed(2)}</strong> for invoice${invoiceNumbers.length !== 1 ? "s" : ""}
    <strong>${invoiceNumbers.join(", ")}</strong>. Your account has been updated.</p>
    <p style="color:#6b7280;font-size:12.5px">Thank you for your business!</p>`)
}

export function paymentRejectedEmailHtml(
  customerName: string, invoiceNumbers: string[], amount: number, reason: string,
) {
  return wrap(`
    <h2 style="margin:0 0 12px;font-size:19px;color:#111827">We couldn't confirm your payment — ${customerName}</h2>
    <p>We checked the screenshot you sent for invoice${invoiceNumbers.length !== 1 ? "s" : ""} <strong>${invoiceNumbers.join(", ")}</strong>
    (£${amount.toFixed(2)}), but ${reason ? `we found an issue: <strong>${reason}</strong>` : "couldn't match it to a payment on our bank statement"}.</p>
    <p>Please double-check the transfer and upload a new screenshot in your <strong>Balance</strong> tab, or call us on
    <strong>${URGENT_SUPPORT_PHONE}</strong> if you think this is a mistake.</p>`)
}

export function paymentReceivedEmailHtml(
  orderNumber: string, customerName: string, amount: number, paymentReference: string, date: string,
) {
  return wrap(`
    <h2 style="margin:0 0 12px;font-size:19px;color:#111827">Thanks, ${customerName} — payment received!</h2>
    <p>We've confirmed payment for order <strong>${orderNumber}</strong>. Please find your receipt below.</p>
    <div style="border:1.5px dashed #86c99a;border-radius:12px;padding:20px;margin:20px 0;background:#f0fdf4">
      <p style="margin:0 0 4px;font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#4d7c5f;font-weight:700">Receipt</p>
      <div style="display:flex;justify-content:space-between;font-size:13.5px;color:#374151;margin-top:10px">
        <span>Reference</span><strong>${paymentReference}</strong>
      </div>
      <div style="display:flex;justify-content:space-between;font-size:13.5px;color:#374151;margin-top:6px">
        <span>Order</span><strong>${orderNumber}</strong>
      </div>
      <div style="display:flex;justify-content:space-between;font-size:13.5px;color:#374151;margin-top:6px">
        <span>Date</span><strong>${date}</strong>
      </div>
      <div style="display:flex;justify-content:space-between;font-size:19px;font-weight:800;color:#14532d;margin-top:14px;padding-top:14px;border-top:1px dashed #86c99a">
        <span>Amount Paid</span><span>£${amount.toFixed(2)}</span>
      </div>
    </div>
    <p style="color:#6b7280;font-size:12.5px">Keep this email as your receipt. Thank you for your business!</p>`)
}

export function overdueEmailHtml(
  customerName: string,
  overdueInvoices: { invoiceNumber: string; amount: number; daysOverdue: number }[],
  totalOutstanding: number,
  creditLimit: number,
  overLimitBy: number,
) {
  const rows = overdueInvoices.map(inv => `
    <tr>
      <td style="padding:8px 0;border-bottom:1px solid #eef1ee;color:#374151"><strong>${inv.invoiceNumber}</strong></td>
      <td style="padding:8px 0;border-bottom:1px solid #eef1ee;text-align:center;color:#b91c1c">${inv.daysOverdue === 0 ? "Credit days reached today" : `${inv.daysOverdue} day${inv.daysOverdue !== 1 ? "s" : ""} overdue`}</td>
      <td style="padding:8px 0;border-bottom:1px solid #eef1ee;text-align:right;color:#111827;font-weight:600">£${inv.amount.toFixed(2)}</td>
    </tr>`).join("")
  const overdueTotal = overdueInvoices.reduce((s, i) => s + i.amount, 0)
  return wrap(`
    <h2 style="margin:0 0 12px;font-size:19px;color:#111827">Payment required — ${customerName}</h2>
    <p>The following invoice${overdueInvoices.length !== 1 ? "s are" : " is"} now due for payment. Please settle ${overdueInvoices.length !== 1 ? "them" : "it"} as soon as possible to keep your account in good standing.</p>
    <table style="width:100%;border-collapse:collapse;font-size:13.5px;margin:16px 0 10px">
      <thead><tr>
        <th style="text-align:left;padding-bottom:6px;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;color:#9aa79e">Invoice</th>
        <th style="text-align:center;padding-bottom:6px;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;color:#9aa79e">Status</th>
        <th style="text-align:right;padding-bottom:6px;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;color:#9aa79e">Amount</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <div style="display:flex;justify-content:space-between;padding:10px 0;font-size:15px;font-weight:800;color:#b91c1c">
      <span>Overdue total</span><span>£${overdueTotal.toFixed(2)}</span>
    </div>
    <div style="border:1.5px dashed #fca5a5;border-radius:12px;padding:14px 18px;margin:12px 0;background:#fef2f2;font-size:13.5px;color:#374151">
      <p style="margin:0 0 4px">Total outstanding balance: <strong>£${totalOutstanding.toFixed(2)}</strong></p>
      ${creditLimit > 0 ? `<p style="margin:0 0 4px">Your credit limit: <strong>£${creditLimit.toFixed(2)}</strong></p>` : ""}
      ${overLimitBy > 0 ? `<p style="margin:0;color:#b91c1c"><strong>You are £${overLimitBy.toFixed(2)} over your credit limit</strong> — please pay at least this amount to continue ordering.</p>` : ""}
    </div>
    <p>You can view and pay your outstanding invoices any time in the <strong>Balance &amp; Payments</strong> section of your customer portal.</p>
    <p style="color:#6b7280;font-size:12.5px">Already paid? Please ignore this email — payments can take a short while to show on your account.</p>`)
}

export function paymentReminderEmailHtml(
  customerName: string, invoiceNumber: string, amountOutstanding: number, dueDate: string, paymentLink: string,
) {
  return wrap(`
    <h2 style="margin:0 0 12px;font-size:19px;color:#111827">Payment reminder — ${customerName}</h2>
    <p>This is a reminder that invoice <strong>${invoiceNumber}</strong> is still outstanding.</p>
    <div style="border:1.5px dashed #86c99a;border-radius:12px;padding:14px 18px;margin:16px 0;background:#f0fdf4;font-size:14px;color:#111827">
      <div style="display:flex;justify-content:space-between;margin-bottom:6px"><span>Invoice</span><strong>${invoiceNumber}</strong></div>
      <div style="display:flex;justify-content:space-between;margin-bottom:6px"><span>Due date</span><strong>${dueDate}</strong></div>
      <div style="display:flex;justify-content:space-between;font-size:17px;font-weight:800;color:#14532d"><span>Amount Outstanding</span><span>£${amountOutstanding.toFixed(2)}</span></div>
    </div>
    <p style="text-align:center;margin:20px 0">
      <a href="${paymentLink}" style="display:inline-block;background:#1f7a3a;color:#fff;text-decoration:none;font-weight:700;font-size:14px;padding:12px 26px;border-radius:10px">Pay Now</a>
    </p>
    <p>If you've already paid, please ignore this reminder — it can take a short while to show on your account.</p>
    <p style="color:#6b7280;font-size:12.5px">Questions about this invoice? Call us on ${URGENT_SUPPORT_PHONE} or reply to this email.</p>`)
}

export function otpEmailHtml(code: string) {
  return wrap(`
    <h2 style="margin:0 0 12px;font-size:19px;color:#111827">Your verification code</h2>
    <p>Use this code to confirm it's you. It expires in <strong>10 minutes</strong>.</p>
    <p style="text-align:center;margin:22px 0">
      <span style="display:inline-block;background:#f0fdf4;border:2px dashed #86c99a;border-radius:12px;padding:16px 28px;font-size:32px;font-weight:800;letter-spacing:10px;color:#14532d">${code}</span>
    </p>
    <p style="color:#6b7280;font-size:12.5px">If you didn't request this code, ignore this email — your account stays safe.</p>`)
}
