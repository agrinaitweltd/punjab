import { supabase } from '../lib/supabase'

export type CommunicationDeliveryLog = {
  id: string; customerId?: string; invoiceId?: string; type: string; channel: string; recipient: string; status: string
  error?: string; createdAt: string; sentAt?: string; senderCategory?: string; senderEmail?: string; subject?: string; retryCount: number
}

export async function getCommunicationDeliveryLogs(): Promise<CommunicationDeliveryLog[]> {
  if (!supabase) return []
  const { data, error } = await supabase.from('communication_logs').select('*').order('created_at', { ascending: false }).limit(500)
  if (error) { console.error('getCommunicationDeliveryLogs', error); return [] }
  return (data || []).map(row => ({ id: row.id, customerId: row.customer_id || undefined, invoiceId: row.invoice_id || undefined, type: row.communication_type, channel: row.channel, recipient: row.recipient || '', status: row.status, error: row.error || undefined, createdAt: row.created_at, sentAt: row.sent_at || undefined, senderCategory: row.sender_category || undefined, senderEmail: row.sender_email || undefined, subject: row.subject || undefined, retryCount: Number(row.retry_count || 0) }))
}
