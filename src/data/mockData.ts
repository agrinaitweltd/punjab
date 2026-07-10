/**
 * Mock data — CLEARED for Supabase integration.
 * Only auth credentials kept so login still works during development.
 * Replace databaseService.ts with Supabase queries when ready.
 */
import type {
  ActivityLog, AdminStaff, Customer, DeliveryArea,
  Invoice, Order, Payment, Product, StockItem, SupportTicket, User,
} from "../types"

// ── Auth (keep these until you wire Supabase Auth) ──────────────────
export const mockUsers: User[] = [
  {
    id: "u-admin-1",
    role: "admin",
    username: "admin",
    email: "admin@punjabfoods.co.uk",
    displayName: "Owner Admin",
    isSuperAdmin: true,
    permissions: {
      customers: true, prices: true, stock: true, orders: true,
      enquiries: true, tickets: true, payments: true, complaints: true,
      extracts: true, stats: true, admins: true, products: true,
    },
  },
  {
    id: "u-customer-1",
    role: "customer",
    username: "cust001",
    email: "buyer@greenmarket.co.uk",
    customerNumber: "CUST-001",
    displayName: "Green Market Buyer",
  },
]

// ── All business data cleared — ready for Supabase ──────────────────
export const mockCustomers:     Customer[]     = []
export const mockProducts:      Product[]      = []
export const mockStock:         StockItem[]    = []
export const mockOrders:        Order[]        = []
export const mockInvoices:      Invoice[]      = []
export const mockPayments:      Payment[]      = []
export const mockTickets:       SupportTicket[] = []
export const mockActivity:      ActivityLog[]  = []
export const mockDeliveryAreas: DeliveryArea[] = []
export const mockAdmins: AdminStaff[] = [
  {
    id: "adm-1",
    name: "Owner Admin",
    email: "admin@punjabfoods.co.uk",
    password: "admin123",
    role: "Owner",
    active: true,
    isSuperAdmin: true,
    permissions: {
      customers: true, prices: true, stock: true, orders: true,
      enquiries: true, tickets: true, payments: true, complaints: true,
      extracts: true, stats: true, admins: true, products: true,
    },
  },
]