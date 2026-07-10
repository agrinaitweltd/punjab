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
} from "../types"

export const mockUsers: User[] = [
  { id: "u-admin-1", role: "admin", username: "admin", email: "admin@punjabfoods.co.uk", displayName: "Owner Admin", permissions: { customers: true, prices: true, stock: true, orders: true, enquiries: true, tickets: true, payments: true, complaints: true, extracts: true, stats: true, admins: true, products: true } },
  { id: "u-customer-1", role: "customer", username: "cust001", email: "buyer@greenmarket.co.uk", customerNumber: "CUST-001", displayName: "Green Market Buyer" },
]

export const mockCustomers: Customer[] = [
  { id: "c-1", companyName: "Green Market Wholesale", contactPerson: "Adeel Khan", email: "buyer@greenmarket.co.uk", phone: "07400 111222", customerNumber: "CUST-001", password: "customer123", address: "12 Yardley Road, Birmingham", deliveryArea: "Birmingham", paymentTerms: "14 Days", balance: 1350, status: "active", lastActivity: "2026-07-10 08:42" },
  { id: "c-2", companyName: "City Fresh Foods", contactPerson: "Maya Patel", email: "ops@cityfresh.co.uk", phone: "07400 223344", customerNumber: "CUST-002", password: "customer123", address: "89 Dock Street, London", deliveryArea: "London", paymentTerms: "Payment Before Order", balance: 0, status: "active", lastActivity: "2026-07-10 09:15" },
  { id: "c-3", companyName: "Northern Produce Ltd", contactPerson: "Raj Sharma", email: "raj@northernproduce.co.uk", phone: "07700 334455", customerNumber: "CUST-003", password: "customer123", address: "4 Mill Lane, Manchester", deliveryArea: "Manchester", paymentTerms: "30 Days", balance: 620, status: "active", lastActivity: "2026-07-09 14:30" },
]

export const mockProducts: Product[] = [
  { id: "p-1",  productName: "Vine Tomato",            category: "Vegetables", variety: "181+ Dutch / Red Cap",    size: "5kg box",   sku: "RED-CAP-181-DUTCH",  boxesPerPallet: 120, productImage: "" },
  { id: "p-2",  productName: "Green Chilli",            category: "Vegetables", variety: "Premium Select",          size: "4kg box",   sku: "GCH-PREM-4KG",       boxesPerPallet: 100, productImage: "" },
  { id: "p-3",  productName: "Mango Alphonso",          category: "Fruits",     variety: "Grade A Alphonso",        size: "3kg box",   sku: "MNG-ALPH-3KG",       boxesPerPallet: 80,  productImage: "" },
  { id: "p-4",  productName: "Aubergine",               category: "Vegetables", variety: "Long Purple",             size: "5kg box",   sku: "AUB-LONG-PURP-5KG",  boxesPerPallet: 100, productImage: "" },
  { id: "p-5",  productName: "Butternut Squash",        category: "Vegetables", variety: "Standard",                size: "10kg box",  sku: "BUT-SQU-10KG",       boxesPerPallet: 60,  productImage: "" },
  { id: "p-6",  productName: "Coriander Bunch",         category: "Herbs",      variety: "Fresh Cut",               size: "12 bunch",  sku: "COR-BCH-12",         boxesPerPallet: 150, productImage: "" },
  { id: "p-7",  productName: "Okra (Ladies Finger)",    category: "Vegetables", variety: "Tender Grade A",          size: "4.5kg box", sku: "OKR-A-4.5KG",        boxesPerPallet: 110, productImage: "" },
  { id: "p-8",  productName: "Red Onion",               category: "Vegetables", variety: "Spanish Medium",          size: "25kg bag",  sku: "RED-ONI-SPAN-25KG",  boxesPerPallet: 40,  productImage: "" },
  { id: "p-9",  productName: "Bitter Melon",            category: "Vegetables", variety: "Indian Grade 1",          size: "4kg box",   sku: "BIT-MEL-IND-4KG",    boxesPerPallet: 100, productImage: "" },
  { id: "p-10", productName: "Banana Cavendish",        category: "Fruits",     variety: "Standard Class 1",        size: "13kg box",  sku: "BAN-CAV-13KG",       boxesPerPallet: 48,  productImage: "" },
  { id: "p-11", productName: "Mooli (White Radish)",    category: "Vegetables", variety: "Long White",              size: "10kg box",  sku: "MOO-WHT-10KG",       boxesPerPallet: 60,  productImage: "" },
  { id: "p-12", productName: "Curry Leaves",            category: "Herbs",      variety: "Fresh Branch",            size: "250g pack", sku: "CRY-LVS-250G",       boxesPerPallet: 200, productImage: "" },
]

export const mockStock: StockItem[] = [
  { id: "s-1",  productId: "p-1",  availableQuantity: 54,  price: 18.50, lastUpdated: "2026-07-10 05:00", status: "available" },
  { id: "s-2",  productId: "p-2",  availableQuantity: 8,   price: 22.00, lastUpdated: "2026-07-10 05:00", status: "low" },
  { id: "s-3",  productId: "p-3",  availableQuantity: 0,   price: 32.00, lastUpdated: "2026-07-10 05:00", status: "out" },
  { id: "s-4",  productId: "p-4",  availableQuantity: 30,  price: 14.00, lastUpdated: "2026-07-10 05:00", status: "available" },
  { id: "s-5",  productId: "p-5",  availableQuantity: 22,  price: 19.50, lastUpdated: "2026-07-10 05:00", status: "available" },
  { id: "s-6",  productId: "p-6",  availableQuantity: 5,   price: 9.00,  lastUpdated: "2026-07-10 05:00", status: "low" },
  { id: "s-7",  productId: "p-7",  availableQuantity: 40,  price: 16.00, lastUpdated: "2026-07-10 05:00", status: "available" },
  { id: "s-8",  productId: "p-8",  availableQuantity: 60,  price: 11.00, lastUpdated: "2026-07-10 05:00", status: "available" },
  { id: "s-9",  productId: "p-9",  availableQuantity: 0,   price: 20.00, lastUpdated: "2026-07-10 05:00", status: "out" },
  { id: "s-10", productId: "p-10", availableQuantity: 15,  price: 17.00, lastUpdated: "2026-07-10 05:00", status: "low" },
  { id: "s-11", productId: "p-11", availableQuantity: 35,  price: 12.50, lastUpdated: "2026-07-10 05:00", status: "available" },
  { id: "s-12", productId: "p-12", availableQuantity: 80,  price: 5.50,  lastUpdated: "2026-07-10 05:00", status: "available" },
]

export const mockOrders: Order[] = [
  { id: "o-1", orderNumber: "ORD-1001", customerId: "c-1", customerName: "Green Market Wholesale", date: "2026-07-10", amount: 740,  status: "Pending",   items: [{ productId: "p-1", quantity: 40, unitPrice: 18.50 }] },
  { id: "o-2", orderNumber: "ORD-1002", customerId: "c-2", customerName: "City Fresh Foods",       date: "2026-07-09", amount: 440,  status: "Preparing", items: [{ productId: "p-2", quantity: 20, unitPrice: 22.00 }] },
  { id: "o-3", orderNumber: "ORD-1003", customerId: "c-3", customerName: "Northern Produce Ltd",   date: "2026-07-08", amount: 960,  status: "Delivered", items: [{ productId: "p-3", quantity: 30, unitPrice: 32.00 }] },
]

export const mockInvoices: Invoice[] = [
  { id: "i-1", customerId: "c-1", invoiceNumber: "INV-2001", amount: 1350, dueDate: "2026-07-18", status: "Unpaid" },
]

export const mockPayments: Payment[] = [
  { id: "pay-1", customerId: "c-1", paymentReference: "BANK-7761", amount: 550, date: "2026-07-07", method: "Bank Transfer" },
]

export const mockTickets: SupportTicket[] = [
  { id: "t-1", createdByRole: "customer", customerId: "c-1", subject: "Delivery timing query", message: "Can the next delivery be moved to early morning?", status: "Open", createdAt: "2026-07-10 09:02" },
]

export const mockActivity: ActivityLog[] = [
  { id: "a-1", customerName: "Green Market Wholesale", action: "Placed order ORD-1001",    timestamp: "2026-07-10 08:44" },
  { id: "a-2", customerName: "City Fresh Foods",       action: "Viewed updated stock list", timestamp: "2026-07-10 08:15" },
  { id: "a-3", customerName: "Northern Produce Ltd",   action: "Paid invoice INV-2001",     timestamp: "2026-07-09 16:00" },
]

export const mockDeliveryAreas: DeliveryArea[] = [
  { id: "d-1", name: "Birmingham",  chargePerPallet: 65 },
  { id: "d-2", name: "London",      chargePerPallet: 85 },
  { id: "d-3", name: "Manchester",  chargePerPallet: 75 },
  { id: "d-4", name: "Leeds",       chargePerPallet: 70 },
  { id: "d-5", name: "Leicester",   chargePerPallet: 65 },
]

export const mockAdmins: AdminStaff[] = [
  { id: "adm-1", name: "Owner Admin", email: "admin@punjabfoods.co.uk", password: "admin123", role: "Owner", permissions: { customers: true, prices: true, stock: true, orders: true, enquiries: true, tickets: true, payments: true, complaints: true, extracts: true, stats: true, admins: true, products: true } },
]