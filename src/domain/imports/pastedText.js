// src/domain/imports/pastedText.js — reads a card app's "Here are your transactions" text (pasted by the user) into the same table shape a
// statement file gives, so it goes through the normal matching. Format seen: "1. Amount: -₹222.14 / Date: 10 November 2026 / Description: UPI-…".
// In that text a NEGATIVE amount is money spent (it lowers the available limit); a positive amount is money back (refund / payment).
// Nothing is guessed: a block missing its amount or date is returned as unreadable instead of being dropped.
const FIELD = /^\s*(?:\d{1,4}[.)]\s*)?(amount|date|description|narration|details?|merchant|particulars)\s*[:\-–]\s*(.*)$/i;
const START = /^\s*\d{1,4}[.)]\s*(?:amount\s*[:\-–]|$)/i;

/** @param {string} text @returns {{ok:boolean, reason?:string, rows:string[][], unreadable:{n:number, text:string}[]}} rows[0] is the heading row. */
export function pastedTextToRows(text) {
  const lines = String(text == null ? "" : text).replace(/\r/g, "").split("\n");
  const blocks = []; let cur = null, last = null;
  for (const line of lines) {
    const f = FIELD.exec(line);
    if (f) {
      const key = /^(description|narration|details?|merchant|particulars)$/i.test(f[1]) ? "desc" : f[1].toLowerCase();
      // a second "Amount:" (or a numbered line) means the next item started
      if (!cur || (key === "amount" && cur.amount !== undefined) || (START.test(line) && cur.amount !== undefined)) { cur = {}; blocks.push(cur); }
      cur[key] = f[2].trim(); last = key; continue;
    }
    if (START.test(line)) { cur = {}; blocks.push(cur); last = null; continue; }
    if (cur && last === "desc" && line.trim() && !/^here are/i.test(line.trim())) cur.desc += " " + line.trim();   // a wrapped description
  }
  const rows = [["Date", "Description", "Amount"]], unreadable = [];
  blocks.forEach((b, i) => {
    const amt = String(b.amount == null ? "" : b.amount).trim();
    const m = /^([+\-–−]?)\s*(?:₹|rs\.?|inr)?\s*([\d,]+(?:\.\d{1,2})?)\s*(cr|dr)?$/i.exec(amt.replace(/\s+/g, " "));
    if (!m || b.date === undefined || b.date === "") { unreadable.push({ n: i + 1, text: `item ${i + 1}: ${!m ? "amount not readable" : "no date"}` }); return; }
    const neg = m[1] === "-" || m[1] === "–" || m[1] === "−" || /^dr$/i.test(m[3] || "");
    // table form the card reader already understands: plain amount = a charge, "CR" = money back
    rows.push([b.date, b.desc || "", neg ? m[2] : `${m[2]} CR`]);
  });
  if (rows.length === 1) return { ok: false, reason: unreadable.length ? "Found items, but none had a readable amount and date." : "No transactions found in the text. Paste the whole message, starting from “Here are your transactions”.", rows, unreadable };
  return { ok: true, rows, unreadable };
}
