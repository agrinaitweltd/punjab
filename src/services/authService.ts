/**
 * Auth service — tries Supabase first, falls back to built-in credentials
 * so the app never goes blank while tables are being set up.
 *
 * Built-in fallback: admin / admin123
 * Once you run schema.sql the real table takes over.
 */
import { supabase } from "../lib/supabase"
import type { User, UserRole } from "../types"

const FALLBACK_ADMIN: User = {
  id: "adm-owner",
  role: "admin",
  username: "admin",
  email: "admin@punjabfoods.co.uk",
  displayName: "Owner Admin",
  isSuperAdmin: true,
  permissions: {
    customers: true, prices: true, stock: true, orders: true, enquiries: true,
    tickets: true, payments: true, complaints: true, extracts: true,
    stats: true, admins: true, products: true,
  },
}

interface LoginInput { role: UserRole; usernameOrEmail: string; password: string }

class AuthService {
  private currentUser: User | null = null

  async login(input: LoginInput): Promise<User | null> {
    // ── Try Supabase if client is available ──────────────────────────
    if (supabase) {
      try {
        if (input.role === "admin") {
          const { data } = await supabase
            .from("admin_staff")
            .select("*")
            .eq("username", input.usernameOrEmail)
            .eq("password", input.password)
            .eq("active", true)
            .maybeSingle()

          if (data) {
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
        } else {
          const { data } = await supabase
            .from("customers")
            .select("*")
            .or(`customer_number.eq.${input.usernameOrEmail},username.eq.${input.usernameOrEmail}`)
            .eq("password", input.password)
            .maybeSingle()

          if (data) {
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
        }
      } catch (e) {
        console.warn("Supabase auth error, trying fallback:", e)
      }
    }

    // ── Built-in fallback (works before tables are set up) ────────────
    if (
      input.role === "admin" &&
      input.usernameOrEmail === "admin" &&
      input.password === "admin123"
    ) {
      this.currentUser = FALLBACK_ADMIN
      return this.currentUser
    }

    return null
  }

  async logout(): Promise<void> {
    this.currentUser = null
  }

  getCurrentUser(): User | null {
    return this.currentUser
  }
}

export const authService = new AuthService()