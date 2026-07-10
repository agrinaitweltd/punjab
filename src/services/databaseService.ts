/**
 * Supabase-backed database service.
 * Table names match the types in src/types/index.ts.
 * Run the SQL in src/lib/schema.sql to create them in your Supabase project.
 */
import { supabase } from "../lib/supabase"
import type {
  ActivityLog, AdminStaff, Customer, DeliveryArea,
  Invoice, Order, Payment, Product, StockItem, SupportTicket,
} from "../types"

// ── Helpers ─────────────────────────────────────────────────────────
function genId(prefix: string) { return `${prefix}-${Date.now()}` }

class SupabaseDatabaseService {

  // ── CUSTOMERS ──────────────────────────────────────────────────────
  async getCustomers(): Promise<Customer[]> {
    const { data, error } = await supabase.from("customers").select("*").order("company_name")
    if (error) { console.error("getCustomers", error); return [] }
    return data ?? []
  }
  async createCustomer(input: Omit<Customer, "id" | "lastActivity" | "status" | "balance">): Promise<Customer> {
    const row = { ...input, id: genId("c"), last_activity: new Date().toISOString(), status: "active", balance: 0 }
    const { data, error } = await supabase.from("customers").insert(row).select().single()
    if (error) throw error
    return data
  }
  async updateCustomer(id: string, input: Partial<Customer>): Promise<Customer | null> {
    const { data, error } = await supabase.from("customers").update(input).eq("id", id).select().single()
    if (error) { console.error("updateCustomer", error); return null }
    return data
  }
  async deleteCustomer(id: string): Promise<boolean> {
    const { error } = await supabase.from("customers").delete().eq("id", id)
    return !error
  }

  // ── PRODUCTS ───────────────────────────────────────────────────────
  async getProducts(): Promise<Product[]> {
    const { data, error } = await supabase.from("products").select("*").order("product_name")
    if (error) { console.error("getProducts", error); return [] }
    return data ?? []
  }
  async createProduct(input: Omit<Product, "id">): Promise<Product> {
    const row = { ...input, id: genId("p") }
    const { data, error } = await supabase.from("products").insert(row).select().single()
    if (error) throw error
    return data
  }
  async updateProduct(id: string, input: Partial<Product>): Promise<Product | null> {
    const { data, error } = await supabase.from("products").update(input).eq("id", id).select().single()
    if (error) { console.error("updateProduct", error); return null }
    return data
  }
  async deleteProduct(id: string): Promise<boolean> {
    await supabase.from("stock_items").delete().eq("product_id", id)
    const { error } = await supabase.from("products").delete().eq("id", id)
    return !error
  }

  // ── STOCK ─────────────────────────────────────────────────────────
  async getStock(): Promise<StockItem[]> {
    const { data, error } = await supabase.from("stock_items").select("*")
    if (error) { console.error("getStock", error); return [] }
    return data ?? []
  }
  async updateStock(id: string, input: Partial<StockItem>): Promise<StockItem | null> {
    const row = { ...input, last_updated: new Date().toLocaleString() }
    const { data, error } = await supabase.from("stock_items").update(row).eq("id", id).select().single()
    if (error) { console.error("updateStock", error); return null }
    return data
  }

  // ── ORDERS ────────────────────────────────────────────────────────
  async getOrders(): Promise<Order[]> {
    const { data, error } = await supabase.from("orders").select("*").order("created_at", { ascending: false })
    if (error) { console.error("getOrders", error); return [] }
    return data ?? []
  }
  async createOrder(input: Omit<Order, "id" | "orderNumber" | "date" | "status">): Promise<Order> {
    const row = {
      ...input,
      id: genId("o"),
      order_number: `ORD-${Math.floor(1000 + Math.random() * 9000)}`,
      date: new Date().toISOString().slice(0, 10),
      status: "Pending",
    }
    const { data, error } = await supabase.from("orders").insert(row).select().single()
    if (error) throw error
    return data
  }
  async updateOrder(id: string, input: Partial<Order>): Promise<Order | null> {
    const { data, error } = await supabase.from("orders").update(input).eq("id", id).select().single()
    if (error) { console.error("updateOrder", error); return null }
    return data
  }

  // ── INVOICES ──────────────────────────────────────────────────────
  async getInvoices(): Promise<Invoice[]> {
    const { data, error } = await supabase.from("invoices").select("*").order("due_date")
    if (error) { console.error("getInvoices", error); return [] }
    return data ?? []
  }

  // ── PAYMENTS ──────────────────────────────────────────────────────
  async getPayments(): Promise<Payment[]> {
    const { data, error } = await supabase.from("payments").select("*").order("date", { ascending: false })
    if (error) { console.error("getPayments", error); return [] }
    return data ?? []
  }

  // ── TICKETS ───────────────────────────────────────────────────────
  async getTickets(): Promise<SupportTicket[]> {
    const { data, error } = await supabase.from("support_tickets").select("*").order("created_at", { ascending: false })
    if (error) { console.error("getTickets", error); return [] }
    return data ?? []
  }
  async createTicket(input: Omit<SupportTicket, "id" | "createdAt" | "status">): Promise<SupportTicket> {
    const row = { ...input, id: genId("t"), created_at: new Date().toLocaleString(), status: "Open" }
    const { data, error } = await supabase.from("support_tickets").insert(row).select().single()
    if (error) throw error
    return data
  }

  // ── ACTIVITY ──────────────────────────────────────────────────────
  async getActivity(): Promise<ActivityLog[]> {
    const { data, error } = await supabase.from("activity_log").select("*").order("timestamp", { ascending: false }).limit(50)
    if (error) { console.error("getActivity", error); return [] }
    return data ?? []
  }

  // ── DELIVERY AREAS ────────────────────────────────────────────────
  async getDeliveryAreas(): Promise<DeliveryArea[]> {
    const { data, error } = await supabase.from("delivery_areas").select("*").order("name")
    if (error) { console.error("getDeliveryAreas", error); return [] }
    return data ?? []
  }

  // ── ADMINS ────────────────────────────────────────────────────────
  async getAdmins(): Promise<AdminStaff[]> {
    const { data, error } = await supabase.from("admin_staff").select("*").order("name")
    if (error) { console.error("getAdmins", error); return [] }
    return data ?? []
  }
  async createAdmin(input: Omit<AdminStaff, "id">): Promise<AdminStaff> {
    const row = { ...input, id: genId("adm") }
    const { data, error } = await supabase.from("admin_staff").insert(row).select().single()
    if (error) throw error
    return data
  }
}

export const databaseService = new SupabaseDatabaseService()