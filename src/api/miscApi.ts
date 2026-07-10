import type { AdminStaff, PermissionSet } from '../types'
import { databaseService } from '../services/databaseService'

export function getActivity()      { return databaseService.getActivity() }
export function getInvoices()      { return databaseService.getInvoices() }
export function getPayments()      { return databaseService.getPayments() }
export function getTickets()       { return databaseService.getTickets() }
export function getDeliveryAreas() { return databaseService.getDeliveryAreas() }
export function getAdmins()        { return databaseService.getAdmins() }

export function createTicket(subject: string, message: string, customerId?: string) {
  return databaseService.createTicket({
    createdByRole: customerId ? 'customer' : 'admin',
    customerId,
    subject,
    message,
  })
}

export function createAdmin(name: string, email: string, password: string, role: string, permissions: PermissionSet) {
  return databaseService.createAdmin({ name, email, password, role, active: true, isSuperAdmin: false, permissions })
}
export function updateAdmin(id: string, input: Partial<AdminStaff>) {
  return databaseService.updateAdmin(id, input)
}
export function deleteAdmin(id: string)                          { return databaseService.deleteAdmin(id) }
export function toggleAdminActive(id: string, active: boolean)  { return databaseService.toggleAdminActive(id, active) }

export function createDeliveryArea(name: string, charge: number) { return databaseService.createDeliveryArea(name, charge) }
export function updateDeliveryArea(id: string, name: string, charge: number) { return databaseService.updateDeliveryArea(id, name, charge) }
export function deleteDeliveryArea(id: string)                   { return databaseService.deleteDeliveryArea(id) }

