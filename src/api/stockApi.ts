import { databaseService } from '../services/databaseService'
import type { StockItem } from '../types'

export function getStock() {
  return databaseService.getStock()
}

export function updateStock(stockId: string, input: Partial<StockItem>) {
  return databaseService.updateStock(stockId, input)
}

