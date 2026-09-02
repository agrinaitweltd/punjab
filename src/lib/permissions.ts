import type { AdminRole, PermissionSet, User } from "../types"

export const EMPTY_PERMISSIONS: PermissionSet = {
  customers: false, prices: false, stock: false, orders: false,
  enquiries: false, tickets: false, payments: false, complaints: false,
  extracts: false, stats: false, admins: false, products: false,
  customersCreate: false, customersDelete: false, invoicesDelete: false,
  paymentsRecord: false, paymentsDelete: false, paymentsAllocate: false,
  buyingPricesEdit: false, creditNotesIssue: false, applicationsManage: false,
  usersManage: false, customersEdit: false,
  invoicesView: false, invoicesSendReminders: false, invoicesViewPdfs: false,
  emailImportsView: false, emailImportsReview: false,
  filesView: false, filesDownload: false,
  communicationsView: false, communicationsSend: false,
  statementsView: false,
}

/** Human-readable label for each permission flag - shown as the tickbox
    text in Admin Users so an admin sees "Send Payment Reminders" instead of
    the raw "invoicesSendReminders" key. */
export const PERMISSION_LABELS: Record<keyof PermissionSet, string> = {
  customers: "View Customers", customersEdit: "Edit Customers",
  customersCreate: "Create Customers", customersDelete: "Delete Customers",
  prices: "View Prices", stock: "View Stock", orders: "View Orders", products: "View Products",
  enquiries: "View Enquiries", tickets: "View Messages", complaints: "View Complaints",
  applicationsManage: "Manage Customer Applications",
  payments: "View Payments", paymentsRecord: "Record Payments",
  paymentsAllocate: "Allocate Payments", paymentsDelete: "Delete Payments",
  invoicesView: "View Invoices", invoicesSendReminders: "Send Payment Reminders",
  invoicesViewPdfs: "View Invoice PDFs", invoicesDelete: "Delete Invoices",
  creditNotesIssue: "Issue Credit Notes", statementsView: "View Statements",
  extracts: "Export Data", buyingPricesEdit: "Edit Buying Prices",
  emailImportsView: "View Email Imports", emailImportsReview: "Review Email Imports",
  filesView: "View Files & Documents", filesDownload: "Download Files",
  communicationsView: "View Communications", communicationsSend: "Send Communications",
  stats: "View Analytics & Reports", admins: "View Admin Users",
  usersManage: "Manage Users (Invite / Edit / Disable)",
}

/** Built-in role templates — mirrors the rows seeded into admin_roles by
    schema.sql. Used as the fallback when offline or before that migration
    has run, so the role picker in Admin Users always has something to show.
    A template just fills in the tickboxes below it - an admin can still
    tick or untick anything afterwards before sending the invitation. */
export const FALLBACK_ROLE_TEMPLATES: AdminRole[] = [
  {
    id: "role-super-admin", name: "Super Admin", isSystem: true,
    description: "Full access to every module and action.",
    permissions: {
      ...EMPTY_PERMISSIONS,
      customers: true, prices: true, stock: true, orders: true, enquiries: true,
      tickets: true, payments: true, complaints: true, extracts: true, stats: true,
      admins: true, products: true, customersCreate: true, customersDelete: true,
      invoicesDelete: true, paymentsRecord: true, paymentsDelete: true,
      paymentsAllocate: true, buyingPricesEdit: true, creditNotesIssue: true,
      applicationsManage: true, usersManage: true, customersEdit: true,
      invoicesView: true, invoicesSendReminders: true, invoicesViewPdfs: true,
      emailImportsView: true, emailImportsReview: true,
      filesView: true, filesDownload: true,
      communicationsView: true, communicationsSend: true,
      statementsView: true,
    },
  },
  {
    id: "role-salesperson", name: "Salesperson", isSystem: true,
    description: "Can create customer applications and accounts, and view products/prices. Cannot delete invoices/payments or manage users.",
    permissions: {
      ...EMPTY_PERMISSIONS,
      customers: true, products: true, prices: true, orders: true,
      customersCreate: true, applicationsManage: true,
    },
  },
  {
    id: "role-cashier", name: "Cashier", isSystem: true,
    description: "Records payments, views balances/statements, allocates payments. Cannot edit buying prices or delete customers.",
    permissions: {
      ...EMPTY_PERMISSIONS,
      customers: true, payments: true, stats: true,
      paymentsRecord: true, paymentsAllocate: true,
    },
  },
  {
    id: "role-helper", name: "Helper (View Only)", isSystem: true,
    description: "Can look things up but can't edit, send, delete or record anything. A safe starting point for a new or temporary team member.",
    permissions: {
      ...EMPTY_PERMISSIONS,
      customers: true, invoicesView: true, invoicesViewPdfs: true, filesView: true,
      emailImportsView: true, communicationsView: true, statementsView: true, stats: true,
    },
  },
  {
    id: "role-office-admin", name: "Office Admin", isSystem: true,
    description: "Day-to-day office work: manage customers, send reminders, record payments, review email imports and files. Cannot manage other users.",
    permissions: {
      ...EMPTY_PERMISSIONS,
      customers: true, customersEdit: true, customersCreate: true,
      invoicesView: true, invoicesViewPdfs: true, invoicesSendReminders: true,
      payments: true, paymentsRecord: true, paymentsAllocate: true,
      emailImportsView: true, emailImportsReview: true,
      filesView: true, filesDownload: true,
      communicationsView: true, communicationsSend: true,
      creditNotesIssue: true, statementsView: true, stats: true,
    },
  },
  {
    id: "role-accounts", name: "Accounts & Finance", isSystem: true,
    description: "Full financial visibility and control: payments, invoices, credit notes and data exports. Cannot manage users.",
    permissions: {
      ...EMPTY_PERMISSIONS,
      payments: true, paymentsRecord: true, paymentsAllocate: true, paymentsDelete: true,
      invoicesView: true, invoicesViewPdfs: true, invoicesDelete: true,
      creditNotesIssue: true, statementsView: true, extracts: true, buyingPricesEdit: true, stats: true,
    },
  },
  {
    id: "role-warehouse", name: "Warehouse & Stock", isSystem: true,
    description: "Stock, products and orders only - no access to customer accounts, invoices or payments.",
    permissions: {
      ...EMPTY_PERMISSIONS,
      stock: true, products: true, orders: true, prices: true,
    },
  },
]

/** Central permission check — Super Admins always pass. Everyone else needs
    the specific flag set true on their own admin_staff.permissions row (role
    templates are just a starting point copied in at creation/edit time). */
export function can(user: User | null | undefined, key: keyof PermissionSet): boolean {
  if (!user) return false
  if (user.role !== "admin") return false
  if (user.isSuperAdmin) return true
  return Boolean(user.permissions?.[key])
}
