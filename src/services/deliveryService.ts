import type { DeliveryArea } from "../types"
import { mockDeliveryAreas } from "../data/mockData"
import { databaseService } from "./databaseService"
import { supabaseReady } from "../lib/supabase"

let areas = [...mockDeliveryAreas]

function nextId() {
  const max = areas.reduce((m, a) => {
    const n = parseInt(a.id.replace(/[^0-9]/g, "")) || 0
    return n > m ? n : m
  }, 0)
  return `da-${String(max + 1).padStart(3, "0")}`
}

export async function getDeliveryAreas(): Promise<DeliveryArea[]> {
  if (supabaseReady) return databaseService.getDeliveryAreas()
  await new Promise(r => setTimeout(r, 100))
  return [...areas].sort((a, b) => a.name.localeCompare(b.name))
}

export async function createDeliveryArea(name: string, chargePerPallet: number): Promise<DeliveryArea> {
  if (supabaseReady) return databaseService.createDeliveryArea(name, chargePerPallet)
  await new Promise(r => setTimeout(r, 150))
  const area: DeliveryArea = { id: nextId(), name, chargePerPallet }
  areas.push(area)
  return area
}

export async function updateDeliveryArea(id: string, name: string, chargePerPallet: number): Promise<DeliveryArea | null> {
  if (supabaseReady) return databaseService.updateDeliveryArea(id, name, chargePerPallet)
  await new Promise(r => setTimeout(r, 100))
  const idx = areas.findIndex(a => a.id === id)
  if (idx === -1) return null
  areas[idx] = { ...areas[idx], name, chargePerPallet }
  return areas[idx]
}

export async function deleteDeliveryArea(id: string): Promise<boolean> {
  if (supabaseReady) return databaseService.deleteDeliveryArea(id)
  await new Promise(r => setTimeout(r, 100))
  areas = areas.filter(a => a.id !== id)
  return true
}