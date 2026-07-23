import type { User, UserRole } from "../types"
import { mockAdmins, mockCustomers } from "../data/mockData"
import { databaseService } from "./databaseService"
import { supabaseReady } from "../lib/supabase"

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
      const admin = roster.find(a =>
        a.email === usernameOrEmail && a.password === password && a.active
      )
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
        const customer = data.find(c =>
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

  /** Google OAuth sign-in: matches the verified Google email against the
      existing admin roster first, then customers. New emails get a customer
      account created automatically. */
  async loginWithGoogleEmail(email: string, googleName?: string): Promise<User | null> {
    const em = email.trim().toLowerCase()
    if (!em) return null

    // Existing admin?
    let roster = mockAdmins
    if (supabaseReady) {
      try {
        const dbAdmins = await databaseService.getAdmins()
        if (dbAdmins.length > 0) roster = [...dbAdmins, ...mockAdmins]
      } catch { /* offline — fallback roster */ }
    }
    const admin = roster.find(a => a.email.toLowerCase() === em && a.active)
    if (admin) {
      this.currentUser = {
        id: admin.id, role: "admin",
        username: admin.name.toLowerCase().replace(/\s+/g, "."),
        email: admin.email, displayName: admin.name,
        isSuperAdmin: admin.isSuperAdmin ?? false,
        permissions: admin.permissions ?? {},
      }
      return this.currentUser
    }

    if (!supabaseReady) return null

    // Existing customer?
    const customers = await databaseService.getCustomers()
    let customer = customers.find(c => c.email?.toLowerCase() === em)

    // New user — create their customer account automatically.
    if (!customer) {
      const nums = customers.map(c => parseInt(c.customerNumber?.replace(/\D/g, "") ?? "") || 0)
      const customerNumber = `CUST-${String(Math.max(1000, ...nums) + 1)}`
      customer = await databaseService.createCustomer({
        companyName: googleName || em.split("@")[0],
        contactPerson: googleName || "",
        email: em, phone: "", customerNumber,
        // Google users authenticate via Google — the local password is a
        // random unguessable placeholder, never told to anyone.
        password: `google-${crypto.randomUUID()}`,
        address: "", deliveryArea: "", paymentTerms: "14 Days",
      })
    }

    this.currentUser = {
      id: customer.id, role: "customer",
      username: customer.customerNumber, email: customer.email,
      displayName: customer.companyName, customerNumber: customer.customerNumber,
    }
    return this.currentUser
  }

  async logout(): Promise<void> {
    await new Promise(r => setTimeout(r, 100))
    this.currentUser = null
  }

  getCurrentUser(): User | null {
    return this.currentUser
  }
}

export const authService = new AuthService()