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

// Accounts are being migrated to real Supabase Auth (see
// scripts/backfill-auth-users.mjs) one at a time as each person sets a real
// password via the recovery link. Until then this always fails harmlessly
// and the caller falls back to the legacy password check below — nobody's
// login can be broken by this.
async function trySupabaseAuth(email: string, password: string): Promise<boolean> {
  if (!supabase) return false
  const { error } = await supabase.auth.signInWithPassword({ email, password })
  return !error
}

class AuthService {
  private currentUser: User | null = null

  async login(role: UserRole, usernameOrEmail: string, password: string): Promise<User | null> {
    await new Promise(r => setTimeout(r, 200))

    if (role === "admin") {
      // Prefer the live Supabase admin roster; the built-in owner
      // credentials remain as a fallback so the portal is never locked out.
      let roster = mockAdmins
      if (supabaseReady) {
        try {
          const dbAdmins = await databaseService.getAdmins()
          if (dbAdmins.length > 0) roster = [...dbAdmins, ...mockAdmins]
        } catch { /* offline — use fallback roster */ }
      }
      const candidate = roster.find(a => a.email === usernameOrEmail && a.active)
      const candidateOk = candidate
        ? (await trySupabaseAuth(candidate.email, password)) || passwordMatches(candidate.password, password)
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
        const data = await databaseService.getCustomers()
        const customerCandidate = data.find(c => c.customerNumber === usernameOrEmail || c.email === usernameOrEmail)
        const customerOk = customerCandidate
          ? (customerCandidate.email && await trySupabaseAuth(customerCandidate.email, password)) || passwordMatches(customerCandidate.password, password)
          : false
        const customer = customerOk ? customerCandidate : undefined
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