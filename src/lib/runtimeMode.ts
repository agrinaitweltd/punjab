const SANDBOX_TABLES = new Set([
  'activity_log', 'assigned_tasks', 'buying_prices', 'buying_sessions',
  'communication_logs', 'credit_note_allocations', 'credit_note_items', 'credit_notes',
  'customer_applications', 'customer_sub_accounts', 'customers', 'day_trades',
  'delivery_areas', 'expenses', 'finance_settings', 'generated_documents',
  'invoice_items', 'invoices', 'notification_logs', 'orders', 'payments',
  'products', 'salesmen', 'stock_items', 'suppliers', 'support_tickets',
  'whatsapp_logs', 'whatsapp_templates',
])

let testMode = false

export function setRuntimeTestMode(enabled: boolean) {
  testMode = enabled
}

export function isRuntimeTestMode() {
  return testMode
}

export function runtimeTable(table: string) {
  return testMode && SANDBOX_TABLES.has(table) ? `test_${table}` : table
}

export function testModeDocumentBucket() {
  return testMode ? 'test-documents' : 'customer-documents'
}
