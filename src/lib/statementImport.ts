/* One-time customer statement import.
   Reads a statement PDF (from the previous accounting system), finds every
   line that looks like "date … invoice number … amount", and returns the
   parsed rows so the admin can review them before they're saved as invoices. */

// pdf.js is heavy (~450 KB) — load it on demand the first time a statement
// is actually imported, so it never weighs down normal page loads.
let pdfjsPromise: Promise<typeof import("pdfjs-dist")> | null = null
function loadPdfjs() {
  if (!pdfjsPromise) {
    pdfjsPromise = import("pdfjs-dist").then(m => {
      m.GlobalWorkerOptions.workerSrc = new URL(
        "pdfjs-dist/build/pdf.worker.min.mjs",
        import.meta.url,
      ).toString()
      return m
    })
  }
  return pdfjsPromise
}

export type StatementRow = {
  date: string          // ISO yyyy-mm-dd
  invoiceNumber: string
  amount: number
  raw: string           // the original line, shown in the preview for checking
}

const DATE_RE = /\b(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})\b/
// £1,234.56 / 1234.56 / 1,234 — the last money-looking token on the line wins
const AMOUNT_RE = /£?\s*(\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?|\d+\.\d{1,2})\b/g

function toIsoDate(d: string, m: string, y: string): string | null {
  const day = parseInt(d, 10), month = parseInt(m, 10)
  let year = parseInt(y, 10)
  if (year < 100) year += 2000
  if (day < 1 || day > 31 || month < 1 || month > 12 || year < 2000 || year > 2100) return null
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`
}

function parseLine(line: string): StatementRow | null {
  const dateMatch = line.match(DATE_RE)
  if (!dateMatch) return null
  const iso = toIsoDate(dateMatch[1], dateMatch[2], dateMatch[3])
  if (!iso) return null

  // Amount: take the LAST money token on the line (statements usually end
  // each row with the invoice amount or running balance — the invoice amount
  // column comes before balance, so prefer the second-to-last when there are
  // two or more money tokens after the date).
  const afterDate = line.slice((dateMatch.index ?? 0) + dateMatch[0].length)
  const amounts = [...afterDate.matchAll(AMOUNT_RE)].map(m2 => parseFloat(m2[1].replace(/,/g, "")))
    .filter(n => !Number.isNaN(n) && n > 0)
  if (amounts.length === 0) return null
  const amount = amounts.length >= 2 ? amounts[amounts.length - 2] : amounts[amounts.length - 1]

  // Invoice number: first token after the date containing a digit that isn't
  // itself a money amount (e.g. "INV-1042", "SI10432", "10432").
  const tokens = afterDate.trim().split(/\s+/)
  let invoiceNumber = ""
  for (const t of tokens) {
    const clean = t.replace(/[£,]/g, "")
    if (!/\d/.test(clean)) continue
    if (/^\d+(\.\d{1,2})?$/.test(clean) && amounts.includes(parseFloat(clean))) continue
    invoiceNumber = t.replace(/[^\w\-\/]/g, "")
    break
  }
  if (!invoiceNumber) {
    // Purely numeric statements: fall back to the first number that isn't the amount
    for (const t of tokens) {
      const clean = t.replace(/[£,]/g, "")
      if (/^\d{3,}$/.test(clean) && !amounts.includes(parseFloat(clean))) { invoiceNumber = clean; break }
    }
  }
  if (!invoiceNumber) return null

  return { date: iso, invoiceNumber, amount, raw: line.trim() }
}

/** Extracts text lines from every page, keeping items on the same visual row
    together (pdf.js returns positioned fragments, not lines). */
async function pdfToLines(file: File): Promise<string[]> {
  const pdfjs = await loadPdfjs()
  const buf = await file.arrayBuffer()
  const doc = await pdfjs.getDocument({ data: buf }).promise
  const lines: string[] = []
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p)
    const content = await page.getTextContent()
    const rows = new Map<number, { x: number; str: string }[]>()
    for (const item of content.items) {
      if (!("str" in item) || !item.str.trim()) continue
      const y = Math.round(item.transform[5] / 3) * 3 // bucket nearby baselines
      const x = item.transform[4]
      if (!rows.has(y)) rows.set(y, [])
      rows.get(y)!.push({ x, str: item.str })
    }
    const sorted = [...rows.entries()].sort((a, b) => b[0] - a[0]) // top → bottom
    for (const [, frags] of sorted) {
      frags.sort((a, b) => a.x - b.x)
      lines.push(frags.map(f => f.str).join(" "))
    }
  }
  return lines
}

export async function parseStatementPdf(file: File): Promise<{ rows: StatementRow[]; totalLines: number }> {
  const lines = await pdfToLines(file)
  const rows: StatementRow[] = []
  const seen = new Set<string>()
  for (const line of lines) {
    const row = parseLine(line)
    if (row && !seen.has(row.invoiceNumber)) {
      seen.add(row.invoiceNumber)
      rows.push(row)
    }
  }
  return { rows, totalLines: lines.length }
}
