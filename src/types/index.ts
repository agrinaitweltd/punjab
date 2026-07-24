export type UserRole = 'admin' | 'customer'

export interface PermissionSet {
  customers: boolean
  prices: boolean
  stock: boolean
  orders: boolean
  enquiries: boolean
  tickets: boolean
  payments: boolean
  complaints: boolean
  extracts: boolean
  stats: boolean
  admins: boolean
  products: boolean
  // Granular action-level flags — module flags above control page/nav
  // visibility, these control specific dangerous or role-restricted actions
  // within a page. Optional + defaulted to false so existing admin rows
  // (created before these existed) don't silently gain new abilities.
  customersCreate?: boolean
  customersDelete?: boolean
  invoicesDelete?: boolean
  paymentsRecord?: boolean
  paymentsDelete?: boolean
  paymentsAllocate?: boolean
  buyingPricesEdit?: boolean
  creditNotesIssue?: boolean
  applicationsManage?: boolean
  usersManage?: boolean
}

/** A named, reusable permission template an admin account can be based on
    (e.g. "Salesperson", "Cashier"). Selecting one in the UI fills the
    permission grid with its defaults — the admin can still customise further,
    since the source of truth for enforcement is always the permissions
    stored on the admin_staff row, not the template itself. */
export interface AdminRole {
  id: string
  name: string
  description: string
  permissions: PermissionSet
  isSystem: boolean
}

export interface User {
  id: string
  role: UserRole
  username: string
  email: string
  displayName: string
  customerNumber?: string
  isSuperAdmin?: boolean
  permissions?: PermissionSet
}

export interface Customer {
  id: string
  companyName: string
  contactPerson: string
  email: string
  phone: string
  customerNumber: string
  password: string
  address: string
  deliveryArea: string
  paymentTerms: string
  balance: number
  status: 'active' | 'inactive'
  lastActivity: string
  creditLimit?: number
  creditDays?: number
  blocked?: boolean
  vatNumber?: string
  registeredAddress?: string
  notes?: string
}

export interface Product {
  id: string
  productName: string
  category: string
  variety: string
  size: string
  sku: string
  boxesPerPallet: number
  productImage: string
}

export interface StockItem {
  id: string
  productId: string
  availableQuantity: number
  price: number
  lastUpdated: string
  status: 'available' | 'low' | 'out'
}

export type OrderStatus =
  | 'Pending'
  | 'Confirmed'
  | 'Preparing'
  | 'Delivered'
  | 'Cancelled'

export interface OrderItem {
  productId: string
  quantity: number
  unitPrice: number
}

export interface Order {
  id: string
  orderNumber: string
  customerId: string
  customerName: string
  date: string
  amount: number
  status: OrderStatus
  items: OrderItem[]
  fulfilment?: 'Delivery' | 'Collection'
  deliveryAddress?: string
}

export interface Invoice {
  id: string
  customerId: string
  invoiceNumber: string
  amount: number
  dueDate: string
  status: 'Unpaid' | 'Part Paid' | 'Paid'
  /** Issue date (from the imported statement or order date) — used with the
      customer's creditDays to work out when the invoice becomes overdue. */
  date?: string
  /** Total paid so far via payments and/or applied credit notes. amount -
      amountPaid is the outstanding balance shown on statements. */
  amountPaid?: number
}

export interface Payment {
  id: string
  customerId: string
  paymentReference: string
  amount: number
  date: string
  method: string
  /** The specific invoice this payment was allocated to, if any — lets a
      statement show a per-invoice payment history rather than just a flat
      list of payments for the whole account. */
  invoiceId?: string
}

/** Option A: issued against a specific invoice (reduces its balance
    immediately). Option B: a standalone "account credit" (no linkedInvoiceId)
    that sits on the customer's account until applied to a future invoice via
    a CreditNoteAllocation. */
export interface CreditNote {
  id: string
  creditNumber: string
  customerId: string
  amount: number
  reason: string
  date: string
  linkedTicketId?: string
  linkedInvoiceId?: string
  status: 'Active' | 'Void'
  /** How much of `amount` hasn't been applied to an invoice yet. */
  remainingBalance: number
}

/** One application of a credit note's balance against a specific invoice —
    kept as its own rows (rather than just decrementing a total) so both the
    credit note and the invoice have an auditable history of exactly when and
    how much was applied. */
export interface CreditNoteAllocation {
  id: string
  creditNoteId: string
  invoiceId: string
  amount: number
  date: string
}

export interface CustomerApplication {
  id: string
  companyName: string
  contactName: string
  email: string
  phone: string
  registeredAddress: string
  status: "Pending" | "Approved" | "Rejected"
  notes?: string
  date: string
}

export interface BuyingSession {
  id: string
  date: string
  status: 'Open' | 'Closed'
  publishedAt?: string
}

export interface BuyingPrice {
  id: string
  sessionId: string
  date: string
  supplier: string
  product: string
  variety: string
  brand: string
  size: string
  unit: string
  price: number
  quantity: number
  notes?: string
  confirmed: boolean
}

export interface NotificationLog {
  id: string
  invoiceId: string
  customerId: string
  channel: 'email' | 'whatsapp'
  status: 'Sent' | 'Failed' | 'Scheduled'
  scheduledFor?: string
  sentAt?: string
  error?: string
}

export interface SupportTicket {
  id: string
  createdByRole: UserRole
  customerId?: string
  subject: string
  message: string
  status: 'Open' | 'In Progress' | 'Closed'
  createdAt: string
}

export interface ActivityLog {
  id: string
  customerName: string
  action: string
  timestamp: string
}

export interface DeliveryArea {
  id: string
  name: string
  chargePerPallet: number
}

export interface AdminStaff {
  id: string
  name: string
  email: string
  password: string
  role: string
  jobTitle?: string
  active: boolean
  isSuperAdmin?: boolean
  permissions: PermissionSet
}
