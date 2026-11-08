// src/domain/images/shrinkImage.js
//
// Photos are kept inside Arth's data (and uploaded with every sync) as data URLs. Phone and gallery photos are far larger than a receipt
// needs, and they were stored exactly as picked. This scales a photo down (longest side MAX_SIDE) and re-encodes it as JPEG, and keeps the
// ORIGINAL whenever the result would not be clearly smaller, the file is not a photo type it can decode, or anything goes wrong.

export const MAX_SIDE = 1600;
export const QUALITY = 0.75;
export const SMALL_ENOUGH_CHARS = 60000;       // a data URL shorter than this is left alone
export const MIN_SAVING = 0.9;                 // the new one must be under 90% of the old one, or the old one is kept

const SHRINKABLE = /^data:image\/(jpeg|jpg|png|webp);base64,/i;
export const isShrinkable = dataUrl => typeof dataUrl === "string" && SHRINKABLE.test(dataUrl);

/** Target size keeping the aspect ratio; never enlarges. */
export function targetSize(width, height, maxSide = MAX_SIDE) {
  const w = Math.max(1, Math.round(width)), h = Math.max(1, Math.round(height));
  const longest = Math.max(w, h);
  if (longest <= maxSide) return { width: w, height: h, scaled: false };
  const k = maxSide / longest;
  return { width: Math.max(1, Math.round(w * k)), height: Math.max(1, Math.round(h * k)), scaled: true };
}

function loadImage(dataUrl) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("the photo could not be decoded"));
    img.src = dataUrl;
  });
}

/** Browser re-encode. Replaced in tests through `encode`. */
async function browserEncode(dataUrl, { maxSide, quality }) {
  const img = await loadImage(dataUrl);
  const { width, height } = targetSize(img.naturalWidth || img.width, img.naturalHeight || img.height, maxSide);
  const canvas = document.createElement("canvas");
  canvas.width = width; canvas.height = height;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, width, height);   // PNGs with transparency: no black background after JPEG
  ctx.drawImage(img, 0, 0, width, height);
  return canvas.toDataURL("image/jpeg", quality);
}

/**
 * @returns {Promise<{dataUrl:string, changed:boolean, before:number, after:number}>}  always a usable data URL (the original on any doubt)
 */
export async function shrinkDataUrl(dataUrl, { maxSide = MAX_SIDE, quality = QUALITY, encode = browserEncode } = {}) {
  const before = typeof dataUrl === "string" ? dataUrl.length : 0;
  if (!isShrinkable(dataUrl) || before < SMALL_ENOUGH_CHARS) return { dataUrl, changed: false, before, after: before };
  try {
    const out = await encode(dataUrl, { maxSide, quality });
    if (typeof out !== "string" || !/^data:image\/jpeg;base64,/.test(out) || out.length >= before * MIN_SAVING) return { dataUrl, changed: false, before, after: before };
    return { dataUrl: out, changed: true, before, after: out.length };
  } catch {
    return { dataUrl, changed: false, before, after: before };
  }
}

/** A picked file as a data URL, scaled down when it is a photo. Rejects only when the file cannot be read at all. */
export function readImageFile(file, opts) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onerror = () => reject(r.error || new Error("the file could not be read"));
    r.onload = async () => resolve((await shrinkDataUrl(String(r.result), opts)).dataUrl);
    r.readAsDataURL(file);
  });
}

/** Photo fields held by Arth's records. Used to count and to shrink what is already saved. */
export const PHOTO_FIELDS = {
  txns: ["imageBase64", "paymentImageBase64"],
  bills: ["imageBase64", "paymentImageBase64"],
};

/** Every photo data URL in the data, with where it lives. Billers' own documents are included. */
export function listPhotos({ txns = [], bills = [], billerAccounts = [] }) {
  const out = [];
  for (const [list, name] of [[txns, "txns"], [bills, "bills"]]) for (const r of list) for (const f of PHOTO_FIELDS[name]) if (isShrinkable(r?.[f])) out.push({ where: name, id: r.id, field: f, chars: r[f].length });
  for (const b of billerAccounts) for (const d of b?.documents || []) if (isShrinkable(d?.dataUrl)) out.push({ where: "billerAccounts", id: b.id, field: "documents", chars: d.dataUrl.length });
  return out;
}

/**
 * Shrinks every photo in the given lists. Identical photos are shrunk once and share the result. Pure with respect to its input.
 * @returns {Promise<{txns:any[], bills:any[], billerAccounts:any[], photos:number, changed:number, before:number, after:number}>}
 */
export async function shrinkAllPhotos({ txns = [], bills = [], billerAccounts = [] }, opts = {}) {
  const memo = new Map();
  const stats = { photos: 0, changed: 0, before: 0, after: 0 };
  const one = async url => {
    if (!isShrinkable(url)) return url;
    stats.photos += 1; stats.before += url.length;
    if (!memo.has(url)) memo.set(url, shrinkDataUrl(url, opts));
    const r = await memo.get(url);
    stats.after += r.dataUrl.length; if (r.changed) stats.changed += 1;
    return r.dataUrl;
  };
  const rows = async (list, fields) => {
    const out = [];
    for (const r of list) { let next = r; for (const f of fields) { if (isShrinkable(r?.[f])) { const u = await one(r[f]); if (u !== r[f]) next = { ...next, [f]: u }; } } out.push(next); }
    return out;
  };
  const newTxns = await rows(txns, PHOTO_FIELDS.txns), newBills = await rows(bills, PHOTO_FIELDS.bills);
  const newBA = [];
  for (const b of billerAccounts) {
    let docs = b?.documents;
    if (Array.isArray(docs) && docs.some(d => isShrinkable(d?.dataUrl))) {
      const nd = []; for (const d of docs) nd.push(isShrinkable(d?.dataUrl) ? { ...d, dataUrl: await one(d.dataUrl) } : d);
      newBA.push({ ...b, documents: nd });
    } else newBA.push(b);
  }
  const replacements = new Map();
  for (const [from, p] of memo) { const r = await p; if (r.changed) replacements.set(from, r.dataUrl); }
  return { txns: newTxns, bills: newBills, billerAccounts: newBA, replacements, ...stats };
}

/**
 * Applies a shrink result to the data as it is NOW (which may have changed since the preview): a photo is replaced only when it is
 * exactly one of the photos that was shrunk. Anything else, including photos added since, is left alone.
 */
export function applyReplacements({ txns = [], bills = [], billerAccounts = [] }, replacements) {
  const swap = (list, fields) => list.map(r => { let next = r; for (const f of fields) { const v = r?.[f]; if (typeof v === "string" && replacements.has(v)) next = { ...next, [f]: replacements.get(v) }; } return next; });
  return {
    txns: swap(txns, PHOTO_FIELDS.txns), bills: swap(bills, PHOTO_FIELDS.bills),
    billerAccounts: billerAccounts.map(b => (Array.isArray(b?.documents) && b.documents.some(d => replacements.has(d?.dataUrl))
      ? { ...b, documents: b.documents.map(d => (replacements.has(d?.dataUrl) ? { ...d, dataUrl: replacements.get(d.dataUrl) } : d)) } : b)),
  };
}
