import { createAdmin, deleteAdmin, getAdmins, toggleAdminActive, updateAdmin } from '../services/adminService'
import { createDeliveryArea, deleteDeliveryArea, getDeliveryAreas, updateDeliveryArea } from '../services/deliveryService'
import { createTicket, getTickets, updateTicketStatus } from '../services/ticketService'
import { getActivity } from '../services/activityService'
import { getInvoices, getPayments } from '../services/invoiceService'

export { getActivity, getInvoices, getPayments }
export { getTickets, createTicket, updateTicketStatus }
export { getDeliveryAreas, createDeliveryArea, updateDeliveryArea, deleteDeliveryArea }
export { getAdmins, createAdmin, updateAdmin, deleteAdmin, toggleAdminActive }

export function createTicketForCustomer(subject: string, message: string, customerId: string) {
  return createTicket('customer', customerId, subject, message)
}

