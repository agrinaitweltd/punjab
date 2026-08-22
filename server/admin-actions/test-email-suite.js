import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import { guardApi, safeError } from '../security.js'
import { requireSensitiveStaff, writeSystemAudit } from '../sensitive-actions.js'
import { brandedEmail, EMAIL_SENDERS, sendTransactionalEmail, summaryTable } from '../email-system.js'

const TEST_RECIPIENT = 'info@kavotech.uk'

async function testInvoicePdf() {
  const pdf = await PDFDocument.create()
  const page = pdf.addPage([595.28, 841.89])
  const regular = await pdf.embedFont(StandardFonts.Helvetica)
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold)
  page.drawRectangle({ x: 0, y: 790, width: 595.28, height: 52, color: rgb(0.12, 0.48, 0.23) })
  page.drawText('PUNJAB EXOTIC FOODS LTD', { x: 38, y: 810, size: 18, font: bold, color: rgb(1, 1, 1) })
  page.drawText('TEST / DEMO - NOT PAYABLE', { x: 38, y: 742, size: 22, font: bold, color: rgb(0.72, 0.12, 0.10) })
  page.drawText('Invoice number: TEST-EMAIL-001', { x: 38, y: 700, size: 12, font: bold, color: rgb(0.12, 0.17, 0.13) })
  page.drawText('Customer: Kavotech Email Preview', { x: 38, y: 678, size: 12, font: regular, color: rgb(0.24, 0.30, 0.26) })
  page.drawText('Invoice date: 22/08/2026', { x: 38, y: 656, size: 12, font: regular, color: rgb(0.24, 0.30, 0.26) })
  page.drawText('Due date: 12/09/2026', { x: 38, y: 634, size: 12, font: regular, color: rgb(0.24, 0.30, 0.26) })
  page.drawRectangle({ x: 38, y: 540, width: 519, height: 58, color: rgb(0.96, 0.97, 0.96) })
  page.drawText('Email template preview item', { x: 52, y: 568, size: 11, font: regular })
  page.drawText('GBP 0.00', { x: 470, y: 568, size: 11, font: bold })
  page.drawText('TOTAL: GBP 0.00', { x: 406, y: 505, size: 13, font: bold })
  page.drawText('This document is for sender and template testing only. It creates no financial record.', { x: 38, y: 92, size: 9, font: regular, color: rgb(0.40, 0.45, 0.42) })
  return Buffer.from(await pdf.save()).toString('base64')
}

function suite(invoicePdf) {
  const portal = 'https://www.punjabexoticfoods.com'
  return [
    { category: 'notifications', subject: '[TEST] Punjab Exotic Foods - Your invoice is ready', heading: 'Your test invoice is ready', intro: 'This is a safe email preview and does not affect any customer balance.', content: summaryTable([['Customer', 'Kavotech Email Preview'], ['Invoice', 'TEST-EMAIL-001'], ['Amount', '£0.00'], ['Outstanding', '£0.00'], ['Due date', '12/09/2026']]), cta: { label: 'Open Customer Portal', url: portal }, attachments: [{ filename: 'TEST-DEMO-NOT-PAYABLE-Invoice.pdf', content: invoicePdf }] },
    { category: 'signup', subject: '[TEST] Punjab Exotic Foods - Verify your email', heading: 'Verify your email address', intro: 'Use this test verification code to preview the signup email.', content: '<div style="margin:22px auto;padding:17px;border:1px solid #cfdcd2;background:#f4f8f5;text-align:center;font-size:30px;font-weight:700;letter-spacing:8px;color:#1f7a3a">438921</div><p style="text-align:center;color:#59655d">This example code expires in 10 minutes.</p>' },
    { category: 'password', subject: '[TEST] Punjab Exotic Foods - Reset your password', heading: 'Reset your password', intro: 'A password reset was requested for this test account.', content: '<p style="text-align:center;color:#59655d">The secure reset link expires automatically. No password or private account information is included.</p>', cta: { label: 'Reset Password', url: portal } },
    { category: 'security', subject: '[TEST] Punjab Exotic Foods - Security alert', heading: 'New account sign-in', intro: 'A test sign-in was recorded on 22 August 2026 at 09:30 BST.', content: summaryTable([['Device', 'Chrome on Windows'], ['Location', 'London, United Kingdom'], ['Status', 'Test preview only']]), cta: { label: 'Secure My Account', url: portal } },
    { category: 'orders', subject: '[TEST] Punjab Exotic Foods - Order confirmed', heading: 'Your order is confirmed', intro: 'Test order TEST-ORDER-001 has been received by our team.', content: summaryTable([['Order reference', 'TEST-ORDER-001'], ['Order total', '£0.00'], ['Status', 'Confirmed']]), cta: { label: 'View Order', url: portal } },
    { category: 'delivery', subject: '[TEST] Punjab Exotic Foods - Delivery scheduled', heading: 'Your delivery is scheduled', intro: 'This is a preview of a delivery notification.', content: summaryTable([['Delivery reference', 'TEST-DEL-001'], ['Scheduled date', '24/08/2026'], ['Status', 'Scheduled']]), cta: { label: 'View Delivery', url: portal } },
    { category: 'statements', subject: '[TEST] Punjab Exotic Foods - Statement ready', heading: 'Your statement is ready', intro: 'Your test account statement is available to view.', content: summaryTable([['Statement period', 'August 2026'], ['Closing balance', '£0.00'], ['Status', 'Test preview']]), cta: { label: 'View Statement', url: portal } },
    { category: 'accounts', subject: '[TEST] Punjab Exotic Foods - Account updated', heading: 'Your account details were updated', intro: 'This is a safe preview of a customer account notification.', content: summaryTable([['Account number', 'TEST001'], ['Credit limit', '£0.00'], ['Credit days', '21']]), cta: { label: 'Open Customer Portal', url: portal } },
    { category: 'system', subject: '[TEST] Punjab Exotic Foods - System notification', heading: 'System workflow completed', intro: 'The test email-template review completed without changing production data.', content: summaryTable([['Workflow', 'Email template preview'], ['Environment', 'Production-safe test'], ['Data created', 'None']]) },
  ]
}

export const emailTestInternals = { suite, testInvoicePdf }

export async function runEmailTestSuite(admin, createdBy) {
  const runId = new Date().toISOString().replace(/[:.]/g, '-')
  const messages = suite(await testInvoicePdf())
  const results = []
  for (const message of messages) {
    const html = brandedEmail({ heading: message.heading, intro: message.intro, contentHtml: message.content, cta: message.cta, preheader: message.subject })
    const sent = await sendTransactionalEmail({ category: message.category, to: TEST_RECIPIENT, subject: message.subject, html, attachments: message.attachments || [], admin, idempotencyKey: `email-suite:${runId}:${message.category}`, communicationType: 'email_template_test', createdBy })
    results.push({ category: message.category, sender: EMAIL_SENDERS[message.category].email, ok: sent.ok, error: sent.error || null, providerMessageId: sent.id || null })
  }
  return { runId, results }
}

export default async function handler(req, res) {
  if (!guardApi(req, res, { maxBytes: 4_096, limit: 2, windowMs: 60 * 60_000 })) return
  const context = await requireSensitiveStaff(req, res, { systemDeveloperOnly: true })
  if (!context) return
  const { admin, user } = context
  try {
    const { runId, results } = await runEmailTestSuite(admin, user.email || user.id)
    await writeSystemAudit(admin, user.id, 'email_template_suite_sent', 'communication_logs', runId, { recipient: TEST_RECIPIENT, successful: results.filter(item => item.ok).length, failed: results.filter(item => !item.ok).length })
    return res.status(results.every(item => item.ok) ? 200 : 207).json({ ok: results.every(item => item.ok), recipient: TEST_RECIPIENT, results })
  } catch (error) {
    console.error('test-email-suite failed', error instanceof Error ? error.message : 'Unknown error')
    return res.status(500).json({ error: safeError })
  }
}
