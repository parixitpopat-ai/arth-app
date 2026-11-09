// src/domain/imports/statementPdf.js — rebuilds the table of a bank-statement PDF (its TEXT layer, read on the device) into raw rows
// for parseStatementRows. Pure. Scanned/photographed PDFs have no text layer and are refused with a reason (no OCR here).
// Method: find the heading line (a date heading plus debit/credit/amount/balance headings), give every later text item to a column,
// start a new row at each line that has a date, and append date-less lines directly under a row (wrapped narration) to that row's text.
// Numbers are placed by the nearest heading centre (they are right-aligned); words and dates by the heading they start under.

const Y_TOL = 2.5, GAP_MERGE = 3.5, CONT_GAP = 16, DATE_RE = /^\d{1,2}[-/. ]?(?:\d{1,2}|[A-Za-z]{3,9})[-/. ]?\d{2,4}$/;
const NUM_RE = /^[\d,]+(?:\.\d{1,2})?(?:\s*(?:cr|dr))?$/i, MONEY_RE = /^[\d,]*\.\d{1,2}(?:\s*(?:cr|dr))?$/i;
const lc = s => String(s).toLowerCase().replace(/[^a-z]/g, "");
const cx = i => i.x + (i.w || 0) / 2;
// a number sits under its heading either centred or right-aligned with it: take the nearer of the two alignments
const dist = (it, h) => Math.min(Math.abs(cx(it) - cx(h)), Math.abs(it.x + (it.w || 0) - (h.x + (h.w || 0))));

function groupLines(items) {
  const out = [];
  for (const it of items.slice().sort((a, b) => b.y - a.y || a.x - b.x)) {
    const l = out.find(l => Math.abs(l.y - it.y) <= Y_TOL);
    l ? l.cells.push(it) : out.push({ y: it.y, cells: [it] });
  }
  out.forEach(l => l.cells.sort((a, b) => a.x - b.x));
  return out;
}
const PHRASE = /(transaction date|txn date|tran date|value date|posting date|particulars|narration|description|cheque no\.?|chq no\.?|debit|credit|withdrawals?|deposits?|balance)/gi;
/** pdf.js sometimes joins neighbouring headings into one run ("Transaction Date Value Date"); cut such a run at each known heading phrase. */
function splitRun(c) {
  const hits = [...c.str.matchAll(PHRASE)];
  if (hits.length < 2) return [c];
  return hits.map((m, k) => { const end = k + 1 < hits.length ? hits[k + 1].index : c.str.length, s = c.str.slice(m.index, end).trim();
    return { ...c, _split: true, str: s, x: c.x + c.w * m.index / c.str.length, w: c.w * (end - m.index) / c.str.length }; });
}
function mergeHeading(cells) {
  const out = [];
  for (const c of cells.flatMap(splitRun)) {
    const p = out[out.length - 1];
    if (p && !p._split && !c._split && c.x - (p.x + p.w) < GAP_MERGE) { p.str += " " + c.str; p.w = c.x + c.w - p.x; } else out.push({ ...c });
  }
  return out;
}
const isHeading = cells => {
  if (cells.length < 4) return false;
  const k = cells.map(c => lc(c.str)).join("|");
  return /date/.test(k) && /(debit|withdraw|amount)/.test(k) && /(credit|deposit|balance|amount)/.test(k);
};

/** Headings printed over two or three lines ("Transaction" above "Date", "Withdrawal" above "Amount (INR)"): join items that sit above one another. */
function clusterHeading(lineGroup) {
  const items = lineGroup.flatMap(l => l.cells.flatMap(splitRun)).sort((a, b) => b.y - a.y);
  const cl = [];
  for (const it of items) {
    const hit = cl.find(c => !c.members.some(m => Math.abs(m.y - it.y) <= Y_TOL) && Math.abs(cx(it) - c.cx) <= Math.max(it.w || 0, c.w) / 2 + 2);
    if (hit) { hit.members.push(it); hit.str += " " + it.str; const x2 = Math.max(hit.x + hit.w, it.x + (it.w || 0)); hit.x = Math.min(hit.x, it.x); hit.w = x2 - hit.x; hit.cx = hit.x + hit.w / 2; }
    else cl.push({ members: [it], str: it.str, x: it.x, w: it.w || 0, cx: cx(it), _split: Boolean(it._split) });
  }
  return cl.sort((a, b) => a.x - b.x).map(({ str, x, w, _split }) => ({ str, x, w, _split }));
}
const HEADWORD = /date|debit|withdraw|credit|deposit|balance|particulars|narration/i;
/** Does a heading start at lines[i]? Tries it alone, then joined with the next one or two lines (each at most CONT_GAP below the last). */
function headingAt(lines, i) {
  if (!HEADWORD.test(lines[i].cells.map(c => c.str).join(" "))) return null;
  for (let k = 0; k < 3 && i + k < lines.length; k++) {
    if (k > 0 && lines[i + k - 1].y - lines[i + k].y > CONT_GAP) break;
    const cells = k === 0 ? mergeHeading(lines[i].cells) : clusterHeading(lines.slice(i, i + k + 1));
    if (isHeading(cells)) return { cells, span: k + 1 };
  }
  return null;
}

/** @param {Array<{number:number, items:Array<{str,x,y,w}>}>} pages @returns {{ok:boolean, reason?:string, rows:Array<Array<string>>}} */
export function pdfPagesToRows(pages) {
  const no = reason => ({ ok: false, reason, rows: [] });
  const chars = (pages || []).reduce((s, p) => s + (p.textChars || 0), 0);
  if (!chars) return no("This PDF has no text in it (it looks scanned or photographed). Download the statement from your bank's app or net banking as Excel/CSV or the original PDF.");
  let head = null, headTexts = null, numeric = [], rows = null;
  const out = [];
  for (const pg of pages) {
    const lines = groupLines(pg.items || []);
    let prevY = null, prevRow = null, skip = 0;
    for (let li = 0; li < lines.length; li++) {
      const ln = lines[li];
      if (skip > 0) { skip--; continue; }
      const found = headingAt(lines, li);
      if (found) {
        const hc = found.cells; skip = found.span - 1;
        if (!head) { head = hc; headTexts = hc.map(c => c.str); numeric = head.map((c, i) => [i, c]).filter(([, c]) => /(debit|withdraw|credit|deposit|amount|balance)/i.test(c.str)); out.push(headTexts); }
        prevY = null; prevRow = null; continue;
      }
      if (!head) continue;
      const row = head.map(() => "");
      for (const it of ln.cells) {
        let col;
        if (MONEY_RE.test(it.str) && numeric.length) col = numeric.reduce((b, [i, c]) => (dist(it, c) < dist(it, head[b]) ? i : b), numeric[0][0]);
        else { col = 0; head.forEach((c, i) => { if (it.x >= c.x - 4) col = i; }); }
        row[col] = row[col] ? row[col] + " " + it.str : it.str;
      }
      const dateCol = head.findIndex(c => /date/i.test(c.str));
      const dated = DATE_RE.test((row[dateCol] || "").trim());
      if (dated) { out.push(row); prevRow = row; prevY = ln.y; }
      else if (prevRow && prevY !== null && prevY - ln.y <= CONT_GAP && row.every((v, i) => !v || !numeric.some(([j]) => j === i) || !NUM_RE.test(v))) {
        row.forEach((v, i) => { if (v) prevRow[i] = prevRow[i] ? prevRow[i] + " " + v : v; });
        prevY = ln.y;
      }
    }
  }
  if (!head) return no("Could not find the transaction table headings in this PDF (a date column and debit/credit/amount columns).");
  if (out.length < 2) return no("The table headings were found but no transaction rows could be read from this PDF.");
  return { ok: true, rows: out };
}
