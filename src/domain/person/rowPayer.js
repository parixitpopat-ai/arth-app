// domain/person/rowPayer.js
//
// The person rows on the Add screen: A / O / C say how someone is involved in an expense, and P says "this person paid it, from the petty cash I gave them".
// P and A / O / C are different answers to the same question, so only one of them can hold for a person at a time, and P is offered only when that person
// still has petty cash from me (or is already ticked, so it can be untied). Pure: the form passes its rows in and takes the result.

/** Is the P button offered for this person? `pettyHeld` is the petty cash still with them (settlements[personId].pettyHeld). */
export const canOfferPettyPaid = (pettyHeld, isSelected) => Number(pettyHeld || 0) > 0 || Boolean(isSelected);

/** The person tapped A, O or C on a row: that mode is set, and if that person was the payer (P) they no longer are. */
export function chooseRowMode({ rows, rowId, mode, paidByPersonId }) {
  const row = (rows || []).find(r => r.id === rowId);
  const nextRows = (rows || []).map(r => (r.id === rowId ? { ...r, mode } : r));
  const clearsPayer = Boolean(row && row.targetType === "person" && paidByPersonId && String(paidByPersonId) === String(row.targetId));
  return { rows: nextRows, paidByPersonId: clearsPayer ? "" : (paidByPersonId || "") };
}

/** The person tapped P on a row: ticks them as the payer and clears their A / O / C; tapping P again unticks. Any earlier payer's row keeps its (cleared) mode. */
export function choosePettyPaid({ rows, rowId, paidByPersonId }) {
  const row = (rows || []).find(r => r.id === rowId);
  if (!row || row.targetType !== "person") return { rows: rows || [], paidByPersonId: paidByPersonId || "" };
  if (paidByPersonId && String(paidByPersonId) === String(row.targetId)) return { rows: rows, paidByPersonId: "" };
  return { rows: rows.map(r => (r.id === rowId ? { ...r, mode: null } : r)), paidByPersonId: row.targetId };
}
