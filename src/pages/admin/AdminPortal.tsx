import { useCallback, useEffect, useState } from 'react'
import { AppLayout } from '../../components/layout/AppLayout'
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
import { CustomersPage } from './CustomersPage'
import { DashboardHome } from './DashboardHome'
import { DeliveryAreasPage } from './DeliveryAreasPage'
import { InvoicesPage } from './InvoicesPage'
import { OrdersPage } from './OrdersPage'
import { PaymentsPage } from './PaymentsPage'
import { ProductsPage } from './ProductsPage'
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

  useEffect(() => {
    load()
  }, [load])

  const page = () => {
    if (current === 'dashboard') {
      return (
        <DashboardHome
          customers={customers}
          products={products}
          orders={orders}
          activity={activity}
        />
      )
    }

    if (current === 'customers') {
      return (
        <CustomersPage
          customers={customers}
          onCreate={async (input) => {
            await createCustomer(input)
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
          onUpdateOrder={async (id, input) => {
            await updateOrder(id, input)
            await load()
          }}
        />
      )
    }

    if (current === 'invoices') {
      return <InvoicesPage invoices={invoices} />
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
            await createTicket(subject, message)
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
            await createAdmin(name, email, password, role, permissions)
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
    <AppLayout role="admin" user={user} current={current} onNavigate={setCurrent} onLogout={onLogout}>
      {page()}
    </AppLayout>
  )
}