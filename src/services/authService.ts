import bcrypt from "bcryptjs"
import type { User, UserRole } from "../types"
import { mockAdmins, mockCustomers } from "../data/mockData"
import { databaseService } from "./databaseService"
import { supabase, supabaseReady } from "../lib/supabase"

// Live database rows have been migrated to bcrypt hashes (see
// scripts/hash-passwords.mjs); offline mock data still uses plain strings
// since it never leaves this bundle. Accept both so the two paths keep working.
const passwordMatches = (stored: string, attempt: string) =>
  stored.startsWith("$2") ? bcrypt.compareSync(attempt, stored) : stored === attempt

async function trySupabaseAuth(role: UserRole, identifier: string, password: string): Promise<boolean> {
  if (!supabase) return false
  try {
    const response = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role, identifier, password }),
    })
    if (!response.ok) return false
    const session = await response.json() as { accessToken?: string; refreshToken?: string }
    if (!session.accessToken || !session.refreshToken) return false
    const { error } = await supabase.auth.setSession({ access_token: session.accessToken, refresh_token: session.refreshToken })
    return !error
  } catch {
    return false
  }
}

class AuthService {
  private currentUser: User | null = null

  async login(role: UserRole, usernameOrEmail: string, password: string): Promise<User | null> {
    await new Promise(r => setTimeout(r, 200))

    if (role === "admin") {
      // Production logins must come from the live roster. Mock accounts are
      // available only when Supabase is not configured (local/offline use).
      let roster = mockAdmins
      if (supabaseReady) {
        if (!(await trySupabaseAuth(role, usernameOrEmail, password))) return null
        try {
          const dbAdmins = await databaseService.getAdmins()
          roster = dbAdmins
        } catch { roster = [] }
      }
      const candidate = roster.find(a => a.email.toLowerCase() === usernameOrEmail.trim().toLowerCase() && a.active)
      const candidateOk = candidate
        ? supabaseReady || passwordMatches(candidate.password, password)
        : false
      const admin = candidateOk ? candidate : undefined
      if (admin) {
        this.currentUser = {
          id: admin.id,
          role: "admin",
          username: admin.name.toLowerCase().replace(/\s+/g, "."),
          email: admin.email,
          displayName: admin.name,
          isSuperAdmin: admin.isSuperAdmin ?? false,
          permissions: admin.permissions ?? {},
        }
        return this.currentUser
      }
    } else {
      if (supabaseReady) {
        if (!(await trySupabaseAuth(role, usernameOrEmail, password))) return null
        const data = await databaseService.getCustomers()
        const customerCandidate = data.find(c => c.customerNumber === usernameOrEmail || c.email === usernameOrEmail)
        const customer = customerCandidate
        if (customer) {
          this.currentUser = {
            id: customer.id,
            role: "customer",
            username: customer.customerNumber,
            email: customer.email,
            displayName: customer.companyName,
            customerNumber: customer.customerNumber,
          }
          return this.currentUser
        }
        // Not the main login — try a team sub-account (must be approved + active).
        const subAccounts = await databaseService.getCustomerSubAccounts()
        const sub = subAccounts.find(s =>
          s.email.toLowerCase() === usernameOrEmail.trim().toLowerCase() && passwordMatches(s.password, password) &&
          s.status === "Approved" && s.active
        )
        if (sub) {
          const parent = data.find(c => c.id === sub.customerId)
          this.currentUser = {
            id: sub.customerId,
            role: "customer",
            username: parent?.customerNumber ?? sub.customerId,
            email: sub.email,
            displayName: parent?.companyName ?? sub.customerName,
            customerNumber: parent?.customerNumber,
            subAccount: { id: sub.id, name: sub.name, permissions: sub.permissions },
          }
          return this.currentUser
        }
      } else {
        const customer = mockCustomers.find(c =>
          (c.customerNumber === usernameOrEmail || c.email === usernameOrEmail) && c.password === password
        )
        if (customer) {
          this.currentUser = {
            id: customer.id,
            role: "customer",
            username: customer.customerNumber,
            email: customer.email,
            displayName: customer.companyName,
            customerNumber: customer.customerNumber,
          }
          return this.currentUser
        }
      }
    }
    return null
  }

  async logout(): Promise<void> {
    await new Promise(r => setTimeout(r, 100))
    if (supabase) { try { await supabase.auth.signOut() } catch { /* no active supabase session — fine */ } }
    this.currentUser = null
  }

  getCurrentUser(): User | null {
    return this.currentUser
  }
}

export const authService = new AuthService()
