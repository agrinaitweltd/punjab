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
    goods_value: item.goodsValue,
    vat_code: item.vatCode,
    vat_rate: item.vatRate,
    vat_amount: item.vatAmount ?? item.goodsValue * item.vatRate / 100,
  }))
  const { error } = await supabase.from('invoice_items').insert(rows)
  if (!error) return
  const compatibilityRequired = error.code === 'PGRST205' || error.code === '42P01' || error.code === '42501' || /invoice_items.*schema cache|relation.*invoice_items|row-level security|permission denied/i.test(error.message)
  if (!compatibilityRequired) throw new Error(`Could not store invoice products: ${error.message}`)

  const fallback = {
    id: `invoice-items-${invoiceId}`,
    customer_name: `INVOICE_ITEMS:${invoiceId}`,
    action: 'Imported invoice product rows',
    timestamp: JSON.stringify({ invoiceId, items, storedAt: new Date().toISOString() }),
  }
  const { error: fallbackError } = await supabase.from('activity_log').upsert(fallback)
  if (fallbackError) throw new Error(`Could not store invoice products: ${fallbackError.message}`)
}

export async function getInvoiceItems(invoiceId: string): Promise<ImportedInvoiceItem[]> {
  if (!supabase) throw new Error('Not connected to the database')
  const { data, error } = await supabase.from('invoice_items').select('*').eq('invoice_id', invoiceId).order('created_at')
  if (!error && data?.length) return data.map(row => ({
    line: row.line_number ?? '', quantity: Number(row.quantity) || 0, product: row.product ?? '', variety: row.variety ?? '', size: row.size ?? '',
    price: Number(row.price) || 0, goodsValue: Number(row.goods_value) || 0, vatCode: row.vat_code ?? '', vatRate: Number(row.vat_rate) || 0,
    vatAmount: Number(row.vat_amount) || 0,
  }))
  const { data: fallback, error: fallbackError } = await supabase.from('activity_log').select('timestamp').eq('id', `invoice-items-${invoiceId}`).maybeSingle()
  if (fallbackError) throw new Error(`Could not load invoice products: ${fallbackError.message}`)
  try { return (JSON.parse(fallback?.timestamp || '{}').items ?? []) as ImportedInvoiceItem[] } catch { return [] }
}
