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

// Tesseract (OCR) is even heavier than pdf.js — only loaded if a page turns
// out to have no real text layer (i.e. it's a scanned image, not exported
// text — very common for statements saved from a phone photo or a scan).
let tesseractPromise: Promise<typeof import("tesseract.js")> | null = null
function loadTesseract() {
  if (!tesseractPromise) tesseractPromise = import("tesseract.js")
  return tesseractPromise
}

function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error(message)), ms)),
  ])
}

/** OCRs an already-drawn canvas (works for both a rendered PDF page and a
    plain photo/screenshot uploaded directly). */
async function ocrCanvas(canvas: HTMLCanvasElement): Promise<string[]> {
  const Tesseract = await loadTesseract()
  const { data } = await Tesseract.recognize(canvas, "eng")
  const lineTexts = (data as unknown as { lines?: { text: string }[] }).lines
  if (lineTexts && lineTexts.length) return lineTexts.map(l => l.text).filter(t => t.trim())
  return data.text.split("\n").filter(t => t.trim())
}

/** Renders a scanned PDF page to a canvas and OCRs it. Some PDFs (certain
    scan/export tools) can make pdf.js's own canvas renderer hang indefinitely
    on a single page — wrapped in a timeout so that fails fast with a clear
    message instead of freezing the import forever. */
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

/** Loads a plain image file (PNG/JPG screenshot or photo of a statement)
    straight into a canvas for OCR — skips PDF parsing entirely, which is the
    most reliable path for a scanned statement. */
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
  const ctx = canvas.getContext("2d")
  if (!ctx) return []
  ctx.drawImage(img, 0, 0)
  return ocrCanvas(canvas)
}

/** Extracts text lines from every page, keeping items on the same visual row
    together (pdf.js returns positioned fragments, not lines). Falls back to
    OCR for any page that has no real text layer (a scanned image). If a
    page's renderer hangs or errors, that page is skipped (with the error
    surfaced) rather than blocking the whole import forever. */
async function pdfToLines(file: File, onProgress?: (msg: string) => void): Promise<{ lines: string[]; renderFailed: boolean }> {
  const pdfjs = await loadPdfjs()
  const buf = await file.arrayBuffer()
  const doc = await pdfjs.getDocument({ data: buf }).promise
  const lines: string[] = []
  let renderFailed = false
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
    if (rows.size === 0) {
      // No extractable text on this page at all — it's a scanned image. Read it with OCR instead.
      onProgress?.(doc.numPages > 1 ? `Reading scanned page ${p} of ${doc.numPages}… this can take a moment` : "Reading scanned statement… this can take a moment")
      try {
        const ocrLines = await ocrPdfPage(page)
        lines.push(...ocrLines)
      } catch {
        renderFailed = true
      }
      continue
    }
    const sorted = [...rows.entries()].sort((a, b) => b[0] - a[0]) // top → bottom
    for (const [, frags] of sorted) {
      frags.sort((a, b) => a.x - b.x)
      lines.push(frags.map(f => f.str).join(" "))
    }
  }
  return { lines, renderFailed }
}

export async function parseStatementPdf(
  file: File, onProgress?: (msg: string) => void,
): Promise<{ rows: StatementRow[]; totalLines: number; renderFailed?: boolean }> {
  let lines: string[]
  let renderFailed = false
  if (file.type.startsWith("image/")) {
    onProgress?.("Reading scanned statement… this can take a moment")
    lines = await imageFileToLines(file)
  } else {
    const result = await pdfToLines(file, onProgress)
    lines = result.lines
    renderFailed = result.renderFailed
  }
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
