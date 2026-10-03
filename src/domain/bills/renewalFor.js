// domain/bills/renewalFor.js
//
// Payments' For filter ("Everyone / Me / Vyom / a group / Unassigned") must apply to renewals and fees
// as well as Bills. Renewal reminders (membership, school fee, insurance) are built without an owner
// id, so this tags each with forType/forId from data that already exists:
//   - membership / school: the Biller Account's own attribution (attributeType + attributedTo)
//   - insurance: the policy's insuredPerson, matched to a Person by name (the policy stores only
//     the name) — if no Person has that name the item stays Unassigned rather than being guessed.
// Pure; returns new objects.

const norm = v => String(v || "").trim().toLowerCase();

export function tagRenewalsWithFor(items, { billerAccounts = [], insurancePolicies = [], people = [] } = {}) {
  return (items || []).map(it => {
    if (it.sourceType === "insurance") {
      const pol = insurancePolicies.find(p => String(p.id) === String(it.policyId));
      const name = norm(pol?.insuredPerson);
      const person = name ? people.find(p => norm(p.name) === name) : null;
      return person ? { ...it, forType: "person", forId: person.id } : it;
    }
    const ba = billerAccounts.find(b => String(b.id) === String(it.billerAccountId));
    if (ba && (ba.attributeType === "person" || ba.attributeType === "group") && ba.attributedTo) {
      return { ...it, forType: ba.attributeType, forId: String(ba.attributedTo) };
    }
    return it;
  });
}
