// src/domain/invoices/blinkitLayout.js — rebuilds the table cells and text blocks of ONE Blinkit GST invoice layout from positioned PDF text items.
// Pure. Layout knowledge comes from a single real invoice (one format); anything that does not fit is reported, not guessed.
// The "Invoice To" (customer) block is recognised only to be SKIPPED: its text never leaves this function.

const Y_TOL = 2.5, LEFT_MAX = 390, RIGHT_MIN = 400, CONT_GAP = 12;
const HEAD_KEYS = ["sr", "upc", "itemdescription", "mrp", "discou", "qty", "taxable", "cgst", "cgst", "sgst", "sgst", "cess", "addition", "total"];
const letters = s => String(s).toLowerCase().replace(/[^a-z]/g, "");
const ctr = i => i.x + (i.w || 0) / 2;

function lines(items) {
  const out = [];
  for (const it of items.slice().sort((a, b) => b.y - a.y || a.x - b.x)) {
    const l = out.find(l => Math.abs(l.y - it.y) <= Y_TOL);
    l ? l.cells.push(it) : out.push({ y: it.y, cells: [it] });
  }
  out.forEach(l => l.cells.sort((a, b) => a.x - b.x));
  return out;
}
const text = l => l.cells.map(c => c.str).join(" ").replace(/\s+/g, " ").trim();
const isRecordStart = l => l.cells.some(c => c.x < 50 && /^(\d+|-)$/.test(c.str));

/** @param {Array<{str:string,x:number,y:number,w:number}>} items @returns {{ok:boolean, reason?:string, ...}} */
export function layoutToBlinkitInput(items) {
  const all = lines(items), no = reason => ({ ok: false, reason });
  const hi = all.findIndex(l => ["sr", "upc", "itemdescription", "mrp"].every((k, i) => letters(l.cells[i] ? l.cells[i].str : "").startsWith(k)));
  if (hi < 0) return no("The item table heading was not found.");
  const head = all[hi], hk = head.cells.map(c => letters(c.str));
  if (hk.length !== HEAD_KEYS.length || !HEAD_KEYS.every((k, i) => hk[i].startsWith(k))) return no("The item table headings are not the 14 expected columns.");
  const b = head.cells.map(c => c.x);
  const colOf = it => { if (it.x < b[3]) { let i = 0; while (i < 2 && b[i + 1] <= it.x) i++; return i; } let i = 3; while (i < 13 && b[i + 1] <= ctr(it)) i++; return i; };

  // ---- text above the table: title, seller (left), invoice numbers (right). Customer block (from "Invoice To" down) is dropped. ----
  const top = items.filter(i => i.y > head.y + Y_TOL), titleY = Math.max(...top.map(i => i.y)), titleLine = lines(top.filter(i => Math.abs(i.y - titleY) <= Y_TOL))[0];
  // The title is the topmost line only when it is not the start of the seller block (so a missing title is "no title", not a wrong one).
  const titleRaw = titleLine ? text(titleLine) : null, titleText = titleRaw && !/^sold by\b/i.test(titleRaw) ? titleRaw : null;
  const leftLines = lines(top.filter(i => i.x < LEFT_MAX && (titleText ? i.y < titleY - Y_TOL : true))), cut = leftLines.findIndex(l => /^invoice to\b/i.test(text(l)));
  const sellerLines = (cut < 0 ? leftLines : leftLines.slice(0, cut)).map(text);
  const metaLines = lines(top.filter(i => i.x >= RIGHT_MIN && (titleText ? i.y < titleY - Y_TOL : true))).map(text);

  // ---- item rows: a record starts at a line whose first column is a number or "-"; lines below it with no such start are wrapped cells ----
  const rest = all.slice(hi + 1), firstRec = rest.findIndex(isRecordStart);
  if (firstRec < 0) return no("No item rows were found under the heading.");
  const headCells = Array(14).fill("");
  for (const l of [head, ...rest.slice(0, firstRec)]) for (const c of l.cells) { let i = 0; while (i < 13 && b[i + 1] <= c.x) i++; headCells[i] = headCells[i] ? `${headCells[i]}\n${c.str}` : c.str; }
  const itemRows = [headCells], put = (row, i, s) => { row[i] = row[i] ? `${row[i]}\n${s}` : s; };
  let cur = null, prevY = null, k = firstRec, endY = null;
  for (; k < rest.length; k++) {
    const l = rest[k], isTotal = l.cells.some(c => c.str === "Total");
    if (isRecordStart(l) || isTotal) {
      cur = Array(14).fill(""); itemRows.push(cur); prevY = l.y;
      if (isTotal) cur[0] = "Total";
      for (const c of l.cells) { if (isTotal && c.str === "Total") continue; put(cur, colOf(c), c.str); }
      if (isTotal) { endY = l.y; k++; break; }
    } else if (cur && prevY - l.y <= CONT_GAP) { for (const c of l.cells) put(cur, colOf(c), c.str); prevY = l.y; }
    else if (/^amount in words/i.test(text(l))) return no("The Total row was not found.");
    else return no(`A line under the item table was not recognised (${JSON.stringify(text(l).slice(0, 40))}).`);
  }
  if (endY === null) return no("The Total row was not found.");
  // wrapped cells of the Total row itself (the printed "1125.0" / "0")
  for (; k < rest.length; k++) { const l = rest[k]; if (prevY - l.y <= CONT_GAP && l.cells.every(c => /^[\d.]+$/.test(c.str))) { for (const c of l.cells) put(cur, colOf(c), c.str); prevY = l.y; } else break; }

  // ---- footer (left column, between the table and the "Annexure" heading) and the annexure table ----
  const annIdx = rest.findIndex((l, i) => i >= k && l.cells.length === 1 && /^annexure$/i.test(l.cells[0].str));
  const footLines = rest.slice(k, annIdx < 0 ? undefined : annIdx).map(l => ({ y: l.y, cells: l.cells.filter(c => c.x < LEFT_MAX) })).filter(l => l.cells.length).map(text);
  const annexureRows = [];
  if (annIdx >= 0) for (const l of rest.slice(annIdx + 1)) {
    if (/^terms\b/i.test(text(l))) break;
    const cells = l.cells.map(c => c.str);
    if (cells[0] === "Total" && cells.length === 5) annexureRows.push(["Total", "", "", "", ...cells.slice(1)]);
    else annexureRows.push(cells);                                          // positional: every annexure value row prints all 8 cells
  }
  return { ok: true, titleText, sellerText: sellerLines.join("\n"), metaText: metaLines.join("\n"), footerText: footLines.join("\n"), textLines: [], itemRows, annexureRows };
}
