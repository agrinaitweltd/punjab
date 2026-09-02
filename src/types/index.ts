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
  customersEdit?: boolean
  invoicesView?: boolean
  invoicesSendReminders?: boolean
  invoicesViewPdfs?: boolean
  emailImportsView?: boolean
  emailImportsReview?: boolean
  filesView?: boolean
  filesDownload?: boolean
  communicationsView?: boolean
  communicationsSend?: boolean
  statementsView?: boolean
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
  isSystemDeveloper?: boolean
  permissions?: PermissionSet
  /** Set once the first-time guided tour is finished or skipped - null/
      undefined means it should auto-start on this login. Untouched by a
      manual "Watch Tutorial Again" replay from Settings. */
  tutorialCompletedAt?: string | null
  /** Set when this session is a customer's sub-account rather than the main
      login — `id` above is still the parent customer's id (so all data
      loads scoped to them), this just narrows what the portal shows. */
  subAccount?: { id: string; name: string; permissions: SubAccountPermissions }
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
  salesmanId?: string
  salesmanName?: string
  /** Soft-deleted customers are hidden from the main list but kept for restore. */
  archived?: boolean
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
  /** What we pay per unit — used to compute profit throughout Analytics.
      Defaults to 0 (profit = revenue) until an admin sets it. */
  costPrice?: number
}

export interface StockItem {
  id: string
  productId: string
  availableQuantity: number
  price: number
  lastUpdated: string
  status: 'available' | 'low' | 'out'
  /** How it's packaged — pallets, bags, boxes, etc. — set when an admin
      publishes quantity & selling price for the first time. */
  packaging?: string
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
  /** The company's official invoice number, entered by staff at end of day
      via the Invoice Numbers page — separate from the billing Invoice record. */
  officialInvoiceNumber?: string
  salesmanId?: string
  salesmanName?: string
  /** Set the moment an admin marks the order Delivered — starts the 20-hour
      window customers have to report a quality issue (or confirm there isn't one). */
  deliveredAt?: string
  /** Whether the customer confirmed the delivery was fine or flagged an issue,
      within the 20-hour window. Absent until they respond. */
  deliveryConfirmation?: 'ok' | 'issue'
  deliveryConfirmedAt?: string
}

/** Hours a customer has, after an order is marked Delivered, to confirm it
    arrived fine or report a quality issue. After this the window is locked. */
export const DELIVERY_COMPLAINT_WINDOW_HOURS = 20

/** A sales login account — logs into the Sales module with number + username
    + code (not a full admin account). One or more of these can be linked to
    an admin (AdminStaff.salesmanIds) so that admin reviews their orders. */
export interface Salesman {
  id: string
  number: string
  username: string
  name: string
  code: string
}

/** A task an admin assigns to another admin — emails the assignee and shows
    up in their Assign Task list until marked done. */
export interface AssignedTask {
  id: string
  title: string
  description: string
  assignedToId: string
  assignedToName: string
  assignedByName: string
  status: 'Open' | 'Done'
  createdAt: string
}

/** What a customer's sub-account (an employee login) is allowed to do in the
    portal — the main customer login always has all of these. */
export interface SubAccountPermissions {
  placeOrders: boolean
  viewOrders: boolean
  viewInvoicesBalance: boolean
  raiseTickets: boolean
  viewDocuments: boolean
}

/** An employee login a customer has invited onto their account. Needs
    super-admin approval before it can log in. Logging in with one loads the
    same customer's data (customerId), scoped by `permissions`. */
export interface CustomerSubAccount {
  id: string
  customerId: string
  customerName: string
  name: string
  email: string
  password: string
  permissions: SubAccountPermissions
  status: 'Pending' | 'Approved' | 'Rejected'
  active: boolean
  createdAt: string
}

export interface DayTrade {
  id: string
  date: string
  totalSales: number
  totalProfit: number
  saleCount: number
  closedAt: string
  closedBy: string
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
  /** Cash payments applied to this invoice. Credit-note allocations are kept
      separately and exposed through `creditApplied`. */
  amountPaid?: number
  /** Derived from credit_note_allocations when invoices are loaded. */
  creditApplied?: number
  /** Archived legacy upload and the regenerated official PDF used by every
      customer download and reminder workflow. */
  sourceDocumentId?: string
  canonicalDocumentId?: string
  canonicalPdfFileName?: string
  canonicalPdfGeneratedAt?: string
  /** Which renderer actually produced the generated PDF - 'ConvertAPI' is
      the official Word-template render; anything else means the converter
      was down and this invoice only has the basic pdf-lib fallback (item
      10 - see imported_metadata.pdfGenerationPending/pdfGenerationError). */
  canonicalPdfProvider?: string
  totalGoods?: number
  totalVat?: number
  packages?: number
  importedMetadata?: Record<string, unknown>
  /** 24-hour reminder cooldown (item 2) - set atomically server-side by
      reserve_invoice_reminder_slot() whenever a reminder is successfully
      sent for this invoice, whatever the stage. Reading these directly off
      the already-loaded invoice means every page that has `invoices` can
      show correct cooldown state with no extra query, and a fresh load
      always reflects another admin's send. */
  lastReminderSentAt?: string
  lastReminderStage?: string
  lastReminderSentBy?: string
  lastReminderRecipient?: string
  lastReminderProviderMessageId?: string
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

export interface Expense {
  id: string
  title: string
  category: string
  supplier: string
  amount: number
  currency: string
  expenseDate: string
  description: string
  paymentMethod: string
  reference: string
  recordedBy: string
  createdAt: string
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
  originalInvoiceReference?: string
  totalGoods?: number
  totalVat?: number
  sourceDocumentId?: string
  sourceFileName?: string
  importedMetadata?: Record<string, unknown>
  createdBy?: string
  createdAt?: string
}

export interface CreditNoteItem {
  id?: string
  creditNoteId: string
  line: string
  quantity: number
  product: string
  variety: string
  size: string
  price: number
  goodsValue: number
  vatCode: string
  vatRate: number
  vatAmount: number
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
  brand: string
  size: string
  price: number
  notes?: string
  confirmed: boolean
}

export interface Supplier {
  id: string
  name: string
  contact: string
  country: string
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
  /** Which reminder stage this send belongs to - 'day-14' | 'day-21' |
      'overdue-N' | 'due-today' | 'seven-days-before-due' | undefined for
      older rows sent before this was tracked. Written by the cron's
      reminderStage() and by the manual reminder composer. */
  reminderStage?: string
  idempotencyKey?: string
  /** Admin display name who triggered a manual send; absent for
      automated/cron sends. */
  sentBy?: string
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

export type WhatsAppMessageType =
  | 'Invoice Created' | 'Payment Reminder' | 'Payment Received'
  | 'Order Confirmed' | 'Order Packed' | 'Order Dispatched' | 'Order Delivered'
  | 'Account Approved' | 'Account Suspended' | 'Custom'

/** One WhatsApp send attempt via UltraMsg — logged whether it succeeds or
    fails, so Retry can resend the exact same message. */
export type NotificationTargetType = 'customer' | 'invoice' | 'payment' | 'credit_note' | 'email_import' | 'system'
export interface AppNotification {
  id: string
  type: string
  title: string
  message?: string
  targetType?: NotificationTargetType
  targetId?: string
  read: boolean
  createdBy?: string
  createdAt: string
}

export interface WhatsAppLog {
  id: string
  customerId?: string
  customerName?: string
  phone: string
  message: string
  type: WhatsAppMessageType
  status: 'Sent' | 'Failed' | 'Pending'
  response?: string
  sentAt?: string
  createdBy: string
}

/** A reusable message body for a given trigger type — {{placeholders}} are
    filled in per-send (customer name, invoice number, amount, etc.). */
export interface WhatsAppTemplate {
  id: string
  name: string
  type: WhatsAppMessageType
  message: string
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
  /** Whether this admin also has one or more Sales Users login accounts
      linked to them (for reviewing that salesman's orders). */
  isSalesman?: boolean
  salesmanIds?: string[]
  /** 'Pending' | 'Sent' | 'Accepted' | 'Failed' | 'Revoked' - set by
      invite-admin.js/reset-admin-credentials.js/manage-admin.js, cleared to
      'Accepted' by complete-account-setup.js once the invited user sets
      their password. Drives the Status column in AdminsPage. */
  invitationStatus?: string
  lastInvitedAt?: string
}
