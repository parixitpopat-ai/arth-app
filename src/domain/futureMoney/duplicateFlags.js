// domain/futureMoney/duplicateFlags.js
//
// Outlook: possible duplicates. Two open commitments that look like the same payment entered twice (a bill and a repeating schedule for the same
// rent, an EMI that is both a loan instalment and a bill, ...). Every one of them is counted in "Needed", so a real duplicate overstates it.
// A flag is a QUESTION, never a deletion: the person looks at both and decides. Pure; nothing is stored here.
//
// Two entries are flagged when, from different records (not the same sourceType + sourceId):
//   1. their amounts are the same (to the rupee), and
//   2. their dates are within 7 days of each other (or both have none), and
//   3. their names say the same thing: after dropping filler words ("bill", "emi", "payment", month names, numbers) one name's words
//      are all in the other's, with at least one word in common. Two entries with no usable name are never matched on the name alone.
//   Same amount and the same date are not enough on their own: nothing is flagged without a shared word.
// Entries 30 days apart (the same rent in two months) are never flagged: that is a normal monthly repeat.

const FILLER = new Set(["bill", "bills", "emi", "payment", "payments", "due", "monthly", "month", "the", "of", "for", "and", "to", "installment", "instalment", "jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec", "january", "february", "march", "april", "june", "july", "august", "september", "october", "november", "december"]);
const words = name => String(name || "").toLowerCase().replace(/[^a-z0-9 ]+/g, " ").split(/\s+/).filter(w => w.length > 1 && !/^\d+$/.test(w) && !FILLER.has(w));
const DAY = 86400000;
const dayNum = d => (d ? Math.floor(new Date(String(d).slice(0, 10) + "T00:00:00Z").getTime() / DAY) : null);

function sameThing(a, b) {
  if (a.sourceType === b.sourceType && String(a.sourceId) === String(b.sourceId)) return false;
  if (Math.round(Number(a.amount) || 0) !== Math.round(Number(b.amount) || 0) || !(Number(a.amount) > 0)) return false;
  const da = dayNum(a.date), db = dayNum(b.date);
  if (da == null !== (db == null)) return false;
  if (da != null && Math.abs(da - db) > 7) return false;
  const wa = words(a.name), wb = words(b.name);
  if (!wa.length || !wb.length) return false;
  const [small, big] = wa.length <= wb.length ? [wa, wb] : [wb, wa];
  return small.every(w => big.includes(w));
}

/**
 * @param {Array<{sourceType:string,sourceId:any,name?:string,amount:number,date?:string|null}>} events  open commitments
 * @param {string[]} [dismissed]  pair keys the person said are not duplicates
 * @returns {{pairs:Array<{key:string,a:object,b:object}>, flagged:Set<string>}}  flagged holds `${sourceType}:${sourceId}` of every entry in a pair
 */
export function findPossibleDuplicates(events, dismissed = []) {
  const list = (events || []).filter(e => e && e.sourceType && e.sourceId != null);
  const skip = new Set(dismissed || []);
  const pairs = [], flagged = new Set();
  for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
    if (!sameThing(list[i], list[j])) continue;
    const ka = `${list[i].sourceType}:${list[i].sourceId}`, kb = `${list[j].sourceType}:${list[j].sourceId}`;
    const key = [ka, kb].sort().join("|");
    if (skip.has(key)) continue;
    pairs.push({ key, a: list[i], b: list[j] }); flagged.add(ka); flagged.add(kb);
  }
  return { pairs, flagged };
}
