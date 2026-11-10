// src/domain/imports/readStatementFile.js — one entry point for a statement file of any supported kind (CSV/TSV text, .xlsx, text-layer PDF).
// Detects the kind from the file's first bytes (not only its name), reads it on the device, and returns the parsed statement or a plain reason.
// Nothing is stored or uploaded. `workerSrc` is only needed in a browser, for PDFs.
import { parseCsv } from "./csv.js";
import { readXlsx } from "./xlsx.js";
import { parseStatementRows } from "./statement.js";
import { pdfPagesToRows } from "./statementPdf.js";
import { extractCardSummary, checkCardSummary } from "./cardSummary.js";

// A card statement is often 10+ pages of offers around one table; read up to this many, and skip counting pictures (only invoices need that).
export const STATEMENT_MAX_PAGES = 40;
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
  let stage = "start";
  try {
    if (kind === "pdf") {
      stage = "load the PDF reader";
      const { readPdfLayout } = await import("../invoices/pdfText.js");
      stage = "open the PDF";
      const lay = await readPdfLayout(bytes, { workerSrc: opts.workerSrc, maxPages: STATEMENT_MAX_PAGES, skipImageOps: true });
      if (lay.status !== "ok") return { kind, ...fail(lay.reason), detail: `PDF reader: ${lay.status}` };
      stage = "find the table";
      const t = pdfPagesToRows(lay.pages);
      if (!t.ok) return { kind, ...fail(t.reason), detail: `${pdfShape(lay.pages)}${t.info ? "; " + t.info : ""}` };
      stage = "read the rows";
      const parsed = parseStatementRows(t.rows, { kind: opts.accountKind });
      if (!parsed.ok) {
        const mask = v => String(v).replace(/[A-Za-z]/g, "a").replace(/\d/g, "9").slice(0, 24);
        const why = [...new Set((parsed.skipped || []).map(x => x.why))].join(", ");
        return { kind, ...parsed, detail: `${pdfShape(lay.pages)}; table rows found: ${t.rows.length - 1}; table headings read: ${(t.rows[0] || []).map(c => String(c).slice(0, 26)).join(" | ")}${why ? `; rows skipped because: ${why}` : ""}; first row (masked): ${(t.rows[1] || []).map(mask).join(" | ")}` };
      }
      if (opts.accountKind === "card") {
        // The printed summary is a bonus: if reading it fails the rows still import, just without the cross-check.
        stage = "read the printed summary";
        let summary = {}, summaryCheck = { ok: false, findings: [] };
        try { summary = extractCardSummary(lay.pages); summaryCheck = checkCardSummary(summary, parsed.rows); } catch { /* rows only */ }
        return { kind, ...parsed, summary, summaryCheck, rowsPerPage: t.rowsPerPage };
      }
      return { kind, ...parsed, rowsPerPage: t.rowsPerPage };
    }
    stage = "read the file";
    if (kind === "xlsx") return { kind, ...parseStatementRows(await readXlsx(bytes), { kind: opts.accountKind }) };
    if (kind === "xls") return { kind, ...fail("This is an old-format .xls file. Save it as .xlsx or CSV and try again.") };
    if (bytes.length > MAX_TEXT_BYTES) return { kind, ...fail("This file is too large to import here. Export a shorter date range.") };
    if (bytes.subarray(0, 4096).includes(0)) return { kind, ...fail("This file is not a CSV, Excel or PDF statement.") };
    return { kind, ...parseStatementRows(parseCsv(new TextDecoder("utf-8").decode(bytes)), { kind: opts.accountKind }) };
  } catch (e) {
    const name = (e && e.name) || typeof e, msg = e && e.message ? String(e.message).slice(0, 140) : "";
    return { kind, ...fail(msg || "This file could not be read."), detail: `failed while trying to ${stage}: ${name}${msg ? " — " + msg : " (no message)"}` };
  }
}

/** What the PDF looked like, without any of its content: page count, text items, and the heading-like words found (column names only). */
export function pdfShape(pages) {
  const items = (pages || []).reduce((n, p) => n + ((p.items || []).length), 0);
  const words = new Set();
  for (const p of pages || []) for (const i of p.items || []) { const w = String(i.str || "").trim(); if (/^(date|serno\.?|sr\.? ?no\.?|transaction details?|particulars|narration|description|amount.*|debit|credit|balance|reward points?|intl\..*)$/i.test(w) && words.size < 12) words.add(w.slice(0, 30)); }
  return `PDF: ${(pages || []).length} page(s), ${items} text pieces; heading words seen: ${words.size ? [...words].join(" | ") : "none"}`;
}
