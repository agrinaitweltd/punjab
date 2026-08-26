// Node-safe PDF -> text-lines extraction for the email-import worker.
//
// Mirrors src/lib/statementImport.ts's pdfToLines() line-reconstruction
// algorithm exactly (same y-row grouping, same x-gap-to-space heuristic) so
// a PDF attached to an email produces the same line shape that the existing
// parseLegacyInvoiceLines()/parseCreditNoteLines() parsers already expect
// from a manually uploaded PDF - only the extraction step differs.
//
// Deliberately text-layer only, no OCR fallback (statementImport.ts's OCR
// path renders to an HTMLCanvasElement via tesseract.js, which needs a
// browser DOM - there's no server equivalent here). A PDF with no
// extractable text layer (a pure scan) comes back with zero lines; the
// caller treats that as "needs review" rather than guessing.
import './dommatrix-polyfill.js'
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs'

export async function extractPdfTextLines(buffer) {
  const loadingTask = getDocument({ data: new Uint8Array(buffer), useWorkerFetch: false, isEvalSupported: false, useSystemFonts: true })
  const doc = await loadingTask.promise
  try {
    const lines = []
    for (let p = 1; p <= doc.numPages; p += 1) {
      const page = await doc.getPage(p)
      const content = await page.getTextContent()
      const rows = new Map()
      for (const item of content.items) {
        if (!('str' in item) || !item.str.trim()) continue
        const y = Math.round(item.transform[5] / 3) * 3
        if (!rows.has(y)) rows.set(y, [])
        rows.get(y).push({ x: item.transform[4], str: item.str })
      }
      for (const [, frags] of [...rows.entries()].sort((a, b) => b[0] - a[0])) {
        frags.sort((a, b) => a.x - b.x)
        const minX = frags[0]?.x ?? 0
        let rendered = ''
        for (const frag of frags) {
          const target = Math.max(0, Math.round((frag.x - minX) / 4.8))
          if (target > rendered.length) rendered += ' '.repeat(target - rendered.length)
          if (rendered && !rendered.endsWith(' ') && target <= rendered.length) rendered += ' '
          rendered += frag.str
        }
        lines.push(rendered)
      }
    }
    return lines
  } finally {
    await loadingTask.destroy()
  }
}
