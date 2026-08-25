import type { CreditNote, CreditNoteAllocation } from "../types"
import { databaseService } from "./databaseService"
import { supabaseReady } from "../lib/supabase"
import { nextCreditNumber } from "../lib/creditNotes"

let creditNotes: CreditNote[] = []
let allocations: CreditNoteAllocation[] = []

export async function getCreditNotes(): Promise<CreditNote[]> {
  if (supabaseReady) return databaseService.getCreditNotes()
  await new Promise(r => setTimeout(r, 100))
  return [...creditNotes].sort((a, b) => b.date.localeCompare(a.date))
}

export async function getCreditNoteAllocations(): Promise<CreditNoteAllocation[]> {
  if (supabaseReady) return databaseService.getCreditNoteAllocations()
  await new Promise(r => setTimeout(r, 100))
  return [...allocations]
}

export async function createCreditNote(
  input: Omit<CreditNote, "id" | "creditNumber"> & { creditNumber?: string },
): Promise<CreditNote> {
  const existing = supabaseReady ? await databaseService.getCreditNotes() : creditNotes
  const creditNumber = input.creditNumber?.trim() || nextCreditNumber(existing)
  if (existing.some(note => note.customerId === input.customerId && note.creditNumber.toLowerCase() === creditNumber.toLowerCase() && note.date === input.date)) {
    throw new Error(`Credit note ${creditNumber} has already been imported for this customer and date.`)
  }
  if (existing.some(note => note.creditNumber.toLowerCase() === creditNumber.toLowerCase())) {
    throw new Error(`Credit note ${creditNumber} already exists.`)
  }
  const full = { ...input, creditNumber }
  if (supabaseReady) return databaseService.createCreditNote(full)
  await new Promise(r => setTimeout(r, 100))
  const note: CreditNote = { ...full, id: `cn-${Date.now()}` }
  creditNotes.push(note)
  return note
}

export async function updateCreditNote(id: string, input: Partial<CreditNote>): Promise<CreditNote | null> {
  if (supabaseReady) return databaseService.updateCreditNote(id, input)
  await new Promise(r => setTimeout(r, 100))
  const idx = creditNotes.findIndex(c => c.id === id)
  if (idx === -1) return null
  creditNotes[idx] = { ...creditNotes[idx], ...input }
  return creditNotes[idx]
}

export async function applyCreditNoteToInvoice(creditNoteId: string, invoiceId: string, amount: number, date: string): Promise<void> {
  if (supabaseReady) return databaseService.applyCreditNote(creditNoteId, invoiceId, amount, date)
  const note = creditNotes.find(item => item.id === creditNoteId)
  if (!note) throw new Error('Credit note not found.')
  const rounded = Math.round(amount * 100) / 100
  if (rounded <= 0 || rounded > note.remainingBalance) throw new Error('Credit amount exceeds the available credit.')
  allocations.push({ id: `cna-${Date.now()}`, creditNoteId, invoiceId, amount: rounded, date })
  note.remainingBalance = Math.round((note.remainingBalance - rounded) * 100) / 100
  note.linkedInvoiceId ||= invoiceId
}
