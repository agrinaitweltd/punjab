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
    name: "Punjab Exotic Foods",
    email: "info@punjabexoticfoods.com",
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
  { id: "da-001", name: "Greater London", chargePerPallet: 85.00 },
  { id: "da-002", name: "Essex", chargePerPallet: 80.00 },
  { id: "da-003", name: "Kent", chargePerPallet: 80.00 },
  { id: "da-004", name: "Surrey", chargePerPallet: 80.00 },
  { id: "da-005", name: "Hertfordshire", chargePerPallet: 78.00 },
  { id: "da-006", name: "Buckinghamshire", chargePerPallet: 78.00 },
  { id: "da-007", name: "Berkshire", chargePerPallet: 78.00 },
  { id: "da-008", name: "Oxfordshire", chargePerPallet: 78.00 },
  { id: "da-009", name: "Cambridgeshire", chargePerPallet: 78.00 },
  { id: "da-010", name: "Bedfordshire", chargePerPallet: 75.00 },
  { id: "da-011", name: "Northamptonshire", chargePerPallet: 75.00 },
  { id: "da-012", name: "Birmingham", chargePerPallet: 65.00 },
  { id: "da-013", name: "Manchester", chargePerPallet: 75.00 },
  { id: "da-014", name: "Liverpool", chargePerPallet: 75.00 },
  { id: "da-015", name: "Leeds", chargePerPallet: 70.00 },
  { id: "da-016", name: "Sheffield", chargePerPallet: 70.00 },
  { id: "da-017", name: "Nottingham", chargePerPallet: 68.00 },
  { id: "da-018", name: "Leicester", chargePerPallet: 65.00 },
  { id: "da-019", name: "Bristol", chargePerPallet: 75.00 },
  { id: "da-020", name: "Cardiff", chargePerPallet: 82.00 },
  { id: "da-021", name: "Edinburgh", chargePerPallet: 95.00 },
  { id: "da-022", name: "Glasgow", chargePerPallet: 95.00 },
  { id: "da-023", name: "Newcastle", chargePerPallet: 85.00 },
  { id: "da-024", name: "Southampton", chargePerPallet: 78.00 },
  { id: "da-025", name: "Portsmouth", chargePerPallet: 78.00 },
  { id: "da-026", name: "Brighton", chargePerPallet: 80.00 },
  { id: "da-027", name: "Milton Keynes", chargePerPallet: 75.00 },
  { id: "da-028", name: "Coventry", chargePerPallet: 68.00 },
  { id: "da-029", name: "Wolverhampton", chargePerPallet: 68.00 },
  { id: "da-030", name: "Reading", chargePerPallet: 78.00 },
  { id: "da-031", name: "Slough", chargePerPallet: 78.00 },
  { id: "da-032", name: "Luton", chargePerPallet: 75.00 },
]

export const mockUsers: User[] = []
