// What "Add / Activate" offers, grouped, and the search over it. Plain data and a pure function (no React) so it can be tested.
export const ADD_ACTIVATE_GROUPS = [
  { label: "Recharge", types: ["Fastag", "Mobile Postpaid", "Mobile Prepaid", "DTH", "Broadband", "Landline", "Cable TV", "Metro Recharge", "NCMC Recharge", "EV Recharge"] },
  { label: "Utility bills", types: ["Electricity", "LPG Gas", "Piped Gas", "Water"] },
  { label: "Finances", types: ["Credit Card", "Recurring Deposit", "NPS", "Insurance", "Forex"] },
  { label: "Education & fitness", types: ["Education Fees", "Gym / Fitness", "Club Membership", "Hospital"] },
  { label: "Others", types: ["Donation", "Municipal Services", "Municipal Tax", "Society Maintenance", "Rental", "Prepaid Meter", "eChallan", "Fleet Card", "B2B", "Other Subscription", "Other"] },
];

/** Filters the groups by a search text (matches the type name, ignoring capitals); empty text keeps everything. Groups left empty are dropped. */
export function filterGroups(groups, query) {
  const q = String(query || "").trim().toLowerCase();
  if (!q) return groups;
  return groups.map(g => ({ ...g, types: g.types.filter(t => t.toLowerCase().includes(q)) })).filter(g => g.types.length);
}
