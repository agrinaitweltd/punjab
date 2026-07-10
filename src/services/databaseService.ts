import type {
  ActivityLog,
  AdminStaff,
  Customer,
  DeliveryArea,
  Invoice,
  Order,
  Payment,
  Product,
  StockItem,
  SupportTicket,
} from '../types'
import {
  mockActivity,
  mockAdmins,
  mockCustomers,
  mockDeliveryAreas,
  mockInvoices,
  mockOrders,
  mockPayments,
  mockProducts,
  mockStock,
  mockTickets,
} from '../data/mockData'

class MockDatabaseService {
  private customers: Customer[] = [...mockCustomers]
  private products: Product[] = [...mockProducts]
  private stock: StockItem[] = [...mockStock]
  private orders: Order[] = [...mockOrders]
  private invoices: Invoice[] = [...mockInvoices]
  private payments: Payment[] = [...mockPayments]
  private tickets: SupportTicket[] = [...mockTickets]
  private activity: ActivityLog[] = [...mockActivity]
  private deliveryAreas: DeliveryArea[] = [...mockDeliveryAreas]
  private admins: AdminStaff[] = [...mockAdmins]

  async getCustomers(): Promise<Customer[]> {
    return [...this.customers]
  }

  async createCustomer(input: Omit<Customer, 'id' | 'lastActivity' | 'status' | 'balance'>): Promise<Customer> {
    const customer: Customer = {
      ...input,
      id: `c-${Date.now()}`,
      lastActivity: new Date().toISOString(),
      status: 'active',
      balance: 0,
    }
    this.customers = [customer, ...this.customers]
    return customer
  }

  async updateCustomer(customerId: string, input: Partial<Customer>): Promise<Customer | null> {
    const index = this.customers.findIndex((item) => item.id === customerId)
    if (index < 0) return null
    this.customers[index] = { ...this.customers[index], ...input }
    return this.customers[index]
  }

  async deleteCustomer(customerId: string): Promise<boolean> {
    const before = this.customers.length
    this.customers = this.customers.filter((item) => item.id !== customerId)
    return before !== this.customers.length
  }

  async getProducts(): Promise<Product[]> {
    return [...this.products]
  }

  async createProduct(input: Omit<Product, 'id'>): Promise<Product> {
    const product: Product = { ...input, id: `p-${Date.now()}` }
    this.products = [product, ...this.products]
    return product
  }

  async updateProduct(productId: string, input: Partial<Product>): Promise<Product | null> {
    const index = this.products.findIndex((item) => item.id === productId)
    if (index < 0) return null
    this.products[index] = { ...this.products[index], ...input }
    return this.products[index]
  }

  async deleteProduct(productId: string): Promise<boolean> {
    const before = this.products.length
    this.products = this.products.filter((item) => item.id !== productId)
    this.stock = this.stock.filter((item) => item.productId !== productId)
    return before !== this.products.length
  }

  async getStock(): Promise<StockItem[]> {
    return [...this.stock]
  }

  async updateStock(stockId: string, input: Partial<StockItem>): Promise<StockItem | null> {
    const index = this.stock.findIndex((item) => item.id === stockId)
    if (index < 0) return null
    this.stock[index] = {
      ...this.stock[index],
      ...input,
      lastUpdated: new Date().toLocaleString(),
    }
    return this.stock[index]
  }

  async getOrders(): Promise<Order[]> {
    return [...this.orders]
  }

  async createOrder(input: Omit<Order, 'id' | 'orderNumber' | 'date' | 'status'>): Promise<Order> {
    const order: Order = {
      ...input,
      id: `o-${Date.now()}`,
      orderNumber: `ORD-${Math.floor(1000 + Math.random() * 9000)}`,
      date: new Date().toISOString().slice(0, 10),
      status: 'Pending',
    }
    this.orders = [order, ...this.orders]
    return order
  }

  async updateOrder(orderId: string, input: Partial<Order>): Promise<Order | null> {
    const index = this.orders.findIndex((item) => item.id === orderId)
    if (index < 0) return null
    this.orders[index] = { ...this.orders[index], ...input }
    return this.orders[index]
  }

  async getInvoices(): Promise<Invoice[]> {
    return [...this.invoices]
  }

  async getPayments(): Promise<Payment[]> {
    return [...this.payments]
  }

  async getTickets(): Promise<SupportTicket[]> {
    return [...this.tickets]
  }

  async createTicket(input: Omit<SupportTicket, 'id' | 'createdAt' | 'status'>): Promise<SupportTicket> {
    const ticket: SupportTicket = {
      ...input,
      id: `t-${Date.now()}`,
      createdAt: new Date().toLocaleString(),
      status: 'Open',
    }
    this.tickets = [ticket, ...this.tickets]
    return ticket
  }

  async getActivity(): Promise<ActivityLog[]> {
    return [...this.activity]
  }

  async getDeliveryAreas(): Promise<DeliveryArea[]> {
    return [...this.deliveryAreas]
  }

  async getAdmins(): Promise<AdminStaff[]> {
    return [...this.admins]
  }

  async createAdmin(input: Omit<AdminStaff, 'id'>): Promise<AdminStaff> {
    const admin = { ...input, id: `adm-${Date.now()}` }
    this.admins = [admin, ...this.admins]
    return admin
  }
}

export const databaseService = new MockDatabaseService()

