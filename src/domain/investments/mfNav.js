// domain/investments/mfNav.js
//
// Reading a mutual fund's latest NAV from mfapi.in (a free public NAV service built on AMFI's data). Pure: URLs and the reader only; the request is in
// src/native/navClient.js.
//
// !! THE RESPONSE SHAPES BELOW ARE FROM MEMORY OF mfapi.in's PUBLIC DOCS, NOT CHECKED AGAINST THE LIVE SERVICE (the machine this was written on cannot reach
// !! it). The reader is strict on purpose: anything that does not look right is refused ("could not read"), never turned into a number. Check the real
// !! responses (the Invest screen shows the reason when a lookup fails) and correct SAMPLE_* and the readers if they differ.
//   latest/history : { meta:{ scheme_code, scheme_name, ... }, data:[ { date:"dd-mm-yyyy", nav:"123.4567" }, ... ], status:"SUCCESS" }
//   search         : [ { schemeCode: 119551, schemeName: "..." }, ... ]

export const MFAPI = "https://api.mfapi.in";
export const latestUrl = code => `${MFAPI}/mf/${encodeURIComponent(String(code).trim())}/latest`;
export const historyUrl = code => `${MFAPI}/mf/${encodeURIComponent(String(code).trim())}`;
export const searchUrl = q => `${MFAPI}/mf/search?q=${encodeURIComponent(String(q).trim())}`;

/** "dd-mm-yyyy" or "yyyy-mm-dd" -> "yyyy-mm-dd", or "" when it is not a real date. */
export function toIsoDate(s) {
  const t = String(s || "").trim();
  let y, m, d;
  let mm = /^(\d{1,2})-(\d{1,2})-(\d{4})$/.exec(t);
  if (mm) { d = +mm[1]; m = +mm[2]; y = +mm[3]; }
  else if ((mm = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(t))) { y = +mm[1]; m = +mm[2]; d = +mm[3]; }
  else return "";
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return "";
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/** @returns {{ok:true, nav:number, date:string, name:string}|{ok:false, reason:"bad-shape"|"no-nav"|"bad-nav"|"bad-date"}} the newest NAV in the payload */
export function readNav(payload) {
  const rows = payload && Array.isArray(payload.data) ? payload.data : null;
  if (!rows) return { ok: false, reason: "bad-shape" };
  if (!rows.length) return { ok: false, reason: "no-nav" };
  let best = null;
  for (const r of rows) {
    if (!r || typeof r !== "object") continue;
    const date = toIsoDate(r.date);
    const nav = typeof r.nav === "number" ? r.nav : Number(String(r.nav ?? "").replace(/,/g, ""));
    if (!date || !Number.isFinite(nav) || nav <= 0) continue;
    if (!best || date > best.date) best = { date, nav };
  }
  if (!best) { const first = rows[0] || {}; return { ok: false, reason: toIsoDate(first.date) ? "bad-nav" : "bad-date" }; }
  const name = payload.meta && typeof payload.meta.scheme_name === "string" ? payload.meta.scheme_name : "";
  return { ok: true, nav: best.nav, date: best.date, name };
}

/** @returns {{ok:true, funds:Array<{code:string,name:string}>}|{ok:false, reason:"bad-shape"}} */
export function readSearch(payload) {
  if (!Array.isArray(payload)) return { ok: false, reason: "bad-shape" };
  const funds = [];
  for (const r of payload) {
    if (!r || typeof r !== "object") continue;
    const code = r.schemeCode ?? r.scheme_code; const name = r.schemeName ?? r.scheme_name;
    if ((typeof code === "number" || typeof code === "string") && String(code).trim() && typeof name === "string" && name.trim()) funds.push({ code: String(code).trim(), name: name.trim() });
  }
  return { ok: true, funds };
}

/** Plain words for a failed lookup. */
export function navFailureMessage(reason) {
  switch (reason) {
    case "offline": return "No internet connection. The old value is kept.";
    case "timeout": return "The NAV service did not answer in time. The old value is kept.";
    case "blocked": return "The browser blocked the request to the NAV service. The Android app can get it; or type the NAV yourself.";
    case "not-found": return "That scheme code was not found. Check the code, or search by the fund's name.";
    case "no-nav": return "The service has no NAV for this scheme.";
    default: return "Arth could not read the NAV service's answer, so the old value is kept. You can type the NAV yourself.";
  }
}
