// src/sync/backupPhotos.js
//
// Photos are most of the size of a backup, and a backup is only needed for what would otherwise be LOST. A photo that also exists in the data that
// replaces the backed-up data is not lost by the replacement, so a backup may leave it out. A photo that exists nowhere else is always kept.
// Left-out photos are recorded (record id + field), so that restoring the backup can put them back from the data that survived.
// (Conflict holds, sign-out and account hand-over copies are never reduced: they are the only copy of a side the person has not yet chosen.)

const MIN_CHARS = 2000;                                    // shorter strings are not photos
const FIELDS = { txns: ["imageBase64", "paymentImageBase64"], bills: ["imageBase64", "paymentImageBase64"] };
const isPhoto = v => typeof v === "string" && v.length >= MIN_CHARS && v.startsWith("data:");

/** Every photo text present in the data (as a Set). */
export function photoSet(snapshot) {
  const out = new Set();
  if (!snapshot || typeof snapshot !== "object") return out;
  for (const [list, fields] of Object.entries(FIELDS)) for (const r of Array.isArray(snapshot[list]) ? snapshot[list] : []) for (const f of fields) if (isPhoto(r?.[f])) out.add(r[f]);
  for (const b of Array.isArray(snapshot.billerAccounts) ? snapshot.billerAccounts : []) for (const d of Array.isArray(b?.documents) ? b.documents : []) if (isPhoto(d?.dataUrl)) out.add(d.dataUrl);
  return out;
}

/**
 * @returns {{snapshot:object, omitted:Array<{where:string,id:any,field:string,doc?:any}>}}  the same snapshot object when nothing is left out
 */
export function stripSurvivingPhotos(snapshot, survivor) {
  const keepElsewhere = photoSet(survivor);
  const omitted = [];
  if (!keepElsewhere.size || !snapshot || typeof snapshot !== "object") return { snapshot, omitted };
  const next = { ...snapshot };
  for (const [list, fields] of Object.entries(FIELDS)) {
    if (!Array.isArray(snapshot[list])) continue;
    next[list] = snapshot[list].map(r => {
      let out = r;
      for (const f of fields) if (isPhoto(r?.[f]) && keepElsewhere.has(r[f])) { out = out === r ? { ...r } : out; out[f] = ""; omitted.push({ where: list, id: r.id, field: f }); }
      return out;
    });
  }
  if (Array.isArray(snapshot.billerAccounts)) {
    next.billerAccounts = snapshot.billerAccounts.map(b => {
      if (!Array.isArray(b?.documents) || !b.documents.some(d => isPhoto(d?.dataUrl) && keepElsewhere.has(d.dataUrl))) return b;
      return { ...b, documents: b.documents.map(d => { if (isPhoto(d?.dataUrl) && keepElsewhere.has(d.dataUrl)) { omitted.push({ where: "billerAccounts", id: b.id, doc: d.id, field: "dataUrl" }); return { ...d, dataUrl: "" }; } return d; }) };
    });
  }
  return omitted.length ? { snapshot: next, omitted } : { snapshot, omitted };
}

/**
 * Puts left-out photos back, from the data as it is now, by record id. A photo whose record no longer holds it stays empty and is counted.
 * @returns {{snapshot:object, filled:number, missing:number}}
 */
export function fillOmittedPhotos(snapshot, omitted, current) {
  if (!Array.isArray(omitted) || !omitted.length || !snapshot) return { snapshot, filled: 0, missing: 0 };
  const byId = (list, id) => (Array.isArray(list) ? list.find(r => r && r.id === id) : undefined);
  let filled = 0, missing = 0;
  const next = { ...snapshot };
  const patch = (listName, fn) => { if (Array.isArray(next[listName])) next[listName] = fn(next[listName]); };
  for (const [list, fields] of Object.entries(FIELDS)) {
    const wanted = omitted.filter(o => o.where === list);
    if (!wanted.length) continue;
    patch(list, rows => rows.map(r => {
      const mine = wanted.filter(o => o.id === r?.id); if (!mine.length) return r;
      let out = r;
      for (const o of mine) { const src = byId(current?.[list], r.id)?.[o.field]; if (fields.includes(o.field) && isPhoto(src) && !isPhoto(r[o.field])) { out = out === r ? { ...r } : out; out[o.field] = src; filled++; } else if (!isPhoto(r[o.field])) missing++; }
      return out;
    }));
  }
  const docs = omitted.filter(o => o.where === "billerAccounts");
  if (docs.length) patch("billerAccounts", rows => rows.map(b => {
    const mine = docs.filter(o => o.id === b?.id); if (!mine.length || !Array.isArray(b.documents)) return b;
    return { ...b, documents: b.documents.map(d => { const o = mine.find(x => x.doc === d?.id); if (!o) return d; const src = (byId(current?.billerAccounts, b.id)?.documents || []).find(x => x?.id === d.id)?.dataUrl; if (isPhoto(src)) { filled++; return { ...d, dataUrl: src }; } missing++; return d; }) };
  }));
  return { snapshot: next, filled, missing };
}
