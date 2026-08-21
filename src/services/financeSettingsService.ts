import { supabase } from '../lib/supabase'
export type FinanceSettings={defaultPaymentTermsDays:number;reminderDaysBeforeDue:number}
const defaults:FinanceSettings={defaultPaymentTermsDays:21,reminderDaysBeforeDue:7}, ID='finance-settings', PREFIX='FINANCE_SETTINGS'
export async function getFinanceSettings(){if(!supabase){const raw=localStorage.getItem(PREFIX);return raw?JSON.parse(raw) as FinanceSettings:defaults}const{data}=await supabase.from('activity_log').select('timestamp').eq('id',ID).maybeSingle();if(!data)return defaults;try{return{...defaults,...JSON.parse(data.timestamp)}}catch{return defaults}}
export async function saveFinanceSettings(settings:FinanceSettings){if(!supabase){localStorage.setItem(PREFIX,JSON.stringify(settings));return}const row={id:ID,customer_name:PREFIX,action:'Invoice & Payment Settings',timestamp:JSON.stringify(settings)};const{error}=await supabase.from('activity_log').upsert(row);if(error)throw error}
