import { databaseService } from '../services/databaseService'
import type { Order } from '../types'

export function getOrders() {
  return databaseService.getOrders()
}

export function createOrder(input: Omit<Order, 'id' | 'orderNumber' | 'date' | 'status'>) {
  return databaseService.createOrder(input)
}

export function updateOrder(orderId: string, input: Partial<Order>) {
  return databaseService.updateOrder(orderId, input)
}

