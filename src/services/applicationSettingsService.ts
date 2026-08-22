import { supabase } from '../lib/supabase'

export type ApplicationSettings = {
  company: Record<string, string>
  invoicing: Record<string, string | boolean>
  customers: Record<string, string | boolean>
  payments: Record<string, string | boolean>
  communications: Record<string, string | boolean>
  files: Record<string, string | boolean>
  interface: Record<string, string | boolean>
}

export const defaultApplicationSettings: ApplicationSettings = {
  company: { companyName: 'Punjab Exotic Foods Limited', tradingName: 'Punjab Exotic Foods', address: 'Unit 2, New Spitalfields Market, Sherrin Road, London E10 5SQ', telephone: '07364 219332', accountsEmail: 'info@punjabexoticfoods.com', vatNumber: '', currency: 'GBP', timeZone: 'Europe/London', dateFormat: 'DD/MM/YYYY' },
  invoicing: { prefix: 'INV', footer: 'Thank you for your business.', showVat: true, automaticPdf: true, automaticDownload: true, numbering: 'Sequential' },
  customers: { defaultCreditLimit: '0', defaultCreditDays: '21', accountNumbers: 'Six-digit manual or imported', defaultStatus: 'Active', creditWarnings: true },
  payments: { methods: 'Bank Transfer, Card, Cash', allocation: 'Oldest outstanding invoice first', referenceFormat: 'PAY-YYYY-###', outstandingBalance: 'Invoice total minus confirmed payments and credits' },
  communications: { senderName: 'Punjab Exotic Foods', accountsEmail: 'info@punjabexoticfoods.com', invoiceEmails: true, reminderEmails: true, reminderWhatsapp: true, notifications: true },
  files: { invoiceStorage: 'Private application document store', categories: 'Invoices, Statements, Delivery Documents, Payment Proofs, General', automaticCanonicalPdf: true },
  interface: { density: 'Comfortable', sidebar: 'Expanded', reducedMotion: false },
}

export async function getApplicationSettings(): Promise<ApplicationSettings> {
  if (!supabase) return defaultApplicationSettings
  const { data, error } = await supabase.from('application_settings').select('company,invoicing,customers,payments,communications,files,interface').eq('id', true).maybeSingle()
  if (error) throw error
  if (!data) return defaultApplicationSettings
  const sections = Object.keys(defaultApplicationSettings) as Array<keyof ApplicationSettings>
  return Object.fromEntries(sections.map(section => [section, { ...defaultApplicationSettings[section], ...(data[section] || {}) }])) as ApplicationSettings
}

export async function saveApplicationSettings(settings: ApplicationSettings): Promise<void> {
  if (!supabase) return
  const session = await supabase.auth.getSession()
  const { error } = await supabase.from('application_settings').update({ ...settings, updated_at: new Date().toISOString(), updated_by: session.data.session?.user.id || null }).eq('id', true)
  if (error) throw error
}
