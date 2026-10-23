// src/domain/imports/csv.js — a small, strict-enough CSV reader for bank exports (RFC 4180 quoting, BOM, CRLF, ; , tab | delimiters).
// Returns an array of rows; each row is an array of trimmed strings. Never throws on odd input: unbalanced quotes simply end the field at end of text.

export function detectDelimiter(text) {
  const lines = String(text).split(/\r?\n/).filter(l => l.trim()).slice(0, 12);
  let best = ",", bestScore = -1;
  for (const d of [",", ";", "\t", "|"]) {
    const counts = lines.map(l => { let n = 0, q = false; for (const ch of l) { if (ch === '"') q = !q; else if (!q && ch === d) n++; } return n; });
    const nonzero = counts.filter(n => n > 0);
    if (!nonzero.length) continue;
    const mode = nonzero.sort((a, b) => a - b)[Math.floor(nonzero.length / 2)];
    const score = mode * 10 + nonzero.length;               // many columns, consistently present
    if (score > bestScore) { bestScore = score; best = d; }
  }
  return best;
}

export function parseCsv(input) {
  const text = String(input == null ? "" : input).replace(/^\uFEFF/, "");
  const delim = detectDelimiter(text);
  const rows = []; let row = [], field = "", inQ = false;
  const endField = () => { row.push(field.trim()); field = ""; };
  const endRow = () => { endField(); if (row.some(c => c !== "")) rows.push(row); row = []; };
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQ) {
      if (ch === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else inQ = false; }
      else field += ch;
    } else if (ch === '"' && field === "") inQ = true;
    else if (ch === delim) endField();
    else if (ch === "\r") { if (text[i + 1] === "\n") i++; endRow(); }
    else if (ch === "\n") endRow();
    else field += ch;
  }
  if (field !== "" || row.length) endRow();
  return rows;
}
