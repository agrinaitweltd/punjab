import { supabase } from '../lib/supabase'
import type { ImportedInvoiceItem } from '../lib/invoiceImport'

export async function saveInvoiceItems(invoiceId: string, items: ImportedInvoiceItem[]): Promise<void> {
  if (!items.length) return
  if (!supabase) throw new Error('Not connected to the database')
  const rows = items.map(item => ({
    invoice_id: invoiceId,
    line_number: item.line,
    quantity: item.quantity,
    product: item.product,
    variety: item.variety,
    size: item.size,
    price: item.price,
    goods_value: item.goodsValue || item.quantity * item.price,
    vat_code: item.vatCode,
    vat_rate: item.vatRate,
  }))
  const { error } = await supabase.from('invoice_items').insert(rows)
  if (!error) return
  const tableMissing = error.code === 'PGRST205' || error.code === '42P01' || /invoice_items.*schema cache|relation.*invoice_items/i.test(error.message)
  if (!tableMissing) throw new Error(`Could not store invoice products: ${error.message}`)

  const fallback = {
    id: `invoice-items-${invoiceId}`,
    customer_name: `INVOICE_ITEMS:${invoiceId}`,
    action: 'Imported invoice product rows',
    timestamp: JSON.stringify({ invoiceId, items, storedAt: new Date().toISOString() }),
  }
  const { error: fallbackError } = await supabase.from('activity_log').upsert(fallback)
  if (fallbackError) throw new Error(`Could not store invoice products: ${fallbackError.message}`)
}
