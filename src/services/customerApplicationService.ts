import type { CustomerApplication } from "../types"
import { databaseService } from "./databaseService"
import { supabaseReady } from "../lib/supabase"

let applications: CustomerApplication[] = []

export async function getCustomerApplications(): Promise<CustomerApplication[]> {
  if (supabaseReady) return databaseService.getCustomerApplications()
  await new Promise(r => setTimeout(r, 100))
  return [...applications].sort((a, b) => b.date.localeCompare(a.date))
}

export async function createCustomerApplication(
  input: Omit<CustomerApplication, "id" | "status">,
): Promise<CustomerApplication> {
  if (supabaseReady) return databaseService.createCustomerApplication(input)
  await new Promise(r => setTimeout(r, 100))
  const application: CustomerApplication = { ...input, id: `capp-${Date.now()}`, status: "Pending" }
  applications.push(application)
  return application
}

export async function updateCustomerApplication(
  id: string, input: Partial<CustomerApplication>,
): Promise<CustomerApplication | null> {
  if (supabaseReady) return databaseService.updateCustomerApplication(id, input)
  await new Promise(r => setTimeout(r, 100))
  const idx = applications.findIndex(a => a.id === id)
  if (idx === -1) return null
  applications[idx] = { ...applications[idx], ...input }
  return applications[idx]
}
