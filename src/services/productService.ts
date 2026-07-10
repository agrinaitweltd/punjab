import type { Product } from "../types"
import { mockProducts, mockStock } from "../data/mockData"
import { databaseService } from "./databaseService"
import { supabaseReady } from "../lib/supabase"

let products = [...mockProducts]
let stock = [...mockStock]

function nextId(prefix: string) {
  const max = products.reduce((m, p) => {
    const n = parseInt(p.id.replace(/[^0-9]/g, "")) || 0
    return n > m ? n : m
  }, 0)
  return `${prefix}-${String(max + 1).padStart(3, "0")}`
}

export async function getProducts(): Promise<Product[]> {
  if (supabaseReady) return databaseService.getProducts()
  await new Promise(r => setTimeout(r, 100))
  return [...products].sort((a, b) => a.productName.localeCompare(b.productName))
}

export async function createProduct(input: Omit<Product, "id">): Promise<Product> {
  if (supabaseReady) return databaseService.createProduct(input)
  await new Promise(r => setTimeout(r, 150))
  const product: Product = { ...input, id: nextId("p") }
  products.push(product)
  stock.push({
    id: nextId("s"),
    productId: product.id,
    availableQuantity: 0,
    price: 0,
    lastUpdated: new Date().toISOString().slice(0, 10),
    status: "out",
  })
  return product
}

export async function updateProduct(id: string, input: Partial<Product>): Promise<Product | null> {
  if (supabaseReady) return databaseService.updateProduct(id, input)
  await new Promise(r => setTimeout(r, 100))
  const idx = products.findIndex(p => p.id === id)
  if (idx === -1) return null
  const updated = { ...products[idx], ...input } as Product
  products[idx] = updated
  return updated
}

export async function deleteProduct(id: string): Promise<boolean> {
  if (supabaseReady) return databaseService.deleteProduct(id)
  await new Promise(r => setTimeout(r, 100))
  products = products.filter(p => p.id !== id)
  stock = stock.filter(s => s.productId !== id)
  return true
}