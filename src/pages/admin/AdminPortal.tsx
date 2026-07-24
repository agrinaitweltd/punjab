import { useCallback, useEffect, useState } from 'react'
import { AppLayout } from '../../components/layout/AppLayout'
import { ToastStack } from '../../components/ToastStack'
import { useUnseenCount, useLiveToasts, usePoll } from '../../lib/notifications'
import { sendEmail, welcomeEmailHtml, paymentReceivedEmailHtml, overdueEmailHtml, orderPaymentRequiredEmailHtml, paymentApprovedEmailHtml, paymentRejectedEmailHtml, paymentReminderEmailHtml } from '../../lib/emailService'
import { getCreditStatus } from '../../lib/creditControl'
import { listPaymentProofs, approvePaymentProof, rejectPaymentProof, type PaymentProof } from '../../lib/paymentProofService'
import { createCustomer, deleteCustomer, getCustomers, updateCustomer } from '../../api/customersApi'
import { createProduct, deleteProduct, getProducts, updateProduct } from '../../api/productsApi'
import { getStock, updateStock } from '../../api/stockApi'
import { getOrders, updateOrder } from '../../api/ordersApi'
import {
  createAdmin,
  createDeliveryArea,
  createTicket,
  deleteAdmin,
  deleteDeliveryArea,
  getActivity,
  getAdmins,
  getDeliveryAreas,
  getInvoices,
  getPayments,
  getTickets,
  toggleAdminActive,
  updateAdmin,
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
  createCreditNoteAllocation,
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
} from '../../api/miscApi'
import { computeCreditApplication } from '../../lib/creditNotes'
import type {
  ActivityLog,
  AdminStaff,
  BuyingPrice,
  BuyingSession,
  Customer,
  NotificationLog,
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
import { OrdersPage } from './OrdersPage'
import { PaymentsPage } from './PaymentsPage'
import { ProductsPage } from './ProductsPage'
import { FilesPage } from './FilesPage'
import { BuyingDeskPage } from './BuyingDeskPage'
import { PaymentRemindersPage } from './PaymentRemindersPage'
import { SettingsPage } from './SettingsPage'
import { SimpleModulePage } from './SimpleModulePage'
import { StockPage } from './StockPage'
import { TicketsPage } from './TicketsPage'

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
    ])

    setCustomers(customersData)
    setProducts(productsData)
    setStock(stockData)
    setOrders(ordersData)
    setActivity(activityData)
    setAdmins(adminsData)
    setInvoices(invoicesData)
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
  }, [])

  // Re-fetch on every page change so dashboards never show stale data
  useEffect(() => {
    load()
  }, [load, current])

  // Keep polling in the background so notifications fire even while the
  // admin stays on one page (e.g. a new order arrives while browsing Stock).
  usePoll(load, 20000)

  const { unseenCount: newOrders, markAllSeen: markOrdersSeen } = useUnseenCount(orders, `punjab-seen-orders-${user.id}`)
  const { unseenCount: newTickets, markAllSeen: markTicketsSeen } = useUnseenCount(tickets, `punjab-seen-tickets-${user.id}`)
  const pendingProofsCount = paymentProofs.filter(p => p.status === 'pending').length
  const canRecordPayments = Boolean(user.isSuperAdmin || user.permissions?.paymentsRecord)
  const { toasts, dismiss } = useLiveToasts(orders, (prevById, o) =>
    prevById.has(o.id) ? null : { id: `order-${o.id}`, title: "New order received", body: `${o.orderNumber} — ${o.customerName} — £${o.amount.toFixed(2)}` })

  const navigate = (key: string) => {
    setCurrent(key)
    if (key === 'orders') markOrdersSeen()
    if (key === 'tickets') markTicketsSeen()
  }

  // The bell represents ALL notifications, not just one page's — clear
  // everything and jump to whichever section actually has something new.
  const openNotifications = () => {
    markOrdersSeen()
    markTicketsSeen()
    setCurrent(newOrders > 0 ? 'orders' : newTickets > 0 ? 'tickets' : pendingProofsCount > 0 ? 'payment-proofs' : 'orders')
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
          onNavigate={navigate}
        />
      )
    }

    if (current === 'session') {
      const canEditBuying = user.isSuperAdmin || Boolean(user.permissions?.buyingPricesEdit)
      return (
        <BuyingDeskPage
          sessions={buyingSessions}
          prices={buyingPrices}
          canEdit={canEditBuying}
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
            void logActivity(user.displayName, `confirmed order for ${price.product} from ${price.supplier} (£${(price.price * price.quantity).toFixed(2)})`)
            await load()
          }}
          onEndDailyBuying={async (session, confirmedPrices) => {
            // Move confirmed produce into Stock — hidden (status "out") until published.
            let allProducts = await getProducts()
            for (const cp of confirmedPrices) {
              const existing = allProducts.find(p => p.productName.toLowerCase() === cp.product.toLowerCase())
              if (!existing) {
                await createProduct({
                  productName: cp.product, category: 'Other Produce', variety: cp.variety || cp.brand || '',
                  size: [cp.size, cp.unit].filter(Boolean).join(' ') || 'box', boxesPerPallet: 0, productImage: '',
                  sku: cp.product.toUpperCase().replace(/[^A-Z0-9]+/g, '-').slice(0, 24) + '-' + Date.now().toString().slice(-4),
                })
              }
            }
            allProducts = await getProducts()
            const stock = await getStock()
            for (const cp of confirmedPrices) {
              const product = allProducts.find(p => p.productName.toLowerCase() === cp.product.toLowerCase())
              const stockRow = product && stock.find(s => s.productId === product.id)
              if (stockRow) {
                await updateStock(stockRow.id, { availableQuantity: cp.quantity, status: 'out' })
              }
            }
            await updateBuyingSession(session.id, { status: 'Closed' })
            void logActivity(user.displayName, `ended daily buying for ${session.date} — ${confirmedPrices.length} item(s) moved to Stock`)
            await load()
          }}
          onPublish={async (session, sellingPrices) => {
            const allProducts = await getProducts()
            const stock = await getStock()
            const sessionConfirmed = buyingPrices.filter(p => p.date === session.date && p.confirmed)
            for (const cp of sessionConfirmed) {
              const product = allProducts.find(p => p.productName.toLowerCase() === cp.product.toLowerCase())
              const stockRow = product && stock.find(s => s.productId === product.id)
              const sellingPrice = sellingPrices[cp.id] ?? 0
              if (stockRow) {
                await updateStock(stockRow.id, {
                  price: sellingPrice,
                  status: cp.quantity === 0 ? 'out' : cp.quantity <= 10 ? 'low' : 'available',
                })
              }
            }
            await updateBuyingSession(session.id, { publishedAt: new Date().toISOString() })
            void logActivity(user.displayName, `published today's buying prices for ${session.date}`)
            await load()
          }}
        />
      )
    }

    if (current === 'files') {
      return <FilesPage customers={customers} />
    }

    if (current === 'customers') {
      return (
        <CustomersPage
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
                welcomeEmailHtml(input.contactPerson || input.companyName, "customer", window.location.origin))
            }
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
      return (
        <OrdersPage
          orders={orders}
          products={products}
          invoices={invoices}
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
                  await createInvoice({
                    customerId: customer.id, invoiceNumber: `INV-${order.orderNumber}`,
                    amount: order.amount, date: today, dueDate: today, status: 'Unpaid',
                  })
                  await updateCustomer(customer.id, { blocked: true })
                  if (customer.email) {
                    void sendEmail(customer.email, `Payment needed — order ${order.orderNumber}`,
                      orderPaymentRequiredEmailHtml(customer.contactPerson || customer.companyName, order.orderNumber, order.amount, today))
                  }
                }
              }
            }
            await updateOrder(id, input)
            await load()
          }}
          onMarkPaid={!canRecordPayments ? undefined : async (order) => {
            const invoiceNumber = `INV-${order.orderNumber}`
            const today = new Date().toISOString().slice(0, 10)
            // An invoice may already exist (created when the order was confirmed and
            // payment was required upfront) — update it instead of creating a
            // duplicate, which would collide on the unique invoice_number.
            const existing = invoices.find(i => i.invoiceNumber === invoiceNumber)
            const invoice = existing
              ? await updateInvoice(existing.id, { status: 'Paid' })
              : await createInvoice({ customerId: order.customerId, invoiceNumber, amount: order.amount, dueDate: today, status: 'Paid' })
            const payment = await createPayment({ customerId: order.customerId, amount: order.amount, date: today, method: 'Bank Transfer' })
            const customer = customers.find(c => c.id === order.customerId)
            if (customer?.email) {
              void sendEmail(customer.email, `Payment received for order ${order.orderNumber}`,
                paymentReceivedEmailHtml(order.orderNumber, customer.contactPerson || customer.companyName, order.amount, payment.paymentReference, today))
            }
            // Once this invoice is paid, check whether the customer is still over
            // their limit or has other overdue invoices — if not, lift the freeze.
            if (customer?.blocked && invoice) {
              const updatedInvoices = invoices.map(i => i.id === invoice.id ? { ...i, status: 'Paid' as const } : i)
              if (!getCreditStatus(customer, updatedInvoices).isOverdue) {
                await updateCustomer(customer.id, { blocked: false })
              }
            }
            void logActivity(user.displayName, `marked order ${order.orderNumber} as paid`)
            await load()
          }}
        />
      )
    }

    if (current === 'invoices') {
      return <InvoicesPage invoices={invoices} />
    }

    if (current === 'payment-proofs') {
      return (
        <PaymentProofsPage
          proofs={paymentProofs}
          canRecord={canRecordPayments}
          onApprove={async (proof) => {
            for (const id of proof.invoiceIds) await updateInvoice(id, { status: 'Paid' })
            await createPayment({ customerId: proof.customerId, amount: proof.amount, date: new Date().toISOString().slice(0, 10), method: 'Bank Transfer (Verified)' })
            await approvePaymentProof(proof.id)
            const customer = customers.find(c => c.id === proof.customerId)
            if (customer?.email) {
              void sendEmail(customer.email, 'Payment confirmed — thank you',
                paymentApprovedEmailHtml(customer.contactPerson || customer.companyName, proof.invoiceNumbers, proof.amount))
            }
            // Lift a payment-required freeze once the account is back within terms.
            if (customer?.blocked) {
              const updatedInvoices = invoices.map(i => proof.invoiceIds.includes(i.id) ? { ...i, status: 'Paid' as const } : i)
              if (!getCreditStatus(customer, updatedInvoices).isOverdue) {
                await updateCustomer(customer.id, { blocked: false })
              }
            }
            void logActivity(user.displayName, `approved payment proof for ${customer?.companyName ?? proof.customerId} (£${proof.amount.toFixed(2)})`)
            await load()
          }}
          onReject={async (proof, reason) => {
            await rejectPaymentProof(proof.id, reason)
            const customer = customers.find(c => c.id === proof.customerId)
            if (customer?.email) {
              void sendEmail(customer.email, "We couldn't confirm your payment",
                paymentRejectedEmailHtml(customer.contactPerson || customer.companyName, proof.invoiceNumbers, proof.amount, reason))
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
              ),
            )
          }}
          onToggleBlock={async (customer, blocked) => {
            const updated = await updateCustomer(customer.id, { blocked })
            if (!updated) {
              window.alert("Couldn't update the account — if this keeps happening, the credit-control database migration in src/lib/schema.sql may not have been run yet.")
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
          onIssue={async (input, mode) => {
            const note = await createCreditNote({
              customerId: input.customerId, amount: input.amount, reason: input.reason,
              date: new Date().toISOString().slice(0, 10),
              linkedTicketId: input.linkedTicketId, linkedInvoiceId: input.linkedInvoiceId,
              status: 'Active', remainingBalance: input.amount,
            })
            // Option A (against an invoice) applies immediately so the
            // invoice's balance updates right away, as requested.
            if (mode === 'invoice' && input.linkedInvoiceId) {
              const invoice = invoices.find(i => i.id === input.linkedInvoiceId)
              if (invoice) {
                const result = computeCreditApplication(note, invoice, input.amount)
                if (result.appliedAmount > 0) {
                  await createCreditNoteAllocation({
                    creditNoteId: note.id, invoiceId: invoice.id,
                    amount: result.appliedAmount, date: new Date().toISOString().slice(0, 10),
                  })
                  await updateInvoice(invoice.id, { amountPaid: result.newInvoiceAmountPaid, status: result.newInvoiceStatus })
                  await updateCreditNote(note.id, { remainingBalance: result.newCreditRemainingBalance })
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
            await createCreditNoteAllocation({
              creditNoteId: note.id, invoiceId: invoice.id,
              amount: result.appliedAmount, date: new Date().toISOString().slice(0, 10),
            })
            await updateInvoice(invoice.id, { amountPaid: result.newInvoiceAmountPaid, status: result.newInvoiceStatus })
            await updateCreditNote(note.id, { remainingBalance: result.newCreditRemainingBalance })
            void logActivity(user.displayName, `applied £${result.appliedAmount.toFixed(2)} credit from ${note.creditNumber} to ${invoice.invoiceNumber}`)
            await load()
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
            await createCustomer({
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
                welcomeEmailHtml(application.contactName || application.companyName, "customer", window.location.origin))
            }
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
      const paymentLink = `${window.location.origin}`
      return (
        <PaymentRemindersPage
          invoices={invoices}
          customers={customers}
          notificationLogs={notificationLogs}
          canManage={user.isSuperAdmin || Boolean(user.permissions?.paymentsRecord)}
          onSendNow={async (invoice, customer) => {
            const sent = await sendEmail(customer.email, `Payment reminder — invoice ${invoice.invoiceNumber}`,
              paymentReminderEmailHtml(customer.contactPerson || customer.companyName, invoice.invoiceNumber, invoice.amount - (invoice.amountPaid ?? 0), invoice.dueDate, paymentLink))
            await createNotificationLog({
              invoiceId: invoice.id, customerId: customer.id, channel: 'email',
              status: sent.ok ? 'Sent' : 'Failed', sentAt: new Date().toISOString(), error: sent.ok ? undefined : sent.error,
            })
            void logActivity(user.displayName, `sent payment reminder for invoice ${invoice.invoiceNumber} to ${customer.companyName}`)
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
            const sent = await sendEmail(customer.email, `Payment reminder — invoice ${invoice.invoiceNumber}`,
              paymentReminderEmailHtml(customer.contactPerson || customer.companyName, invoice.invoiceNumber, invoice.amount - (invoice.amountPaid ?? 0), invoice.dueDate, paymentLink))
            await createNotificationLog({
              invoiceId: invoice.id, customerId: customer.id, channel: 'email',
              status: sent.ok ? 'Sent' : 'Failed', sentAt: new Date().toISOString(), error: sent.ok ? undefined : sent.error,
            })
            void logActivity(user.displayName, `resent payment reminder for invoice ${invoice.invoiceNumber} to ${customer.companyName}`)
            await load()
          }}
        />
      )
    }

    if (current === 'payments') {
      return <PaymentsPage payments={payments} />
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
          loadRoles={getAdminRoles}
          onCreate={async (name, email, password, role, jobTitle, permissions) => {
            await createAdmin({ name, email, password, role, jobTitle, active: true, isSuperAdmin: false, permissions })
            if (email) {
              void sendEmail(email, "Your Punjab Exotic Foods admin account",
                welcomeEmailHtml(name, "admin", window.location.origin))
            }
            void logActivity(user.displayName, `created admin account for ${name} (${role})`)
            await load()
          }}
          onUpdate={async (id, data) => {
            await updateAdmin(id, data)
            void logActivity(user.displayName, `updated admin account for ${data.name ?? id}`)
            await load()
          }}
          onDelete={async (id) => {
            const target = admins.find(a => a.id === id)
            await deleteAdmin(id)
            void logActivity(user.displayName, `deleted admin account${target ? ` for ${target.name}` : ""}`)
            await load()
          }}
          onToggleActive={async (id, active) => {
            const target = admins.find(a => a.id === id)
            await toggleAdminActive(id, active)
            void logActivity(user.displayName, `${active ? "activated" : "deactivated"} admin account${target ? ` for ${target.name}` : ""}`)
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
      return <SimpleModulePage title="Stats & Analytics" text="Business performance stats including sales volume, top customers, product popularity and revenue trends." />
    }

    return <SettingsPage />
  }

  return (
    <AppLayout
      role="admin" user={user} current={current} onNavigate={navigate} onLogout={onLogout}
      badges={{ orders: newOrders, tickets: newTickets, 'payment-proofs': pendingProofsCount }}
      notifCount={newOrders + newTickets + pendingProofsCount}
      onBellClick={openNotifications}
    >
      {page()}
      <ToastStack toasts={toasts} onDismiss={dismiss} />
    </AppLayout>
  )
}