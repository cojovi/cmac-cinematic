export interface CsvColumn<Row> { header: string; value: (row: Row) => unknown }

/** Neutralise spreadsheet formula injection: customer-supplied text is exported, and a leading = + - @ would execute in Excel/Sheets. */
function cell(value: unknown) {
  let text = value == null ? '' : String(value)
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text
}

export function toCsv<Row>(rows: Row[], columns: CsvColumn<Row>[]) {
  const lines = [columns.map((column) => cell(column.header)).join(',')]
  for (const row of rows) lines.push(columns.map((column) => cell(column.value(row))).join(','))
  return lines.join('\r\n')
}

export function downloadCsv<Row>(filename: string, rows: Row[], columns: CsvColumn<Row>[]) {
  // The BOM makes Excel read UTF-8 names correctly.
  const blob = new Blob(['﻿', toCsv(rows, columns)], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

export function csvFilename(prefix: string, now = new Date()) {
  return `cmac-${prefix}-${now.toISOString().slice(0, 10)}.csv`
}
