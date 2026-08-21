let pdfjsPromise: Promise<typeof import("pdfjs-dist")> | null = null
function loadPdfjs() {
  if (!pdfjsPromise) {
    pdfjsPromise = import("pdfjs-dist").then(m => {
      m.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString()
      return m
    })
  }
  return pdfjsPromise
}

export type StatementRow = {
  date: string
  invoiceNumber: string
  amount: number
  raw: string
  goodsAmount?: number
  vatAmount?: number
  datePaid?: string | null
  amountPaid?: number
  outstandingAmount?: number
  runningOutstandingBalance?: number
  status?: "Unpaid" | "Part Paid" | "Paid"
}

export type PunjabStatement = {
  documentType: "PUNJAB_CUSTOMER_STATEMENT"
  customer: { name: string; accountNumber: string; address: string[]; postcode: string }
  statementDate: string
  invoiceCount: number
  rows: StatementRow[]
  firstInvoice: { number: string; date: string; amount: number } | null
  latestInvoice: { number: string; date: string; amount: number } | null
  totals: { goods: number; vat: number; invoiceTotal: number; paid: number; outstanding: number }
  ageing: {
    labels: { current: string; days7Plus: string; days14Plus: string; days21Plus: string; older: string }
    current: number
    days7Plus: number
    days14Plus: number
    days21Plus: number
    older: number
  }
  reconciled: boolean
  processingStatus: "RECONCILED" | "NEEDS_REVIEW"
  reviewReasons: string[]
}

const DATE_RE = /\b(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})\b/
const AMOUNT_RE = /(-|\()?\s*£?\s*((?:\d{1,3}(?:,\d{3})+(?:\.\d{1,2})?)|(?:\d+\.\d{2}))\s*(\))?/g
const MONEY_TOKEN_RE = /-?\d{1,3}(?:,\d{3})*(?:\.\d{2})|-?\d+\.\d{2}/g
const POSTCODE_RE = /\b[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}\b/i

function toIsoDate(d: string, m: string, y: string): string | null {
  const day = parseInt(d, 10), month = parseInt(m, 10)
  let year = parseInt(y, 10)
  if (year < 100) year += 2000
  if (day < 1 || day > 31 || month < 1 || month > 12 || year < 2000 || year > 2100) return null
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`
}

function parseMoney(value?: string | null): number {
  if (!value) return 0
  const n = parseFloat(value.replace(/[£,\s]/g, ""))
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0
}

function moneyTokens(line: string) {
  return [...line.matchAll(MONEY_TOKEN_RE)].map(m => ({ value: parseMoney(m[0]), index: m.index ?? 0 }))
}

function normaliseLine(line: string) {
  return line.replace(/\s+/g, " ").trim()
}

function parseDate(value?: string | null) {
  const match = value?.match(DATE_RE)
  return match ? toIsoDate(match[1], match[2], match[3]) : null
}

function headingIndex(line: string, heading: string) {
  return line.toLowerCase().indexOf(heading.toLowerCase())
}

function valuesByNearestColumn(tokens: ReturnType<typeof moneyTokens>, columns: Record<string, number>) {
  const assigned: Record<string, number> = {}
  const active = Object.entries(columns).filter(([, x]) => x >= 0)
  for (const token of tokens) {
    let best: { key: string; distance: number } | null = null
    for (const [key, x] of active) {
      const distance = Math.abs(token.index - x)
      if (!best || distance < best.distance) best = { key, distance }
    }
    if (best && best.distance <= 24 && assigned[best.key] === undefined) assigned[best.key] = token.value
  }
  return assigned
}

function parseLine(line: string): StatementRow | null {
  const dateMatch = line.match(DATE_RE)
  if (!dateMatch) return null
  const iso = toIsoDate(dateMatch[1], dateMatch[2], dateMatch[3])
  if (!iso) return null
  const afterDate = line.slice((dateMatch.index ?? 0) + dateMatch[0].length)
  const amounts = [...afterDate.matchAll(AMOUNT_RE)].map(m => {
    const raw = parseFloat(m[2].replace(/,/g, ""))
    return m[1] === "-" || m[1] === "(" || m[3] === ")" ? -raw : raw
  }).filter(n => !Number.isNaN(n) && n !== 0)
  if (!amounts.length) return null
  const amount = amounts.length >= 2 ? amounts[amounts.length - 2] : amounts[amounts.length - 1]
  const invoiceNumber = afterDate.match(/\b[A-Z]*-?\d{3,}\b/i)?.[0]?.replace(/[^\w-/]/g, "") ?? ""
  return invoiceNumber ? { date: iso, invoiceNumber, amount, raw: normaliseLine(line) } : null
}

function recognisePunjabStatement(lines: string[]) {
  const text = lines.map(normaliseLine).join("\n")
  const markers = [
    /Punjab Exotic Foods Ltd/i, /Stmt\s*Date/i, /Acc(?:ount)?\s*No/i, /S\s*T\s*A\s*T\s*E\s*M\s*E\s*N\s*T|STATEMENT/i,
    /Inv Date/i, /Inv No/i, /GoodsAmt/i, /Inv Total/i, /Item O\/S/i, /TotalO\/S/i,
    /Stmt Acc Totals/i, /Current/i, /7\+\s*Days/i, /14\+\s*Days/i, /Older/i,
  ]
  return markers.filter(re => re.test(text)).length >= 7
}

function deriveCustomer(lines: string[]) {
  const statementIndex = lines.findIndex(l => /S\s*T\s*A\s*T\s*E\s*M\s*E\s*N\s*T|STATEMENT/i.test(l))
  const candidates = lines.slice(0, statementIndex > 0 ? statementIndex : 25)
    .map(normaliseLine)
    .filter(Boolean)
    .filter(l => !/Punjab Exotic Foods Ltd|Gate 9|Spitalfields|Sherrin Road|London E10|Tel|Mobile|Email|Stmt\s*Date|Acc(?:ount)?\s*No|Page\s*:/i.test(l))
  const postcodeIndex = candidates.findIndex(l => POSTCODE_RE.test(l))
  const block = postcodeIndex >= 0 ? candidates.slice(Math.max(0, postcodeIndex - 4), postcodeIndex + 1) : candidates.slice(-5)
  const postcode = block.find(l => POSTCODE_RE.test(l))?.match(POSTCODE_RE)?.[0].toUpperCase() ?? ""
  return { name: block[0] ?? "", address: block.slice(1).filter(l => l !== postcode), postcode }
}

function parsePunjabCustomerStatement(lines: string[]): PunjabStatement | null {
  const headingLineIndex = lines.findIndex(l => /Inv Date/i.test(l) && /Inv No/i.test(l) && /GoodsAmt/i.test(l))
  if (headingLineIndex < 0) return null
  const heading = lines[headingLineIndex]
  const cols = {
    goods: headingIndex(heading, "GoodsAmt"),
    vat: headingIndex(heading, "Vat"),
    invoiceTotal: headingIndex(heading, "Inv Total"),
    datePaid: headingIndex(heading, "DatePaid"),
    amountPaid: headingIndex(heading, "Amt Paid"),
    outstanding: headingIndex(heading, "Item O/S"),
    running: headingIndex(heading, "TotalO/S"),
  }
  const rows: StatementRow[] = []
  let totalsLine = ""
  for (const line of lines.slice(headingLineIndex + 1)) {
    if (/Stmt Acc Totals/i.test(line)) { totalsLine = line; break }
    const dateMatch = line.match(DATE_RE)
    const date = dateMatch ? toIsoDate(dateMatch[1], dateMatch[2], dateMatch[3]) : null
    if (!date || dateMatch?.index === undefined) continue
    const invoiceNumber = line.slice(dateMatch.index + dateMatch[0].length).match(/\b\d{4,}\b/)?.[0] ?? ""
    if (!invoiceNumber) continue
    const values = valuesByNearestColumn(moneyTokens(line), cols)
    const goodsAmount = values.goods ?? 0
    const vatAmount = values.vat ?? 0
    const invoiceTotal = values.invoiceTotal ?? 0
    const amountPaid = values.amountPaid ?? 0
    const runningOutstandingBalance = values.running ?? 0
    const datePaid = parseDate(line.slice(Math.max(0, cols.datePaid), Math.max(cols.datePaid + 18, cols.amountPaid)))
    const statementAmount = invoiceTotal || goodsAmount
    const isBlankPayment = !datePaid && amountPaid <= 0
    const outstandingAmount = isBlankPayment ? (values.outstanding ?? statementAmount) : (values.outstanding ?? 0)
    const syncedAmountPaid = isBlankPayment ? 0 : Math.max(0, Math.round((statementAmount - outstandingAmount) * 100) / 100) || amountPaid
    const status = isBlankPayment ? "Unpaid" : outstandingAmount <= 0 ? "Paid" : syncedAmountPaid > 0 ? "Part Paid" : "Unpaid"
    rows.push({
      date,
      invoiceNumber,
      amount: statementAmount,
      goodsAmount,
      vatAmount,
      datePaid,
      amountPaid: syncedAmountPaid,
      outstandingAmount,
      runningOutstandingBalance,
      status,
      raw: normaliseLine(line),
    })
  }
  const totalValues = valuesByNearestColumn(moneyTokens(totalsLine), cols)
  const totals = {
    goods: totalValues.goods ?? 0,
    vat: totalValues.vat ?? 0,
    invoiceTotal: totalValues.invoiceTotal ?? 0,
    paid: totalValues.amountPaid ?? 0,
    outstanding: totalValues.outstanding ?? totalValues.running ?? 0,
  }
  const ageing = { labels: { current: "Current", days7Plus: "7+ Days", days14Plus: "14+ Days", days21Plus: "21+ Days", older: "Older" }, current: 0, days7Plus: 0, days14Plus: 0, days21Plus: 0, older: 0 }
  for (const line of lines.map(normaliseLine)) {
    const amount = moneyTokens(line)[0]?.value
    if (amount === undefined) continue
    if (/^Current\b/i.test(line)) ageing.current = amount
    else if (/^7\+\s*Days\b/i.test(line)) ageing.days7Plus = amount
    else if (/^14\+\s*Days\b/i.test(line)) ageing.days14Plus = amount
    else if (/^21\+\s*Days\b/i.test(line)) ageing.days21Plus = amount
    else if (/^Older\b/i.test(line)) ageing.older = amount
  }
  const customer = deriveCustomer(lines)
  const statementDate = parseDate(lines.find(l => /Stmt\s*Date/i.test(l)) ?? "") ?? ""
  const accountNumber = normaliseLine(lines.find(l => /Acc(?:ount)?\s*No/i.test(l)) ?? "").match(/Acc(?:ount)?\s*No\s*:?\s*([A-Z0-9-]+)/i)?.[1] ?? ""
  const reviewReasons: string[] = []
  const sumGoods = Math.round(rows.reduce((s, r) => s + (r.goodsAmount ?? 0), 0) * 100) / 100
  const sumInvoice = Math.round(rows.reduce((s, r) => s + r.amount, 0) * 100) / 100
  if (!statementDate) reviewReasons.push("Statement date was not found.")
  if (!accountNumber) reviewReasons.push("Account number was not found.")
  if (!customer.name || /Punjab Exotic Foods/i.test(customer.name)) reviewReasons.push("Customer block was not confidently identified.")
  if (!rows.length) reviewReasons.push("No invoice rows were found.")
  if (Math.abs(sumGoods - totals.goods) > 0.01) reviewReasons.push(`Goods total mismatch: rows ${sumGoods.toFixed(2)} vs statement ${totals.goods.toFixed(2)}.`)
  if (Math.abs(sumInvoice - totals.invoiceTotal) > 0.01) reviewReasons.push(`Invoice total mismatch: rows ${sumInvoice.toFixed(2)} vs statement ${totals.invoiceTotal.toFixed(2)}.`)
  const sorted = [...rows].sort((a, b) => a.date.localeCompare(b.date))
  const reconciled = reviewReasons.length === 0
  return {
    documentType: "PUNJAB_CUSTOMER_STATEMENT",
    customer: { ...customer, accountNumber },
    statementDate,
    invoiceCount: rows.length,
    rows,
    firstInvoice: sorted[0] ? { number: sorted[0].invoiceNumber, date: sorted[0].date, amount: sorted[0].amount } : null,
    latestInvoice: sorted.at(-1) ? { number: sorted.at(-1)!.invoiceNumber, date: sorted.at(-1)!.date, amount: sorted.at(-1)!.amount } : null,
    totals,
    ageing,
    reconciled,
    processingStatus: reconciled ? "RECONCILED" : "NEEDS_REVIEW",
    reviewReasons,
  }
}

let tesseractPromise: Promise<typeof import("tesseract.js")> | null = null
function loadTesseract() {
  if (!tesseractPromise) tesseractPromise = import("tesseract.js")
  return tesseractPromise
}

function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  return Promise.race([promise, new Promise<T>((_, reject) => setTimeout(() => reject(new Error(message)), ms))])
}

async function ocrCanvas(canvas: HTMLCanvasElement): Promise<string[]> {
  const Tesseract = await loadTesseract()
  const { data } = await Tesseract.recognize(canvas, "eng")
  const lineTexts = (data as unknown as { lines?: { text: string }[] }).lines
  if (lineTexts?.length) return lineTexts.map(l => l.text).filter(t => t.trim())
  return data.text.split("\n").filter(t => t.trim())
}

async function ocrPdfPage(page: import("pdfjs-dist").PDFPageProxy): Promise<string[]> {
  const viewport = page.getViewport({ scale: 2 })
  const canvas = document.createElement("canvas")
  canvas.width = viewport.width
  canvas.height = viewport.height
  const ctx = canvas.getContext("2d")
  if (!ctx) return []
  const renderTask = page.render({ canvasContext: ctx, viewport, canvas })
  await withTimeout(renderTask.promise, 20000, "PDF_RENDER_TIMEOUT")
  return ocrCanvas(canvas)
}

async function imageFileToLines(file: File): Promise<string[]> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(String(r.result))
    r.onerror = () => reject(r.error)
    r.readAsDataURL(file)
  })
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image()
    el.onload = () => resolve(el)
    el.onerror = () => reject(new Error("Couldn't read that image."))
    el.src = dataUrl
  })
  const canvas = document.createElement("canvas")
  canvas.width = img.naturalWidth
  canvas.height = img.naturalHeight
  canvas.getContext("2d")?.drawImage(img, 0, 0)
  return ocrCanvas(canvas)
}

export async function extractDocumentLines(file: File, onProgress?: (msg: string) => void): Promise<string[]> {
  if (file.type.startsWith('image/')) {
    onProgress?.('Reading invoice image...')
    return imageFileToLines(file)
  }
  const result = await pdfToLines(file, onProgress)
  return result.lines
}

async function pdfToLines(file: File, onProgress?: (msg: string) => void): Promise<{ lines: string[]; renderFailed: boolean }> {
  const pdfjs = await loadPdfjs()
  const doc = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise
  const lines: string[] = []
  let renderFailed = false
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p)
    const content = await page.getTextContent()
    const rows = new Map<number, { x: number; str: string }[]>()
    for (const item of content.items) {
      if (!("str" in item) || !item.str.trim()) continue
      const y = Math.round(item.transform[5] / 3) * 3
      if (!rows.has(y)) rows.set(y, [])
      rows.get(y)!.push({ x: item.transform[4], str: item.str })
    }
    if (!rows.size) {
      onProgress?.(doc.numPages > 1 ? `Reading scanned page ${p} of ${doc.numPages}... this can take a moment` : "Reading scanned statement... this can take a moment")
      try { lines.push(...await ocrPdfPage(page)) } catch { renderFailed = true }
      continue
    }
    for (const [, frags] of [...rows.entries()].sort((a, b) => b[0] - a[0])) {
      frags.sort((a, b) => a.x - b.x)
      const minX = frags[0]?.x ?? 0
      let rendered = ""
      for (const frag of frags) {
        const target = Math.max(0, Math.round((frag.x - minX) / 4.8))
        if (target > rendered.length) rendered += " ".repeat(target - rendered.length)
        if (rendered && !rendered.endsWith(" ") && target <= rendered.length) rendered += " "
        rendered += frag.str
      }
      lines.push(rendered)
    }
  }
  return { lines, renderFailed }
}

export async function parseStatementPdf(
  file: File,
  onProgress?: (msg: string) => void,
): Promise<{ rows: StatementRow[]; totalLines: number; renderFailed?: boolean; statement?: PunjabStatement }> {
  let lines: string[]
  let renderFailed = false
  if (file.type.startsWith("image/")) {
    onProgress?.("Reading scanned statement... this can take a moment")
    lines = await imageFileToLines(file)
  } else {
    const result = await pdfToLines(file, onProgress)
    lines = result.lines
    renderFailed = result.renderFailed
  }
  const statement = recognisePunjabStatement(lines) ? parsePunjabCustomerStatement(lines) ?? undefined : undefined
  if (statement) return { rows: statement.rows, totalLines: lines.length, renderFailed, statement }

  const rows: StatementRow[] = []
  const seen = new Set<string>()
  for (const line of lines) {
    const row = parseLine(line)
    if (row && !seen.has(row.invoiceNumber)) {
      seen.add(row.invoiceNumber)
      rows.push(row)
    }
  }
  return { rows, totalLines: lines.length, renderFailed }
}
