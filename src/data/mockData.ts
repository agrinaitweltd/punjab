/**
 * All mock data cleared — Supabase is the source of truth.
 * Auth uses the admin_staff and customers tables in Supabase.
 */
import type {
  ActivityLog, AdminStaff, Customer, DeliveryArea,
  Invoice, Order, Payment, Product, StockItem, SupportTicket, User,
} from "../types"

export const mockUsers:         User[]          = []
export const mockCustomers:     Customer[]      = []
export const mockProducts:      Product[]       = []
export const mockStock:         StockItem[]     = []
export const mockOrders:        Order[]         = []
export const mockInvoices:      Invoice[]       = []
export const mockPayments:      Payment[]       = []
export const mockTickets:       SupportTicket[] = []
export const mockActivity:      ActivityLog[]   = []
export const mockDeliveryAreas: DeliveryArea[]  = []
export const mockAdmins:        AdminStaff[]    = []