// src/domain/imports/xlsx.js — dependency-free reader for the FIRST worksheet of a .xlsx file (a zip of XML parts).
// Supports stored and deflate entries (browser/Node DecompressionStream), shared strings, inline strings and numbers. Not supported (reported, never
// guessed): the old binary .xls format, encrypted files, zip64. Numeric cells are returned as numbers; the statement parser decides whether a
// number is an Excel date serial (it knows which column is the date).

const u16 = (dv, o) => dv.getUint16(o, true), u32 = (dv, o) => dv.getUint32(o, true);
const MAX_BYTES = 12 * 1024 * 1024;

async function inflateRaw(bytes) {
  if (typeof DecompressionStream === "undefined") throw new Error("This browser cannot open compressed Excel files. Export the statement as CSV instead.");
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/** Map of entry name -> async () => Uint8Array */
function readZipDirectory(u8) {
  const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
  let eocd = -1;
  for (let i = u8.length - 22; i >= Math.max(0, u8.length - 65557); i--) { if (u32(dv, i) === 0x06054b50) { eocd = i; break; } }
  if (eocd < 0) throw new Error("This file is not a valid .xlsx workbook.");
  const count = u16(dv, eocd + 10), cdOffset = u32(dv, eocd + 16);
  if (cdOffset === 0xffffffff || count === 0xffff) throw new Error("This workbook uses a zip format Arth cannot read. Export the statement as CSV instead.");
  const entries = new Map(); let p = cdOffset;
  for (let n = 0; n < count; n++) {
    if (u32(dv, p) !== 0x02014b50) throw new Error("This file is not a valid .xlsx workbook.");
    const flags = u16(dv, p + 8), method = u16(dv, p + 10), compSize = u32(dv, p + 20), nameLen = u16(dv, p + 28), extraLen = u16(dv, p + 30), commentLen = u16(dv, p + 32), local = u32(dv, p + 42);
    const name = new TextDecoder().decode(u8.subarray(p + 46, p + 46 + nameLen));
    if (flags & 1) throw new Error("This workbook is password-protected. Remove the password or export the statement as CSV.");
    entries.set(name, async () => {
      if (u32(dv, local) !== 0x04034b50) throw new Error("This file is not a valid .xlsx workbook.");
      const start = local + 30 + u16(dv, local + 26) + u16(dv, local + 28), data = u8.subarray(start, start + compSize);
      if (method === 0) return data.slice();
      if (method === 8) return inflateRaw(data);
      throw new Error("This workbook uses an unsupported compression method. Export the statement as CSV instead.");
    });
    p += 46 + nameLen + extraLen + commentLen;
  }
  return entries;
}

const unescapeXml = s => s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d))).replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16))).replace(/&amp;/g, "&");
const colIndex = ref => { let n = 0; for (const ch of ref.replace(/[^A-Z]/gi, "").toUpperCase()) n = n * 26 + (ch.charCodeAt(0) - 64); return n - 1; };
const textOf = xml => { let out = ""; for (const m of xml.matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)) out += unescapeXml(m[1]); return out; };

/** @param {ArrayBuffer|Uint8Array} buffer @returns {Promise<Array<Array<string|number>>>} rows of the first worksheet */
export async function readXlsx(buffer) {
  const u8 = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  if (u8.length > MAX_BYTES) throw new Error("This workbook is too large to import here (over 12 MB). Export a shorter date range.");
  if (u8.length >= 8 && u8[0] === 0xd0 && u8[1] === 0xcf && u8[2] === 0x11 && u8[3] === 0xe0) throw new Error("This is an old-format .xls file. Save it as .xlsx or CSV and try again.");
  const files = readZipDirectory(u8), text = async n => (files.has(n) ? new TextDecoder().decode(await files.get(n)()) : null);
  // which worksheet is first: workbook.xml order -> relationship target; fall back to sheet1.xml
  let sheetPath = "xl/worksheets/sheet1.xml";
  const wb = await text("xl/workbook.xml"), rels = await text("xl/_rels/workbook.xml.rels");
  if (wb && rels) {
    const first = /<sheet\b[^>]*?r:id="([^"]+)"/.exec(wb);
    if (first) { const rel = new RegExp(`<Relationship\\b[^>]*?Id="${first[1]}"[^>]*?>`).exec(rels), t = rel && /Target="([^"]+)"/.exec(rel[0]); if (t) sheetPath = t[1].startsWith("/") ? t[1].slice(1) : `xl/${t[1]}`; }
  }
  const sheetXml = await text(sheetPath);
  if (sheetXml == null) throw new Error("No worksheet was found in this workbook.");
  const sst = await text("xl/sharedStrings.xml"), shared = sst ? [...sst.matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>/g)].map(m => textOf(m[1])) : [];
  const rows = [];
  for (const rm of sheetXml.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g)) {
    const row = [];
    for (const cm of rm[1].matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const attrs = cm[1], body = cm[2] || "", r = /\br="([A-Z]+\d+)"/.exec(attrs), t = /\bt="(\w+)"/.exec(attrs), v = /<v>([\s\S]*?)<\/v>/.exec(body);
      let value = "";
      if (t && t[1] === "s" && v) value = shared[Number(v[1])] ?? "";
      else if (t && t[1] === "inlineStr") value = textOf(body);
      else if (t && (t[1] === "str" || t[1] === "e") && v) value = unescapeXml(v[1]);
      else if (t && t[1] === "b" && v) value = v[1] === "1" ? "TRUE" : "FALSE";
      else if (v) { const n = Number(v[1]); value = Number.isFinite(n) ? n : unescapeXml(v[1]); }
      const idx = r ? colIndex(r[1]) : row.length;
      while (row.length < idx) row.push("");
      row[idx] = typeof value === "string" ? value.trim() : value;
    }
    if (row.some(c => c !== "")) rows.push(row);
  }
  return rows;
}
