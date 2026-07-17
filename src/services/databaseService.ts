import { supabase as _sb } from "../lib/supabase"
import type {
  ActivityLog, AdminStaff, Customer, DeliveryArea,
  Invoice, Order, Payment, Product, StockItem, SupportTicket,
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
  }
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapProduct(r: any): Product {
  return {
    id: r.id, productName: r.product_name, category: r.category ?? "",
    variety: r.variety ?? "", size: r.size ?? "", sku: r.sku,
    boxesPerPallet: r.boxes_per_pallet ?? 0, productImage: r.product_image ?? "",
  }
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapStock(r: any): StockItem {
  return {
    id: r.id, productId: r.product_id, availableQuantity: r.available_quantity ?? 0,
    price: r.price ?? 0, lastUpdated: r.last_updated ?? "", status: r.status ?? "available",
  }
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapOrder(r: any): Order {
  return {
    id: r.id, orderNumber: r.order_number, customerId: r.customer_id ?? "",
    customerName: r.customer_name ?? "", date: r.date ?? "",
    amount: r.amount ?? 0, status: r.status ?? "Pending", items: r.items ?? [],
  }
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapInvoice(r: any): Invoice {
  return {
    id: r.id, customerId: r.customer_id ?? "", invoiceNumber: r.invoice_number,
    amount: r.amount ?? 0, dueDate: r.due_date ?? "", status: r.status ?? "Unpaid",
  }
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapPayment(r: any): Payment {
  return {
    id: r.id, customerId: r.customer_id ?? "", paymentReference: r.payment_reference,
    amount: r.amount ?? 0, date: r.date ?? "", method: r.method ?? "",
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
    role: r.role ?? "Staff", active: r.active ?? true,
    isSuperAdmin: r.is_super_admin ?? false, permissions: r.permissions ?? {},
  }
}

// ── camelCase input → snake_case for INSERT/UPDATE ───────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toCustomerRow(input: any) {
  return {
    company_name: input.companyName, contact_person: input.contactPerson,
    email: input.email, phone: input.phone, customer_number: input.customerNumber,
    password: input.password, address: input.address, delivery_area: input.deliveryArea,
    payment_terms: input.paymentTerms,
  }
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toProductRow(input: any) {
  return {
    product_name: input.productName, category: input.category, variety: input.variety,
    size: input.size, sku: input.sku, boxes_per_pallet: input.boxesPerPallet,
    product_image: input.productImage ?? "",
  }
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
    const { data, error } = await db().from("customers").insert(row).select().single()
    if (error) throw error
    return mapCustomer(data)
  }
  async updateCustomer(id: string, input: Partial<Customer>): Promise<Customer | null> {
    const row = toCustomerRow(input)
    const { data, error } = await db().from("customers").update(row).eq("id", id).select().single()
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
    const row = { id: genId("p"), ...toProductRow(input) }
    const { data, error } = await db().from("products").insert(row).select().single()
    if (error) throw error
    // Every product needs a stock row so it appears on the Stock page for pricing.
    const stockRow = { id: genId("s"), product_id: row.id, available_quantity: 0, price: 0, status: "out", last_updated: new Date().toLocaleString() }
    const { error: stockErr } = await db().from("stock_items").insert(stockRow)
    if (stockErr) console.error("createProduct stock row", stockErr)
    return mapProduct(data)
  }
  async updateProduct(id: string, input: Partial<Product>): Promise<Product | null> {
    const row = toProductRow(input)
    const { data, error } = await db().from("products").update(row).eq("id", id).select().single()
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
    const row = {
      available_quantity: input.availableQuantity,
      price: input.price,
      status: input.status,
      last_updated: new Date().toISOString(),
    }
    const { data, error } = await db().from("stock_items").update(row).eq("id", id).select().single()
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
    }
    const { data, error } = await db().from("orders").insert(row).select().single()
    if (error) throw error
    return mapOrder(data)
  }
  async updateOrder(id: string, input: Partial<Order>): Promise<Order | null> {
    const { data, error } = await db().from("orders").update({ status: input.status }).eq("id", id).select().single()
    if (error) { console.error("updateOrder", error); return null }
    return mapOrder(data)
  }

  // ── INVOICES ──────────────────────────────────────────────────────
  async getInvoices(): Promise<Invoice[]> {
    const { data, error } = await db().from("invoices").select("*").order("due_date")
    if (error) { console.error("getInvoices", error); return [] }
    return (data ?? []).map(mapInvoice)
  }

  // ── PAYMENTS ──────────────────────────────────────────────────────
  async getPayments(): Promise<Payment[]> {
    const { data, error } = await db().from("payments").select("*").order("date", { ascending: false })
    if (error) { console.error("getPayments", error); return [] }
    return (data ?? []).map(mapPayment)
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
    // FILE:-prefixed rows are stored documents (see lib/fileService) — not activity.
    const { data, error } = await db().from("activity_log").select("*")
      .not("customer_name", "like", "FILE:%")
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
    const row = {
      id: genId("adm"),
      name: input.name, email: input.email, password: input.password,
      username: input.name.toLowerCase().replace(/\s+/g, "."),
      role: input.role, active: input.active ?? true,
      is_super_admin: false, permissions: input.permissions,
    }
    const { data, error } = await db().from("admin_staff").insert(row).select().single()
    if (error) throw error
    return mapAdmin(data)
  }
  async updateAdmin(id: string, input: Partial<AdminStaff>): Promise<AdminStaff | null> {
    const row: Record<string, unknown> = {}
    if (input.name)        row.name        = input.name
    if (input.email)       row.email       = input.email
    if (input.password)    row.password    = input.password
    if (input.role)        row.role        = input.role
    if (input.permissions) row.permissions = input.permissions
    if (input.active !== undefined) row.active = input.active
    const { data, error } = await db().from("admin_staff").update(row).eq("id", id).select().single()
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
}

export const databaseService = new SupabaseDatabaseService()