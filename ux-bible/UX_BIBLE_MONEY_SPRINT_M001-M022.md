# Sprint 3B — Money (M001–M022)

Same template as Home, plus Migration Impact and Complexity (S/M/L/XL).

## Chapter Organization

```
Ch.1 Dashboard    — M001
Ch.2 Wealth       — M002-M005
Ch.3 Debt         — M006, M007, M013, M014, M015, M016
Ch.4 Cash         — M008, M009, M010
Ch.5 Investments  — M011, M012 (holdings only — SIP schedule lives in Outlook, never mixed)
Ch.6 People       — M017, M018 (reuse the existing settlements system directly)
Ch.7 Physical Assets — M019, M020, M021, M022
```

## The Balance Sheet Test

Every screen in this module must answer **"Does this change my Balance
Sheet?"** — if no, it doesn't belong in Money.

| Included (✅) | Excluded (❌, belongs in Outlook) |
|---|---|
| Asset, Liability, Loan, Credit Card, Investment Holdings, Money to Receive | Bill Reminder, SIP Due Tomorrow, Budget Progress |

**Checked against all 22 screens below — all pass.** Nothing in this
module tracks a future due date or schedule; every screen here reflects
current position only. (Confirms the Money/Outlook split already frozen
in the IA and ADR-021 — not a new finding, just verified explicitly.)

---

# M001 — Money Dashboard
**Purpose:** Unified view of everything owned and owed.
**Question Answered:** What do I own and owe, overall?
**Owner Engine:** Balance
**Entry Points:** Bottom Nav → Money
**Exit Points:** each section → its own detail screen (M002-M022)
**Components:** Net Worth hero, 11 sections (Cash/Investments/Credit Cards/Money to Receive/Money You Owe/Vehicles/Property/Business Assets)
**Business Rules:** every number reuses an existing top-level calculation (`netWorthValue`, `totalAssetsValue`, `totalLiabilitiesValue`) — zero new calculations.
**Empty States:** each section shows its own "no X yet" line when empty (built).
**Error States:** N/A beyond standard load failure.
**Navigation:** `Money → tap any section → detail`
**Developer Notes:** built this sprint (`MoneyPage`).
**Status:** Existing | **Priority:** P0 | **Complexity:** M (UI + existing logic assembled into one screen) | **Migration Impact:** None — pure presentation, reused existing values.

---

# M002 — Net Worth
**Purpose:** The single top-line number for financial position.
**Question Answered:** What is my net worth right now?
**Owner Engine:** Balance
**Entry Points:** Money Dashboard (hero card)
**Exit Points:** Assets, Liabilities breakdowns
**Components:** Net Worth figure, Assets/Liabilities sub-totals.
**Business Rules:** `netWorthValue = totalAssetsValue - totalLiabilitiesValue`, unchanged.
**Status:** Existing | **Priority:** P0 | **Complexity:** S | **Migration Impact:** None.

---

# M003 — Assets
**Purpose:** List everything owned.
**Question Answered:** What do I own?
**Owner Engine:** Balance
**Entry Points:** Money Dashboard
**Exit Points:** individual Asset Detail
**Components:** grouped list (bank, cash, investments, tracked assets, receivables, loans given).
**Status:** Existing | **Priority:** P0 | **Complexity:** S | **Migration Impact:** None.

---

# M004 — Asset Detail
**Purpose:** Full detail on one specific asset.
**Owner Engine:** Balance
**Entry Points:** Assets list
**Status:** Existing | **Priority:** P1 | **Complexity:** S | **Migration Impact:** None.

---

# M005 — Add Asset
**Purpose:** Record a new tracked asset.
**Owner Engine:** Balance
**Entry Points:** Assets list "+"
**Business Rules:** Progressive Enrichment applies — minimal required fields, value can be added later.
**Status:** Existing | **Priority:** P1 | **Complexity:** S | **Migration Impact:** None.

---

# M006 — Liabilities
**Purpose:** List everything owed.
**Question Answered:** What do I owe?
**Owner Engine:** Balance
**Components:** credit card debt, loans taken, other liabilities.
**Status:** Existing | **Priority:** P0 | **Complexity:** S | **Migration Impact:** None.

---

# M007 — Liability Detail
**Purpose:** Full detail on one liability.
**Owner Engine:** Balance
**Status:** Existing | **Priority:** P1 | **Complexity:** S | **Migration Impact:** None.

---

# M008 — Accounts
**Purpose:** List all bank/cash/CC/investment accounts.
**Owner Engine:** Balance
**Entry Points:** Money Dashboard, Manage (drawer)
**Business Rules:** debit/UPI sub-accounts excluded from primary selection lists (per this session's fix) but still shown here as accounts in their own right for management purposes.
**Status:** Existing | **Priority:** P0 | **Complexity:** S | **Migration Impact:** None.

---

# M009 — Account Detail
**Purpose:** Transaction history and balance for one account.
**Owner Engine:** Balance
**Status:** Existing | **Priority:** P0 | **Complexity:** S | **Migration Impact:** None.

---

# M010 — Cash
**Purpose:** Bank + cash-in-hand position.
**Owner Engine:** Balance
**Components:** built this sprint as its own labeled Money section (bank accounts + cash accounts), reusing `accountBalance()`.
**Status:** Existing | **Priority:** P0 | **Complexity:** S | **Migration Impact:** None.

---

# M011 — Investments
**Purpose:** Holdings-only view (schedule/SIP view lives in Outlook, per the Money/Outlook split).
**Owner Engine:** Balance
**Components:** `investmentTypeSummaries`, already real.
**Business Rules:** Money shows holdings value only — "how much do I have," never due dates or SIP schedule (that's Outlook's O009).
**Status:** Existing | **Priority:** P0 | **Complexity:** S | **Migration Impact:** None.

---

# M012 — Investment Detail
**Purpose:** Detail on one holding/investment type.
**Owner Engine:** Balance
**Status:** Existing | **Priority:** P1 | **Complexity:** S | **Migration Impact:** None.

---

# M013 — Credit Cards (position view)
**Purpose:** Show CC financial position — never due dates/reminders (Outlook's job).
**Question Answered:** How much do I owe on my credit cards, and how much room do I have left?
**Owner Engine:** Balance
**Components:** Outstanding Balance, Available Limit, Utilisation %, Total Exposure.
**Business Rules:** Outstanding Balance is real (`accountBalance`). **Available Limit and Utilisation show "Not set"/"—", not fabricated** — CC accounts have no credit-limit field in the data model today, confirmed by code check.
**Empty States:** "No credit cards yet."
**Status:** Existing (position-view portion built this sprint) | **Priority:** P0 | **Complexity:** M | **Migration Impact:** **Requires a `creditLimit` field added to CC-type accounts** to make Available Limit/Utilisation real instead of "Not set" — flagged, not yet done.

---

# M014 — Credit Card Detail
**Purpose:** Single card's full position detail.
**Owner Engine:** Balance
**Status:** Existing | **Priority:** P1 | **Complexity:** S | **Migration Impact:** Same as M013 (depends on credit-limit field).

---

# M015 — Loans
**Purpose:** List loans given and taken.
**Owner Engine:** Balance
**Status:** Existing | **Priority:** P1 | **Complexity:** S | **Migration Impact:** None.

---

# M016 — Loan Detail
**Purpose:** Full detail on one loan, repayment history.
**Owner Engine:** Balance
**Status:** Existing | **Priority:** P1 | **Complexity:** S | **Migration Impact:** None.

---

# M017 — Money to Receive
**Purpose:** Who owes you money.
**Owner Engine:** Balance
**Components:** built this sprint as its own Money section, reusing `settlements`/`owesMe`.
**Status:** Existing | **Priority:** P0 | **Complexity:** S | **Migration Impact:** None.

---

# M018 — Money You Owe
**Purpose:** Who you owe money to.
**Owner Engine:** Balance
**Components:** built this sprint, reusing `settlements`/`iOwe` (field name confirmed by code check, not guessed).
**Status:** Existing | **Priority:** P0 | **Complexity:** S | **Migration Impact:** None.

---

# M019 — Vehicles
**Purpose:** Show vehicle asset value.
**Owner Engine:** Balance (record itself owned by Manage, per ADR-021)
**Business Rules:** shows "Value not set" when no `purchaseValue` exists — Progressive Enrichment, never fabricated.
**Status:** Existing | **Priority:** P1 | **Complexity:** S | **Migration Impact:** **Requires `purchaseValue` field added to the Vehicle record** for real values to ever display — same flagged gap since UX-005.

---

# M020 — Vehicle Detail
**Purpose:** Full vehicle detail including value.
**Owner Engine:** Balance/Manage
**Status:** Existing | **Priority:** P2 | **Complexity:** S | **Migration Impact:** Same as M019.

---

# M021 — Property
**Purpose:** Track owned property and its value.
**Owner Engine:** Balance (record owned by Manage)
**Components:** currently a placeholder only ("No properties added yet").
**Status:** New | **Priority:** P2 | **Complexity:** **XL** | **Migration Impact:** Requires a new Property entity (Manage), CRUD screens, valuation field/logic, and integration into `totalAssetsValue`. Genuinely new domain work, not a UI task.

---

# M022 — Business Assets
**Purpose:** Track business-owned assets.
**Owner Engine:** Balance (record owned by Manage)
**Components:** placeholder only ("No business assets added yet").
**Status:** New | **Priority:** P3 | **Complexity:** **XL** | **Migration Impact:** Same class of work as M021 — new entity, CRUD, valuation, Net Worth integration.

---

## Sprint 3B Summary

| Status | Count |
|---|---|
| Existing | 20 |
| New | 2 (M021, M022 — both XL) |

**Only two genuinely new-domain-work screens in the entire Money module** — everything else is either fully built or a thin presentation layer over existing calculations. The two real complexity spikes (M013/M014's credit-limit field, M019/M020's purchase-value field) are both small, additive schema changes, not architecture work — correctly scored M, not XL.
