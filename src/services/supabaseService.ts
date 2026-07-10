/**
 * SUPABASE INTEGRATION — ready to wire up.
 *
 * Steps to connect:
 * 1. npm install @supabase/supabase-js
 * 2. Add to .env:
 *      VITE_SUPABASE_URL=https://xxxx.supabase.co
 *      VITE_SUPABASE_ANON_KEY=your-anon-key
 * 3. Uncomment the client below and replace databaseService calls
 *    in src/api/*.ts with supabaseService calls.
 * 4. Create tables in Supabase matching the types in src/types/index.ts:
 *    customers, products, stock_items, orders, invoices, payments,
 *    support_tickets, delivery_areas, admin_staff
 *
 * Example table: customers
 *   id uuid primary key default gen_random_uuid()
 *   company_name text not null
 *   contact_person text
 *   email text unique
 *   customer_number text unique
 *   delivery_area text
 *   payment_terms text
 *   balance numeric default 0
 *   active boolean default true
 *   created_at timestamptz default now()
 */

// import { createClient } from "@supabase/supabase-js"
//
// const supabaseUrl  = import.meta.env.VITE_SUPABASE_URL  as string
// const supabaseKey  = import.meta.env.VITE_SUPABASE_ANON_KEY as string
// export const supabase = createClient(supabaseUrl, supabaseKey)
//
// Example usage (replace databaseService in api/customersApi.ts):
//
// export async function getCustomers() {
//   const { data, error } = await supabase.from("customers").select("*").order("company_name")
//   if (error) throw error
//   return data
// }
//
// export async function createCustomer(input: Omit<Customer, "id">) {
//   const { data, error } = await supabase.from("customers").insert(input).select().single()
//   if (error) throw error
//   return data
// }

export {}