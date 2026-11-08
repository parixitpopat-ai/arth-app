// src/sync/packedList.js
//
// Backup lists (full copies of the data) are stored compressed so they take a fraction of the browser's small storage.
// Format: "z1:" + base64(zlib(JSON)). Anything else is read as plain JSON, so lists written by earlier versions still load,
// and the next write converts them. Unreadable input reads as an empty list (never throws), as before.
import { zlibSync, unzlibSync, strToU8, strFromU8 } from "fflate";

const PREFIX = "z1:";      // zlib(JSON)
const PREFIX2 = "z2:";     // zlib(JSON) with large identical strings (photos) stored once

function toB64(bytes) {
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(s);
}
function fromB64(b64) {
  const s = atob(b64), out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

const BIG = 2000, MARK = "\u0001";

/** Large strings that occur more than once (the same photo on a bill and on its payment) are moved to a table and referenced. */
function dedupe(value) {
  const seen = new Map();
  (function count(v) {
    if (typeof v === "string") { if (v.length >= BIG) seen.set(v, (seen.get(v) || 0) + 1); }
    else if (Array.isArray(v)) v.forEach(count);
    else if (v && typeof v === "object") Object.values(v).forEach(count);
  })(value);
  const table = [], index = new Map();
  for (const [s, n] of seen) if (n > 1) { index.set(s, table.length); table.push(s); }
  if (!table.length) return null;
  const swap = v => {
    if (typeof v === "string") {
      if (index.has(v)) return MARK + index.get(v);
      return v.startsWith(MARK) ? MARK + v : v;          // a real string that starts with the marker is escaped
    }
    if (Array.isArray(v)) return v.map(swap);
    if (v && typeof v === "object") { const o = {}; for (const k of Object.keys(v)) o[k] = swap(v[k]); return o; }
    return v;
  };
  return { t: table, d: swap(value) };
}
function restore(wrapped) {
  const { t, d } = wrapped;
  const back = v => {
    if (typeof v === "string") {
      if (v.startsWith(MARK + MARK)) return v.slice(1);
      if (v.startsWith(MARK)) return t[Number(v.slice(1))];
      return v;
    }
    if (Array.isArray(v)) return v.map(back);
    if (v && typeof v === "object") { const o = {}; for (const k of Object.keys(v)) o[k] = back(v[k]); return o; }
    return v;
  };
  return back(d);
}

export function packList(list) {
  const dd = dedupe(list);
  return dd ? PREFIX2 + toB64(zlibSync(strToU8(JSON.stringify(dd)), { level: 6 }))
    : PREFIX + toB64(zlibSync(strToU8(JSON.stringify(list)), { level: 6 }));
}

let lastRaw = null, lastList = null;   // the same stored text is read several times per sync cycle: inflate it once

/** @returns {any[]} the list, or [] when the text is missing, damaged or not a list */
export function unpackList(raw) {
  if (raw == null || raw === "") return [];
  if (raw === lastRaw) return lastList;
  try {
    let v;
    if (raw.startsWith(PREFIX2)) v = restore(JSON.parse(strFromU8(unzlibSync(fromB64(raw.slice(PREFIX2.length))))));
    else if (raw.startsWith(PREFIX)) v = JSON.parse(strFromU8(unzlibSync(fromB64(raw.slice(PREFIX.length)))));
    else v = JSON.parse(raw);
    const list = Array.isArray(v) ? v : [];
    lastRaw = raw; lastList = list;
    return list;
  } catch { return []; }
}
