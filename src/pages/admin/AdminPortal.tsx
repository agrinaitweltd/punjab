import { useCallback, useEffect, useRef, useState } from 'react'
import { AppLayout } from '../../components/layout/AppLayout'
import { ToastStack } from '../../components/ToastStack'
import { useUnseenCount, useLiveToasts, usePoll } from '../../lib/notifications'
import { ADMIN_NOTIFY_EMAIL, sendEmail, welcomeEmailHtml, paymentReceivedEmailHtml, overdueEmailHtml, orderPaymentRequiredEmailHtml, paymentApprovedEmailHtml, paymentRejectedEmailHtml, paymentReminderEmailHtml } from '../../lib/emailService'
import { getCreditStatus } from '../../lib/creditControl'
import { APPROVED_INVOICE_TEMPLATE_ID, dataUriBase64, findInvoicePdf, uploadFile } from '../../lib/fileService'
import { generateCanonicalInvoicePdf } from '../../lib/canonicalInvoice'
import { confirmAction, showNotice, showAppError, showSuccess } from '../../lib/appDialogs'
import { getInvoiceItems, saveInvoiceItems } from '../../services/invoiceItemService'
import { saveCreditNoteItems } from '../../services/creditNoteItemService'
import { findDuplicateCreditNote, findDuplicateInvoice, matchImportedCustomer } from '../../lib/importMatching'
import type { ImportedCreditNote, ImportedFinancialDocument } from '../../lib/invoiceImport'
import { listPaymentProofs, approvePaymentProof, rejectPaymentProof, type PaymentProof } from '../../lib/paymentProofService'
import { createCustomer, deleteCustomer, getCustomers, updateCustomer } from '../../api/customersApi'
import { createProduct, deleteProduct, getProducts, updateProduct } from '../../api/productsApi'
import { getStock, updateStock } from '../../api/stockApi'
import { getOrders, updateOrder } from '../../api/ordersApi'
import { useRealtimeSync } from '../../lib/useRealtimeSync'
import { mapCustomer, mapInvoice, mapPayment, mapCreditNote, mapCreditNoteAllocation } from '../../services/databaseService'
import {
  createDeliveryArea,
  createTicket,
  deleteDeliveryArea,
  getActivity,
  getAdmins,
  getDeliveryAreas,
  getInvoices,
  getPayments,
  getTickets,
  updateDeliveryArea,
  updateTicketStatus,
  createInvoice,
  createPayment,
  updateInvoice,
  getAdminRoles,
  logActivity,
  getCreditNotes,
  getCreditNoteAllocations,
  createCreditNote,
  updateCreditNote,
  applyCreditNoteToInvoice,
  getCustomerApplications,
  updateCustomerApplication,
  getBuyingSessions,
  getOrCreateBuyingSession,
  updateBuyingSession,
  getBuyingPrices,
  createBuyingPrice,
  updateBuyingPrice,
  deleteBuyingPrice,
  getNotificationLogs,
  createNotificationLog,
  getSuppliers,
  createSupplier,
  updateSupplier,
  deleteSupplier,
  getDayTrades,
  createDayTrade,
  getSalesmen,
  createSalesman,
  updateSalesman,
  deleteSalesman,
  getAssignedTasks,
  createAssignedTask,
  updateAssignedTaskStatus,
  getCustomerSubAccounts,
  updateCustomerSubAccount,
  getWhatsAppLogs,
  getWhatsAppTemplates,
  createWhatsAppTemplate,
  updateWhatsAppTemplate,
} from '../../api/miscApi'
import { sendWhatsAppDocument, sendWhatsAppMessage, retryWhatsAppMessage, sendInvoiceMessage, sendPaymentReceived, sendOrderConfirmed, sendOrderPacked, sendOrderDelivered, sendAccountApproved, sendAccountSuspended, invalidateTemplateCache } from '../../lib/whatsapp'
import { WhatsAppLogsPage } from './WhatsAppLogsPage'
import { WhatsAppSendPage } from './WhatsAppSendPage'
import { attachCreditAllocations, computeCreditApplication, invoiceOutstanding, invoiceStatusFor } from '../../lib/creditNotes'
import { currentTradingDate } from '../../lib/tradingDate'
import type {
  ActivityLog,
  AdminStaff,
  AssignedTask,
  BuyingPrice,
  BuyingSession,
  Customer,
  CustomerSubAccount,
  DayTrade,
  NotificationLog,
  Supplier,
  CreditNote,
  CreditNoteAllocation,
  CustomerApplication,
  DeliveryArea,
  Invoice,
  Order,
  Payment,
  Product,
  StockItem,
  SupportTicket,
  User,
  WhatsAppLog,
  WhatsAppTemplate,
  Expense,
} from '../../types'
import { AdminsPage } from './AdminsPage'
import { ComplaintsPage } from './ComplaintsPage'
import { CreditControlPage } from './CreditControlPage'
import { CreditNotesPage } from './CreditNotesPage'
import { CustomerApplicationsPage } from './CustomerApplicationsPage'
import { PaymentProofsPage } from './PaymentProofsPage'
import { CustomersPage } from './CustomersPage'
import { DashboardHome } from './DashboardHome'
import { DeliveryAreasPage } from './DeliveryAreasPage'
import { InvoicesPage } from './InvoicesPage'
import { OutstandingInvoicesPage } from './OutstandingInvoicesPage'
import { CreateInvoicePage } from './CreateInvoicePage'
import { InvoiceNumbersPage } from './InvoiceNumbersPage'
import { SalesLoginPage } from './SalesLoginPage'
import { AnalyticsPage } from './AnalyticsPage'
import { DayTradePage } from './DayTradePage'
import { DayCheckPage } from './DayCheckPage'
import { totalSales, totalProfit, toProductsById, completedSales } from '../../lib/analytics'
import { loadSalesLogin, saveSalesLogin } from '../../lib/salesmen'
import type { Salesman } from '../../types'
import { OrdersPage } from './OrdersPage'
import { PaymentsPage } from './PaymentsPage'
import { ProductsPage } from './ProductsPage'
import { FilesPage } from './FilesPage'
import { BuyingDeskPage } from './BuyingDeskPage'
import { SuppliersPage } from './SuppliersPage'
import { SalesUsersPage } from './SalesUsersPage'
import { AssignTaskPage } from './AssignTaskPage'
import { SubAccountApprovalsPage } from './SubAccountApprovalsPage'
import { PaymentRemindersPage } from './PaymentRemindersPage'
import { SettingsPage } from './SettingsPage'
import { SimpleModulePage } from './SimpleModulePage'
import { StockPage } from './StockPage'
import { TicketsPage } from './TicketsPage'
import { ExpensesPage } from './ExpensesPage'
import { GlobalSearchPage } from './GlobalSearchPage'
import { CommunicationHistoryPage } from './CommunicationHistoryPage'
import { SystemDeveloperPage } from './SystemDeveloperPage'
import { DatabaseResetPage } from './DatabaseResetPage'
import { LoginActivityPage } from './LoginActivityPage'
import { createExpense, deleteExpense, getExpenses } from '../../services/expenseService'
import { inviteAdmin, inviteCustomer, manageAdmin, resetAdminCredentials, getEmailImports, type EmailImportRow } from '../../lib/secureAdminApi'
import { EmailImportsPage } from './EmailImportsPage'
import { NotFoundPage } from './NotFoundPage'
import { getCommunicationDeliveryLogs, type CommunicationDeliveryLog } from '../../services/communicationLogService'
import { getNotifications, markNotificationRead, markAllNotificationsRead, mapNotificationRow } from '../../lib/notificationsService'
import type { AppNotification } from '../../types'

export function AdminPortal({ user, onLogout }: { user: User; onLogout: () => void }) {
  const [current, setCurrent] = useState('dashboard')
  const [customers, setCustomers] = useState<Customer[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [stock, setStock] = useState<StockItem[]>([])
  const [orders, setOrders] = useState<Order[]>([])
  const [activity, setActivity] = useState<ActivityLog[]>([])
  const [admins, setAdmins] = useState<AdminStaff[]>([])
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [payments, setPayments] = useState<Payment[]>([])
  const [tickets, setTickets] = useState<SupportTicket[]>([])
  const [deliveryAreas, setDeliveryAreas] = useState<DeliveryArea[]>([])
  const [paymentProofs, setPaymentProofs] = useState<PaymentProof[]>([])
  const [creditNotes, setCreditNotes] = useState<CreditNote[]>([])
  const [creditNoteAllocations, setCreditNoteAllocations] = useState<CreditNoteAllocation[]>([])
  const [applications, setApplications] = useState<CustomerApplication[]>([])
  const [buyingSessions, setBuyingSessions] = useState<BuyingSession[]>([])
  const [buyingPrices, setBuyingPrices] = useState<BuyingPrice[]>([])
  const [notificationLogs, setNotificationLogs] = useState<NotificationLog[]>([])
  const [openAddCustomerRequest, setOpenAddCustomerRequest] = useState(0)
  const [invoicesCustomerFilter, setInvoicesCustomerFilter] = useState<string | null>(null)
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [openCreditNoteId, setOpenCreditNoteId] = useState<string | null>(null)
  const [salesLogin, setSalesLogin] = useState<Salesman | null>(() => loadSalesLogin())
  const [dayTrades, setDayTrades] = useState<DayTrade[]>([])
  const [salesmen, setSalesmen] = useState<Salesman[]>([])
  const [assignedTasks, setAssignedTasks] = useState<AssignedTask[]>([])
  const [subAccounts, setSubAccounts] = useState<CustomerSubAccount[]>([])
  const [whatsappLogs, setWhatsappLogs] = useState<WhatsAppLog[]>([])
  const [whatsappTemplates, setWhatsappTemplates] = useState<WhatsAppTemplate[]>([])
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [communicationLogs, setCommunicationLogs] = useState<CommunicationDeliveryLog[]>([])
  const [emailImports, setEmailImports] = useState<EmailImportRow[]>([])
  const [notifications, setNotifications] = useState<AppNotification[]>([])
  const [globalSearchTerm, setGlobalSearchTerm] = useState('')

  const load = useCallback(async () => {
    const [
      customersData,
      productsData,
      stockData,
      ordersData,
      activityData,
      adminsData,
      invoicesData,
      paymentsData,
      ticketsData,
      deliveryAreasData,
      paymentProofsData,
      creditNotesData,
      creditNoteAllocationsData,
      applicationsData,
      buyingSessionsData,
      buyingPricesData,
      notificationLogsData,
      suppliersData,
      dayTradesData,
      salesmenData,
      assignedTasksData,
      subAccountsData,
      whatsappLogsData,
      whatsappTemplatesData,
      expensesData,
      communicationLogsData,
      emailImportsData,
      notificationsData,
    ] = await Promise.all([
      getCustomers(),
      getProducts(),
      getStock(),
      getOrders(),
      getActivity(),
      getAdmins(),
      getInvoices(),
      getPayments(),
      getTickets(),
      getDeliveryAreas(),
      listPaymentProofs(),
      getCreditNotes(),
      getCreditNoteAllocations(),
      getCustomerApplications(),
      getBuyingSessions(),
      getBuyingPrices(),
      getNotificationLogs(),
      getSuppliers(),
      getDayTrades(),
      getSalesmen(),
      getAssignedTasks(),
      getCustomerSubAccounts(),
      getWhatsAppLogs(),
      getWhatsAppTemplates(),
      getExpenses(),
      getCommunicationDeliveryLogs(),
      getEmailImports().then(r => r.imports).catch(() => []),
      getNotifications(),
    ])

    setCustomers(customersData)
    setProducts(productsData)
    setStock(stockData)
    setOrders(ordersData)
    setActivity(activityData)
    setAdmins(adminsData)
    setInvoices(attachCreditAllocations(invoicesData, creditNoteAllocationsData))
    setPayments(paymentsData)
    setTickets(ticketsData)
    setDeliveryAreas(deliveryAreasData)
    setPaymentProofs(paymentProofsData)
    setCreditNotes(creditNotesData)
    setCreditNoteAllocations(creditNoteAllocationsData)
    setApplications(applicationsData)
    setBuyingSessions(buyingSessionsData)
    setBuyingPrices(buyingPricesData)
    setNotificationLogs(notificationLogsData)
    setSuppliers(suppliersData)
    setDayTrades(dayTradesData)
    setSalesmen(salesmenData)
    setAssignedTasks(assignedTasksData)
    setSubAccounts(subAccountsData)
    setWhatsappLogs(whatsappLogsData)
    setWhatsappTemplates(whatsappTemplatesData)
    setExpenses(expensesData)
    setCommunicationLogs(communicationLogsData)
    setEmailImports(emailImportsData)
    setNotifications(notificationsData)
  }, [])

  // Load once on mount. Individual actions patch their own slice of state
  // directly (see e.g. importCustomerDocuments) instead of triggering a full
  // 26-table reload, so we don't need to re-run this on every page click.
  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Cross-admin realtime sync: one Supabase channel per table for the whole
  // session (not per-page), patching only the affected row - never a
  // refetch. creditNoteAllocations is mirrored into a ref so the invoice/
  // allocation handlers below can recompute the derived `creditApplied`
  // field without needing to resubscribe whenever allocations change.
  const creditNoteAllocationsRef = useRef<CreditNoteAllocation[]>([])
  useEffect(() => { creditNoteAllocationsRef.current = creditNoteAllocations }, [creditNoteAllocations])

  const upsertById = <T extends { id: string }>(setter: React.Dispatch<React.SetStateAction<T[]>>, row: T) =>
    setter(list => list.some(item => item.id === row.id) ? list.map(item => item.id === row.id ? row : item) : [...list, row])
  const removeById = <T extends { id: string }>(setter: React.Dispatch<React.SetStateAction<T[]>>, id: string) =>
    setter(list => list.filter(item => item.id !== id))

  useRealtimeSync({
    customers: {
      map: mapCustomer,
      onInsert: row => upsertById(setCustomers, row),
      onUpdate: row => upsertById(setCustomers, row),
      onDelete: id => removeById(setCustomers, id),
    },
    invoices: {
      map: mapInvoice,
      onInsert: row => setInvoices(list => attachCreditAllocations(list.some(i => i.id === row.id) ? list.map(i => i.id === row.id ? row : i) : [...list, row], creditNoteAllocationsRef.current)),
      onUpdate: row => setInvoices(list => attachCreditAllocations(list.map(i => i.id === row.id ? row : i), creditNoteAllocationsRef.current)),
      onDelete: id => removeById(setInvoices, id),
    },
    payments: {
      map: mapPayment,
      onInsert: row => upsertById(setPayments, row),
      onUpdate: row => upsertById(setPayments, row),
      onDelete: id => removeById(setPayments, id),
    },
    credit_notes: {
      map: mapCreditNote,
      onInsert: row => upsertById(setCreditNotes, row),
      onUpdate: row => upsertById(setCreditNotes, row),
      onDelete: id => removeById(setCreditNotes, id),
    },
    credit_note_allocations: {
      map: mapCreditNoteAllocation,
      onInsert: row => setCreditNoteAllocations(list => {
        const next = list.some(a => a.id === row.id) ? list.map(a => a.id === row.id ? row : a) : [...list, row]
        setInvoices(current => attachCreditAllocations(current, next))
        return next
      }),
      onDelete: id => setCreditNoteAllocations(list => {
        const next = list.filter(a => a.id !== id)
        setInvoices(current => attachCreditAllocations(current, next))
        return next
      }),
    },
    // email_imports rows are already snake_case end to end (there's no
    // separate camelCase client type for this one), so the "map" is just an
    // identity pass-through - the mailbox worker and this realtime channel
    // agree on the row shape directly.
    email_imports: {
      map: row => row as EmailImportRow,
      onInsert: row => upsertById(setEmailImports, row),
      onUpdate: row => upsertById(setEmailImports, row),
    },
    notifications: {
      map: mapNotificationRow,
      onInsert: row => upsertById(setNotifications, row),
      onUpdate: row => upsertById(setNotifications, row),
    },
  })

  // The background poll only needs to catch orders/tickets created by other
  // users while this admin stays on one page — it doesn't need the other 24
  // tables `load()` fetches, so it gets its own much cheaper query.
  const loadLive = useCallback(async () => {
    const [ordersData, ticketsData] = await Promise.all([getOrders(), getTickets()])
    setOrders(ordersData)
    setTickets(ticketsData)
  }, [])
  usePoll(loadLive, 20000)

  const { unseenCount: newOrders, markAllSeen: markOrdersSeen } = useUnseenCount(orders, `punjab-seen-orders-${user.id}`)
  const { unseenCount: newTickets, markAllSeen: markTicketsSeen } = useUnseenCount(tickets, `punjab-seen-tickets-${user.id}`)
  const pendingProofsCount = paymentProofs.filter(p => p.status === 'pending').length
  const canRecordPayments = Boolean(user.isSuperAdmin || user.permissions?.paymentsRecord)
  const { toasts, dismiss } = useLiveToasts(orders, (prevById, o) =>
    prevById.has(o.id) ? null : { id: `order-${o.id}`, title: "New order received", body: `${o.orderNumber} — ${o.customerName} — £${o.amount.toFixed(2)}` })

  const tradingDate = currentTradingDate(dayTrades)

  const navigate = (key: string) => {
    if (key === 'add-customer') {
      if (!user.isSuperAdmin && !user.permissions?.customersCreate) return
      setOpenAddCustomerRequest(value => value + 1)
      setCurrent('customers')
      return
    }
    setCurrent(key)
    if (key !== 'invoices') setInvoicesCustomerFilter(null)
    if (key === 'orders') markOrdersSeen()
    if (key === 'tickets') markTicketsSeen()
  }

  const sendInvoiceReminderPdf = async (invoice: Invoice, customer: Customer) => {
    const storedPdf = await findInvoicePdf(customer.id, invoice.invoiceNumber, invoice.id, invoice.amount)
    if (!storedPdf) {
      const error = `Invoice PDF ${invoice.invoiceNumber} is missing. Generate or upload the official invoice PDF, then retry.`
      const channels: Array<'email' | 'whatsapp'> = []
      if (customer.email) channels.push('email')
      if (customer.phone) channels.push('whatsapp')
      await Promise.all(channels.map(channel => createNotificationLog({ invoiceId: invoice.id, customerId: customer.id, channel, status: 'Failed', error })))
      await sendEmail(ADMIN_NOTIFY_EMAIL, `Invoice PDF Missing - ${customer.companyName} - ${invoice.invoiceNumber}`, `<p>${error}</p><p>Customer: ${customer.companyName}<br>Account: ${customer.customerNumber}<br>Due date: ${invoice.dueDate}</p>`, undefined, { category: 'system', customerId: customer.id, invoiceId: invoice.id, communicationType: 'invoice_pdf_missing' })
      void logActivity(user.displayName, `invoice reminder failed for ${invoice.invoiceNumber}: official PDF missing`)
      throw new Error(error)
    }
    const outstanding = invoiceOutstanding(invoice)
    const base64 = dataUriBase64(storedPdf.dataUri)
    const results: boolean[] = []
    if (customer.email) {
      const sent = await sendEmail(customer.email, `Payment Reminder - Invoice ${invoice.invoiceNumber}`, paymentReminderEmailHtml(customer.contactPerson || customer.companyName, invoice.invoiceNumber, outstanding, invoice.dueDate, `${window.location.origin}/customer`), [{ filename: storedPdf.name, content: base64 }], { category: 'notifications', customerId: customer.id, invoiceId: invoice.id, idempotencyKey: `invoice:${invoice.id}:manual-reminder:${new Date().toISOString().slice(0, 10)}`, communicationType: 'payment_reminder' })
      results.push(sent.ok)
      await createNotificationLog({ invoiceId: invoice.id, customerId: customer.id, channel: 'email', status: sent.ok ? 'Sent' : 'Failed', sentAt: sent.ok ? new Date().toISOString() : undefined, error: sent.error })
    }
    if (customer.phone) {
      const message = `Hello ${customer.contactPerson || customer.companyName}, invoice ${invoice.invoiceNumber} has an outstanding balance of £${outstanding.toFixed(2)} and is due ${invoice.dueDate}. The original invoice PDF is attached.`
      const sent = await sendWhatsAppDocument(customer.phone, message, storedPdf.name, base64, { customerId: customer.id, customerName: customer.companyName, createdBy: user.displayName })
      results.push(sent.status === 'Sent')
      await createNotificationLog({ invoiceId: invoice.id, customerId: customer.id, channel: 'whatsapp', status: sent.status === 'Sent' ? 'Sent' : 'Failed', sentAt: sent.status === 'Sent' ? new Date().toISOString() : undefined, error: sent.status === 'Sent' ? undefined : sent.response })
    }
    if (!results.length) throw new Error('This customer has no email address or telephone number.')
    if (!results.every(Boolean)) throw new Error('The invoice was not sent on every available channel. Check Communication History and retry.')
    void logActivity(user.displayName, `sent original invoice PDF reminder for ${invoice.invoiceNumber}`)
  }

  const regenerateInvoicePdf = async (invoice: Invoice, customer: Customer) => {
    const items = await getInvoiceItems(invoice.id)
    const pdf = await generateCanonicalInvoicePdf(invoice, customer, items)
    const stored = await uploadFile(pdf.fileName, 'application/pdf', pdf.blob.size, pdf.dataUri, `Invoices: ${invoice.invoiceNumber}`, customer.id, customer.companyName, { invoiceId: invoice.id, invoiceNumber: invoice.invoiceNumber, invoiceAmount: invoice.amount, documentRole: 'canonical_invoice', templateId: APPROVED_INVOICE_TEMPLATE_ID })
    const updated = await updateInvoice(invoice.id, { canonicalDocumentId: stored.id, canonicalPdfFileName: stored.name, canonicalPdfGeneratedAt: new Date().toISOString() })
    if (!updated) throw new Error('The official PDF was generated but could not be linked to the invoice.')
    void logActivity(user.displayName, `regenerated official PDF for invoice ${invoice.invoiceNumber}`)
    await load()
  }

  const dayEnd = async () => {
    const closingDate = tradingDate
    if (dayTrades.some(dt => dt.date === closingDate)) {
      showNotice(`${closingDate} has already been closed as a Day Trade.`)
      return
    }
    const todaysSales = completedSales(orders).filter(o => o.date === closingDate)
    if (!await confirmAction(`Close trading for ${closingDate}? This archives ${todaysSales.length} sale(s) as a permanent Day Trade record, ends buying for that date, and moves new sales/buying to the next day. This cannot be undone.`)) return
    const productsById = toProductsById(products)
    try {
      // Credit-term sales aren't invoiced at confirm time (only "pay before
      // order" ones are) — Day End is when they're finally invoiced and
      // added to the customer's balance, one invoice per sale not already billed.
      for (const sale of todaysSales) {
        const invoiceNumber = `INV-${sale.orderNumber}`
        if (invoices.some(i => i.invoiceNumber === invoiceNumber)) continue
        const customer = customers.find(c => c.id === sale.customerId)
        if (!customer) continue
        const due = new Date(closingDate + "T00:00:00")
        due.setDate(due.getDate() + (customer.creditDays ?? 14))
        await createInvoice({
          customerId: customer.id, invoiceNumber, amount: sale.amount,
          date: closingDate, dueDate: due.toISOString().slice(0, 10), status: 'Unpaid',
        })
        await updateCustomer(customer.id, { balance: (customer.balance ?? 0) + sale.amount })
      }
      await createDayTrade({
        date: closingDate,
        totalSales: totalSales(todaysSales),
        totalProfit: totalProfit(todaysSales, productsById),
        saleCount: todaysSales.length,
        closedAt: new Date().toISOString(),
        closedBy: user.displayName,
      })
      // Close out that date's buying session too, if one was ever started.
      const closingSession = buyingSessions.find(s => s.date === closingDate)
      if (closingSession && closingSession.status === 'Open') {
        await updateBuyingSession(closingSession.id, { status: 'Closed' })
      }
      void logActivity(user.displayName, `closed trading day ${closingDate} (${todaysSales.length} sales)`)
      await load()
      navigate('day-trade')
    } catch {
      showNotice("Couldn't close the trading day. Please try again or contact support if the problem continues.")
    }
  }

  const handleMarkNotificationRead = (id: string) => {
    upsertById(setNotifications, { ...(notifications.find(n => n.id === id) as AppNotification), id, read: true })
    void markNotificationRead(id)
  }
  const handleMarkAllNotificationsRead = () => {
    setNotifications(list => list.map(n => ({ ...n, read: true })))
    void markAllNotificationsRead()
  }
  const handleOpenNotification = (notification: AppNotification) => {
    switch (notification.targetType) {
      case 'customer':
        if (notification.targetId) { setInvoicesCustomerFilter(notification.targetId); navigate('invoices') }
        break
      case 'invoice':
        if (notification.targetId) { setInvoicesCustomerFilter(null); navigate('invoices') }
        break
      case 'payment':
        navigate('payments')
        break
      case 'credit_note':
        if (notification.targetId) setOpenCreditNoteId(notification.targetId)
        navigate('credit-notes')
        break
      case 'email_import':
        navigate('email-imports')
        break
      default:
        navigate('dashboard')
    }
  }

  const importCustomerDocuments = async (documents: ImportedFinancialDocument[], onProgress?: (stage: string) => void) => {
    if (!documents.length) throw new Error('Select at least one document to import.')
    onProgress?.('Checking existing customers')
    const importedCustomer = documents[0].customer
    const accounts = new Set(documents.map(document => document.customer.accountNumber.replace(/[^a-z0-9]/gi, '').toLowerCase()).filter(Boolean))
    if (accounts.size > 1) throw new Error('The selected documents belong to different customer accounts.')
    let customer = matchImportedCustomer(customers, importedCustomer)
    if (!customer && documents.every(document => document.documentType === 'credit_note')) {
      throw new Error('Create the customer from an invoice first, then add the credit note from their customer account.')
    }
    if (!customer) {
      if (!importedCustomer.companyName.trim() || !importedCustomer.accountNumber.trim()) throw new Error('Confirm the customer name and account number before importing.')
      onProgress?.('Saving to Supabase')
      customer = await createCustomer({
        companyName: importedCustomer.companyName, contactPerson: '',
        email: importedCustomer.email || `${importedCustomer.accountNumber}@pending.punjab.local`,
        phone: importedCustomer.phone,
        customerNumber: importedCustomer.accountNumber.replace(/[^a-z0-9]/gi, '').toUpperCase(),
        password: `pending-${Math.random().toString(36).slice(2, 12)}`,
        address: [importedCustomer.address, importedCustomer.postcode].filter(Boolean).join(', '),
        deliveryArea: '', paymentTerms: '14 Days', creditDays: 14,
      })
      void logActivity(user.displayName, `created customer ${customer.companyName} from imported documents`)
    } else {
      const updatedCustomer = await updateCustomer(customer.id, {
        companyName: importedCustomer.companyName || customer.companyName,
        phone: importedCustomer.phone || customer.phone,
        email: importedCustomer.email || customer.email,
        address: [importedCustomer.address, importedCustomer.postcode].filter(Boolean).join(', ') || customer.address,
      })
      if (updatedCustomer) customer = updatedCustomer
    }
    const savedCustomer = customer

    const availableInvoices = [...invoices]
    const availableCredits = [...creditNotes]
    const newInvoices: Invoice[] = []
    const newCreditNotes: CreditNote[] = []
    let workingBalance = invoices.filter(invoice => invoice.customerId === savedCustomer.id).reduce((sum, invoice) => sum + invoiceOutstanding(invoice), 0)

    onProgress?.('Validating')
    for (const document of documents) {
      if (document.documentType === 'invoice') {
        const issueDate = document.invoice.date || new Date().toISOString().slice(0, 10)
        if (findDuplicateInvoice(availableInvoices, { invoiceNumber: document.invoice.invoiceNumber, customerId: savedCustomer.id, date: issueDate })) throw new Error('This invoice has already been imported for that customer and date.')
        if (availableInvoices.some(invoice => invoice.invoiceNumber.trim().toLowerCase() === document.invoice.invoiceNumber.trim().toLowerCase())) throw new Error('That invoice number already exists.')
        const due = new Date(`${issueDate}T00:00:00`); due.setDate(due.getDate() + (savedCustomer.creditDays ?? 14))
        onProgress?.('Saving to Supabase')
        const createdInvoice = await createInvoice({
          customerId: savedCustomer.id, invoiceNumber: document.invoice.invoiceNumber, date: issueDate,
          dueDate: due.toISOString().slice(0, 10), amount: document.invoice.grandTotal,
          amountPaid: 0, status: document.invoice.grandTotal > 0 ? 'Unpaid' : 'Paid',
          totalGoods: document.invoice.totalGoods, totalVat: document.invoice.vat, packages: document.invoice.packages,
          importedMetadata: { accountNumber: importedCustomer.accountNumber, deliveryAccount: document.invoice.deliveryAccount, salesman: document.invoice.salesman, vatSummary: document.vatSummary },
        })
        await saveInvoiceItems(createdInvoice.id, document.items)
        onProgress?.('Saving PDF')
        // The source upload and canonical-PDF generation don't depend on each
        // other - only on the invoice/customer/items above - so they run
        // concurrently instead of as two sequential round trips.
        const [source, canonical] = await Promise.all([
          document.source
            ? uploadFile(document.source.name, document.source.type, document.source.size, document.source.dataUri, `Invoices: Original source for ${createdInvoice.invoiceNumber}`, savedCustomer.id, savedCustomer.companyName, { invoiceId: createdInvoice.id, invoiceNumber: createdInvoice.invoiceNumber, invoiceAmount: createdInvoice.amount, documentRole: 'legacy_source' })
            : Promise.resolve(undefined),
          generateCanonicalInvoicePdf(createdInvoice, savedCustomer, document.items),
        ])
        const official = await uploadFile(canonical.fileName, 'application/pdf', canonical.blob.size, canonical.dataUri, `Invoices: ${createdInvoice.invoiceNumber}`, savedCustomer.id, savedCustomer.companyName, { invoiceId: createdInvoice.id, invoiceNumber: createdInvoice.invoiceNumber, invoiceAmount: createdInvoice.amount, documentRole: 'canonical_invoice', templateId: APPROVED_INVOICE_TEMPLATE_ID })
        const linked = await updateInvoice(createdInvoice.id, { sourceDocumentId: source?.id, canonicalDocumentId: official.id, canonicalPdfFileName: official.name, canonicalPdfGeneratedAt: new Date().toISOString() })
        if (!linked) throw new Error('The invoice was imported, but its PDF references could not be linked.')
        const finalInvoice = { ...createdInvoice, sourceDocumentId: source?.id, canonicalDocumentId: official.id, canonicalPdfFileName: official.name, creditApplied: 0 }
        availableInvoices.push(finalInvoice)
        newInvoices.push(finalInvoice)
        workingBalance = Math.max(0, workingBalance + document.invoice.grandTotal)
        void logActivity(user.displayName, `imported invoice ${createdInvoice.invoiceNumber} for ${savedCustomer.companyName} (${document.items.length} product rows)`)
        continue
      }

      const sourceCreditNumber = document.creditNote.creditNumber.trim()
      if (sourceCreditNumber) {
        const identity = { creditNumber: sourceCreditNumber, customerId: savedCustomer.id, date: document.creditNote.date }
        if (findDuplicateCreditNote(availableCredits, identity)) throw new Error('This credit note has already been imported for that customer and date.')
        if (availableCredits.some(note => note.creditNumber.trim().toLowerCase() === sourceCreditNumber.toLowerCase())) throw new Error('That credit note number already exists.')
      }
      const accountingAmount = Math.abs(document.creditNote.grandTotal)
      onProgress?.('Saving to Supabase')
      const note = await createCreditNote({
        creditNumber: sourceCreditNumber || undefined, customerId: savedCustomer.id, amount: accountingAmount,
        reason: document.creditNote.originalInvoiceReference ? `Imported credit for invoice ${document.creditNote.originalInvoiceReference}` : 'Imported credit note',
        date: document.creditNote.date, status: 'Active', remainingBalance: accountingAmount,
        originalInvoiceReference: document.creditNote.originalInvoiceReference,
        totalGoods: document.creditNote.totalGoods, totalVat: document.creditNote.vat,
        sourceFileName: document.source?.name,
        importedMetadata: { accountNumber: importedCustomer.accountNumber, deliveryAccount: document.creditNote.deliveryAccount, salesman: document.creditNote.salesman, packages: document.creditNote.packages, sourceGrandTotal: document.creditNote.grandTotal, vatSummary: document.vatSummary },
      })
      await saveCreditNoteItems(note.id, document.items)
      let sourceDocumentId: string | undefined
      let finalNote = note
      if (document.source) {
        onProgress?.('Saving PDF')
        const source = await uploadFile(document.source.name, document.source.type, document.source.size, document.source.dataUri, `Credit Notes: Original source for ${note.creditNumber}`, savedCustomer.id, savedCustomer.companyName, { creditNoteId: note.id, creditNoteNumber: note.creditNumber, creditNoteAmount: note.amount, documentRole: 'credit_note_source' })
        sourceDocumentId = source.id
        if (!await updateCreditNote(note.id, { sourceDocumentId, sourceFileName: source.name })) throw new Error('The credit note was imported, but its source PDF could not be linked.')
        finalNote = { ...note, sourceDocumentId, sourceFileName: source.name }
      }
      availableCredits.push(finalNote)
      newCreditNotes.push(finalNote)
      void logActivity(user.displayName, `imported credit note ${note.creditNumber} for ${savedCustomer.companyName} (${document.items.length} product rows)`)
    }

    await updateCustomer(savedCustomer.id, { balance: workingBalance })
    onProgress?.('Complete')

    // Patch local state directly instead of a full 26-table reload - this is
    // the whole "Import Customer -> Continue" latency the full `load()` used
    // to add on top of an already-multi-step operation. Must dedupe by id
    // (upsertById, not a blind append) - the realtime `customers`/`invoices`
    // INSERT event for the row(s) this same write just created can arrive
    // before this line runs, and a blind append after that would render the
    // same customer/invoice twice.
    const updatedCustomer = { ...savedCustomer, balance: workingBalance }
    upsertById(setCustomers, updatedCustomer)
    for (const invoice of newInvoices) upsertById(setInvoices, invoice)
    for (const note of newCreditNotes) upsertById(setCreditNotes, note)

    return { customerName: savedCustomer.companyName, accountNumber: savedCustomer.customerNumber }
  }

  // Shared by InvoicesPage's "Paid" checkbox, OutstandingInvoicesPage's
  // payment modal, and the customer-scoped invoice view - one path for
  // recording a payment so behaviour (balance sync, receipt email, realtime
  // propagation via the setInvoices/setCustomers/setPayments merges below)
  // stays identical everywhere an admin can mark/record a payment.
  const recordInvoicePayment = async (invoice: Invoice, amount: number) => {
    const outstanding = invoiceOutstanding(invoice)
    if (amount <= 0) throw new Error('Payment amount must be greater than zero.')
    if (amount > outstanding + 0.005) throw new Error(`Payment exceeds the £${outstanding.toFixed(2)} outstanding balance.`)
    const newPaid = (invoice.amountPaid ?? 0) + amount
    const newStatus = invoiceStatusFor(invoice.amount, newPaid, invoice.creditApplied ?? 0)
    const newPayment = await createPayment({ customerId: invoice.customerId, invoiceId: invoice.id, amount, date: currentTradingDate(dayTrades), method: 'Bank Transfer' })
    await updateInvoice(invoice.id, { amountPaid: newPaid, status: newStatus })
    setInvoices(list => list.map(item => item.id === invoice.id ? { ...item, amountPaid: newPaid, status: newStatus } : item))
    upsertById(setPayments, newPayment)
    const customer = customers.find(c => c.id === invoice.customerId)
    if (customer) {
      const synchronizedBalance = invoices
        .filter(item => item.customerId === customer.id)
        .reduce((sum, item) => sum + invoiceOutstanding(item.id === invoice.id ? { ...item, amountPaid: newPaid } : item), 0)
      await updateCustomer(customer.id, { balance: synchronizedBalance })
      setCustomers(list => list.map(c => c.id === customer.id ? { ...c, balance: synchronizedBalance } : c))
      if (newStatus === 'Paid') {
        void sendPaymentReceived(invoice, customer, amount, user.displayName)
        if (customer.email) void sendEmail(customer.email, `Payment Received - Invoice ${invoice.invoiceNumber}`, paymentReceivedEmailHtml(invoice.invoiceNumber, customer.companyName, amount, 'Manual confirmation', currentTradingDate(dayTrades)), undefined, { category: 'notifications', customerId: customer.id, invoiceId: invoice.id, communicationType: 'payment_received' })
      }
    }
    void logActivity(user.displayName, `recorded payment of £${amount.toFixed(2)} for invoice ${invoice.invoiceNumber}`)
    showSuccess('Payment recorded successfully')
  }

  const page = () => {
    if (current === 'dashboard') {
      return (
        <DashboardHome
          customers={customers}
          products={products}
          orders={orders}
          stock={stock}
          activity={activity}
          invoices={invoices}
          payments={payments}
          expenses={expenses}
          userName={user.displayName}
          onNavigate={navigate}
        />
      )
    }

    if (current === 'global-search') return <GlobalSearchPage key={globalSearchTerm} customers={customers} invoices={invoices} onNavigate={navigate} initialQuery={globalSearchTerm} />
    // Login Activity is available to every active admin, not just System
    // Developers - an admin needs to be able to audit activity on their own
    // account. The endpoint and RLS policy behind it allow the same.
    if (current === 'login-activity') return <LoginActivityPage />
    if (['system-overview', 'system-users', 'audit-logs', 'error-log', 'test-mode', 'backup-recovery', 'system-health', 'security'].includes(current)) {
      return user.isSystemDeveloper ? <SystemDeveloperPage section={current} /> : <SettingsPage onNavigate={navigate} isSystemDeveloper={user.isSystemDeveloper} />
    }
    if (current === 'database-reset') {
      return user.isSystemDeveloper ? <DatabaseResetPage /> : <SettingsPage onNavigate={navigate} isSystemDeveloper={user.isSystemDeveloper} />
    }
    if (current === 'communication-history') return <CommunicationHistoryPage customers={customers} invoices={invoices} emailLogs={notificationLogs} deliveryLogs={communicationLogs} whatsappLogs={whatsappLogs} onNavigate={navigate} />

    if (current === 'session') {
      const canEditBuying = user.isSuperAdmin || Boolean(user.permissions?.buyingPricesEdit)
      return (
        <BuyingDeskPage
          sessions={buyingSessions}
          prices={buyingPrices}
          products={products}
          suppliers={suppliers}
          canEdit={canEditBuying}
          initialDate={tradingDate}
          onStartSession={async (date) => {
            await getOrCreateBuyingSession(date)
            await load()
          }}
          onAddPrice={async (input) => {
            await createBuyingPrice({ ...input, confirmed: false })
            void logActivity(user.displayName, `added buying price for ${input.product} from ${input.supplier} (£${input.price.toFixed(2)})`)
            await load()
          }}
          onUpdatePrice={async (id, input) => {
            await updateBuyingPrice(id, input)
            await load()
          }}
          onDeletePrice={async (id) => {
            await deleteBuyingPrice(id)
            await load()
          }}
          onConfirm={async (price) => {
            await updateBuyingPrice(price.id, { confirmed: true })
            void logActivity(user.displayName, `confirmed order for ${price.product} from ${price.supplier} (£${price.price.toFixed(2)})`)
            await load()
          }}
          onEndDailyBuying={async (session, confirmedPrices) => {
            // Move confirmed produce into Stock — hidden (status "out", qty 0)
            // until an admin sets quantity & selling price on the Stock page.
            const allProducts = await getProducts()
            const stock = await getStock()
            for (const cp of confirmedPrices) {
              const product = allProducts.find(p => p.productName.toLowerCase() === cp.product.toLowerCase())
              const stockRow = product && stock.find(s => s.productId === product.id)
              if (stockRow) {
                await updateStock(stockRow.id, { availableQuantity: 0, status: 'out' })
              }
            }
            if (session.status !== 'Closed') await updateBuyingSession(session.id, { status: 'Closed' })
            void logActivity(user.displayName, `sent buying for ${session.date} to Stock — ${confirmedPrices.length} item(s) (${session.status === 'Closed' ? 'extra session' : 'first session'})`)
            await load()
            navigate('stock')
          }}
          onCreateSupplier={async (input) => {
            await createSupplier(input)
            void logActivity(user.displayName, `added supplier ${input.name}`)
            await load()
          }}
        />
      )
    }

    if (current === 'sales-users') {
      return (
        <SalesUsersPage
          salesmen={salesmen}
          onCreate={async (input) => {
            await createSalesman(input)
            void logActivity(user.displayName, `added sales user ${input.name} (#${input.number})`)
            await load()
          }}
          onUpdate={async (id, input) => {
            await updateSalesman(id, input)
            await load()
          }}
          onDelete={async (id) => {
            const target = salesmen.find(s => s.id === id)
            await deleteSalesman(id)
            void logActivity(user.displayName, `deleted sales user${target ? ` ${target.name}` : ""}`)
            await load()
          }}
        />
      )
    }

    if (current === 'assign-task') {
      return (
        <AssignTaskPage
          tasks={assignedTasks}
          admins={admins}
          currentAdminId={user.id}
          onAssign={async (assignedToId, title, description) => {
            const target = admins.find(a => a.id === assignedToId)
            await createAssignedTask({
              title, description, assignedToId, assignedToName: target?.name ?? "",
              assignedByName: user.displayName,
            })
            if (target?.email) {
              void sendEmail(target.email, `New task assigned: ${title}`,
                `<p>Hi ${target.name},</p><p><strong>${user.displayName}</strong> assigned you a task:</p>
                 <p style="font-size:16px;font-weight:700;margin:12px 0 4px">${title}</p>
                 ${description ? `<p style="color:#4b5563">${description}</p>` : ""}
                 <p style="margin-top:20px"><a href="${window.location.origin}" style="color:#1f7a3a;font-weight:700">Open Punjab Exotic Foods Portal →</a></p>`, undefined, { category: 'system', communicationType: 'task_assigned' })
            }
            void logActivity(user.displayName, `assigned task "${title}" to ${target?.name ?? assignedToId}`)
            await load()
          }}
          onMarkDone={async (id) => {
            await updateAssignedTaskStatus(id, 'Done')
            await load()
          }}
        />
      )
    }

    if (current === 'sub-accounts') {
      return (
        <SubAccountApprovalsPage
          subAccounts={subAccounts}
          onDecide={async (account, status) => {
            await updateCustomerSubAccount(account.id, { status })
            void sendEmail(account.email, status === 'Approved'
              ? "Your Punjab Exotic Foods team account is approved"
              : "Your Punjab Exotic Foods team account request",
              status === 'Approved'
                ? `<p>Hi ${account.name},</p><p>Your team login for <strong>${account.customerName}</strong> has been approved. You can now sign in with your email and password.</p>`
                : `<p>Hi ${account.name},</p><p>Your request for a team login under <strong>${account.customerName}</strong> was not approved. Please contact ${account.customerName} for details.</p>`, undefined, { category: 'accounts', customerId: account.customerId, communicationType: 'team_account_status' })
            void logActivity(user.displayName, `${status === 'Approved' ? 'approved' : 'rejected'} sub-account ${account.name} (${account.customerName})`)
            await load()
          }}
        />
      )
    }

    if (current === 'email-imports') {
      return (
        <EmailImportsPage
          imports={emailImports}
          customers={customers}
          onRefresh={async () => { setEmailImports((await getEmailImports()).imports) }}
          onOpenCustomer={(customerId) => { setInvoicesCustomerFilter(customerId); navigate('invoices') }}
        />
      )
    }

    if (current === 'whatsapp-logs') {
      return (
        <WhatsAppLogsPage
          logs={whatsappLogs}
          onRetry={async (log) => {
            await retryWhatsAppMessage(log, user.displayName)
            await load()
          }}
        />
      )
    }

    if (current === 'whatsapp-send') {
      return (
        <WhatsAppSendPage
          logs={whatsappLogs}
          templates={whatsappTemplates}
          onSend={async (phone, message) => {
            await sendWhatsAppMessage(phone, message, { type: 'Custom', createdBy: user.displayName })
            await load()
          }}
          onSaveTemplate={async (name, message) => {
            await createWhatsAppTemplate({ name, type: 'Custom', message })
            invalidateTemplateCache()
            await load()
          }}
          onUpdateTemplate={async (id, message) => {
            await updateWhatsAppTemplate(id, { message })
            invalidateTemplateCache()
            await load()
          }}
        />
      )
    }

    if (current === 'suppliers') {
      return (
        <SuppliersPage
          suppliers={suppliers}
          prices={buyingPrices}
          canManage={user.isSuperAdmin || Boolean(user.permissions?.buyingPricesEdit)}
          onCreate={async (input) => {
            await createSupplier(input)
            void logActivity(user.displayName, `added supplier ${input.name}`)
            await load()
          }}
          onUpdate={async (id, input) => {
            await updateSupplier(id, input)
            await load()
          }}
          onDelete={async (id) => {
            const target = suppliers.find(s => s.id === id)
            await deleteSupplier(id)
            void logActivity(user.displayName, `deleted supplier${target ? ` ${target.name}` : ""}`)
            await load()
          }}
        />
      )
    }

    if (current === 'files') {
          return <FilesPage customers={customers} invoices={invoices} />
    }

    if (current === 'customers') {
      return (
        <CustomersPage
          openAddRequest={openAddCustomerRequest}
          customers={customers}
          deliveryAreas={deliveryAreas}
          invoices={invoices}
          payments={payments}
          creditNotes={creditNotes}
          creditNoteAllocations={creditNoteAllocations}
          onCreate={async (input) => {
            await createCustomer(input)
            if (input.email) {
              void sendEmail(input.email, "Welcome to the Punjab Exotic Foods Portal",
                welcomeEmailHtml(input.contactPerson || input.companyName, "customer", window.location.origin), undefined, { category: 'signup', communicationType: 'customer_welcome' })
            }
            await load()
          }}
          onCreateFromDocuments={importCustomerDocuments}
          canCreditNotes={user.isSuperAdmin || Boolean(user.permissions?.creditNotesIssue)}
          onAddCreditNote={async (customer, document: ImportedCreditNote, invoiceId) => {
            const amount = Math.abs(document.creditNote.grandTotal)
            const invoice = invoiceId ? invoices.find(item => item.id === invoiceId && item.customerId === customer.id) : undefined
            if (invoiceId && !invoice) throw new Error('The selected invoice does not belong to this customer.')
            if (invoice && amount > invoiceOutstanding(invoice)) throw new Error(`Invoice ${invoice.invoiceNumber} only has £${invoiceOutstanding(invoice).toFixed(2)} outstanding.`)
            const note = await createCreditNote({
              creditNumber: document.creditNote.creditNumber.trim() || undefined,
              customerId: customer.id,
              amount,
              reason: document.creditNote.originalInvoiceReference ? `Imported credit for invoice ${document.creditNote.originalInvoiceReference}` : 'Imported customer credit',
              date: document.creditNote.date,
              status: 'Active',
              remainingBalance: amount,
              originalInvoiceReference: document.creditNote.originalInvoiceReference,
              totalGoods: document.creditNote.totalGoods,
              totalVat: document.creditNote.vat,
              sourceFileName: document.source?.name,
              importedMetadata: { accountNumber: customer.customerNumber, deliveryAccount: document.creditNote.deliveryAccount, salesman: document.creditNote.salesman, packages: document.creditNote.packages, sourceGrandTotal: document.creditNote.grandTotal, vatSummary: document.vatSummary },
            })
            await saveCreditNoteItems(note.id, document.items)
            if (document.source) {
              const source = await uploadFile(document.source.name, document.source.type, document.source.size, document.source.dataUri, `Credit Notes: Original source for ${note.creditNumber}`, customer.id, customer.companyName, { creditNoteId: note.id, creditNoteNumber: note.creditNumber, creditNoteAmount: note.amount, documentRole: 'credit_note_source' })
              if (!await updateCreditNote(note.id, { sourceDocumentId: source.id, sourceFileName: source.name })) throw new Error('The credit note was saved, but its source document could not be linked.')
            }
            if (invoice) {
              await applyCreditNoteToInvoice(note.id, invoice.id, amount, document.creditNote.date)
              const synchronizedBalance = Math.max(0, invoices.filter(item => item.customerId === customer.id).reduce((sum, item) => sum + invoiceOutstanding(item), 0) - amount)
              await updateCustomer(customer.id, { balance: synchronizedBalance })
            }
            void logActivity(user.displayName, `${invoice ? `applied ${note.creditNumber} to ${invoice.invoiceNumber}` : `saved ${note.creditNumber} as unallocated credit`} for ${customer.companyName}`)
            await load()
          }}
          onNavigate={navigate}
          onOpenInvoices={(customer) => { setInvoicesCustomerFilter(customer.id); navigate('invoices') }}
          onInviteCustomer={async (accountNumber, email, phone) => {
            const customer=customers.find(c=>c.customerNumber===accountNumber)
            if(!customer) throw new Error('Customer account not found')
            await updateCustomer(customer.id,{email,phone})
            await inviteCustomer(customer.id, email)
            void logActivity(user.displayName,`sent portal invitation to ${customer.companyName} (${email})`)
            await load()
          }}
          onUpdate={async (id, input) => {
            await updateCustomer(id, input)
            await load()
          }}
          onDelete={async (id) => {
            const target = customers.find(c => c.id === id)
            await deleteCustomer(id)
            void logActivity(user.displayName, `deleted customer${target ? ` ${target.companyName}` : ""}`)
            await load()
          }}
          canDelete={user.isSuperAdmin || Boolean(user.permissions?.customersDelete)}
          canCreate={user.isSuperAdmin || Boolean(user.permissions?.customersCreate)}
          whatsappTemplates={whatsappTemplates}
          onSendWhatsApp={async (phone, message, customer) => {
            await sendWhatsAppMessage(phone, message, { type: 'Custom', customerId: customer.id, customerName: customer.companyName, createdBy: user.displayName })
            await load()
          }}
          onSaveWhatsAppTemplate={async (name, message) => {
            await createWhatsAppTemplate({ name, type: 'Custom', message })
            invalidateTemplateCache()
            await load()
          }}
        />
      )
    }

    if (current === 'products') {
      return (
        <ProductsPage
          products={products}
          stock={stock}
          onCreate={async (input) => {
            await createProduct(input)
            await load()
          }}
          onUpdate={async (id, input) => {
            await updateProduct(id, input)
            await load()
          }}
          onDelete={async (id) => {
            await deleteProduct(id)
            await load()
          }}
        />
      )
    }

    if (current === 'stock') {
      return (
        <StockPage
          products={products}
          stock={stock}
          onNavigate={navigate}
          onUpdateStock={async (id, input) => {
            await updateStock(id, input)
            await load()
          }}
        />
      )
    }

    if (current === 'orders') {
      if (!salesLogin) {
        return <SalesLoginPage onLogin={(s) => { saveSalesLogin(s); setSalesLogin(s) }} />
      }
      return (
        <OrdersPage
          orders={orders}
          products={products}
          invoices={invoices}
          customers={customers}
          stock={stock}
          tradingDate={tradingDate}
          onSalePlaced={load}
          onUpdateOrder={async (id, input) => {
            const order = orders.find(o => o.id === id)
            // Approving an order (Pending -> Confirmed) is the credit-control checkpoint:
            // if the customer requires payment before order, or this order would push
            // them over their credit limit, invoice it immediately, freeze their
            // account from placing further orders, and email them to pay. Otherwise
            // it's within their agreed credit terms — proceed normally ("pay later").
            if (order && order.status === 'Pending' && input.status === 'Confirmed') {
              const customer = customers.find(c => c.id === order.customerId)
              if (customer) {
                const status = getCreditStatus(customer, invoices)
                const creditLimit = customer.creditLimit ?? 0
                const projectedOutstanding = status.outstanding + order.amount
                const requiresPaymentNow = customer.paymentTerms === 'Payment Before Order' ||
                  (creditLimit > 0 && projectedOutstanding > creditLimit)
                if (requiresPaymentNow) {
                  const today = new Date().toISOString().slice(0, 10)
                  const newInvoice = await createInvoice({
                    customerId: customer.id, invoiceNumber: `INV-${order.orderNumber}`,
                    amount: order.amount, date: today, dueDate: today, status: 'Unpaid',
                  })
                  // Pay-before-order customers see their balance move the moment
                  // the order is confirmed — credit customers wait until Day End.
                  await updateCustomer(customer.id, { blocked: true, balance: (customer.balance ?? 0) + order.amount })
                  if (customer.email) {
                    void sendEmail(customer.email, `Payment needed — order ${order.orderNumber}`,
                      orderPaymentRequiredEmailHtml(customer.contactPerson || customer.companyName, order.orderNumber, order.amount, today), undefined, { category: 'notifications', customerId: customer.id, communicationType: 'order_payment_required' })
                  }
                  void sendInvoiceMessage(newInvoice, customer, user.displayName)
                }
              }
            }
            // Editing a ticket's items/amount before Day End — if it was already
            // invoiced (pay-before-order sales are, immediately), keep that
            // invoice and the customer's balance in sync with the new total.
            // Credit-term sales aren't invoiced yet at this point, so nothing
            // extra is needed there — Day End will bill the corrected amount.
            if (input.amount !== undefined && order) {
              const existingInvoice = invoices.find(i => i.invoiceNumber === `INV-${order.orderNumber}`)
              if (existingInvoice && existingInvoice.status !== 'Paid') {
                const delta = input.amount - existingInvoice.amount
                await updateInvoice(existingInvoice.id, { amount: input.amount })
                if (delta !== 0) {
                  const customer = customers.find(c => c.id === order.customerId)
                  if (customer) await updateCustomer(customer.id, { balance: Math.max(0, (customer.balance ?? 0) + delta) })
                }
              }
            }
            await updateOrder(id, input)
            if (input.status === 'Confirmed' || input.status === 'Preparing' || input.status === 'Delivered') {
              const updatedOrder = order ? { ...order, ...input } : orders.find(o => o.id === id)
              const customer = customers.find(c => c.id === updatedOrder?.customerId)
              if (updatedOrder) {
                if (input.status === 'Confirmed') void sendOrderConfirmed(updatedOrder, customer, user.displayName)
                if (input.status === 'Preparing') void sendOrderPacked(updatedOrder, customer, user.displayName)
                if (input.status === 'Delivered') void sendOrderDelivered(updatedOrder, customer, user.displayName)
              }
            }
            await load()
          }}
          onMarkPaid={!canRecordPayments ? undefined : async (order) => {
            const invoiceNumber = `INV-${order.orderNumber}`
            const today = new Date().toISOString().slice(0, 10)
            // An invoice may already exist (created when the order was confirmed and
            // payment was required upfront) — update it instead of creating a
            // duplicate, which would collide on the unique invoice_number.
            const existing = invoices.find(i => i.invoiceNumber === invoiceNumber)
            const cashAmount = existing ? invoiceOutstanding(existing) : order.amount
            const newPaid = (existing?.amountPaid ?? 0) + cashAmount
            const invoice = existing
              ? await updateInvoice(existing.id, { amountPaid: newPaid, status: invoiceStatusFor(existing.amount, newPaid, existing.creditApplied ?? 0) })
              : await createInvoice({ customerId: order.customerId, invoiceNumber, amount: order.amount, amountPaid: order.amount, dueDate: today, status: 'Paid' })
            const payment = cashAmount > 0
              ? await createPayment({ customerId: order.customerId, amount: cashAmount, date: today, method: 'Bank Transfer' })
              : null
            const customer = customers.find(c => c.id === order.customerId)
            if (customer?.email && payment) {
              void sendEmail(customer.email, `Payment received for order ${order.orderNumber}`,
                paymentReceivedEmailHtml(order.orderNumber, customer.contactPerson || customer.companyName, cashAmount, payment.paymentReference, today), undefined, { category: 'notifications', customerId: customer.id, communicationType: 'payment_received' })
            }
            if (customer && invoice && cashAmount > 0) void sendPaymentReceived(invoice, customer, cashAmount, user.displayName)
            // Paying an invoice brings the balance back down — and once this
            // invoice is paid, check whether the customer is still over their
            // limit or has other overdue invoices; if not, lift the freeze.
            if (customer) {
              const updatedInvoices = invoice ? invoices.map(i => i.id === invoice.id ? { ...i, amountPaid: newPaid, status: 'Paid' as const } : i) : invoices
              const stillOverdue = customer.blocked && getCreditStatus(customer, updatedInvoices).isOverdue
              await updateCustomer(customer.id, {
                balance: Math.max(0, (customer.balance ?? 0) - cashAmount),
                ...(customer.blocked ? { blocked: stillOverdue } : {}),
              })
            }
            void logActivity(user.displayName, `marked order ${order.orderNumber} as paid`)
            await load()
          }}
        />
      )
    }

    if (current === 'invoices') {
      return (
        <InvoicesPage
          invoices={invoices}
          customers={customers}
          creditNotes={creditNotes}
          allocations={creditNoteAllocations}
          onOpenCreditNote={(id) => { setOpenCreditNoteId(id); navigate('credit-notes') }}
          onNavigate={navigate}
          onRecordPayment={recordInvoicePayment}
          customerId={invoicesCustomerFilter}
          onClearCustomerFilter={() => setInvoicesCustomerFilter(null)}
        />
      )
    }

    if (current === 'outstanding') {
      return <OutstandingInvoicesPage invoices={invoices} customers={customers} onSendReminder={async (invoice, customer) => {
        await sendInvoiceReminderPdf(invoice, customer)
        await load()
      }} onRecordPayment={recordInvoicePayment} />
    }

    if (current === 'create-invoice') {
      return <CreateInvoicePage customers={customers} invoices={invoices} userName={user.displayName} onCreated={load} />
    }

    if (current === 'day-trade') {
      return <DayTradePage dayTrades={dayTrades} orders={orders} products={products} />
    }

    if (current === 'day-check') {
      return <DayCheckPage orders={orders} products={products} buyingPrices={buyingPrices} />
    }

    if (current === 'invoice-numbers') {
      return (
        <InvoiceNumbersPage
          orders={orders}
          onSave={async (orderId, officialInvoiceNumber) => {
            await updateOrder(orderId, { officialInvoiceNumber })
            void logActivity(user.displayName, `set invoice number ${officialInvoiceNumber} for sale ${orders.find(o => o.id === orderId)?.orderNumber ?? orderId}`)
            await load()
          }}
        />
      )
    }

    if (current === 'payment-proofs') {
      return (
        <PaymentProofsPage
          proofs={paymentProofs}
          canRecord={canRecordPayments}
          onApprove={async (proof) => {
            const selectedInvoices = proof.invoiceIds.map(id => invoices.find(invoice => invoice.id === id)).filter((invoice): invoice is Invoice => Boolean(invoice))
            const selectedOutstanding = selectedInvoices.reduce((sum, invoice) => sum + invoiceOutstanding(invoice), 0)
            if (proof.amount > selectedOutstanding + 0.005) throw new Error('Payment proof amount exceeds the selected invoice balance.')
            let remainingPayment = proof.amount
            const paidByInvoice = new Map<string, number>()
            for (const invoice of selectedInvoices) {
              const applied = Math.min(remainingPayment, invoiceOutstanding(invoice))
              if (applied <= 0) continue
              const newPaid = (invoice.amountPaid ?? 0) + applied
              await updateInvoice(invoice.id, { amountPaid: newPaid, status: invoiceStatusFor(invoice.amount, newPaid, invoice.creditApplied ?? 0) })
              paidByInvoice.set(invoice.id, newPaid)
              remainingPayment -= applied
            }
            if (remainingPayment > 0.005) throw new Error('Payment proof could not be allocated to the selected invoices.')
            await createPayment({ customerId: proof.customerId, amount: proof.amount, date: new Date().toISOString().slice(0, 10), method: 'Bank Transfer (Verified)' })
            await approvePaymentProof(proof.id)
            const customer = customers.find(c => c.id === proof.customerId)
            if (customer?.email) {
              void sendEmail(customer.email, 'Payment confirmed — thank you',
                paymentApprovedEmailHtml(customer.contactPerson || customer.companyName, proof.invoiceNumbers, proof.amount), undefined, { category: 'notifications', customerId: customer.id, communicationType: 'payment_approved' })
            }
            const paidInvoice = invoices.find(i => proof.invoiceIds.includes(i.id))
            if (customer && paidInvoice) void sendPaymentReceived(paidInvoice, customer, proof.amount, user.displayName)
            // Paying brings the balance down, and lifts a payment-required
            // freeze once the account is back within terms.
            if (customer) {
              const updatedInvoices = invoices.map(invoice => {
                const amountPaid = paidByInvoice.get(invoice.id)
                return amountPaid === undefined ? invoice : { ...invoice, amountPaid, status: invoiceStatusFor(invoice.amount, amountPaid, invoice.creditApplied ?? 0) }
              })
              const stillOverdue = customer.blocked && getCreditStatus(customer, updatedInvoices).isOverdue
              await updateCustomer(customer.id, {
                balance: Math.max(0, (customer.balance ?? 0) - proof.amount),
                ...(customer.blocked ? { blocked: stillOverdue } : {}),
              })
            }
            void logActivity(user.displayName, `approved payment proof for ${customer?.companyName ?? proof.customerId} (£${proof.amount.toFixed(2)})`)
            await load()
          }}
          onReject={async (proof, reason) => {
            await rejectPaymentProof(proof.id, reason)
            const customer = customers.find(c => c.id === proof.customerId)
            if (customer?.email) {
              void sendEmail(customer.email, "We couldn't confirm your payment",
                paymentRejectedEmailHtml(customer.contactPerson || customer.companyName, proof.invoiceNumbers, proof.amount, reason), undefined, { category: 'notifications', customerId: customer.id, communicationType: 'payment_rejected' })
            }
            void logActivity(user.displayName, `rejected payment proof for ${customer?.companyName ?? proof.customerId}`)
            await load()
          }}
        />
      )
    }

    if (current === 'credit-control') {
      return (
        <CreditControlPage
          customers={customers}
          invoices={invoices}
          onSendReminder={async (status) => {
            const c = status.customer
            if (!c.email) return
            await sendEmail(
              c.email,
              `Payment required — ${status.overdueInvoices.length || status.unpaidCount} invoice${(status.overdueInvoices.length || status.unpaidCount) !== 1 ? 's' : ''} outstanding`,
              overdueEmailHtml(
                c.contactPerson || c.companyName,
                status.overdueInvoices,
                status.outstanding,
                c.creditLimit ?? 0,
                status.overLimitBy,
              ), undefined, { category: 'notifications', customerId: c.id, communicationType: 'credit_control_warning' }
            )
          }}
          onToggleBlock={async (customer, blocked) => {
            const updated = await updateCustomer(customer.id, { blocked })
            if (!updated) {
              showNotice("Couldn't update the account. Please try again or contact support if the problem continues.")
            } else {
              void (blocked ? sendAccountSuspended(customer, user.displayName) : sendAccountApproved(customer, user.displayName))
            }
            await load()
          }}
        />
      )
    }

    if (current === 'credit-notes') {
      return (
        <CreditNotesPage
          creditNotes={creditNotes}
          allocations={creditNoteAllocations}
          customers={customers}
          invoices={invoices}
          tickets={tickets}
          canManage={user.isSuperAdmin || Boolean(user.permissions?.creditNotesIssue)}
          openCreditNoteId={openCreditNoteId}
          onIssue={async (input, mode) => {
            // A credit note is still a normal support ticket on the customer's
            // account — auto-create one (unless an existing ticket was picked)
            // so it always shows up there, "credited against this ticket".
            let linkedTicketId = input.linkedTicketId
            if (!linkedTicketId) {
              const ticket = await createTicket(
                'admin', input.customerId,
                `Credit Note — ${input.reason}`,
                `A credit note for £${input.amount.toFixed(2)} was issued: ${input.reason}`,
              )
              linkedTicketId = ticket.id
            }
            const note = await createCreditNote({
              customerId: input.customerId, amount: input.amount, reason: input.reason,
              date: new Date().toISOString().slice(0, 10),
              linkedTicketId, linkedInvoiceId: input.linkedInvoiceId,
              status: 'Active', remainingBalance: input.amount,
            })
            // Option A (against an invoice) applies immediately so the
            // invoice's balance updates right away, as requested.
            if (mode === 'invoice' && input.linkedInvoiceId) {
              const invoice = invoices.find(i => i.id === input.linkedInvoiceId)
              if (invoice) {
                const result = computeCreditApplication(note, invoice, input.amount)
                if (result.appliedAmount > 0) {
                  await applyCreditNoteToInvoice(note.id, invoice.id, result.appliedAmount, new Date().toISOString().slice(0, 10))
                  const customer = customers.find(c => c.id === input.customerId)
                  if (customer) await updateCustomer(customer.id, { balance: Math.max(0, invoices.filter(item => item.customerId === customer.id).reduce((sum, item) => sum + invoiceOutstanding(item), 0) - result.appliedAmount) })
                }
              }
            }
            const customer = customers.find(c => c.id === input.customerId)
            void logActivity(user.displayName, `issued credit note ${note.creditNumber} for ${customer?.companyName ?? input.customerId} (£${input.amount.toFixed(2)})`)
            await load()
          }}
          onEdit={async (id, input) => {
            await updateCreditNote(id, input)
            void logActivity(user.displayName, `edited credit note ${id}`)
            await load()
          }}
          onVoid={async (note) => {
            await updateCreditNote(note.id, { status: 'Void' })
            void logActivity(user.displayName, `voided credit note ${note.creditNumber}`)
            await load()
          }}
          onApply={async (note, invoiceId, amount) => {
            const invoice = invoices.find(i => i.id === invoiceId)
            if (!invoice) return
            const result = computeCreditApplication(note, invoice, amount)
            if (result.appliedAmount <= 0) return
            try {
              await applyCreditNoteToInvoice(note.id, invoice.id, result.appliedAmount, new Date().toISOString().slice(0, 10))
              const customer = customers.find(c => c.id === note.customerId)
              if (customer) await updateCustomer(customer.id, { balance: Math.max(0, invoices.filter(item => item.customerId === customer.id).reduce((sum, item) => sum + invoiceOutstanding(item), 0) - result.appliedAmount) })
              void logActivity(user.displayName, `applied £${result.appliedAmount.toFixed(2)} credit from ${note.creditNumber} to ${invoice.invoiceNumber}`)
              await load()
              showSuccess('Credit note applied successfully')
            } catch (error) {
              showAppError(error, { feature: 'Apply Credit Note', context: { creditNumber: note.creditNumber, invoiceNumber: invoice.invoiceNumber }, fallbackCode: 213 })
            }
          }}
        />
      )
    }

    if (current === 'customer-applications') {
      return (
        <CustomerApplicationsPage
          applications={applications}
          canManage={user.isSuperAdmin || Boolean(user.permissions?.applicationsManage)}
          onApprove={async (application) => {
            const newCustomer = await createCustomer({
              companyName: application.companyName,
              contactPerson: application.contactName,
              email: application.email,
              phone: application.phone,
              registeredAddress: application.registeredAddress,
              address: '',
              customerNumber: `CUST-${Date.now().toString().slice(-6)}`,
              password: '',
              deliveryArea: '',
              paymentTerms: 'Payment Before Order',
            })
            await updateCustomerApplication(application.id, { status: 'Approved' })
            if (application.email) {
              void sendEmail(application.email, "Welcome to the Punjab Exotic Foods Portal",
                welcomeEmailHtml(application.contactName || application.companyName, "customer", window.location.origin), undefined, { category: 'signup', communicationType: 'customer_welcome' })
            }
            void sendAccountApproved(newCustomer, user.displayName)
            void logActivity(user.displayName, `approved customer application for ${application.companyName}`)
            await load()
          }}
          onReject={async (application) => {
            await updateCustomerApplication(application.id, { status: 'Rejected' })
            void logActivity(user.displayName, `rejected customer application for ${application.companyName}`)
            await load()
          }}
          onSaveNotes={async (id, notes) => {
            await updateCustomerApplication(id, { notes })
            await load()
          }}
        />
      )
    }

    if (current === 'payment-reminders') {
      return (
        <PaymentRemindersPage
          invoices={invoices}
          customers={customers}
          notificationLogs={notificationLogs}
          canManage={user.isSuperAdmin || Boolean(user.permissions?.paymentsRecord)}
          onSendNow={async (invoice, customer) => {
            await sendInvoiceReminderPdf(invoice, customer)
            await load()
          }}
          onSchedule={async (invoice, customer, scheduledFor) => {
            await createNotificationLog({
              invoiceId: invoice.id, customerId: customer.id, channel: 'email',
              status: 'Scheduled', scheduledFor: new Date(scheduledFor).toISOString(),
            })
            void logActivity(user.displayName, `scheduled payment reminder for invoice ${invoice.invoiceNumber} to ${customer.companyName}`)
            await load()
          }}
          onResend={async (log) => {
            const invoice = invoices.find(i => i.id === log.invoiceId)
            const customer = customers.find(c => c.id === log.customerId)
            if (!invoice || !customer) return
            await sendInvoiceReminderPdf(invoice, customer)
            await load()
          }}
          onRetryPdf={regenerateInvoicePdf}
        />
      )
    }

    if (current === 'payments') {
      return <PaymentsPage payments={payments} />
    }

    if (current === 'expenses') {
      return <ExpensesPage expenses={expenses} userName={user.displayName} onCreate={async input => { await createExpense(input); void logActivity(user.displayName, `recorded expense £${input.amount.toFixed(2)} ${input.category}`); await load() }} onDelete={async id => { await deleteExpense(id); await load() }} />
    }

    if (current === 'delivery-areas') {
      return (
        <DeliveryAreasPage
          deliveryAreas={deliveryAreas}
          onCreate={async (name, charge) => {
            await createDeliveryArea(name, charge)
            await load()
          }}
          onUpdate={async (id, name, charge) => {
            await updateDeliveryArea(id, name, charge)
            await load()
          }}
          onDelete={async (id) => {
            await deleteDeliveryArea(id)
            await load()
          }}
        />
      )
    }

    if (current === 'tickets') {
      return (
        <TicketsPage
          tickets={tickets}
          onCreate={async (subject, message) => {
            await createTicket('admin', undefined, subject, message)
            await load()
          }}
          onUpdateStatus={async (id, status) => {
            await updateTicketStatus(id, status)
            await load()
          }}
        />
      )
    }

    if (current === 'complaints') {
      return <ComplaintsPage tickets={tickets} />
    }

    if (current === 'admins') {
      return (
        <AdminsPage
          admins={admins}
          salesmen={salesmen}
          currentUserIsSystemDeveloper={user.isSystemDeveloper}
          loadRoles={getAdminRoles}
          onCreate={async (name, email, role, jobTitle, permissions, isSalesman, salesmanIds, sensitiveToken) => {
            await inviteAdmin({ name, email, role, jobTitle, permissions, isSalesman, salesmanIds }, sensitiveToken)
            void logActivity(user.displayName, `invited admin account for ${name} (${role})`)
            await load()
          }}
          onUpdate={async (id, data, sensitiveToken) => {
            await manageAdmin({ action: 'update', id, data }, sensitiveToken)
            void logActivity(user.displayName, `updated admin account for ${data.name ?? id}`)
            await load()
          }}
          onDelete={async (id, sensitiveToken) => {
            const target = admins.find(a => a.id === id)
            await manageAdmin({ action: 'remove', id }, sensitiveToken)
            void logActivity(user.displayName, `removed admin access${target ? ` for ${target.name}` : ""}`)
            await load()
          }}
          onToggleActive={async (id, active, sensitiveToken) => {
            const target = admins.find(a => a.id === id)
            await manageAdmin({ action: 'set_active', id, active }, sensitiveToken)
            void logActivity(user.displayName, `${active ? "activated" : "deactivated"} admin account${target ? ` for ${target.name}` : ""}`)
            await load()
          }}
          onResetCredentials={async (id, sensitiveToken) => {
            const target = admins.find(a => a.id === id)
            await resetAdminCredentials(id, sensitiveToken)
            void logActivity(user.displayName, `reset account access and resent setup link${target ? ` for ${target.name}` : ""}`)
            await load()
          }}
        />
      )
    }

    if (current === 'enquiries') {
      return <SimpleModulePage title="Enquiries" text="Customer enquiries will appear here. You can review and respond to general product or pricing enquiries." />
    }

    if (current === 'data-extract') {
      return <SimpleModulePage title="Data Extract" text="Export customer data, order history, stock reports and payment records as CSV or Excel files." />
    }

    if (current === 'stats') {
      return <AnalyticsPage orders={orders} products={products} />
    }

    if (current === 'settings') {
      return <SettingsPage onNavigate={navigate} isSystemDeveloper={user.isSystemDeveloper} />
    }

    return <NotFoundPage onNavigate={navigate} />
  }

  return (
    <AppLayout
      role="admin" user={user} current={current} onNavigate={navigate} onLogout={onLogout}
      badges={{ orders: newOrders, tickets: newTickets, 'payment-proofs': pendingProofsCount }}
      notifications={notifications}
      onMarkNotificationRead={handleMarkNotificationRead}
      onMarkAllNotificationsRead={handleMarkAllNotificationsRead}
      onOpenNotification={handleOpenNotification}
      onSearch={term => { setGlobalSearchTerm(term); navigate('global-search') }}
      onDayEnd={dayEnd}
    >
      {page()}
      <ToastStack toasts={toasts} onDismiss={dismiss} />
    </AppLayout>
  )
}
