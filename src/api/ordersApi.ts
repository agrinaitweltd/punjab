import { createOrder, getOrders, updateOrderStatus } from '../services/orderService'
import type { Order } from '../types'

export { getOrders, createOrder }

export function updateOrder(_id: string, input: Partial<Order>) {
  if (input.status) return updateOrderStatus(_id, input.status)
  return Promise.resolve(null)
}

