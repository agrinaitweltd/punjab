import { supabase } from "./supabase"
import { isRuntimeTestMode } from "./runtimeMode"

export type DateRangeKey = "today" | "7d" | "30d" | "thisMonth" | "prevMonth" | "thisYear" | "custom"

export type DashboardAnalytics = {
  summary: {
    totalCustomers: number
    totalInvoiceValue: number
    paymentsReceived: number
    outstanding: number
    paidInvoices: number
    openInvoices: number
    overdueInvoices: number
    creditNotesValue: number
    creditNotesCount: number
    documentsImportedToday: number
  }
  topProducts: Array<{ product: string; qty: number; value: number }>
  topCustomers: Array<{ customerId: string; name: string; totalInvoiced: number; totalPaid: number; outstanding: number; invoiceCount: number }>
  salesOverTime: Array<{ period: string; value: number }>
  paymentsOverTime: Array<{ period: string; value: number }>
  creditNotesOverTime: Array<{ period: string; value: number }>
  customerGrowth: Array<{ period: string; value: number }>
  creditNotesByCustomer: Array<{ customerId: string; name: string; value: number }>
  creditedProducts: Array<{ product: string; qty: number; value: number }>
}

const pad = (n: number) => String(n).padStart(2, "0")
const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

/** Resolves a date-range preset key to concrete start/end dates (inclusive)
    and the bucket granularity the server should group time series by -
    daily for short ranges, weekly/monthly for longer ones so a "This Year"
    query returns ~12-52 points instead of 365. */
export function resolveDateRange(key: DateRangeKey, custom?: { start: string; end: string }): { start: string; end: string; bucket: "day" | "week" | "month" } {
  const now = new Date()
  const today = iso(now)
  if (key === "today") return { start: today, end: today, bucket: "day" }
  if (key === "7d") { const d = new Date(now); d.setDate(d.getDate() - 6); return { start: iso(d), end: today, bucket: "day" } }
  if (key === "30d") { const d = new Date(now); d.setDate(d.getDate() - 29); return { start: iso(d), end: today, bucket: "day" } }
  if (key === "thisMonth") { const start = new Date(now.getFullYear(), now.getMonth(), 1); return { start: iso(start), end: today, bucket: "day" } }
  if (key === "prevMonth") {
    const start = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const end = new Date(now.getFullYear(), now.getMonth(), 0)
    return { start: iso(start), end: iso(end), bucket: "day" }
  }
  if (key === "thisYear") { const start = new Date(now.getFullYear(), 0, 1); return { start: iso(start), end: today, bucket: "month" } }
  if (key === "custom" && custom) {
    const days = (new Date(custom.end).getTime() - new Date(custom.start).getTime()) / 86_400_000
    return { start: custom.start, end: custom.end, bucket: days > 120 ? "month" : days > 31 ? "week" : "day" }
  }
  return { start: today, end: today, bucket: "day" }
}

export async function getDashboardAnalytics(range: { start: string; end: string; bucket: "day" | "week" | "month" }): Promise<DashboardAnalytics> {
  if (!supabase) throw new Error("Not connected to the database")
  const { data, error } = await supabase.rpc("get_dashboard_analytics", {
    p_start: range.start, p_end: range.end, p_bucket: range.bucket, p_test: isRuntimeTestMode(),
  })
  if (error) throw error
  return data as DashboardAnalytics
}
