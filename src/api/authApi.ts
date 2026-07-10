import { authService } from '../services/authService'
import type { UserRole } from '../types'

export async function loginUser(role: UserRole, usernameOrEmail: string, password: string) {
  return authService.login({ role, usernameOrEmail, password })
}

export async function logoutUser() {
  return authService.logout()
}

