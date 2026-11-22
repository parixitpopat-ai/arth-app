// src/native/navClient.js — asks the NAV service (mfapi.in) for a fund's latest NAV or searches funds by name. Reading the answer is
// domain/investments/mfNav.js. In the Android app the request goes through Capacitor's native HTTP (no browser CORS rules); in a browser it is a plain
// fetch, which the service may refuse (reported as "blocked"). Every result says why it failed; nothing is thrown, nothing is invented.
// `window.__ARTH_NAV_TEST__ = { responses:{ [url]: payload | {__status:404} | {__fail:"offline"} }, calls:[] }` is a test hook; absent in real use.
import { Capacitor, CapacitorHttp } from "@capacitor/core";
import { latestUrl, historyUrl, searchUrl, readNav, readSearch } from "../domain/investments/mfNav.js";

const TIMEOUT_MS = 15000;
const fake = () => (typeof window !== "undefined" ? window.__ARTH_NAV_TEST__ : null);

async function getJson(url) {
  const f = fake();
  if (f) {
    f.calls = f.calls || []; f.calls.push(url);
    const r = (f.responses || {})[url];
    if (r === undefined) return { ok: false, reason: "not-found" };
    if (r && r.__fail) return { ok: false, reason: r.__fail };
    if (r && r.__status) return { ok: false, reason: r.__status === 404 ? "not-found" : "bad-shape" };
    return { ok: true, data: r };
  }
  try {
    if (Capacitor.isNativePlatform()) {
      const res = await CapacitorHttp.get({ url, headers: { Accept: "application/json" }, connectTimeout: TIMEOUT_MS, readTimeout: TIMEOUT_MS });
      if (res.status === 404) return { ok: false, reason: "not-found" };
      if (res.status < 200 || res.status >= 300) return { ok: false, reason: "bad-shape" };
      let data = res.data;
      if (typeof data === "string") { try { data = JSON.parse(data); } catch { return { ok: false, reason: "bad-shape" }; } }
      return { ok: true, data };
    }
    const ctl = new AbortController(); const timer = setTimeout(() => ctl.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(url, { headers: { Accept: "application/json" }, signal: ctl.signal });
      if (res.status === 404) return { ok: false, reason: "not-found" };
      if (!res.ok) return { ok: false, reason: "bad-shape" };
      return { ok: true, data: await res.json() };
    } finally { clearTimeout(timer); }
  } catch (e) {
    if (e && e.name === "AbortError") return { ok: false, reason: "timeout" };
    if (typeof navigator !== "undefined" && navigator.onLine === false) return { ok: false, reason: "offline" };
    if (e instanceof SyntaxError) return { ok: false, reason: "bad-shape" };
    return { ok: false, reason: Capacitor.isNativePlatform() ? "offline" : "blocked" };
  }
}

/** @returns {Promise<{ok:true,nav:number,date:string,name:string}|{ok:false,reason:string}>} */
export async function fetchLatestNav(code) {
  const a = await getJson(latestUrl(code));
  if (a.ok) { const r = readNav(a.data); if (r.ok) return r; }
  else if (a.reason !== "not-found") return a;
  const b = await getJson(historyUrl(code));   // the full history, newest taken from it, if the short answer was not usable
  if (!b.ok) return b.reason === "not-found" || (a.ok === false && a.reason === "not-found") ? { ok: false, reason: "not-found" } : b;
  return readNav(b.data);
}

/** @returns {Promise<{ok:true,funds:Array<{code:string,name:string}>}|{ok:false,reason:string}>} */
export async function searchFunds(q) {
  if (String(q || "").trim().length < 3) return { ok: true, funds: [] };
  const r = await getJson(searchUrl(q));
  return r.ok ? readSearch(r.data) : r;
}
