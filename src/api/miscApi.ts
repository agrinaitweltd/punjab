import { createAdmin, deleteAdmin, getAdmins, getAdminRoles, logActivity, toggleAdminActive, updateAdmin } from '../services/adminService'
import { createDeliveryArea, deleteDeliveryArea, getDeliveryAreas, updateDeliveryArea } from '../services/deliveryService'
import { createTicket, getTickets, updateTicketStatus } from '../services/ticketService'
import { getActivity } from '../services/activityService'
import { getInvoices, getPayments, createInvoice, createPayment, updateInvoice, importStatementInvoices } from '../services/invoiceService'

export { getActivity, getInvoices, getPayments, createInvoice, createPayment, updateInvoice, importStatementInvoices }
export { getTickets, createTicket, updateTicketStatus }
export { getDeliveryAreas, createDeliveryArea, updateDeliveryArea, deleteDeliveryArea }
export { getAdmins, createAdmin, updateAdmin, deleteAdmin, toggleAdminActive, getAdminRoles, logActivity }

export function createTicketForCustomer(subject: string, message: string, customerId: string) {
  return createTicket('customer', customerId, subject, message)
}

