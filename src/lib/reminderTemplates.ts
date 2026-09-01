import type { Customer, Invoice } from '../types'
import { invoiceOutstanding, classifyInvoice } from './creditNotes'

const daysBetween = (fromIso: string, toIso: string) => Math.round((new Date(`${toIso}T00:00:00`).getTime() - new Date(`${fromIso}T00:00:00`).getTime()) / 86_400_000)

/** True if this unpaid invoice is currently at (or past) the point where an
    admin should be sending a 14-day, 21-day, or 21+ overdue reminder today -
    the same three-way classification RemindersPage's "Due Today" queue
    uses, exposed here so other pages (the Invoices list's "Reminder due"
    filter) can reuse it instead of re-deriving it. */
export function isReminderDueToday(invoice: Invoice, today: string = new Date().toISOString().slice(0, 10)): boolean {
  if (invoiceOutstanding(invoice) <= 0) return false
  if (invoice.date && daysBetween(invoice.date, today) === 14) return true
  if (invoice.date && daysBetween(invoice.date, today) === 21) return true
  return classifyInvoice(invoice) === 'overdue'
}

/** The three reminder stages an admin can send from - matches the
    `reminder_stage` values the (now-manual) reminder workflow writes to
    notification_logs, so history/filtering stays consistent whether a send
    came from the automated cron (historically) or this composer. */
export type ReminderStage = 'day-14' | 'day-21' | '21-plus'

export function reminderStageLabel(stage: ReminderStage): string {
  if (stage === 'day-14') return '14-Day Reminder'
  if (stage === 'day-21') return '21-Day Reminder'
  return '21+ Days Overdue'
}

/** Single source of truth for the pre-filled subject/message per stage, so
    the composer, the "Due Today" queue, and the 21+ Overdue module all stay
    in sync. The admin can edit the result freely before sending - this is
    only the starting point.

    The 21+ stage deliberately has NO real wording yet: the owner said a
    separate letter template will be supplied later, and explicitly asked
    not to have that wording guessed in the meantime. Until it's provided,
    this returns an obvious placeholder that forces the admin to write or
    paste real wording before sending. */
export function reminderTemplateFor(stage: ReminderStage, invoice: Invoice, customer: Customer): { subject: string; message: string } {
  const name = customer.contactPerson || customer.companyName
  const outstanding = invoiceOutstanding(invoice)
  if (stage === 'day-14') {
    return {
      subject: `Payment Reminder - Invoice ${invoice.invoiceNumber}`,
      message: `Hello ${name},\n\nThis is a friendly reminder that invoice ${invoice.invoiceNumber}, dated ${invoice.date}, is still outstanding.\n\nAmount outstanding: £${outstanding.toFixed(2)}\nDue date: ${invoice.dueDate}\n\nPlease arrange payment at your earliest convenience. If you have already paid, please disregard this message.\n\nKind regards,\nPunjab Exotic Foods Limited`,
    }
  }
  if (stage === 'day-21') {
    return {
      subject: `Overdue Payment Notice - Invoice ${invoice.invoiceNumber}`,
      message: `Hello ${name},\n\nInvoice ${invoice.invoiceNumber}, dated ${invoice.date}, is now overdue and remains unpaid.\n\nAmount outstanding: £${outstanding.toFixed(2)}\nDue date: ${invoice.dueDate}\n\nPlease settle this invoice as soon as possible to keep your account in good standing. Please contact us if you have any questions or need to discuss payment.\n\nKind regards,\nPunjab Exotic Foods Limited`,
    }
  }
  return {
    subject: `Account Overdue - Invoice ${invoice.invoiceNumber} [TEMPLATE PENDING]`,
    message: `[TEMPLATE PENDING - the approved 21+ days overdue letter wording has not been supplied yet. Please write or paste the correct wording here before sending.]\n\nInvoice ${invoice.invoiceNumber}, dated ${invoice.date}, remains unpaid.\nAmount outstanding: £${outstanding.toFixed(2)}\nDue date: ${invoice.dueDate}\n\nKind regards,\nPunjab Exotic Foods Limited`,
  }
}
