/* Sends email through the /api/send-email serverless function (Resend).
   Works on the Vercel deployment; in local dev the call fails gracefully
   and callers can fall back (e.g. show the OTP code on screen). */

export async function sendEmail(to: string, subject: string, html: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const r = await fetch("/api/send-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ to, subject, html }),
    })
    if (!r.ok) return { ok: false, error: `HTTP ${r.status}` }
    return { ok: true }
  } catch (e) {
    return { ok: false, error: String(e) }
  }
}

const wrap = (inner: string) => `
<div style="background:#f4f6f4;padding:32px 16px;font-family:Segoe UI,Arial,sans-serif">
  <div style="max-width:520px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08)">
    <div style="height:6px;background:linear-gradient(90deg,#1f7a3a,#f5c518,#f2790f,#d93025)"></div>
    <div style="padding:28px 32px 8px">
      <p style="margin:0;font-size:18px;font-weight:800;color:#0d2b1e">PUNJAB <span style="font-weight:500">EXOTIC FOODS</span></p>
      <p style="margin:2px 0 0;font-size:11px;letter-spacing:2px;color:#8a9a8f;text-transform:uppercase">Freshness Starts Here</p>
    </div>
    <div style="padding:16px 32px 28px;color:#374151;font-size:14px;line-height:1.65">${inner}</div>
    <div style="padding:16px 32px;background:#fafbfa;border-top:1px solid #eef1ee;font-size:11.5px;color:#9aa79e">
      Punjab Exotic Foods Ltd · Wholesale exotic fruit &amp; veg · This is an automated message.
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
) {
  const rows = items.map(it => `
    <tr>
      <td style="padding:8px 0;border-bottom:1px solid #eef1ee;color:#374151">${it.name}</td>
      <td style="padding:8px 0;border-bottom:1px solid #eef1ee;text-align:center;color:#6b7280">${it.qty}</td>
      <td style="padding:8px 0;border-bottom:1px solid #eef1ee;text-align:right;color:#111827;font-weight:600">£${(it.qty * it.unitPrice).toFixed(2)}</td>
    </tr>`).join("")
  return wrap(`
    <h2 style="margin:0 0 6px;font-size:19px;color:#111827">Thanks, ${customerName} — your order has been received!</h2>
    <p style="margin:0 0 16px">Order <strong>${orderNumber}</strong> is now with our team. We'll confirm it shortly and be in touch soon.</p>
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

export function otpEmailHtml(code: string) {
  return wrap(`
    <h2 style="margin:0 0 12px;font-size:19px;color:#111827">Your verification code</h2>
    <p>Use this code to confirm it's you. It expires in <strong>10 minutes</strong>.</p>
    <p style="text-align:center;margin:22px 0">
      <span style="display:inline-block;background:#f0fdf4;border:2px dashed #86c99a;border-radius:12px;padding:16px 28px;font-size:32px;font-weight:800;letter-spacing:10px;color:#14532d">${code}</span>
    </p>
    <p style="color:#6b7280;font-size:12.5px">If you didn't request this code, ignore this email — your account stays safe.</p>`)
}
