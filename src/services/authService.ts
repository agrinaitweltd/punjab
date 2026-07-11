import type { User, UserRole } from "../types"
import { mockAdmins, mockCustomers } from "../data/mockData"
import { databaseService } from "./databaseService"
import { supabaseReady } from "../lib/supabase"

class AuthService {
  private currentUser: User | null = null

  async login(role: UserRole, usernameOrEmail: string, password: string): Promise<User | null> {
    await new Promise(r => setTimeout(r, 200))
    console.log("Login attempt:", { role, usernameOrEmail, password, supabaseReady })
    
    if (role === "admin") {
      if (supabaseReady) {
        console.log("Using Supabase for admin login")
        const data = await databaseService.getAdmins()
        console.log("Admins from DB:", data)
        const admin = data.find(a => a.email === usernameOrEmail && a.password === password && a.active)
        console.log("Found admin:", admin)
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
        console.log("Using mock data for admin login")
        console.log("Mock admins:", mockAdmins)
        const admin = mockAdmins.find(a =>
          a.email === usernameOrEmail && a.password === password && a.active
        )
        console.log("Found admin:", admin)
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

  async logout(): Promise<void> {
    await new Promise(r => setTimeout(r, 100))
    this.currentUser = null
  }

  getCurrentUser(): User | null {
    return this.currentUser
  }
}

export const authService = new AuthService()