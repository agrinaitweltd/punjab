import type { AdminStaff } from "../types"
import { mockAdmins } from "../data/mockData"

let admins = [...mockAdmins]

function nextId() {
  const max = admins.reduce((m, a) => {
    const n = parseInt(a.id.replace(/[^0-9]/g, "")) || 0
    return n > m ? n : m
  }, 0)
  return `adm-${String(max + 1).padStart(3, "0")}`
}

export async function getAdmins(): Promise<AdminStaff[]> {
  await new Promise(r => setTimeout(r, 100))
  return [...admins].sort((a, b) => a.name.localeCompare(b.name))
}

export async function createAdmin(input: Omit<AdminStaff, "id">): Promise<AdminStaff> {
  await new Promise(r => setTimeout(r, 150))
  const admin: AdminStaff = {
    ...input,
    id: nextId(),
  }
  admins.push(admin)
  return admin
}

export async function updateAdmin(id: string, input: Partial<AdminStaff>): Promise<AdminStaff | null> {
  await new Promise(r => setTimeout(r, 100))
  const idx = admins.findIndex(a => a.id === id)
  if (idx === -1) return null
  admins[idx] = { ...admins[idx], ...input } as AdminStaff
  return admins[idx]
}

export async function deleteAdmin(id: string): Promise<boolean> {
  await new Promise(r => setTimeout(r, 100))
  admins = admins.filter(a => a.id !== id)
  return true
}

export async function toggleAdminActive(id: string, active: boolean): Promise<boolean> {
  await new Promise(r => setTimeout(r, 100))
  const idx = admins.findIndex(a => a.id === id)
  if (idx === -1) return false
  admins[idx] = { ...admins[idx], active }
  return true
}