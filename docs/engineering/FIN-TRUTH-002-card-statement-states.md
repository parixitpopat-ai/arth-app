# FIN-TRUTH-002 — What "To pay" means for each card statement state

Status: **audit, no behaviour changed.** Measured on `main` @ `9c143cc` in a real browser (today = 11 Oct 2026, card
statement day 15, due day 5, all statements for the 15 Aug–15 Sep cycle, due 5 Oct). Related locked rules: Credit Card WP
rules 5–9 (`src/domain/cards/reconciliation.js`): three verification states only, every transition explicit, a mismatch never
closes by itself, no "accept difference" workflow, `arthAmount` is never overwritten by a bank figure.

## Measured behaviour

| State | Arth amount | Bank amount | In Payments "To pay" | Outlook / Money Required | Notes |
|---|---|---|---|---|---|
| No transactions in the cycle | 0 | – | **no bill exists** (since `wp-statement-no-txn-no-bill`) | not present | Home asks on billing day |
| Needs verification | 2,300 | – | ₹2,300, overdue after due date | ₹2,300 | label "Needs verification" |
| Matched with bank | 2,300 | 2,300 | ₹2,300 | ₹2,300 | label only |
| Mismatch, bank higher | 2,300 | 3,000 | **₹2,300** | **₹2,300** | bank figure is not used as the amount payable |
| Mismatch, Arth higher | 2,300 | 1,800 | **₹2,300** | **₹2,300** | same |
| Mismatch, Arth 0 | 0 | 1,500 | **not listed** | **not listed** | row is invisible outside the card's own screen |
| Paid | 2,300 | any | under "Paid" | not present | – |

Total of the four open rows = ₹9,200 = Home "Money Required" = Outlook "Needed": the three agree.

## Meaning, as the code defines it today

* **To pay = Arth's recorded amount for the cycle** (`bill.amount`), for statements that are unpaid and due or overdue.
* **Verification never changes the amount payable.** It is a label. A bank figure is stored beside Arth's, never in place of it.
* A statement with Arth's amount 0 is **not payable and not listed**, whatever the bank says.

## Findings

1. Consistent: Payments, Outlook and Money Required use one definition.
2. **Gap (evidenced):** *Mismatch with Arth 0* (bank says something is owed, Arth has no transactions) has no visible
   surface in "To pay", Outlook or Home. It exists only in the card's statement sheet. Nothing prompts the user to add the
   missing transactions.
3. No evidence that mismatch rows are mis-stated; they follow rules 5–9 as written.

## Decisions needed before any change (not made here)

* Should *mismatch, Arth 0* appear as an **attention item** ("Bank says ₹1,500; Arth has no transactions — add them or
  confirm"), explicitly **not** as an amount payable? (Recommended, and consistent with "never treat a mismatch as payable".)
* If yes, where: the existing Home billing-day prompt, the Credit Cards list, or both?
* Whether Outlook/Money Required may ever include a bank figure — currently **no**, and nothing here proposes it.
