// src/sync/packedList.js
//
// Backup lists (full copies of the data) are stored compressed so they take a fraction of the browser's small storage.
// Format: "z1:" + base64(zlib(JSON)). Anything else is read as plain JSON, so lists written by earlier versions still load,
// and the next write converts them. Unreadable input reads as an empty list (never throws), as before.
import { zlibSync, unzlibSync, strToU8, strFromU8 } from "fflate";

const PREFIX = "z1:";

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

export function packList(list) {
  return PREFIX + toB64(zlibSync(strToU8(JSON.stringify(list)), { level: 6 }));
}

let lastRaw = null, lastList = null;   // the same stored text is read several times per sync cycle: inflate it once

/** @returns {any[]} the list, or [] when the text is missing, damaged or not a list */
export function unpackList(raw) {
  if (raw == null || raw === "") return [];
  if (raw === lastRaw) return lastList;
  try {
    const text = raw.startsWith(PREFIX) ? strFromU8(unzlibSync(fromB64(raw.slice(PREFIX.length)))) : raw;
    const v = JSON.parse(text);
    const list = Array.isArray(v) ? v : [];
    lastRaw = raw; lastList = list;
    return list;
  } catch { return []; }
}
