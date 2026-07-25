import type { Order, OrderItem, Product } from "../types"

/** Sales figures exclude cancelled orders — everything else counts as a
    completed/placed sale for revenue & profit purposes. */
export function completedSales(orders: Order[]): Order[] {
  return orders.filter(o => o.status !== "Cancelled")
}

export function inRange(dateIso: string, from: string, to: string): boolean {
  return dateIso >= from && dateIso <= to
}

export function filterByRange(orders: Order[], from: string, to: string): Order[] {
  return completedSales(orders).filter(o => inRange(o.date, from, to))
}

function costFor(item: OrderItem, productsById: Map<string, Product>): number {
  return productsById.get(item.productId)?.costPrice ?? 0
}

export function orderProfit(order: Order, productsById: Map<string, Product>): number {
  return order.items.reduce((s, it) => s + (it.unitPrice - costFor(it, productsById)) * it.quantity, 0)
}

export function toProductsById(products: Product[]): Map<string, Product> {
  return new Map(products.map(p => [p.id, p]))
}

export function totalSales(orders: Order[]): number {
  return orders.reduce((s, o) => s + o.amount, 0)
}

export function totalProfit(orders: Order[], productsById: Map<string, Product>): number {
  return orders.reduce((s, o) => s + orderProfit(o, productsById), 0)
}

export function profitMarginPct(sales: number, profit: number): number {
  return sales > 0 ? (profit / sales) * 100 : 0
}

/** Common date-range presets, returned as [from, to] ISO date strings. */
export function rangePreset(preset: "today" | "week" | "month" | "year" | "all", orders: Order[]): [string, string] {
  const now = new Date()
  const toIso = (d: Date) => d.toISOString().slice(0, 10)
  const today = toIso(now)
  if (preset === "today") return [today, today]
  if (preset === "week") {
    const d = new Date(now); d.setDate(d.getDate() - 7)
    return [toIso(d), today]
  }
  if (preset === "month") {
    const d = new Date(now); d.setMonth(d.getMonth() - 1)
    return [toIso(d), today]
  }
  if (preset === "year") {
    const d = new Date(now); d.setFullYear(d.getFullYear() - 1)
    return [toIso(d), today]
  }
  const earliest = orders.reduce((m, o) => (o.date && (!m || o.date < m) ? o.date : m), "")
  return [earliest || today, today]
}

export type ProductStat = {
  productId: string; name: string; qtySold: number; revenue: number; profit: number
}
export function productStats(orders: Order[], products: Product[]): ProductStat[] {
  const productsById = toProductsById(products)
  const map = new Map<string, ProductStat>()
  for (const o of orders) {
    for (const it of o.items) {
      const product = productsById.get(it.productId)
      const name = product?.productName ?? "Unknown product"
      const existing = map.get(it.productId) ?? { productId: it.productId, name, qtySold: 0, revenue: 0, profit: 0 }
      existing.qtySold += it.quantity
      existing.revenue += it.unitPrice * it.quantity
      existing.profit += (it.unitPrice - costFor(it, productsById)) * it.quantity
      map.set(it.productId, existing)
    }
  }
  return [...map.values()]
}

export type CustomerStat = {
  customerId: string; name: string; sales: number; profit: number; orderCount: number; avgOrderValue: number
}
export function customerStats(orders: Order[], products: Product[]): CustomerStat[] {
  const productsById = toProductsById(products)
  const map = new Map<string, CustomerStat>()
  for (const o of orders) {
    const existing = map.get(o.customerId) ?? { customerId: o.customerId, name: o.customerName, sales: 0, profit: 0, orderCount: 0, avgOrderValue: 0 }
    existing.sales += o.amount
    existing.profit += orderProfit(o, productsById)
    existing.orderCount += 1
    map.set(o.customerId, existing)
  }
  for (const c of map.values()) c.avgOrderValue = c.orderCount ? c.sales / c.orderCount : 0
  return [...map.values()]
}

export type SalesmanStat = {
  salesmanId: string; name: string; sales: number; profit: number; orderCount: number
  avgOrderValue: number; customerCount: number; qtySold: number
}
export function salesmanStats(orders: Order[], products: Product[]): SalesmanStat[] {
  const productsById = toProductsById(products)
  const map = new Map<string, SalesmanStat & { customers: Set<string> }>()
  for (const o of orders) {
    if (!o.salesmanId) continue
    const existing = map.get(o.salesmanId) ?? {
      salesmanId: o.salesmanId, name: o.salesmanName ?? o.salesmanId, sales: 0, profit: 0,
      orderCount: 0, avgOrderValue: 0, customerCount: 0, qtySold: 0, customers: new Set<string>(),
    }
    existing.sales += o.amount
    existing.profit += orderProfit(o, productsById)
    existing.orderCount += 1
    existing.qtySold += o.items.reduce((s, it) => s + it.quantity, 0)
    existing.customers.add(o.customerId)
    map.set(o.salesmanId, existing)
  }
  return [...map.values()].map(({ customers, ...rest }) => ({
    ...rest, avgOrderValue: rest.orderCount ? rest.sales / rest.orderCount : 0, customerCount: customers.size,
  }))
}

/** Groups completed sales by day/week/month/year for trend charts — returns
    [{ label, sales, profit }] sorted ascending by period. */
export function seriesByPeriod(orders: Order[], products: Product[], period: "day" | "week" | "month" | "year"): { label: string; sales: number; profit: number }[] {
  const productsById = toProductsById(products)
  const keyFor = (dateIso: string) => {
    const d = new Date(dateIso + "T00:00:00")
    if (isNaN(d.getTime())) return dateIso
    if (period === "day") return dateIso
    if (period === "year") return String(d.getFullYear())
    if (period === "month") return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
    const weekStart = new Date(d); weekStart.setDate(d.getDate() - d.getDay())
    return weekStart.toISOString().slice(0, 10)
  }
  const map = new Map<string, { sales: number; profit: number }>()
  for (const o of orders) {
    const key = keyFor(o.date)
    const existing = map.get(key) ?? { sales: 0, profit: 0 }
    existing.sales += o.amount
    existing.profit += orderProfit(o, productsById)
    map.set(key, existing)
  }
  return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([label, v]) => ({ label, ...v }))
}
