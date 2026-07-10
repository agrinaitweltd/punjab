import { databaseService } from '../services/databaseService'
import type { Product } from '../types'

export function getProducts() {
  return databaseService.getProducts()
}

export function createProduct(input: Omit<Product, 'id'>) {
  return databaseService.createProduct(input)
}

export function updateProduct(productId: string, input: Partial<Product>) {
  return databaseService.updateProduct(productId, input)
}

export function deleteProduct(productId: string) {
  return databaseService.deleteProduct(productId)
}

