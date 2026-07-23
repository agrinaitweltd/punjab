import { authService } from '../services/authService'
import type { UserRole } from '../types'

export async function loginUser(role: UserRole, usernameOrEmail: string, password: string) {
  return authService.login(role, usernameOrEmail, password)
}

export async function loginWithGoogleEmail(email: string, googleName?: string) {
  return authService.loginWithGoogleEmail(email, googleName)
}

export async function logoutUser() {
  return authService.logout()
}

