import { supabase } from '../lib/supabase'
import type { ImportedInvoiceItem } from '../lib/invoiceImport'
import type { CreditNoteItem } from '../types'

function db() {
  if (!supabase) throw new Error('Not connected to the database')
  return supabase
}

export async function saveCreditNoteItems(creditNoteId: string, items: ImportedInvoiceItem[]): Promise<void> {
  if (!items.length) throw new Error('At least one credited product row is required.')
  const rows = items.map(item => ({
    credit_note_id: creditNoteId,
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
  const { error } = await db().from('credit_note_items').insert(rows)
  if (error) throw new Error(`Could not store credited products: ${error.message}`)
}

export async function getCreditNoteItems(creditNoteId: string): Promise<CreditNoteItem[]> {
  const { data, error } = await db().from('credit_note_items').select('*').eq('credit_note_id', creditNoteId).order('created_at')
  if (error) throw new Error(`Could not load credited products: ${error.message}`)
  return (data ?? []).map(row => ({
    id: row.id, creditNoteId: row.credit_note_id, line: row.line_number ?? '', quantity: Number(row.quantity) || 0,
    product: row.product ?? '', variety: row.variety ?? '', size: row.size ?? '', price: Number(row.price) || 0,
    goodsValue: Number(row.goods_value) || 0, vatCode: row.vat_code ?? '', vatRate: Number(row.vat_rate) || 0,
    vatAmount: Number(row.vat_amount) || 0,
  }))
}
