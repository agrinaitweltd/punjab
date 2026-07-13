import type {
  ActivityLog, AdminStaff, Customer, DeliveryArea,
  Invoice, Order, Payment, Product, StockItem, SupportTicket, User,
} from "../types"

// ─────────────────────────────────────────────────────────────
// All demo/mock business data has been removed — the app runs on
// live Supabase data. Only the admin login roster and the default
// delivery areas remain as offline fallbacks.
// ─────────────────────────────────────────────────────────────

export const mockAdmins: AdminStaff[] = [
  {
    id: "adm-owner",
    name: "Owner Admin",
    email: "owner@punjabfoods.co.uk",
    password: "admin123",
    role: "Owner",
    active: true,
    isSuperAdmin: true,
    permissions: {
      customers: true, prices: true, stock: true, orders: true, enquiries: true,
      tickets: true, payments: true, complaints: true, extracts: true,
      stats: true, admins: true, products: true,
    },
  },
  {
    id: "adm-001",
    name: "Sarah Johnson",
    email: "sarah@punjabfoods.co.uk",
    password: "staff123",
    role: "Manager",
    active: true,
    isSuperAdmin: false,
    permissions: {
      customers: true, prices: true, stock: true, orders: true, enquiries: false,
      tickets: true, payments: true, complaints: true, extracts: true,
      stats: true, admins: false, products: true,
    },
  },
]

export const mockCustomers: Customer[] = []
export const mockProducts: Product[] = []
export const mockStock: StockItem[] = []
export const mockOrders: Order[] = []
export const mockInvoices: Invoice[] = []
export const mockPayments: Payment[] = []
export const mockTickets: SupportTicket[] = []
export const mockActivity: ActivityLog[] = []

export const mockDeliveryAreas: DeliveryArea[] = [
  { id: "da-001", name: "Birmingham", chargePerPallet: 65.00 },
  { id: "da-002", name: "London", chargePerPallet: 85.00 },
  { id: "da-003", name: "Manchester", chargePerPallet: 75.00 },
  { id: "da-004", name: "Leeds", chargePerPallet: 70.00 },
  { id: "da-005", name: "Leicester", chargePerPallet: 65.00 },
]

export const mockUsers: User[] = []
