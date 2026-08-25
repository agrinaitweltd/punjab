import { createAdmin, deleteAdmin, getAdmins, getAdminRoles, logActivity, toggleAdminActive, updateAdmin } from '../services/adminService'
import { createDeliveryArea, deleteDeliveryArea, getDeliveryAreas, updateDeliveryArea } from '../services/deliveryService'
import { createTicket, getTickets, updateTicketStatus } from '../services/ticketService'
import { getActivity } from '../services/activityService'
import { getInvoices, getPayments, createInvoice, createPayment, updateInvoice, importStatementInvoices } from '../services/invoiceService'
import { getCreditNotes, getCreditNoteAllocations, createCreditNote, updateCreditNote, applyCreditNoteToInvoice } from '../services/creditNoteService'
import { getCustomerApplications, createCustomerApplication, updateCustomerApplication } from '../services/customerApplicationService'
import { getBuyingSessions, getOrCreateBuyingSession, updateBuyingSession, getBuyingPrices, createBuyingPrice, updateBuyingPrice, deleteBuyingPrice } from '../services/buyingDeskService'
import { getNotificationLogs, createNotificationLog, updateNotificationLog } from '../services/notificationService'
import { getSuppliers, createSupplier, updateSupplier, deleteSupplier } from '../services/supplierService'
import { getDayTrades, createDayTrade } from '../services/dayTradeService'
import { getSalesmen, createSalesman, updateSalesman, deleteSalesman } from '../services/salesmanService'
import { getAssignedTasks, createAssignedTask, updateAssignedTaskStatus } from '../services/assignedTaskService'
import { getCustomerSubAccounts, createCustomerSubAccount, updateCustomerSubAccount, deleteCustomerSubAccount } from '../services/customerSubAccountService'
import { getWhatsAppLogs, createWhatsAppLog, updateWhatsAppLog, getWhatsAppTemplates, createWhatsAppTemplate, updateWhatsAppTemplate } from '../services/whatsappService'

export { getActivity, getInvoices, getPayments, createInvoice, createPayment, updateInvoice, importStatementInvoices }
export { getTickets, createTicket, updateTicketStatus }
export { getDeliveryAreas, createDeliveryArea, updateDeliveryArea, deleteDeliveryArea }
export { getAdmins, createAdmin, updateAdmin, deleteAdmin, toggleAdminActive, getAdminRoles, logActivity }
export { getCreditNotes, getCreditNoteAllocations, createCreditNote, updateCreditNote, applyCreditNoteToInvoice }
export { getCustomerApplications, createCustomerApplication, updateCustomerApplication }
export { getBuyingSessions, getOrCreateBuyingSession, updateBuyingSession, getBuyingPrices, createBuyingPrice, updateBuyingPrice, deleteBuyingPrice }
export { getNotificationLogs, createNotificationLog, updateNotificationLog }
export { getSuppliers, createSupplier, updateSupplier, deleteSupplier }
export { getDayTrades, createDayTrade }
export { getSalesmen, createSalesman, updateSalesman, deleteSalesman }
export { getAssignedTasks, createAssignedTask, updateAssignedTaskStatus }
export { getCustomerSubAccounts, createCustomerSubAccount, updateCustomerSubAccount, deleteCustomerSubAccount }
export { getWhatsAppLogs, createWhatsAppLog, updateWhatsAppLog, getWhatsAppTemplates, createWhatsAppTemplate, updateWhatsAppTemplate }

export function createTicketForCustomer(subject: string, message: string, customerId: string) {
  return createTicket('customer', customerId, subject, message)
}

