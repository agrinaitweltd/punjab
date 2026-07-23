import { supabase } from "./supabase"

/* Bank-transfer payment proofs (screenshots).
   Customer pays by bank transfer, uploads a screenshot of the transfer as
   proof, and an admin reviews it before marking the invoice paid. Stored the
   same way as lib/fileService.ts documents — as a data-URI in activity_log,
   under a distinct PAYPROOF: marker so it's filtered out of both the real
   activity feed and the Documents file library. */

export type ProofStatus = "pending" | "approved" | "rejected"

export type PaymentProof = {
  id: string
  customerId: string
  customerName: string
  invoiceIds: string[]
  invoiceNumbers: string[]
  amount: number
  fileName: string
  fileType: string
  dataUri: string
  note: string
  status: ProofStatus
  uploadedAt: string
  reviewedAt: string
  reviewNote: string
}

export const MAX_PROOF_BYTES = 4 * 1024 * 1024 // 4 MB — screenshots only

type ProofMeta = {
  customerId: string; customerName: string; invoiceIds: string[]; invoiceNumbers: string[]
  amount: number; fileName: string; fileType: string; note: string; status: ProofStatus
  uploadedAt: string; reviewedAt: string; reviewNote: string
}

function db() {
  if (!supabase) throw new Error("Not connected to the database")
  return supabase
}

function mapRow(r: { id: string; action: string; timestamp: string; created_at?: string }): PaymentProof {
  let meta: Partial<ProofMeta> = {}
  try { meta = JSON.parse(r.timestamp ?? "{}") } catch { /* ignore */ }
  return {
    id: r.id,
    customerId: meta.customerId ?? "",
    customerName: meta.customerName ?? "",
    invoiceIds: meta.invoiceIds ?? [],
    invoiceNumbers: meta.invoiceNumbers ?? [],
    amount: meta.amount ?? 0,
    fileName: meta.fileName ?? "payment-proof",
    fileType: meta.fileType ?? "image/png",
    dataUri: r.action ?? "",
    note: meta.note ?? "",
    status: meta.status ?? "pending",
    uploadedAt: meta.uploadedAt ?? r.created_at ?? "",
    reviewedAt: meta.reviewedAt ?? "",
    reviewNote: meta.reviewNote ?? "",
  }
}

export async function listPaymentProofs(): Promise<PaymentProof[]> {
  const { data, error } = await db().from("activity_log").select("*")
    .like("customer_name", "PAYPROOF:%")
    .order("created_at", { ascending: false })
  if (error) { console.error("listPaymentProofs", error); return [] }
  return (data ?? []).map(mapRow)
}

export async function listPaymentProofsForCustomer(customerId: string): Promise<PaymentProof[]> {
  const all = await listPaymentProofs()
  return all.filter(p => p.customerId === customerId)
}

export async function uploadPaymentProof(input: {
  customerId: string; customerName: string; invoiceIds: string[]; invoiceNumbers: string[]
  amount: number; fileName: string; fileType: string; dataUri: string; note: string
}): Promise<void> {
  const meta: ProofMeta = {
    customerId: input.customerId, customerName: input.customerName,
    invoiceIds: input.invoiceIds, invoiceNumbers: input.invoiceNumbers, amount: input.amount,
    fileName: input.fileName, fileType: input.fileType, note: input.note,
    status: "pending", uploadedAt: new Date().toISOString(), reviewedAt: "", reviewNote: "",
  }
  const row = {
    id: `pp-${Date.now()}`,
    customer_name: `PAYPROOF:${input.customerName}`,
    action: input.dataUri,
    timestamp: JSON.stringify(meta),
  }
  const { error } = await db().from("activity_log").insert(row)
  if (error) throw error
}

async function updateStatus(id: string, patch: Partial<ProofMeta>): Promise<void> {
  const { data, error: readError } = await db().from("activity_log").select("*").eq("id", id).single()
  if (readError) throw readError
  const current = mapRow(data)
  const meta: ProofMeta = {
    customerId: current.customerId, customerName: current.customerName,
    invoiceIds: current.invoiceIds, invoiceNumbers: current.invoiceNumbers, amount: current.amount,
    fileName: current.fileName, fileType: current.fileType, note: current.note,
    status: current.status, uploadedAt: current.uploadedAt, reviewedAt: current.reviewedAt, reviewNote: current.reviewNote,
    ...patch,
  }
  const { error } = await db().from("activity_log").update({ timestamp: JSON.stringify(meta) }).eq("id", id)
  if (error) throw error
}

export async function approvePaymentProof(id: string): Promise<void> {
  await updateStatus(id, { status: "approved", reviewedAt: new Date().toISOString() })
}

export async function rejectPaymentProof(id: string, reviewNote: string): Promise<void> {
  await updateStatus(id, { status: "rejected", reviewedAt: new Date().toISOString(), reviewNote })
}
