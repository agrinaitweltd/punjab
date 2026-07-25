import type { Order } from "../types"
import { mockOrders } from "../data/mockData"
import { databaseService } from "./databaseService"
import { supabaseReady } from "../lib/supabase"

let orders = [...mockOrders]

function nextOrderNumber(): string {
  const max = orders.reduce((m, o) => {
    const n = parseInt(o.orderNumber.replace(/[^0-9]/g, "")) || 0
    return n > m ? n : m
  }, 1000)
  return `ORD-${max + 1}`
}

export async function getOrders(): Promise<Order[]> {
  if (supabaseReady) return databaseService.getOrders()
  await new Promise(r => setTimeout(r, 100))
  return [...orders].sort((a, b) => b.date.localeCompare(a.date))
}

export async function createOrder(input: Omit<Order, "id" | "orderNumber" | "date" | "status"> & { date?: string }): Promise<Order> {
  if (supabaseReady) return databaseService.createOrder(input)
  await new Promise(r => setTimeout(r, 150))
  const order: Order = {
    ...input,
    id: `o-${Date.now()}`,
    orderNumber: nextOrderNumber(),
    date: input.date || new Date().toISOString().slice(0, 10),
    status: "Pending",
    items: input.items || [],
  }
  orders.push(order)
  return order
}

export async function updateOrderStatus(id: string, status: Order["status"]): Promise<Order | null> {
  if (supabaseReady) return databaseService.updateOrder(id, { status })
  await new Promise(r => setTimeout(r, 100))
  const idx = orders.findIndex(o => o.id === id)
  if (idx === -1) return null
  orders[idx] = { ...orders[idx], status }
  return orders[idx]
}

export async function getCustomerOrders(customerId: string): Promise<Order[]> {
  if (supabaseReady) return databaseService.getOrders().then(data => data.filter(o => o.customerId === customerId))
  await new Promise(r => setTimeout(r, 100))
  return orders.filter(o => o.customerId === customerId).sort((a, b) => b.date.localeCompare(a.date))
}