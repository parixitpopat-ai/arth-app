// domain/loans/loanList.js
//
// Money → Loans: the loans the person owes and the loans they gave, still open, biggest first, with the two totals. Pure.
// Card EMI purchases are a card matter (they show under Cards), so loans backed by a card are left out via isCardBacked.

const n = v => Number(v) || 0;
const r2 = v => Math.round(n(v) * 100) / 100;

/**
 * @param {Array<{id:any,name?:string,direction?:string,status?:string,outstanding?:number,dueDate?:string,interestRate?:number,hasInterest?:boolean,personId?:string}>} loans
 * @param {(loan:object)=>boolean} [isCardBacked]
 */
export function summariseLoans(loans, isCardBacked = () => false) {
  const open = (loans || []).filter(l => l && !isCardBacked(l) && (l.status || "active") === "active" && n(l.outstanding) > 0);
  const row = l => ({ id: l.id, name: l.name || "Loan", outstanding: r2(l.outstanding), dueDate: l.dueDate || "", interest: l.hasInterest && n(l.interestRate) > 0 ? n(l.interestRate) : 0, personId: l.personId || "", loan: l });
  const sorted = list => list.map(row).sort((a, b) => b.outstanding - a.outstanding);
  const taken = sorted(open.filter(l => l.direction === "taken"));
  const given = sorted(open.filter(l => l.direction !== "taken"));
  const sum = list => r2(list.reduce((s, x) => s + x.outstanding, 0));
  return { taken, given, takenTotal: sum(taken), givenTotal: sum(given), hasAny: taken.length + given.length > 0 };
}
