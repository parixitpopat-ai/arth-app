# FIN-TRUTH-003 — Calendar-month credit card spend: proposed definition (for review, not implemented)

Status: **definition only.** Nothing is built. Facts below were read from `main` @ `9c143cc`.

## Why this is not one number today

The app shows card figures on a **statement cycle**, not a calendar month:

| Shown today | Meaning | Where |
|---|---|---|
| Billed / Due now | charges in the last closed cycle, less refunds and payments after it (`getCardSummary().totalOutstanding`) | Home card tile, Money tab, card page |
| Unbilled | charges since the last statement date, up to today (`currentCycleSpend`) | same |
| In use | billed + unbilled (`getCardUsage`) | same |

None of these answers "how much did I spend on the card in October". A cycle of 16 Sep–15 Oct straddles two months.

## Proposed metric: **Card spending, calendar month M (my share)**

> Σ over expense transactions with date in M whose account is the card (or a UPI handle linked to it), of
> `getMyExpenseShare` (refunds netted, amounts others owe me left out, excluded-from-spend left out).

It is a **subset of Spent**: for every month, `Spent(M) = Card spending(M) + Spending on every other account(M)`.
That is the invariant to test.

A second, separately labelled figure, **Card charges, month M (gross)**, may be wanted for the card's own page: all
card charges by transaction date (expense + investment + card EMI), before sharing and refunds. It is activity, not spending.

## Relationship to everything else

| Item | In *Card spending (my share)* | Why |
|---|---|---|
| Ordinary card purchase | yes, in the month of its date | it is an expense |
| Purchase shared with someone | only my share | same rule as Spent |
| Refund linked to an expense | reduces the **original expense's month**, whenever the refund arrives | existing rule (`buildRefundTotalsByExpense`, D1) |
| Person/group repayment | no effect | not a refund (D1) |
| Investment charged to the card | no | a cash outflow, not spending; counts toward the card's *charges*, *billed*, *unbilled*, *in use* |
| Statement payment (`cc_payment`) | no | settles a liability already counted when charged; counting it would double count |
| EMI purchase via Add Expense > EMI | down payment in the purchase month; each instalment in its own month | instalments are `expense` rows on the card |
| EMI instalment logged as `cc_emi` | **no, today** | `getHouseholdAttributedTotal` counts only `type === "expense"`; see Open question 1 |
| Future-dated instalment in the current month | yes (all month-to-date figures count future-dated rows) | app-wide convention; see Open question 2 |

## Open questions (decisions for the reviewer)

1. **Two EMI models disagree.** Instalments created by an EMI *purchase* are `expense` rows and count in Spent. Instalments
   logged against a card EMI *plan* are `cc_emi` rows and do not, although both are card charges. Should `cc_emi` count in
   Spent (and therefore in card spending)? Not decided anywhere in FIN-TRUTH-001. Changing it moves existing Spent figures.
2. **Month-to-date includes future-dated rows.** On 10 Oct an instalment dated 15 Oct is already in October's Spent. The
   audit (`wp-emi-backdated-audit`) found this is the general convention, not an EMI-specific error, and that no instalment is
   attributed to the purchase month. Excluding future-dated rows from Spent would also hide future instalments from every
   forward view (EMI loans are deliberately excluded from debt service to avoid double counting), so it needs its own decision.
3. Should the card page show both Card spending (my share) and Card charges (gross), or only the first?
4. Should the figure appear on Home, the Money tab, the card page, or only the card page?
5. Cards with linked UPI handles: include the handle's spend (recommended, as `getCardSummary` already does).

## Reconciliation tests to write once the definition is approved

* `Spent(M) = Card spending(M) + other(M)` for a month containing: purchase, shared purchase, linked refund in a later
  month, investment, statement payment, EMI-purchase instalment, down payment.
* Statement payment changes billed and cash, never Card spending.
* Card spending(M) differs from the statement amount for a cycle straddling M, and both are labelled.
