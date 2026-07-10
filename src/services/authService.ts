import { mockUsers } from '../data/mockData'
import type { User, UserRole } from '../types'

interface LoginInput {
  role: UserRole
  usernameOrEmail: string
  password: string
}

class MockAuthService {
  private currentUser: User | null = null

  async login(input: LoginInput): Promise<User | null> {
    if (input.role === 'admin') {
      if (input.usernameOrEmail === 'admin' && input.password === 'admin123') {
        this.currentUser = mockUsers.find((item) => item.role === 'admin') || null
        return this.currentUser
      }
      return null
    }

    if (
      (input.usernameOrEmail === 'CUST-001' || input.usernameOrEmail === 'buyer@greenmarket.co.uk') &&
      input.password === 'customer123'
    ) {
      this.currentUser = mockUsers.find((item) => item.role === 'customer') || null
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

export const authService = new MockAuthService()

