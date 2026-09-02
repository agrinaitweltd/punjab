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

/** Built-in role templates — mirrors the rows seeded into admin_roles by
    schema.sql. Used as the fallback when offline or before that migration
    has run, so the role picker in Admin Users always has something to show. */
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
