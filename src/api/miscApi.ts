import type { PermissionSet } from '../types'
import { databaseService } from '../services/databaseService'

export function getActivity() {
  return databaseService.getActivity()
}

export function getInvoices() {
  return databaseService.getInvoices()
}

export function getPayments() {
  return databaseService.getPayments()
}

export function getTickets() {
  return databaseService.getTickets()
}

export function createTicket(subject: string, message: string, customerId?: string) {
  return databaseService.createTicket({
    createdByRole: customerId ? 'customer' : 'admin',
    customerId,
    subject,
    message,
  })
}

export function getDeliveryAreas() {
  return databaseService.getDeliveryAreas()
}

export function getAdmins() {
  return databaseService.getAdmins()
}

export function createAdmin(name: string, email: string, password: string, role: string, permissions: PermissionSet) {
  return databaseService.createAdmin({
    name,
    email,
    password,
    role,
    permissions,
  })
}

