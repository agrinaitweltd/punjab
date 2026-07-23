import { useCallback, useEffect, useState } from 'react'
import { AppLayout } from '../../components/layout/AppLayout'
import { ToastStack } from '../../components/ToastStack'
import { useUnseenCount, useLiveToasts, usePoll } from '../../lib/notifications'
import { sendEmail, welcomeEmailHtml, paymentReceivedEmailHtml, overdueEmailHtml } from '../../lib/emailService'
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
} from '../../api/miscApi'
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
} from '../../types'
import { AdminsPage } from './AdminsPage'
import { ComplaintsPage } from './ComplaintsPage'
import { CreditControlPage } from './CreditControlPage'
import { CustomersPage } from './CustomersPage'
import { DashboardHome } from './DashboardHome'
import { DeliveryAreasPage } from './DeliveryAreasPage'
import { InvoicesPage } from './InvoicesPage'
import { OrdersPage } from './OrdersPage'
import { PaymentsPage } from './PaymentsPage'
import { ProductsPage } from './ProductsPage'
import { FilesPage } from './FilesPage'
import { SessionPage } from './SessionPage'
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
    setCurrent(newOrders > 0 ? 'orders' : newTickets > 0 ? 'tickets' : 'orders')
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
      return <SessionPage onFinished={async () => { await load(); setCurrent('stock') }} />
    }

    if (current === 'files') {
      return <FilesPage customers={customers} />
    }

    if (current === 'customers') {
      return (
        <CustomersPage
          customers={customers}
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
            await deleteCustomer(id)
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
      return (
        <OrdersPage
          orders={orders}
          products={products}
          invoices={invoices}
          onUpdateOrder={async (id, input) => {
            await updateOrder(id, input)
            await load()
          }}
          onMarkPaid={async (order) => {
            const invoiceNumber = `INV-${order.orderNumber}`
            const today = new Date().toISOString().slice(0, 10)
            await createInvoice({ customerId: order.customerId, invoiceNumber, amount: order.amount, dueDate: today, status: 'Paid' })
            const payment = await createPayment({ customerId: order.customerId, amount: order.amount, date: today, method: 'Bank Transfer' })
            const customer = customers.find(c => c.id === order.customerId)
            if (customer?.email) {
              void sendEmail(customer.email, `Payment received for order ${order.orderNumber}`,
                paymentReceivedEmailHtml(order.orderNumber, customer.contactPerson || customer.companyName, order.amount, payment.paymentReference, today))
            }
            await load()
          }}
        />
      )
    }

    if (current === 'invoices') {
      return <InvoicesPage invoices={invoices} />
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
          onCreate={async (name, email, password, role, permissions) => {
            await createAdmin({ name, email, password, role, active: true, isSuperAdmin: false, permissions })
            if (email) {
              void sendEmail(email, "Your Punjab Exotic Foods admin account",
                welcomeEmailHtml(name, "admin", window.location.origin))
            }
            await load()
          }}
          onUpdate={async (id, data) => {
            await updateAdmin(id, data)
            await load()
          }}
          onDelete={async (id) => {
            await deleteAdmin(id)
            await load()
          }}
          onToggleActive={async (id, active) => {
            await toggleAdminActive(id, active)
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
      badges={{ orders: newOrders, tickets: newTickets }}
      notifCount={newOrders + newTickets}
      onBellClick={openNotifications}
    >
      {page()}
      <ToastStack toasts={toasts} onDismiss={dismiss} />
    </AppLayout>
  )
}