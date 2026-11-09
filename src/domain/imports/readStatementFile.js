// src/domain/imports/readStatementFile.js — one entry point for a statement file of any supported kind (CSV/TSV text, .xlsx, text-layer PDF).
// Detects the kind from the file's first bytes (not only its name), reads it on the device, and returns the parsed statement or a plain reason.
// Nothing is stored or uploaded. `workerSrc` is only needed in a browser, for PDFs.
import { parseCsv } from "./csv.js";
import { readXlsx } from "./xlsx.js";
import { parseStatementRows } from "./statement.js";
import { pdfPagesToRows } from "./statementPdf.js";
import { extractCardSummary, checkCardSummary } from "./cardSummary.js";

const MAX_TEXT_BYTES = 8 * 1024 * 1024;
const fail = reason => ({ ok: false, reason, rows: [], skipped: [], balance: { checked: 0, mismatches: [], order: "unknown" }, period: null });

export function sniffKind(bytes) {
  const head = new TextDecoder("latin1").decode(bytes.subarray(0, 1024));
  if (head.includes("%PDF-")) return "pdf";
  if (bytes[0] === 0x50 && bytes[1] === 0x4b) return "xlsx";
  if (bytes[0] === 0xd0 && bytes[1] === 0xcf) return "xls";
  return "text";
}

// accountKind "card": a plain amount is a charge, "CR" is a credit, and a PDF's printed summary (dates, totals) is read too.
/** @param {Uint8Array} bytes @param {{name?:string, workerSrc?:string, accountKind?:"card"}} [opts] @returns {Promise<{kind:string}&ReturnType<typeof parseStatementRows>>} */
export async function readStatementFile(bytes, opts = {}) {
  if (!bytes || !bytes.length) return { kind: "unknown", ...fail("The file is empty.") };
  const kind = sniffKind(bytes);
  try {
    if (kind === "pdf") {
      const { readPdfLayout } = await import("../invoices/pdfText.js");
      const lay = await readPdfLayout(bytes, { workerSrc: opts.workerSrc });
      if (lay.status !== "ok") return { kind, ...fail(lay.reason) };
      const t = pdfPagesToRows(lay.pages);
      if (!t.ok) return { kind, ...fail(t.reason) };
      const parsed = parseStatementRows(t.rows, { kind: opts.accountKind });
      if (opts.accountKind === "card" && parsed.ok) { const summary = extractCardSummary(lay.pages); return { kind, ...parsed, summary, summaryCheck: checkCardSummary(summary, parsed.rows) }; }
      return { kind, ...parsed };
    }
    if (kind === "xlsx") return { kind, ...parseStatementRows(await readXlsx(bytes), { kind: opts.accountKind }) };
    if (kind === "xls") return { kind, ...fail("This is an old-format .xls file. Save it as .xlsx or CSV and try again.") };
    if (bytes.length > MAX_TEXT_BYTES) return { kind, ...fail("This file is too large to import here. Export a shorter date range.") };
    if (bytes.subarray(0, 4096).includes(0)) return { kind, ...fail("This file is not a CSV, Excel or PDF statement.") };
    return { kind, ...parseStatementRows(parseCsv(new TextDecoder("utf-8").decode(bytes)), { kind: opts.accountKind }) };
  } catch (e) {
    return { kind, ...fail(e && e.message ? e.message : "This file could not be read.") };
  }
}
