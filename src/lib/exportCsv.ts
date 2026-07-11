// Small dependency-free CSV export helper.
// Builds a CSV string from rows and triggers a browser download.

function escapeCell(value: unknown): string {
  const s = value == null ? "" : String(value)
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

export function exportToCsv(filename: string, headers: string[], rows: (string | number)[][]): void {
  const lines = [headers, ...rows].map(cols => cols.map(escapeCell).join(","))
  const csv = "﻿" + lines.join("\r\n") // BOM so Excel reads UTF-8 correctly
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = filename.endsWith(".csv") ? filename : `${filename}.csv`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
