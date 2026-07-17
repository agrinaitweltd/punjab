export type UserRole = 'admin' | 'customer'

export interface PermissionSet {
  customers: boolean
  prices: boolean
  stock: boolean
  orders: boolean
  enquiries: boolean
  tickets: boolean
  payments: boolean
  complaints: boolean
  extracts: boolean
  stats: boolean
  admins: boolean
  products: boolean
}

export interface User {
  id: string
  role: UserRole
  username: string
  email: string
  displayName: string
  customerNumber?: string
  isSuperAdmin?: boolean
  permissions?: PermissionSet
}

export interface Customer {
  id: string
  companyName: string
  contactPerson: string
  email: string
  phone: string
  customerNumber: string
  password: string
  address: string
  deliveryArea: string
  paymentTerms: string
  balance: number
  status: 'active' | 'inactive'
  lastActivity: string
}

export interface Product {
  id: string
  productName: string
  category: string
  variety: string
  size: string
  sku: string
  boxesPerPallet: number
  productImage: string
}

export interface StockItem {
  id: string
  productId: string
  availableQuantity: number
  price: number
  lastUpdated: string
  status: 'available' | 'low' | 'out'
}

export type OrderStatus =
  | 'Pending'
  | 'Confirmed'
  | 'Preparing'
  | 'Delivered'
  | 'Cancelled'

export interface OrderItem {
  productId: string
  quantity: number
  unitPrice: number
}

export interface Order {
  id: string
  orderNumber: string
  customerId: string
  customerName: string
  date: string
  amount: number
  status: OrderStatus
  items: OrderItem[]
  fulfilment?: 'Delivery' | 'Collection'
  deliveryAddress?: string
}

export interface Invoice {
  id: string
  customerId: string
  invoiceNumber: string
  amount: number
  dueDate: string
  status: 'Unpaid' | 'Part Paid' | 'Paid'
}

export interface Payment {
  id: string
  customerId: string
  paymentReference: string
  amount: number
  date: string
  method: string
}

export interface SupportTicket {
  id: string
  createdByRole: UserRole
  customerId?: string
  subject: string
  message: string
  status: 'Open' | 'In Progress' | 'Closed'
  createdAt: string
}

export interface ActivityLog {
  id: string
  customerName: string
  action: string
  timestamp: string
}

export interface DeliveryArea {
  id: string
  name: string
  chargePerPallet: number
}

export interface AdminStaff {
  id: string
  name: string
  email: string
  password: string
  role: string
  active: boolean
  isSuperAdmin?: boolean
  permissions: PermissionSet
}
