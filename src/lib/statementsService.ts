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
    re-running it client-side would duplicate server logic.

    Also patches the underlying activity_log file row's own customerId/
    customerName metadata to match - without this, the statement's PDF stays
    permanently invisible in any customer-scoped file view (the customer
    portal's own files, and the admin Files "By Customer" folder) even after
    being explicitly linked here, since listFilesForCustomer() filters by
    the file's own metadata, not customer_statements.customer_id. */
export async function linkStatementToCustomer(statementId: string, customerId: string, customerName: string): Promise<void> {
  if (!supabase) throw new Error("Not connected to the database")
  const { data: statement, error: statementError } = await supabase
    .from("customer_statements")
    .update({ customer_id: customerId, customer_name: customerName, reconciliation_status: "needs_review" })
    .eq("id", statementId)
    .select("source_document_id")
    .maybeSingle()
  if (statementError) throw statementError

  const fileId = statement?.source_document_id
  if (!fileId) return
  const { data: file, error: fileReadError } = await supabase.from("activity_log").select("timestamp").eq("id", fileId).maybeSingle()
  if (fileReadError || !file) return
  let metadata: Record<string, unknown> = {}
  try { metadata = JSON.parse(file.timestamp ?? "{}") } catch { /* legacy row - nothing to preserve */ }
  await supabase.from("activity_log").update({ timestamp: JSON.stringify({ ...metadata, customerId, customerName }) }).eq("id", fileId)
}
