/**
 * Auth via Supabase table lookups.
 * Admin logins check the "admin_staff" table (username + password).
 * Customer logins check the "customers" table (customer_number + password).
 *
 * To migrate to Supabase Auth (email+password):
 *   supabase.auth.signInWithPassword({ email, password })
 */
import { supabase } from "../lib/supabase"
import type { User, UserRole } from "../types"

interface LoginInput { role: UserRole; usernameOrEmail: string; password: string }

class AuthService {
  private currentUser: User | null = null

  async login(input: LoginInput): Promise<User | null> {
    if (input.role === "admin") {
      // Check admin_staff table
      const { data, error } = await supabase
        .from("admin_staff")
        .select("*")
        .eq("username", input.usernameOrEmail)
        .eq("password", input.password)
        .eq("active", true)
        .single()

      if (error || !data) {
        console.warn("Admin login failed:", error?.message)
        return null
      }

      this.currentUser = {
        id: data.id,
        role: "admin",
        username: data.username ?? data.name,
        email: data.email,
        displayName: data.name,
        isSuperAdmin: data.is_super_admin ?? false,
        permissions: data.permissions ?? {},
      }
      return this.currentUser
    }

    // Customer login
    const { data, error } = await supabase
      .from("customers")
      .select("*")
      .or(`customer_number.eq.${input.usernameOrEmail},username.eq.${input.usernameOrEmail}`)
      .eq("password", input.password)
      .single()

    if (error || !data) {
      console.warn("Customer login failed:", error?.message)
      return null
    }

    this.currentUser = {
      id: data.id,
      role: "customer",
      username: data.customer_number,
      email: data.email,
      displayName: data.company_name,
      customerNumber: data.customer_number,
    }
    return this.currentUser
  }

  async logout(): Promise<void> {
    this.currentUser = null
  }

  getCurrentUser(): User | null {
    return this.currentUser
  }
}

export const authService = new AuthService()