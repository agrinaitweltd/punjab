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

// Admin login goes straight to Supabase Auth with the password the person
// actually typed — no bridge/DB-password layer in between. This is the
// account Supabase itself enforces the password policy and re-auth against.
async function recordAdminLoginAttempt(email: string, success: boolean, failureCode?: string, userId?: string, accountId?: string) {
  try {
    await fetch('/api/admin-security?action=record-login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, success, failureCode, userId, accountId }),
    })
  } catch { /* best-effort audit log — never block login on this */ }
}

async function trySupabaseAdminAuth(email: string, password: string) {
  if (!supabase) return null
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error || !data.session) {
    await recordAdminLoginAttempt(email, false, error?.message === 'Email not confirmed' ? 'unconfirmed' : 'invalid_credentials')
    return null
  }
  return data.session
}

class AuthService {
  private currentUser: User | null = null

  async login(role: UserRole, usernameOrEmail: string, password: string): Promise<User | null> {
    await new Promise(r => setTimeout(r, 200))

    if (role === "admin") {
      const email = usernameOrEmail.trim().toLowerCase()
      if (supabaseReady) {
        // The password is verified by Supabase Auth itself — there is no
        // separate/legacy password store in the loop for admins.
        const session = await trySupabaseAdminAuth(email, password)
        if (!session || !supabase) return null
        const { data, error } = await supabase.from("admin_staff")
          .select("*").eq("auth_user_id", session.user.id).maybeSingle()
        if (error || !data || data.active === false) {
          await recordAdminLoginAttempt(email, false, 'no_active_staff_row', session.user.id)
          await supabase.auth.signOut()
          return null
        }
        await recordAdminLoginAttempt(email, true, undefined, session.user.id, data.id)
        this.currentUser = {
          id: data.id,
          role: "admin",
          username: String(data.name ?? "").toLowerCase().replace(/\s+/g, "."),
          email: data.email,
          displayName: data.name,
          isSuperAdmin: data.is_super_admin ?? false,
          isSystemDeveloper: data.role === "System Developer",
          permissions: { ...(data.permissions ?? {}), customers: true, customersCreate: true },
          tutorialCompletedAt: data.tutorial_completed_at ?? null,
        }
        return this.currentUser
      }
      // Offline/local dev only — no Supabase env vars configured.
      const candidate = mockAdmins.find(a => a.email.toLowerCase() === email && a.active)
      const admin = candidate && passwordMatches(candidate.password, password) ? candidate : undefined
      if (admin) {
        this.currentUser = {
          id: admin.id,
          role: "admin",
          username: admin.name.toLowerCase().replace(/\s+/g, "."),
          email: admin.email,
          displayName: admin.name,
          isSuperAdmin: admin.isSuperAdmin ?? false,
          isSystemDeveloper: admin.role === "System Developer",
          permissions: { ...(admin.permissions ?? {}), customers: true, customersCreate: true },
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
