import type {
  ActivityLog, AdminStaff, Customer, DeliveryArea,
  Invoice, Order, Payment, Product, StockItem, SupportTicket, User,
} from "../types"

export const mockAdmins: AdminStaff[] = [
  {
    id: "adm-owner",
    name: "Owner Admin",
    email: "owner@punjabfoods.co.uk",
    password: "admin123",
    role: "Owner",
    active: true,
    isSuperAdmin: true,
    permissions: {
      customers: true, prices: true, stock: true, orders: true, enquiries: true,
      tickets: true, payments: true, complaints: true, extracts: true,
      stats: true, admins: true, products: true,
    },
  },
  {
    id: "adm-001",
    name: "Sarah Johnson",
    email: "sarah@punjabfoods.co.uk",
    password: "staff123",
    role: "Manager",
    active: true,
    isSuperAdmin: false,
    permissions: {
      customers: true, prices: true, stock: true, orders: true, enquiries: false,
      tickets: true, payments: true, complaints: true, extracts: true,
      stats: true, admins: false, products: true,
    },
  },
]

export const mockCustomers: Customer[] = [
  {
    id: "c-001",
    companyName: "Fresh Market Ltd",
    contactPerson: "John Smith",
    email: "john@freshmarket.com",
    phone: "07700 900001",
    customerNumber: "CUST-001",
    password: "customer123",
    address: "12 Market Street, Birmingham B1 1AA",
    deliveryArea: "Birmingham",
    paymentTerms: "14 Days",
    balance: 1250.00,
    status: "active",
    lastActivity: "2026-01-10 14:30",
  },
  {
    id: "c-002",
    companyName: "Green Grocers",
    contactPerson: "Emma Davis",
    email: "emma@greengrocers.co.uk",
    phone: "07700 900002",
    customerNumber: "CUST-002",
    password: "customer123",
    address: "45 High Street, London SW1A 1AA",
    deliveryArea: "London",
    paymentTerms: "30 Days",
    balance: 0.00,
    status: "active",
    lastActivity: "2026-01-09 09:15",
  },
  {
    id: "c-003",
    companyName: "Metro Foods",
    contactPerson: "James Wilson",
    email: "james@metrofoods.com",
    phone: "07700 900003",
    customerNumber: "CUST-003",
    password: "customer123",
    address: "78 Oxford Road, Manchester M1 7EA",
    deliveryArea: "Manchester",
    paymentTerms: "Payment Before Order",
    balance: 890.50,
    status: "active",
    lastActivity: "2026-01-08 16:45",
  },
]

export const mockProducts: Product[] = [
  {
    id: "p-001",
    productName: "Premium Mangoes",
    category: "Fruits",
    variety: "Alphonso",
    size: "5kg box",
    sku: "FRUIT-MAN-ALP-5K",
    boxesPerPallet: 40,
    productImage: "",
  },
  {
    id: "p-002",
    productName: "Organic Carrots",
    category: "Vegetables",
    variety: "Nantes",
    size: "10kg bag",
    sku: "VEG-CAR-NAN-10K",
    boxesPerPallet: 60,
    productImage: "",
  },
  {
    id: "p-003",
    productName: "Fresh Coriander",
    category: "Herbs",
    variety: "Common",
    size: "250g bunch",
    sku: "HERB-COR-COM-250",
    boxesPerPallet: 120,
    productImage: "",
  },
  {
    id: "p-004",
    productName: "Baby Spinach",
    category: "Vegetables",
    variety: "Baby Leaf",
    size: "500g pack",
    sku: "VEG-SPN-BLF-500",
    boxesPerPallet: 80,
    productImage: "",
  },
  {
    id: "p-005",
    productName: "Thai Basil",
    category: "Herbs",
    variety: "Thai",
    size: "200g bunch",
    sku: "HERB-BAS-THAI-200",
    boxesPerPallet: 100,
    productImage: "",
  },
]

export const mockStock: StockItem[] = [
  { id: "s-001", productId: "p-001", availableQuantity: 120, price: 18.50, lastUpdated: "2026-01-10", status: "available" },
  { id: "s-002", productId: "p-002", availableQuantity: 85, price: 8.75, lastUpdated: "2026-01-10", status: "available" },
  { id: "s-003", productId: "p-003", availableQuantity: 15, price: 3.20, lastUpdated: "2026-01-09", status: "low" },
  { id: "s-004", productId: "p-004", availableQuantity: 0, price: 4.50, lastUpdated: "2026-01-08", status: "out" },
  { id: "s-005", productId: "p-005", availableQuantity: 64, price: 5.95, lastUpdated: "2026-01-10", status: "available" },
]

export const mockOrders: Order[] = [
  {
    id: "o-001",
    orderNumber: "ORD-1001",
    customerId: "c-001",
    customerName: "Fresh Market Ltd",
    date: "2026-01-10",
    amount: 925.00,
    status: "Confirmed",
    items: [
      { productId: "p-001", quantity: 20, unitPrice: 18.50 },
      { productId: "p-002", quantity: 30, unitPrice: 8.75 },
    ],
  },
  {
    id: "o-002",
    orderNumber: "ORD-1002",
    customerId: "c-002",
    customerName: "Green Grocers",
    date: "2026-01-10",
    amount: 475.00,
    status: "Pending",
    items: [
      { productId: "p-003", quantity: 40, unitPrice: 3.20 },
      { productId: "p-005", quantity: 40, unitPrice: 5.95 },
    ],
  },
  {
    id: "o-003",
    orderNumber: "ORD-1003",
    customerId: "c-001",
    customerName: "Fresh Market Ltd",
    date: "2026-01-09",
    amount: 640.00,
    status: "Delivered",
    items: [
      { productId: "p-004", quantity: 50, unitPrice: 4.50 },
      { productId: "p-002", quantity: 30, unitPrice: 8.75 },
    ],
  },
  {
    id: "o-004",
    orderNumber: "ORD-1004",
    customerId: "c-003",
    customerName: "Metro Foods",
    date: "2026-01-09",
    amount: 1480.00,
    status: "Preparing",
    items: [
      { productId: "p-001", quantity: 40, unitPrice: 18.50 },
      { productId: "p-003", quantity: 80, unitPrice: 3.20 },
      { productId: "p-005", quantity: 20, unitPrice: 5.95 },
    ],
  },
]

export const mockInvoices: Invoice[] = [
  { id: "inv-001", customerId: "c-001", invoiceNumber: "INV-2026-001", amount: 1250.00, dueDate: "2026-01-24", status: "Unpaid" },
  { id: "inv-002", customerId: "c-002", invoiceNumber: "INV-2026-002", amount: 890.50, dueDate: "2026-02-08", status: "Unpaid" },
  { id: "inv-003", customerId: "c-001", invoiceNumber: "INV-2026-003", amount: 640.00, dueDate: "2026-01-23", status: "Paid" },
]

export const mockPayments: Payment[] = [
  { id: "pay-001", customerId: "c-001", paymentReference: "PAY-2026-001", amount: 640.00, date: "2026-01-23", method: "Bank Transfer" },
  { id: "pay-002", customerId: "c-002", paymentReference: "PAY-2026-002", amount: 450.00, date: "2026-01-10", method: "Cheque" },
]

export const mockTickets: SupportTicket[] = [
  { id: "t-001", createdByRole: "customer", customerId: "c-001", subject: "Delivery Delay", message: "Order ORD-1001 was delayed by 2 days", status: "Open", createdAt: "2026-01-10 10:00" },
  { id: "t-002", createdByRole: "admin", customerId: undefined, subject: "Price Review", message: "Need to update mango prices for new season", status: "In Progress", createdAt: "2026-01-09 14:30" },
]

export const mockActivity: ActivityLog[] = [
  { id: "a-001", customerName: "Fresh Market Ltd", action: "Order placed", timestamp: "2026-01-10 14:30" },
  { id: "a-002", customerName: "Green Grocers", action: "Payment received", timestamp: "2026-01-10 11:20" },
  { id: "a-003", customerName: "Metro Foods", action: "Ticket created", timestamp: "2026-01-09 16:45" },
]

export const mockDeliveryAreas: DeliveryArea[] = [
  { id: "da-001", name: "Birmingham", chargePerPallet: 65.00 },
  { id: "da-002", name: "London", chargePerPallet: 85.00 },
  { id: "da-003", name: "Manchester", chargePerPallet: 75.00 },
  { id: "da-004", name: "Leeds", chargePerPallet: 70.00 },
  { id: "da-005", name: "Leicester", chargePerPallet: 65.00 },
]

export const mockUsers: User[] = [
  { id: "adm-owner", role: "admin", username: "admin", email: "owner@punjabfoods.co.uk", displayName: "Owner Admin", isSuperAdmin: true, permissions: mockAdmins[0].permissions },
  { id: "c-001", role: "customer", username: "CUST-001", email: "john@freshmarket.com", displayName: "Fresh Market Ltd", customerNumber: "CUST-001" },
  { id: "c-002", role: "customer", username: "CUST-002", email: "emma@greengrocers.co.uk", displayName: "Green Grocers", customerNumber: "CUST-002" },
  { id: "c-003", role: "customer", username: "CUST-003", email: "james@metrofoods.com", displayName: "Metro Foods", customerNumber: "CUST-003" },
]