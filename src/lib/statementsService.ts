import { supabase } from "./supabase"
import type { StatementRecord } from "./secureAdminApi"

/* Customer statements. `supabase.from` already routes to
   test_customer_statements under Test Mode via the Proxy in supabase.ts,
   so no runtimeTable() call is needed here. */

export async function getStatements(limit = 200): Promise<StatementRecord[]> {
  if (!supabase) return []
  const { data, error } = await supabase
    .from("customer_statements")
    .select("*")
    .order("statement_date", { ascending: false })
    .limit(limit)
  if (error) { console.error("getStatements", error); return [] }
  return (data ?? []) as StatementRecord[]
}

/** Links a statement that arrived without a confident customer match to a
    customer the admin picked. Reconciliation is intentionally NOT re-run
    here - it is a read-only comparison performed at import time, and
    re-running it client-side would duplicate server logic. */
export async function linkStatementToCustomer(statementId: string, customerId: string, customerName: string): Promise<void> {
  if (!supabase) throw new Error("Not connected to the database")
  const { error } = await supabase
    .from("customer_statements")
    .update({ customer_id: customerId, customer_name: customerName, reconciliation_status: "needs_review" })
    .eq("id", statementId)
  if (error) throw error
}
