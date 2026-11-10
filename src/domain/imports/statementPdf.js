// src/domain/imports/statementPdf.js — rebuilds the table of a bank-statement PDF (its TEXT layer, read on the device) into raw rows
// for parseStatementRows. Pure. Scanned/photographed PDFs have no text layer and are refused with a reason (no OCR here).
// Method: find the heading line (a date heading plus debit/credit/amount/balance headings), give every later text item to a column,
// start a new row at each line that has a date, and append date-less lines directly under a row (wrapped narration) to that row's text.
// Numbers are placed by the nearest heading centre (they are right-aligned); words and dates by the heading they start under.

const Y_TOL = 3.5, GAP_MERGE = 3.5, CONT_GAP = 16, DATE_RE = /^\d{1,2}[-/. ]?(?:\d{1,2}|[A-Za-z]{3,9})[-/. ]?\d{2,4}$/;
const NUM_RE = /^(?:₹|Rs\.?|INR)?\s*[\d,]+(?:\.\d{1,2})?(?:\s*(?:cr|dr))?$/i, MONEY_RE = /^(?:₹|Rs\.?|INR)?\s*[\d,]*\.\d{1,2}(?:\s*(?:cr|dr))?$/i;
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

/** Column geometry for one heading: which headings are money, which are text, the table's horizontal extent, and how its cells map onto the FIRST heading's columns. */
function geometryOf(cells, base) {
  const numeric = cells.map((c, i) => [i, c]).filter(([, c]) => /(debit|withdraw|credit|deposit|amount|balance)/i.test(c.str));
  const textCols = cells.map((_, i) => i).filter(i => !numeric.some(([j]) => j === i));
  // A later page may repeat the heading at other positions (no side panel, wider table) and with or without extra cells: map each cell to the
  // first heading's column of the same text so every page fills the same row layout. A cell with no counterpart is dropped.
  let map;
  if (cells === base) map = cells.map((_, i) => i);
  else { const used = new Set(); map = cells.map(c => { const j = base.findIndex((b, k) => !used.has(k) && lc(b.str) === lc(c.str)); if (j >= 0) used.add(j); return j; }); }
  return { cells, numeric, textCols, map, left: cells[0].x - 6, right: cells[cells.length - 1].x + cells[cells.length - 1].w + 12, colLeft: new Map() };
}

/** @param {Array<{number:number, items:Array<{str,x,y,w}>}>} pages @returns {{ok:boolean, reason?:string, rows:Array<Array<string>>, rowsPerPage?:number[]}} */
export function pdfPagesToRows(pages) {
  const no = reason => ({ ok: false, reason, rows: [] });
  const chars = (pages || []).reduce((s, p) => s + (p.textChars || 0), 0);
  if (!chars) return no("This PDF has no text in it (it looks scanned or photographed). Download the statement from your bank's app or net banking as Excel/CSV or the original PDF.");
  let base = null, cur = null;
  const out = [], rowsPerPage = [];
  for (const pg of pages) {
    let lines = groupLines(pg.items || []);
    let pageRows = 0;
    // A continuation page with no heading of its own: the table may sit at other positions. Shift the page so its first date lines up with the Date heading.
    if (cur && !lines.some((_, i) => headingAt(lines, i))) {
      const di = cur.cells.findIndex(c => /date/i.test(c.str)), first = lines.flatMap(l => l.cells).filter(c => DATE_RE.test(c.str.trim())).sort((x, y) => x.x - y.x)[0];
      if (di >= 0 && first && Math.abs(first.x - cur.cells[di].x) > 6) { const dx = first.x - cur.cells[di].x; lines = lines.map(l => ({ ...l, cells: l.cells.map(c => ({ ...c, x: c.x - dx })) })); }
    }
    let prevY = null, prevRow = null, skip = 0;
    for (let li = 0; li < lines.length; li++) {
      const ln = lines[li];
      if (skip > 0) { skip--; continue; }
      const found = headingAt(lines, li);
      if (found) {
        const hc = found.cells; skip = found.span - 1;
        if (!base) { base = hc; out.push(hc.map(c => c.str)); cur = geometryOf(hc, hc); } else cur = geometryOf(hc, base);
        prevY = null; prevRow = null; continue;
      }
      if (!cur) continue;
      const { cells: head, numeric, textCols, map, left, right, colLeft } = cur;
      const row = base.map(() => "");
      const add = (c, str) => { const k = map[c]; if (k >= 0) row[k] = row[k] ? row[k] + " " + str : str; };
      // only what sits inside the table: a page with a side panel (offers, spend charts) must not leak into the rows
      for (const it of ln.cells) {
        if (it.x < left || it.x > right) continue;
        // Amounts (and a "CR"/"DR" beside one) are right-aligned under a money heading: nearest heading wins.
        if ((MONEY_RE.test(it.str) || /^(?:cr|dr)\.?$/i.test(it.str)) && numeric.length) {
          add(numeric.reduce((b, [i, c]) => (dist(it, c) < dist(it, head[b]) ? i : b), numeric[0][0]), it.str);
          continue;
        }
        // Text. A run goes under the one text heading it overlaps (data is often wider than its heading and centred under it, so it can start well left of
        // the heading). A run that overlaps nothing — a short wrapped line at the left edge of a wide column — goes where earlier runs starting at that
        // same x went, else to the nearest heading. pdf.js sometimes joins neighbouring cells of one line into one run ("14308206086 ZOMATO CYBS DELHI");
        // a run overlapping two or more text headings is split into words, each placed on its own estimated span. Money headings are excluded.
        const spanOf = (a2, b2) => textCols.map(i => { const h = head[i]; return { i, ov: Math.max(0, Math.min(b2, h.x + h.w) - Math.max(a2, h.x)), gap: Math.max(0, h.x - b2, a2 - (h.x + h.w)) }; });
        const nearest = list => list.reduce((best, c) => (c.ov > best.ov || (c.ov === best.ov && c.ov === 0 && c.gap < best.gap) ? c : best), list[0]);
        const runSpans = spanOf(it.x, it.x + (it.w || 0)), overlapping = runSpans.filter(c => c.ov > 0);
        if (overlapping.length <= 1) {
          let c2;
          if (overlapping.length === 1) { c2 = overlapping[0].i; (colLeft.get(c2) || colLeft.set(c2, []).get(c2)).push(it.x); }
          else { const learned = textCols.find(i => (colLeft.get(i) || []).some(x0 => Math.abs(x0 - it.x) <= 4)); c2 = learned !== undefined ? learned : nearest(runSpans).i; }
          add(c2, it.str);
          continue;
        }
        for (const tok of it.str.matchAll(/\S+/g)) {
          const L = Math.max(1, it.str.length), w = it.w || 0;
          add(nearest(spanOf(it.x + w * tok.index / L, it.x + w * (tok.index + tok[0].length) / L)).i, tok[0]);
        }
      }
      const dateCol = base.findIndex(c => /date/i.test(c.str));
      const dated = DATE_RE.test((row[dateCol] || "").trim());
      if (dated) { out.push(row); pageRows++; prevRow = row; prevY = ln.y; }
      else if (prevRow && prevY !== null && prevY - ln.y <= CONT_GAP) {
        const isNumBase = k => numeric.some(([j]) => map[j] === k);
        // An amount that sits a few points off its row's baseline arrives as its own line: it fills the row's EMPTY amount cell. Any other
        // line under a row (wrapped narration) is appended to the text cells; a stray number under a filled amount cell is not added to anything.
        let used = false;
        row.forEach((v, k) => {
          if (!v) return;
          if (isNumBase(k)) { if (!prevRow[k] && NUM_RE.test(v)) { prevRow[k] = v; used = true; } }
          else { prevRow[k] = prevRow[k] ? prevRow[k] + " " + v : v; used = true; }
        });
        if (used) prevY = ln.y;
      }
    }
    rowsPerPage.push(pageRows);
  }
  if (!base) return no("Could not find the transaction table headings in this PDF (a date column and debit/credit/amount columns).");
  if (out.length < 2) return { ...no("The table headings were found but no transaction rows could be read from this PDF."), info: shapeInfo(pages, base), rowsPerPage };
  return { ok: true, rows: out, rowsPerPage };
}

/** Geometry for diagnosing a layout, with every letter and digit masked (a -> letters, 9 -> digits): column headings with x/width, and up to three lines that contain a date. */
export function shapeInfo(pages, head) {
  const mask = str => String(str).replace(/[A-Za-z]/g, "a").replace(/\d/g, "9").slice(0, 28);
  const heads = (head || []).map(c => `${String(c.str).slice(0, 22)}@${Math.round(c.x)}+${Math.round(c.w)}`).join(" | ");
  const lines = [];
  for (const pg of pages || []) for (const ln of groupLines(pg.items || [])) {
    if (lines.length >= 3) break;
    if (ln.cells.some(c => /\b\d{1,2}[-/. ]\d{1,2}[-/. ]\d{2,4}\b/.test(c.str))) lines.push(ln.cells.slice(0, 10).map(c => `${mask(c.str)}@${Math.round(c.x)}+${Math.round(c.w)}`).join(" "));
  }
  return `headings: ${heads}; sample dated lines (masked): ${lines.length ? lines.join(" // ") : "none"}`;
}
