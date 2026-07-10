import { databaseService } from '../services/databaseService'
import type { Customer } from '../types'

export function getCustomers() {
  return databaseService.getCustomers()
}

export function createCustomer(input: Omit<Customer, 'id' | 'lastActivity' | 'status' | 'balance'>) {
  return databaseService.createCustomer(input)
}

export function updateCustomer(customerId: string, input: Partial<Customer>) {
  return databaseService.updateCustomer(customerId, input)
}

export function deleteCustomer(customerId: string) {
  return databaseService.deleteCustomer(customerId)
}

