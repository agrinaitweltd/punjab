import { useEffect, useMemo, useState } from 'react'
import { AppLayout } from '../../components/layout/AppLayout'
import { getProducts } from '../../api/productsApi'
import { createOrder, getOrders } from '../../api/ordersApi'
import { createTicket, getInvoices, getPayments, getTickets } from '../../api/miscApi'
import type { Invoice, Order, Payment, Product, SupportTicket, User } from '../../types'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { DataTable } from '../../components/ui/Table'
import { Input, TextArea } from '../../components/ui/Input'

export function CustomerPortal({ user, onLogout }: { user: User; onLogout: () => void }) {
  const [current, setCurrent] = useState('dashboard')
  const [products, setProducts] = useState<Product[]>([])
  const [orders, setOrders] = useState<Order[]>([])
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [payments, setPayments] = useState<Payment[]>([])
  const [tickets, setTickets] = useState<SupportTicket[]>([])
  const [selectedProduct, setSelectedProduct] = useState('')
  const [quantity, setQuantity] = useState('1')
  const [ticketSubject, setTicketSubject] = useState('')
  const [ticketMessage, setTicketMessage] = useState('')

  const customerOrders = useMemo(
    () => orders.filter((order) => order.customerId === 'c-1'),
    [orders],
  )

  const load = async () => {
    const [productsData, ordersData, invoicesData, paymentsData, ticketsData] = await Promise.all([
      getProducts(),
      getOrders(),
      getInvoices(),
      getPayments(),
      getTickets(),
    ])
    setProducts(productsData)
    setOrders(ordersData)
    setInvoices(invoicesData)
    setPayments(paymentsData)
    setTickets(ticketsData)
    setSelectedProduct(productsData[0]?.id ?? '')
  }

  useEffect(() => {
    load()
  }, [])

  const renderPage = () => {
    if (current === 'dashboard') {
      return (
        <div className="overview-grid">
          <Card title="Available Products"><p className="metric">{products.length}</p></Card>
          <Card title="Open Orders"><p className="metric">{customerOrders.length}</p></Card>
          <Card title="Outstanding Invoices"><p className="metric">{invoices.filter((item) => item.status !== 'Paid').length}</p></Card>
        </div>
      )
    }

    if (current === 'products') {
      return (
        <Card title="Available Products and Prices">
          <DataTable columns={['Product', 'Category', 'Variety', 'Size', 'SKU']}>
            {products.map((product) => (
              <tr key={product.id}>
                <td>{product.productName}</td>
                <td>{product.category}</td>
                <td>{product.variety}</td>
                <td>{product.size}</td>
                <td>{product.sku}</td>
              </tr>
            ))}
          </DataTable>
        </Card>
      )
    }

    if (current === 'place-order') {
      return (
        <Card title="Place Order">
          <form
            className="form-grid"
            onSubmit={async (event) => {
              event.preventDefault()
              const product = products.find((item) => item.id === selectedProduct)
              if (!product) return
              await createOrder({
                customerId: 'c-1',
                customerName: 'Green Market Wholesale',
                amount: Number(quantity) * 20,
                items: [
                  {
                    productId: selectedProduct,
                    quantity: Number(quantity),
                    unitPrice: 20,
                  },
                ],
              })
              setQuantity('1')
              await load()
            }}
          >
            <label className="form-control">
              <span>Product</span>
              <select value={selectedProduct} onChange={(event) => setSelectedProduct(event.target.value)}>
                {products.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.productName}
                  </option>
                ))}
              </select>
            </label>
            <Input label="Quantity" type="number" min="1" value={quantity} onChange={(event) => setQuantity(event.target.value)} />
            <div className="wide actions-row">
              <Button type="submit">Place Order</Button>
            </div>
          </form>
        </Card>
      )
    }

    if (current === 'orders') {
      return (
        <Card title="My Orders">
          <DataTable columns={['Order Number', 'Date', 'Amount', 'Status']}>
            {customerOrders.map((order) => (
              <tr key={order.id}>
                <td>{order.orderNumber}</td>
                <td>{order.date}</td>
                <td>£{order.amount.toFixed(2)}</td>
                <td>{order.status}</td>
              </tr>
            ))}
          </DataTable>
        </Card>
      )
    }

    if (current === 'invoices') {
      return (
        <div className="stack">
          <Card title="Invoices">
            <DataTable columns={['Invoice Number', 'Amount', 'Due Date', 'Status']}>
              {invoices.map((invoice) => (
                <tr key={invoice.id}>
                  <td>{invoice.invoiceNumber}</td>
                  <td>£{invoice.amount.toFixed(2)}</td>
                  <td>{invoice.dueDate}</td>
                  <td>{invoice.status}</td>
                </tr>
              ))}
            </DataTable>
          </Card>
          <Card title="Payments">
            <DataTable columns={['Reference', 'Amount', 'Date', 'Method']}>
              {payments.map((payment) => (
                <tr key={payment.id}>
                  <td>{payment.paymentReference}</td>
                  <td>£{payment.amount.toFixed(2)}</td>
                  <td>{payment.date}</td>
                  <td>{payment.method}</td>
                </tr>
              ))}
            </DataTable>
          </Card>
        </div>
      )
    }

    return (
      <Card title="Support Tickets">
        <form
          className="form-grid"
          onSubmit={async (event) => {
            event.preventDefault()
            if (!ticketSubject || !ticketMessage) return
            await createTicket(ticketSubject, ticketMessage, 'c-1')
            setTicketSubject('')
            setTicketMessage('')
            await load()
          }}
        >
          <Input label="Subject" value={ticketSubject} onChange={(event) => setTicketSubject(event.target.value)} />
          <div className="wide">
            <TextArea label="Message" value={ticketMessage} onChange={(event) => setTicketMessage(event.target.value)} rows={3} />
          </div>
          <div className="wide actions-row">
            <Button type="submit">Send Support Ticket</Button>
          </div>
        </form>

        <DataTable columns={['Subject', 'Status', 'Created At']}>
          {tickets
            .filter((ticket) => ticket.customerId === 'c-1')
            .map((ticket) => (
              <tr key={ticket.id}>
                <td>{ticket.subject}</td>
                <td>{ticket.status}</td>
                <td>{ticket.createdAt}</td>
              </tr>
            ))}
        </DataTable>
      </Card>
    )
  }

  return (
    <AppLayout role="customer" user={user} current={current} onNavigate={setCurrent} onLogout={onLogout}>
      {renderPage()}
    </AppLayout>
  )
}







