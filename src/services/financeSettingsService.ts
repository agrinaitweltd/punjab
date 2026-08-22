import { supabase } from '../lib/supabase'

export type FinanceSettings = { defaultPaymentTermsDays: number; reminderDaysBeforeDue: number }
const defaults: FinanceSettings = { defaultPaymentTermsDays: 21, reminderDaysBeforeDue: 7 }

export async function getFinanceSettings(): Promise<FinanceSettings> {
  if (!supabase) return defaults
  const { data, error } = await supabase.from('finance_settings').select('default_payment_terms_days,reminder_days_before_due').eq('id', true).maybeSingle()
  if (error) throw error
  return data ? { defaultPaymentTermsDays: data.default_payment_terms_days, reminderDaysBeforeDue: data.reminder_days_before_due } : defaults
}

export async function saveFinanceSettings(settings: FinanceSettings): Promise<void> {
  if (!supabase) return
  const session = await supabase.auth.getSession()
  const { error } = await supabase.from('finance_settings').update({ default_payment_terms_days: settings.defaultPaymentTermsDays, reminder_days_before_due: settings.reminderDaysBeforeDue, updated_at: new Date().toISOString(), updated_by: session.data.session?.user.email || null }).eq('id', true)
  if (error) throw error
}
