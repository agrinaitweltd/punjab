import type { SupportTicket } from "../types"
import { mockTickets } from "../data/mockData"
import { databaseService } from "./databaseService"
import { supabaseReady } from "../lib/supabase"

let tickets = [...mockTickets]

function nextId() {
  const max = tickets.reduce((m, t) => {
    const n = parseInt(t.id.replace(/[^0-9]/g, "")) || 0
    return n > m ? n : m
  }, 0)
  return `t-${String(max + 1).padStart(3, "0")}`
}

export async function getTickets(): Promise<SupportTicket[]> {
  if (supabaseReady) return databaseService.getTickets()
  await new Promise(r => setTimeout(r, 100))
  return [...tickets].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export async function createTicket(
  createdByRole: SupportTicket["createdByRole"],
  customerId: string | undefined,
  subject: string,
  message: string
): Promise<SupportTicket> {
  if (supabaseReady) return databaseService.createTicket({ createdByRole, customerId, subject, message })
  await new Promise(r => setTimeout(r, 150))
  const ticket: SupportTicket = {
    id: nextId(),
    createdByRole,
    customerId,
    subject,
    message,
    status: "Open",
    createdAt: new Date().toISOString().slice(0, 16).replace("T", " "),
  }
  tickets.push(ticket)
  return ticket
}

export async function updateTicketStatus(id: string, status: SupportTicket["status"]): Promise<SupportTicket | null> {
  if (supabaseReady) return databaseService.updateTicket(id, { status })
  await new Promise(r => setTimeout(r, 100))
  const idx = tickets.findIndex(t => t.id === id)
  if (idx === -1) return null
  tickets[idx] = { ...tickets[idx], status }
  return tickets[idx]
}

export async function replyToTicket(id: string, message: string): Promise<SupportTicket | null> {
  if (supabaseReady) return databaseService.updateTicket(id, { message, status: "In Progress" })
  await new Promise(r => setTimeout(r, 100))
  const idx = tickets.findIndex(t => t.id === id)
  if (idx === -1) return null
  tickets[idx] = { ...tickets[idx], message, status: "In Progress" }
  return tickets[idx]
}
