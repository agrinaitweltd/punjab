import { supabase as _sb } from "../lib/supabase"
import type {
  ActivityLog, AdminRole, AdminStaff, BuyingPrice, BuyingSession, Customer, CreditNote, CreditNoteAllocation, CustomerApplication, DayTrade, DeliveryArea,
  Invoice, NotificationLog, Order, Payment, Product, StockItem, Supplier, SupportTicket,
} from "../types"

function genId(prefix: string) { return `${prefix}-${Date.now()}` }
function db() {
  if (!_sb) throw new Error("Supabase not connected — run schema.sql first")
  return _sb
}

// ── Field mappers: snake_case DB rows → camelCase TS types ──────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapCustomer(r: any): Customer {
  return {
    id: r.id, companyName: r.company_name, contactPerson: r.contact_person,
    email: r.email, phone: r.phone, customerNumber: r.customer_number,
    password: r.password, address: r.address, deliveryArea: r.delivery_area,
    paymentTerms: r.payment_terms, balance: r.balance ?? 0,
    status: r.status ?? "active", lastActivity: r.last_activity ?? "",
    creditLimit: r.credit_limit ?? 0, creditDays: r.credit_days ?? 14,
    blocked: r.blocked ?? false,
    vatNumber: r.vat_number ?? undefined, registeredAddress: r.registered_address ?? undefined,
    notes: r.notes ?? undefined,
    salesmanId: r.salesman_id ?? undefined, salesmanName: r.salesman_name ?? undefined,
  }
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapProduct(r: any): Product {
  return {
    id: r.id, productName: r.product_name, category: r.category ?? "",
    variety: r.variety ?? "", size: r.size ?? "", sku: r.sku,
    boxesPerPallet: r.boxes_per_pallet ?? 0, productImage: r.product_image ?? "",
    costPrice: r.cost_price ?? 0,
  }
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapStock(r: any): StockItem {
  return {
    id: r.id, productId: r.product_id, availableQuantity: r.available_quantity ?? 0,
    price: r.price ?? 0, lastUpdated: r.last_updated ?? "", status: r.status ?? "available",
    packaging: r.packaging ?? undefined,
  }
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapOrder(r: any): Order {
  return {
    id: r.id, orderNumber: r.order_number, customerId: r.customer_id ?? "",
    customerName: r.customer_name ?? "", date: r.date ?? "",
    amount: r.amount ?? 0, status: r.status ?? "Pending", items: r.items ?? [],
    fulfilment: r.fulfilment === "Collection" ? "Collection" : "Delivery",
    deliveryAddress: r.delivery_address ?? "",
    officialInvoiceNumber: r.official_invoice_number ?? undefined,
    salesmanId: r.salesman_id ?? undefined, salesmanName: r.salesman_name ?? undefined,
  }
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapInvoice(r: any): Invoice {
  return {
    id: r.id, customerId: r.customer_id ?? "", invoiceNumber: r.invoice_number,
    amount: r.amount ?? 0, dueDate: r.due_date ?? "", status: r.status ?? "Unpaid",
    date: r.date ?? r.due_date ?? "", amountPaid: r.amount_paid ?? 0,
  }
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapPayment(r: any): Payment {
  return {
    id: r.id, customerId: r.customer_id ?? "", paymentReference: r.payment_reference,
    amount: r.amount ?? 0, date: r.date ?? "", method: r.method ?? "",
    invoiceId: r.invoice_id ?? undefined,
  }
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapCreditNote(r: any): CreditNote {
  return {
    id: r.id, creditNumber: r.credit_number, customerId: r.customer_id ?? "",
    amount: r.amount ?? 0, reason: r.reason ?? "", date: r.date ?? "",
    linkedTicketId: r.linked_ticket_id ?? undefined, linkedInvoiceId: r.linked_invoice_id ?? undefined,
    status: r.status ?? "Active", remainingBalance: r.remaining_balance ?? 0,
  }
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapCreditNoteAllocation(r: any): CreditNoteAllocation {
  return { id: r.id, creditNoteId: r.credit_note_id, invoiceId: r.invoice_id, amount: r.amount ?? 0, date: r.date ?? "" }
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapBuyingSession(r: any): BuyingSession {
  return { id: r.id, date: r.date, status: r.status ?? "Open", publishedAt: r.published_at ?? undefined }
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapBuyingPrice(r: any): BuyingPrice {
  return {
    id: r.id, sessionId: r.session_id, date: r.date, supplier: r.supplier, product: r.product,
    brand: r.brand ?? "", size: r.size ?? "",
    price: r.price ?? 0, notes: r.notes ?? undefined, confirmed: r.confirmed ?? false,
  }
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapSupplier(r: any): Supplier {
  return { id: r.id, name: r.name, contact: r.contact ?? "", country: r.country ?? "" }
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapNotificationLog(r: any): NotificationLog {
  return {
    id: r.id, invoiceId: r.invoice_id, customerId: r.customer_id, channel: r.channel ?? "email",
    status: r.status ?? "Sent", scheduledFor: r.scheduled_for ?? undefined, sentAt: r.sent_at ?? undefined,
    error: r.error ?? undefined,
  }
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapDayTrade(r: any): DayTrade {
  return {
    id: r.id, date: r.date, totalSales: r.total_sales ?? 0, totalProfit: r.total_profit ?? 0,
    saleCount: r.sale_count ?? 0, closedAt: r.closed_at ?? "", closedBy: r.closed_by ?? "",
  }
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapCustomerApplication(r: any): CustomerApplication {
  return {
    id: r.id, companyName: r.company_name, contactName: r.contact_name, email: r.email,
    phone: r.phone ?? "", registeredAddress: r.registered_address ?? "",
    status: r.status ?? "Pending", notes: r.notes ?? undefined, date: r.date ?? "",
  }
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapTicket(r: any): SupportTicket {
  return {
    id: r.id, createdByRole: r.created_by_role ?? "customer",
    customerId: r.customer_id ?? "", subject: r.subject, message: r.message ?? "",
    status: r.status ?? "Open", createdAt: r.created_at ?? "",
  }
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapActivity(r: any): ActivityLog {
  return { id: r.id, customerName: r.customer_name ?? "", action: r.action ?? "", timestamp: r.timestamp ?? "" }
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapDeliveryArea(r: any): DeliveryArea {
  return { id: r.id, name: r.name, chargePerPallet: r.charge_per_pallet ?? 0 }
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapAdmin(r: any): AdminStaff {
  return {
    id: r.id, name: r.name, email: r.email, password: r.password ?? "",
    role: r.role ?? "Staff", jobTitle: r.job_title ?? "", active: r.active ?? true,
    isSuperAdmin: r.is_super_admin ?? false, permissions: r.permissions ?? {},
  }
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapAdminRole(r: any): AdminRole {
  return {
    id: r.id, name: r.name, description: r.description ?? "",
    permissions: r.permissions ?? {}, isSystem: r.is_system ?? false,
  }
}

// ── camelCase input → snake_case for INSERT/UPDATE ───────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toCustomerRow(input: any) {
  const row: Record<string, unknown> = {
    company_name: input.companyName, contact_person: input.contactPerson,
    email: input.email, phone: input.phone, customer_number: input.customerNumber,
    password: input.password, address: input.address, delivery_area: input.deliveryArea,
    payment_terms: input.paymentTerms,
  }
  // Credit-control fields — only included when explicitly set, so updates
  // that don't touch them never send the keys at all.
  if (input.creditLimit !== undefined) row.credit_limit = input.creditLimit
  if (input.creditDays !== undefined) row.credit_days = input.creditDays
  if (input.blocked !== undefined) row.blocked = input.blocked
  if (input.balance !== undefined) row.balance = input.balance
  if (input.vatNumber !== undefined) row.vat_number = input.vatNumber
  if (input.registeredAddress !== undefined) row.registered_address = input.registeredAddress
  if (input.notes !== undefined) row.notes = input.notes
  if (input.salesmanId !== undefined) row.salesman_id = input.salesmanId
  if (input.salesmanName !== undefined) row.salesman_name = input.salesmanName
  return row
}

/** Strips the credit-control keys so a write can be retried against a DB
    where the migration (credit_limit / credit_days / blocked) hasn't run. */
function withoutCreditColumns(row: Record<string, unknown>) {
  const { credit_limit: _cl, credit_days: _cd, blocked: _b, ...rest } = row
  void _cl; void _cd; void _b
  return rest
}

/** Strips vat_number/registered_address/notes/salesman_* so a write can be
    retried against a DB where that migration hasn't run yet. */
function withoutCustomerProfileColumns(row: Record<string, unknown>) {
  const { vat_number: _vn, registered_address: _ra, notes: _n, salesman_id: _si, salesman_name: _sn, ...rest } = row
  void _vn; void _ra; void _n; void _si; void _sn
  return rest
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toProductRow(input: any) {
  const row: Record<string, unknown> = {
    product_name: input.productName, category: input.category, variety: input.variety,
    size: input.size, sku: input.sku, boxes_per_pallet: input.boxesPerPallet,
    product_image: input.productImage ?? "",
  }
  if (input.costPrice !== undefined) row.cost_price = input.costPrice
  return row
}

class SupabaseDatabaseService {

  // ── CUSTOMERS ──────────────────────────────────────────────────────
  async getCustomers(): Promise<Customer[]> {
    const { data, error } = await db().from("customers").select("*").order("company_name")
    if (error) { console.error("getCustomers", error); return [] }
    return (data ?? []).map(mapCustomer)
  }
  async createCustomer(input: Omit<Customer, "id" | "lastActivity" | "status" | "balance">): Promise<Customer> {
    const row = { id: genId("c"), ...toCustomerRow(input), last_activity: new Date().toISOString(), status: "active", balance: 0 }
    let { data, error } = await db().from("customers").insert(row).select().single()
    if (error && (error.code === "PGRST204" || /vat_number|registered_address|notes|salesman/.test(error.message ?? ""))) {
      ;({ data, error } = await db().from("customers").insert({ ...withoutCustomerProfileColumns(row), id: row.id }).select().single())
    }
    if (error && (error.code === "PGRST204" || /credit_limit|credit_days|blocked/.test(error.message ?? ""))) {
      ;({ data, error } = await db().from("customers").insert({ ...withoutCreditColumns(withoutCustomerProfileColumns(row)), id: row.id }).select().single())
    }
    if (error) throw error
    return mapCustomer(data)
  }
  async updateCustomer(id: string, input: Partial<Customer>): Promise<Customer | null> {
    const row = toCustomerRow(input)
    let { data, error } = await db().from("customers").update(row).eq("id", id).select().single()
    if (error && (error.code === "PGRST204" || /vat_number|registered_address|notes|salesman/.test(error.message ?? ""))) {
      const fallbackRow = withoutCustomerProfileColumns(row)
      if (Object.keys(fallbackRow).length === 0) { console.warn("updateCustomer: profile columns not migrated yet — skipped"); return null }
      ;({ data, error } = await db().from("customers").update(fallbackRow).eq("id", id).select().single())
    }
    // Retry without credit-control columns if the migration hasn't been run yet.
    if (error && (error.code === "PGRST204" || /credit_limit|credit_days|blocked/.test(error.message ?? ""))) {
      const fallbackRow = withoutCreditColumns(withoutCustomerProfileColumns(row))
      if (Object.keys(fallbackRow).length === 0) {
        // Nothing left to persist (e.g. only `blocked` was set) — this is an
        // expected no-op until the migration runs, not a real failure.
        console.warn("updateCustomer: credit-control columns not migrated yet — skipped, run schema.sql's alter table statements")
        return null
      }
      ;({ data, error } = await db().from("customers").update(fallbackRow).eq("id", id).select().single())
    }
    if (error) { console.error("updateCustomer", error); return null }
    return mapCustomer(data)
  }
  async deleteCustomer(id: string): Promise<boolean> {
    const { error } = await db().from("customers").delete().eq("id", id)
    return !error
  }

  // ── PRODUCTS ───────────────────────────────────────────────────────
  async getProducts(): Promise<Product[]> {
    const { data, error } = await db().from("products").select("*").order("product_name")
    if (error) { console.error("getProducts", error); return [] }
    return (data ?? []).map(mapProduct)
  }
  async createProduct(input: Omit<Product, "id">): Promise<Product> {
    const row: Record<string, unknown> = { id: genId("p"), ...toProductRow(input) }
    let { data, error } = await db().from("products").insert(row).select().single()
    if (error && (error.code === "PGRST204" || /cost_price/.test(error.message ?? ""))) {
      const { cost_price: _cp, ...fallbackRow } = row
      void _cp
      ;({ data, error } = await db().from("products").insert(fallbackRow).select().single())
    }
    if (error) throw error
    // Every product needs a stock row so it appears on the Stock page for pricing.
    const stockRow = { id: genId("s"), product_id: row.id, available_quantity: 0, price: 0, status: "out", last_updated: new Date().toLocaleString() }
    const { error: stockErr } = await db().from("stock_items").insert(stockRow)
    if (stockErr) console.error("createProduct stock row", stockErr)
    return mapProduct(data)
  }
  async updateProduct(id: string, input: Partial<Product>): Promise<Product | null> {
    const row = toProductRow(input)
    let { data, error } = await db().from("products").update(row).eq("id", id).select().single()
    if (error && (error.code === "PGRST204" || /cost_price/.test(error.message ?? ""))) {
      const { cost_price: _cp, ...fallbackRow } = row
      void _cp
      ;({ data, error } = await db().from("products").update(fallbackRow).eq("id", id).select().single())
    }
    if (error) { console.error("updateProduct", error); return null }
    return mapProduct(data)
  }
  async deleteProduct(id: string): Promise<boolean> {
    await db().from("stock_items").delete().eq("product_id", id)
    const { error } = await db().from("products").delete().eq("id", id)
    return !error
  }

  // ── STOCK ─────────────────────────────────────────────────────────
  async getStock(): Promise<StockItem[]> {
    const { data, error } = await db().from("stock_items").select("*")
    if (error) { console.error("getStock", error); return [] }
    return (data ?? []).map(mapStock)
  }
  async updateStock(id: string, input: Partial<StockItem>): Promise<StockItem | null> {
    const row: Record<string, unknown> = {
      available_quantity: input.availableQuantity,
      price: input.price,
      status: input.status,
      last_updated: new Date().toISOString(),
    }
    if (input.packaging !== undefined) row.packaging = input.packaging
    let { data, error } = await db().from("stock_items").update(row).eq("id", id).select().single()
    if (error && (error.code === "PGRST204" || /packaging/.test(error.message ?? ""))) {
      const { packaging: _p, ...fallbackRow } = row
      void _p
      ;({ data, error } = await db().from("stock_items").update(fallbackRow).eq("id", id).select().single())
    }
    if (error) { console.error("updateStock", error); return null }
    return mapStock(data)
  }

  // ── ORDERS ────────────────────────────────────────────────────────
  async getOrders(): Promise<Order[]> {
    const { data, error } = await db().from("orders").select("*").order("created_at", { ascending: false })
    if (error) { console.error("getOrders", error); return [] }
    return (data ?? []).map(mapOrder)
  }
  async createOrder(input: Omit<Order, "id" | "orderNumber" | "date" | "status">): Promise<Order> {
    const row = {
      id: genId("o"),
      order_number: `ORD-${Math.floor(1000 + Math.random() * 9000)}`,
      customer_id: input.customerId,
      customer_name: input.customerName,
      date: new Date().toISOString().slice(0, 10),
      amount: input.amount,
      status: "Pending",
      items: input.items,
      fulfilment: input.fulfilment ?? "Delivery",
      delivery_address: input.deliveryAddress ?? null,
      salesman_id: input.salesmanId ?? null,
      salesman_name: input.salesmanName ?? null,
    }
    let { data, error } = await db().from("orders").insert(row).select().single()
    // The "fulfilment"/"delivery_address"/"salesman_*" columns may not exist yet
    // if the schema migration hasn't been run — retry without them so checkout
    // still works rather than hard-failing the order.
    if (error && (error.message?.includes("fulfilment") || error.message?.includes("delivery_address") || error.message?.includes("salesman") || error.code === "PGRST204")) {
      const { fulfilment: _f, delivery_address: _d, salesman_id: _si, salesman_name: _sn, ...rowWithoutExtras } = row
      void _f; void _d; void _si; void _sn
      ;({ data, error } = await db().from("orders").insert(rowWithoutExtras).select().single())
    }
    if (error) throw error
    return mapOrder(data)
  }
  async updateOrder(id: string, input: Partial<Order>): Promise<Order | null> {
    const row: Record<string, unknown> = {}
    if (input.status !== undefined) row.status = input.status
    if (input.officialInvoiceNumber !== undefined) row.official_invoice_number = input.officialInvoiceNumber
    if (input.salesmanId !== undefined) row.salesman_id = input.salesmanId
    if (input.salesmanName !== undefined) row.salesman_name = input.salesmanName
    let { data, error } = await db().from("orders").update(row).eq("id", id).select().single()
    if (error && (error.code === "PGRST204" || /official_invoice_number|salesman/.test(error.message ?? ""))) {
      const { official_invoice_number: _oin, salesman_id: _si, salesman_name: _sn, ...fallbackRow } = row
      void _oin; void _si; void _sn
      if (Object.keys(fallbackRow).length === 0) { console.warn("updateOrder: columns not migrated yet — skipped"); return null }
      ;({ data, error } = await db().from("orders").update(fallbackRow).eq("id", id).select().single())
    }
    if (error) { console.error("updateOrder", error); return null }
    return mapOrder(data)
  }

  // ── INVOICES ──────────────────────────────────────────────────────
  async getInvoices(): Promise<Invoice[]> {
    const { data, error } = await db().from("invoices").select("*").order("due_date")
    if (error) { console.error("getInvoices", error); return [] }
    return (data ?? []).map(mapInvoice)
  }
  async createInvoice(input: Omit<Invoice, "id"> & { id?: string }): Promise<Invoice> {
    const row: Record<string, unknown> = {
      // An empty string customerId (orphaned order whose customer was deleted)
      // must become a real null — the FK constraint checks any non-null value
      // against customers, so "" would fail as "customer not found".
      id: input.id ?? genId("inv"), customer_id: input.customerId || null, invoice_number: input.invoiceNumber,
      amount: input.amount, due_date: input.dueDate, status: input.status,
    }
    if (input.date) row.date = input.date
    let { data, error } = await db().from("invoices").insert(row).select().single()
    // Retry without the issue-date column if that migration hasn't been run yet.
    if (error && (error.code === "PGRST204" || /column .*date/.test(error.message ?? "")) && "date" in row) {
      const { date: _d, ...rest } = row
      void _d
      ;({ data, error } = await db().from("invoices").insert(rest).select().single())
    }
    if (error) throw error
    return mapInvoice(data)
  }
  async updateInvoice(id: string, input: Partial<Invoice>): Promise<Invoice | null> {
    const row: Record<string, unknown> = {}
    if (input.status) row.status = input.status
    if (input.amount !== undefined) row.amount = input.amount
    if (input.dueDate) row.due_date = input.dueDate
    if (input.amountPaid !== undefined) row.amount_paid = input.amountPaid
    let { data, error } = await db().from("invoices").update(row).eq("id", id).select().single()
    if (error && (error.code === "PGRST204" || /amount_paid/.test(error.message ?? "")) && "amount_paid" in row) {
      const { amount_paid: _ap, ...rest } = row
      void _ap
      ;({ data, error } = await db().from("invoices").update(rest).eq("id", id).select().single())
    }
    if (error) { console.error("updateInvoice", error); return null }
    return mapInvoice(data)
  }

  // ── PAYMENTS ──────────────────────────────────────────────────────
  async getPayments(): Promise<Payment[]> {
    const { data, error } = await db().from("payments").select("*").order("date", { ascending: false })
    if (error) { console.error("getPayments", error); return [] }
    return (data ?? []).map(mapPayment)
  }
  async createPayment(input: Omit<Payment, "id">): Promise<Payment> {
    const row: Record<string, unknown> = {
      id: genId("pay"), customer_id: input.customerId || null, payment_reference: input.paymentReference,
      amount: input.amount, date: input.date, method: input.method,
    }
    if (input.invoiceId) row.invoice_id = input.invoiceId
    let { data, error } = await db().from("payments").insert(row).select().single()
    if (error && (error.code === "PGRST204" || /invoice_id/.test(error.message ?? "")) && "invoice_id" in row) {
      const { invoice_id: _iid, ...rest } = row
      void _iid
      ;({ data, error } = await db().from("payments").insert(rest).select().single())
    }
    if (error) throw error
    return mapPayment(data)
  }

  // ── TICKETS ───────────────────────────────────────────────────────
  async getTickets(): Promise<SupportTicket[]> {
    const { data, error } = await db().from("support_tickets").select("*").order("created_at", { ascending: false })
    if (error) { console.error("getTickets", error); return [] }
    return (data ?? []).map(mapTicket)
  }
  async updateTicket(id: string, input: Partial<SupportTicket>): Promise<SupportTicket | null> {
    const row: Record<string, unknown> = {}
    if (input.status) row.status = input.status
    if (input.message !== undefined) row.message = input.message
    const { data, error } = await db().from("support_tickets").update(row).eq("id", id).select().single()
    if (error) { console.error("updateTicket", error); return null }
    return mapTicket(data)
  }
  async createTicket(input: Omit<SupportTicket, "id" | "createdAt" | "status">): Promise<SupportTicket> {
    const row = {
      id: genId("t"),
      created_by_role: input.createdByRole,
      customer_id: input.customerId,
      subject: input.subject,
      message: input.message,
      status: "Open",
    }
    const { data, error } = await db().from("support_tickets").insert(row).select().single()
    if (error) throw error
    return mapTicket(data)
  }

  // ── ACTIVITY ──────────────────────────────────────────────────────
  async getActivity(): Promise<ActivityLog[]> {
    // FILE:/PAYPROOF:-prefixed rows are stored documents and payment proofs
    // (see lib/fileService, lib/paymentProofService) — not real activity.
    const { data, error } = await db().from("activity_log").select("*")
      .not("customer_name", "like", "FILE:%")
      .not("customer_name", "like", "PAYPROOF:%")
      .order("created_at", { ascending: false }).limit(50)
    if (error) { console.error("getActivity", error); return [] }
    return (data ?? []).map(mapActivity)
  }

  // ── DELIVERY AREAS ────────────────────────────────────────────────
  async getDeliveryAreas(): Promise<DeliveryArea[]> {
    const { data, error } = await db().from("delivery_areas").select("*").order("name")
    if (error) { console.error("getDeliveryAreas", error); return [] }
    return (data ?? []).map(mapDeliveryArea)
  }
  async createDeliveryArea(name: string, chargePerPallet: number): Promise<DeliveryArea> {
    const row = { id: genId("da"), name, charge_per_pallet: chargePerPallet }
    const { data, error } = await db().from("delivery_areas").insert(row).select().single()
    if (error) throw error
    return mapDeliveryArea(data)
  }
  async updateDeliveryArea(id: string, name: string, chargePerPallet: number): Promise<DeliveryArea | null> {
    const { data, error } = await db().from("delivery_areas").update({ name, charge_per_pallet: chargePerPallet }).eq("id", id).select().single()
    if (error) { console.error("updateDeliveryArea", error); return null }
    return mapDeliveryArea(data)
  }
  async deleteDeliveryArea(id: string): Promise<boolean> {
    const { error } = await db().from("delivery_areas").delete().eq("id", id)
    return !error
  }

  // ── ADMINS ────────────────────────────────────────────────────────
  async getAdmins(): Promise<AdminStaff[]> {
    const { data, error } = await db().from("admin_staff").select("*").order("name")
    if (error) { console.error("getAdmins", error); return [] }
    return (data ?? []).map(mapAdmin)
  }
  async createAdmin(input: Omit<AdminStaff, "id">): Promise<AdminStaff> {
    const row: Record<string, unknown> = {
      id: genId("adm"),
      name: input.name, email: input.email, password: input.password,
      username: input.name.toLowerCase().replace(/\s+/g, "."),
      role: input.role, job_title: input.jobTitle || null, active: input.active ?? true,
      is_super_admin: false, permissions: input.permissions,
    }
    let { data, error } = await db().from("admin_staff").insert(row).select().single()
    // Retry without job_title if that migration hasn't been run yet.
    if (error && (error.code === "PGRST204" || /job_title/.test(error.message ?? ""))) {
      const { job_title: _jt, ...rest } = row
      void _jt
      ;({ data, error } = await db().from("admin_staff").insert(rest).select().single())
    }
    if (error) throw error
    return mapAdmin(data)
  }
  async updateAdmin(id: string, input: Partial<AdminStaff>): Promise<AdminStaff | null> {
    const row: Record<string, unknown> = {}
    if (input.name)        row.name        = input.name
    if (input.email)       row.email       = input.email
    if (input.password)    row.password    = input.password
    if (input.role)        row.role        = input.role
    if (input.jobTitle !== undefined) row.job_title = input.jobTitle
    if (input.permissions) row.permissions = input.permissions
    if (input.active !== undefined) row.active = input.active
    let { data, error } = await db().from("admin_staff").update(row).eq("id", id).select().single()
    if (error && (error.code === "PGRST204" || /job_title/.test(error.message ?? "")) && "job_title" in row) {
      const { job_title: _jt, ...rest } = row
      void _jt
      ;({ data, error } = await db().from("admin_staff").update(rest).eq("id", id).select().single())
    }
    if (error) { console.error("updateAdmin", error); return null }
    return mapAdmin(data)
  }
  async deleteAdmin(id: string): Promise<boolean> {
    const { error } = await db().from("admin_staff").delete().eq("id", id)
    return !error
  }
  async toggleAdminActive(id: string, active: boolean): Promise<boolean> {
    const { error } = await db().from("admin_staff").update({ active }).eq("id", id)
    return !error
  }

  // ── ADMIN ROLES (permission templates) ───────────────────────────
  async getAdminRoles(): Promise<AdminRole[]> {
    const { data, error } = await db().from("admin_roles").select("*").order("name")
    if (error) { console.error("getAdminRoles", error); return [] }
    return (data ?? []).map(mapAdminRole)
  }

  // ── CREDIT NOTES ──────────────────────────────────────────────────
  async getCreditNotes(): Promise<CreditNote[]> {
    const { data, error } = await db().from("credit_notes").select("*").order("date", { ascending: false })
    if (error) { console.error("getCreditNotes", error); return [] }
    return (data ?? []).map(mapCreditNote)
  }
  async createCreditNote(input: Omit<CreditNote, "id">): Promise<CreditNote> {
    const row = {
      id: genId("cn"), credit_number: input.creditNumber, customer_id: input.customerId || null,
      amount: input.amount, reason: input.reason, date: input.date,
      linked_ticket_id: input.linkedTicketId || null, linked_invoice_id: input.linkedInvoiceId || null,
      status: input.status, remaining_balance: input.remainingBalance,
    }
    const { data, error } = await db().from("credit_notes").insert(row).select().single()
    if (error) throw error
    return mapCreditNote(data)
  }
  async updateCreditNote(id: string, input: Partial<CreditNote>): Promise<CreditNote | null> {
    const row: Record<string, unknown> = {}
    if (input.reason !== undefined) row.reason = input.reason
    if (input.amount !== undefined) row.amount = input.amount
    if (input.status) row.status = input.status
    if (input.remainingBalance !== undefined) row.remaining_balance = input.remainingBalance
    const { data, error } = await db().from("credit_notes").update(row).eq("id", id).select().single()
    if (error) { console.error("updateCreditNote", error); return null }
    return mapCreditNote(data)
  }

  async getCreditNoteAllocations(): Promise<CreditNoteAllocation[]> {
    const { data, error } = await db().from("credit_note_allocations").select("*").order("date", { ascending: false })
    if (error) { console.error("getCreditNoteAllocations", error); return [] }
    return (data ?? []).map(mapCreditNoteAllocation)
  }
  async createCreditNoteAllocation(input: Omit<CreditNoteAllocation, "id">): Promise<CreditNoteAllocation> {
    const row = {
      id: genId("cna"), credit_note_id: input.creditNoteId, invoice_id: input.invoiceId,
      amount: input.amount, date: input.date,
    }
    const { data, error } = await db().from("credit_note_allocations").insert(row).select().single()
    if (error) throw error
    return mapCreditNoteAllocation(data)
  }

  // ── CUSTOMER APPLICATIONS ──────────────────────────────────────────
  async getCustomerApplications(): Promise<CustomerApplication[]> {
    const { data, error } = await db().from("customer_applications").select("*").order("date", { ascending: false })
    if (error) { console.error("getCustomerApplications", error); return [] }
    return (data ?? []).map(mapCustomerApplication)
  }
  async createCustomerApplication(input: Omit<CustomerApplication, "id" | "status">): Promise<CustomerApplication> {
    const row = {
      id: genId("capp"), company_name: input.companyName, contact_name: input.contactName,
      email: input.email, phone: input.phone || null, registered_address: input.registeredAddress || null,
      status: "Pending", date: input.date,
    }
    const { data, error } = await db().from("customer_applications").insert(row).select().single()
    if (error) throw error
    return mapCustomerApplication(data)
  }
  async updateCustomerApplication(id: string, input: Partial<CustomerApplication>): Promise<CustomerApplication | null> {
    const row: Record<string, unknown> = {}
    if (input.status) row.status = input.status
    if (input.notes !== undefined) row.notes = input.notes
    const { data, error } = await db().from("customer_applications").update(row).eq("id", id).select().single()
    if (error) { console.error("updateCustomerApplication", error); return null }
    return mapCustomerApplication(data)
  }

  // ── PRODUCE BUYING DESK ─────────────────────────────────────────────
  async getBuyingSessions(): Promise<BuyingSession[]> {
    const { data, error } = await db().from("buying_sessions").select("*").order("date", { ascending: false })
    if (error) { console.error("getBuyingSessions", error); return [] }
    return (data ?? []).map(mapBuyingSession)
  }
  async getOrCreateBuyingSession(date: string): Promise<BuyingSession> {
    const { data: existing } = await db().from("buying_sessions").select("*").eq("date", date).maybeSingle()
    if (existing) return mapBuyingSession(existing)
    const row = { id: genId("bs"), date, status: "Open" }
    const { data, error } = await db().from("buying_sessions").insert(row).select().single()
    if (error) throw error
    return mapBuyingSession(data)
  }
  async updateBuyingSession(id: string, input: Partial<BuyingSession>): Promise<BuyingSession | null> {
    const row: Record<string, unknown> = {}
    if (input.status) row.status = input.status
    if (input.publishedAt !== undefined) row.published_at = input.publishedAt
    const { data, error } = await db().from("buying_sessions").update(row).eq("id", id).select().single()
    if (error) { console.error("updateBuyingSession", error); return null }
    return mapBuyingSession(data)
  }

  async getBuyingPrices(): Promise<BuyingPrice[]> {
    const { data, error } = await db().from("buying_prices").select("*").order("date", { ascending: false })
    if (error) { console.error("getBuyingPrices", error); return [] }
    return (data ?? []).map(mapBuyingPrice)
  }
  async createBuyingPrice(input: Omit<BuyingPrice, "id">): Promise<BuyingPrice> {
    const row = {
      id: genId("bp"), session_id: input.sessionId, date: input.date, supplier: input.supplier,
      product: input.product, brand: input.brand || null, size: input.size || null,
      price: input.price, quantity: 0, notes: input.notes || null, confirmed: input.confirmed,
    }
    const { data, error } = await db().from("buying_prices").insert(row).select().single()
    if (error) throw error
    return mapBuyingPrice(data)
  }
  async updateBuyingPrice(id: string, input: Partial<BuyingPrice>): Promise<BuyingPrice | null> {
    const row: Record<string, unknown> = {}
    if (input.price !== undefined) row.price = input.price
    if (input.notes !== undefined) row.notes = input.notes
    if (input.confirmed !== undefined) row.confirmed = input.confirmed
    const { data, error } = await db().from("buying_prices").update(row).eq("id", id).select().single()
    if (error) { console.error("updateBuyingPrice", error); return null }
    return mapBuyingPrice(data)
  }
  async deleteBuyingPrice(id: string): Promise<boolean> {
    const { error } = await db().from("buying_prices").delete().eq("id", id)
    return !error
  }

  // ── SUPPLIERS ─────────────────────────────────────────────────────
  async getSuppliers(): Promise<Supplier[]> {
    const { data, error } = await db().from("suppliers").select("*").order("name")
    if (error) { console.error("getSuppliers", error); return [] }
    return (data ?? []).map(mapSupplier)
  }
  async createSupplier(input: Omit<Supplier, "id">): Promise<Supplier> {
    const row = { id: genId("sup"), name: input.name, contact: input.contact || null, country: input.country || null }
    const { data, error } = await db().from("suppliers").insert(row).select().single()
    if (error) throw error
    return mapSupplier(data)
  }
  async updateSupplier(id: string, input: Partial<Supplier>): Promise<Supplier | null> {
    const row: Record<string, unknown> = {}
    if (input.name !== undefined) row.name = input.name
    if (input.contact !== undefined) row.contact = input.contact
    if (input.country !== undefined) row.country = input.country
    const { data, error } = await db().from("suppliers").update(row).eq("id", id).select().single()
    if (error) { console.error("updateSupplier", error); return null }
    return mapSupplier(data)
  }
  async deleteSupplier(id: string): Promise<boolean> {
    const { error } = await db().from("suppliers").delete().eq("id", id)
    return !error
  }

  // ── DAY TRADE (end-of-day archive) ──────────────────────────────────
  async getDayTrades(): Promise<DayTrade[]> {
    const { data, error } = await db().from("day_trades").select("*").order("date", { ascending: false })
    if (error) { console.error("getDayTrades", error); return [] }
    return (data ?? []).map(mapDayTrade)
  }
  async createDayTrade(input: Omit<DayTrade, "id">): Promise<DayTrade> {
    const row = {
      id: genId("dt"), date: input.date, total_sales: input.totalSales, total_profit: input.totalProfit,
      sale_count: input.saleCount, closed_at: input.closedAt, closed_by: input.closedBy,
    }
    const { data, error } = await db().from("day_trades").insert(row).select().single()
    if (error) throw error
    return mapDayTrade(data)
  }

  // ── PAYMENT REMINDER NOTIFICATIONS ──────────────────────────────────
  async getNotificationLogs(): Promise<NotificationLog[]> {
    const { data, error } = await db().from("notification_logs").select("*").order("created_at", { ascending: false })
    if (error) { console.error("getNotificationLogs", error); return [] }
    return (data ?? []).map(mapNotificationLog)
  }
  async createNotificationLog(input: Omit<NotificationLog, "id">): Promise<NotificationLog> {
    const row = {
      id: genId("nl"), invoice_id: input.invoiceId, customer_id: input.customerId, channel: input.channel,
      status: input.status, scheduled_for: input.scheduledFor || null, sent_at: input.sentAt || null,
      error: input.error || null,
    }
    const { data, error } = await db().from("notification_logs").insert(row).select().single()
    if (error) throw error
    return mapNotificationLog(data)
  }
  async updateNotificationLog(id: string, input: Partial<NotificationLog>): Promise<NotificationLog | null> {
    const row: Record<string, unknown> = {}
    if (input.status) row.status = input.status
    if (input.sentAt !== undefined) row.sent_at = input.sentAt
    if (input.error !== undefined) row.error = input.error
    const { data, error } = await db().from("notification_logs").update(row).eq("id", id).select().single()
    if (error) { console.error("updateNotificationLog", error); return null }
    return mapNotificationLog(data)
  }

  // ── AUDIT LOG ─────────────────────────────────────────────────────
  // Reuses the activity_log table (same one the dashboard's "Recent
  // Activity" feed reads from) so staff/permission/customer changes are
  // visible in one place without a separate audit table.
  async logActivity(actorName: string, action: string): Promise<void> {
    const row = { id: genId("act"), customer_name: actorName, action, timestamp: new Date().toISOString().slice(0, 16).replace("T", " ") }
    const { error } = await db().from("activity_log").insert(row)
    if (error) console.error("logActivity", error)
  }
}

export const databaseService = new SupabaseDatabaseService()