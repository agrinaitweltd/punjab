import type { Expense } from '../types'
import { supabase } from '../lib/supabase'

const PREFIX = 'EXPENSE:'
let local: Expense[] = []

export async function getExpenses(): Promise<Expense[]> {
  if (!supabase) return [...local].sort((a,b) => b.expenseDate.localeCompare(a.expenseDate))
  const { data, error } = await supabase.from('activity_log').select('*').like('customer_name', `${PREFIX}%`).order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []).map(row => { const meta = JSON.parse(row.timestamp || '{}'); return { id: row.id, title: String(row.customer_name).slice(PREFIX.length), ...meta } as Expense })
}

export async function createExpense(input: Omit<Expense, 'id' | 'createdAt'>): Promise<Expense> {
  const expense: Expense = { ...input, id: `exp-${Date.now()}`, createdAt: new Date().toISOString() }
  if (!supabase) { local.push(expense); return expense }
  const { error } = await supabase.from('activity_log').insert({ id: expense.id, customer_name: `${PREFIX}${expense.title}`, action: expense.description || expense.category, timestamp: JSON.stringify({ ...expense, id: undefined }) })
  if (error) throw error
  return expense
}

export async function deleteExpense(id: string) {
  if (!supabase) { local = local.filter(x => x.id !== id); return }
  const { error } = await supabase.from('activity_log').delete().eq('id', id).like('customer_name', `${PREFIX}%`)
  if (error) throw error
}
