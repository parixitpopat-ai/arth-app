// Removes only settlement_in records that are exact duplicates of one already kept.
//
// The earlier cleanup keyed on person + date + amount (and, when linked, person + expense + date +
// amount + account) and dropped every later record with the same key. Two real repayments or refunds
// of the same amount on the same day have identical keys, so the second was deleted on load, and the
// deletion was then saved and synced. A record is now dropped only when it is identical to a kept one
// in every field, id included, so the kept copy demonstrably preserves everything the dropped one held.
// Lookalikes with different ids are kept.

const canonical = value => {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map(k => `${JSON.stringify(k)}:${canonical(value[k])}`).join(",")}}`;
  }
  return JSON.stringify(value === undefined ? null : value);
};

export const dedupeSettlementTxns = txns => {
  const seen = new Set();
  return txns.filter(t => {
    if (t?.type !== "settlement_in") return true;
    const key = canonical(t);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};
