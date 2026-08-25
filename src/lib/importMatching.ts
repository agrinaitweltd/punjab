import type { Customer, CreditNote, Invoice } from '../types'

export function normalizeAccountNumber(value = '') {
  return value.replace(/[^a-z0-9]/gi, '').toLowerCase()
}

export function normalizeCompanyName(value = '') {
  return value
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/\b(?:limited|ltd\.?|plc|llp|co\.?|company)\b/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function matchImportedCustomer(
  customers: Customer[],
  imported: { accountNumber?: string; companyName?: string; existingCustomerId?: string },
) {
  if (imported.existingCustomerId) {
    const byId = customers.find(customer => customer.id === imported.existingCustomerId)
    if (byId) return byId
  }
  const account = normalizeAccountNumber(imported.accountNumber)
  if (account) {
    const byAccount = customers.find(customer => normalizeAccountNumber(customer.customerNumber) === account)
    if (byAccount) return byAccount
  }
  const company = normalizeCompanyName(imported.companyName)
  return company ? customers.find(customer => normalizeCompanyName(customer.companyName) === company) : undefined
}

export function findDuplicateInvoice(invoices: Invoice[], identity: { invoiceNumber: string; customerId: string; date: string }) {
  const number = identity.invoiceNumber.trim().toLowerCase()
  return invoices.find(invoice => invoice.customerId === identity.customerId && invoice.invoiceNumber.trim().toLowerCase() === number && invoice.date === identity.date)
}

export function findDuplicateCreditNote(creditNotes: CreditNote[], identity: { creditNumber: string; customerId: string; date: string }) {
  const number = identity.creditNumber.trim().toLowerCase()
  return creditNotes.find(note => note.customerId === identity.customerId && note.creditNumber.trim().toLowerCase() === number && note.date === identity.date)
}

export function findCreditInvoiceMatch(invoices: Invoice[], customerId: string, referencedInvoiceNumber = '') {
  const reference = normalizeAccountNumber(referencedInvoiceNumber)
  if (!reference) return undefined
  return invoices.find(invoice => invoice.customerId === customerId && normalizeAccountNumber(invoice.invoiceNumber) === reference)
}
