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
  User,
} from '../types'

export const mockUsers: User[] = [
  {
    id: 'u-admin-1',
    role: 'admin',
    username: 'admin',
    email: 'admin@punjabfoods.co.uk',
    displayName: 'Owner Admin',
    permissions: { customers: true, prices: true, stock: true, orders: true, enquiries: true, tickets: true, payments: true, complaints: true, extracts: true, stats: true, admins: true, products: true },
  },
  {
    id: 'u-customer-1',
    role: 'customer',
    username: 'cust001',
    email: 'buyer@greenmarket.co.uk',
    customerNumber: 'CUST-001',
    displayName: 'Green Market Buyer',
  },
]

export const mockCustomers: Customer[] = [
  {
    id: 'c-1',
    companyName: 'Green Market Wholesale',
    contactPerson: 'Adeel Khan',
    email: 'buyer@greenmarket.co.uk',
    phone: '07400 111222',
    customerNumber: 'CUST-001',
    password: 'customer123',
    address: '12 Yardley Road, Birmingham',
    deliveryArea: 'Birmingham',
    paymentTerms: '14 Days',
    balance: 1350,
    status: 'active',
    lastActivity: '2026-07-10 08:42',
  },
  {
    id: 'c-2',
    companyName: 'City Fresh Foods',
    contactPerson: 'Maya Patel',
    email: 'ops@cityfresh.co.uk',
    phone: '07400 223344',
    customerNumber: 'CUST-002',
    password: 'customer123',
    address: '89 Dock Street, London',
    deliveryArea: 'London',
    paymentTerms: 'Payment Before Order',
    balance: 0,
    status: 'active',
    lastActivity: '2026-07-10 09:15',
  },
]

export const mockProducts: Product[] = [
  {
    id: 'p-1',
    productName: 'Vine Tomato',
    category: 'Vegetables',
    variety: '181+ Dutch / Red Cap',
    size: '5kg box',
    sku: 'RED-CAP-181-DUTCH',
    boxesPerPallet: 120,
    productImage: '',
  },
  {
    id: 'p-2',
    productName: 'Green Chilli',
    category: 'Vegetables',
    variety: 'Premium Select',
    size: '4kg box',
    sku: 'GCH-PREM-4KG',
    boxesPerPallet: 100,
    productImage: '',
  },
]

export const mockStock: StockItem[] = [
  {
    id: 's-1',
    productId: 'p-1',
    availableQuantity: 54,
    price: 18.5,
    lastUpdated: '2026-07-10 08:00',
    status: 'available',
  },
  {
    id: 's-2',
    productId: 'p-2',
    availableQuantity: 8,
    price: 22,
    lastUpdated: '2026-07-10 07:50',
    status: 'low',
  },
]

export const mockOrders: Order[] = [
  {
    id: 'o-1',
    orderNumber: 'ORD-1001',
    customerId: 'c-1',
    customerName: 'Green Market Wholesale',
    date: '2026-07-10',
    amount: 740,
    status: 'Pending',
    items: [{ productId: 'p-1', quantity: 40, unitPrice: 18.5 }],
  },
  {
    id: 'o-2',
    orderNumber: 'ORD-1002',
    customerId: 'c-2',
    customerName: 'City Fresh Foods',
    date: '2026-07-09',
    amount: 440,
    status: 'Preparing',
    items: [{ productId: 'p-2', quantity: 20, unitPrice: 22 }],
  },
]

export const mockInvoices: Invoice[] = [
  {
    id: 'i-1',
    customerId: 'c-1',
    invoiceNumber: 'INV-2001',
    amount: 1350,
    dueDate: '2026-07-18',
    status: 'Unpaid',
  },
]

export const mockPayments: Payment[] = [
  {
    id: 'pay-1',
    customerId: 'c-1',
    paymentReference: 'BANK-7761',
    amount: 550,
    date: '2026-07-07',
    method: 'Bank Transfer',
  },
]

export const mockTickets: SupportTicket[] = [
  {
    id: 't-1',
    createdByRole: 'customer',
    customerId: 'c-1',
    subject: 'Delivery timing query',
    message: 'Can the next delivery be moved to early morning?',
    status: 'Open',
    createdAt: '2026-07-10 09:02',
  },
]

export const mockActivity: ActivityLog[] = [
  {
    id: 'a-1',
    customerName: 'Green Market Wholesale',
    action: 'Placed order ORD-1001',
    timestamp: '2026-07-10 08:44',
  },
  {
    id: 'a-2',
    customerName: 'City Fresh Foods',
    action: 'Viewed updated stock list',
    timestamp: '2026-07-10 08:15',
  },
]

export const mockDeliveryAreas: DeliveryArea[] = [
  { id: 'd-1', name: 'Birmingham', chargePerPallet: 65 },
  { id: 'd-2', name: 'London', chargePerPallet: 85 },
]

export const mockAdmins: AdminStaff[] = [
  {
    id: 'adm-1',
    name: 'Owner Admin',
    email: 'admin@punjabfoods.co.uk',
    password: 'admin123',
    role: 'Owner',
    permissions: { customers: true, prices: true, stock: true, orders: true, enquiries: true, tickets: true, payments: true, complaints: true, extracts: true, stats: true, admins: true, products: true },
  },
]


