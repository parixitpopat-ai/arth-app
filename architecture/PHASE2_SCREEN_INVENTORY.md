# Arth v2.0 — Phase 2: Screen Inventory (v2, refined with ID scheme)

Refines the original Phase 2 catalogue with permanent screen IDs.
Existing/Refactor/New status re-checked against what's actually been
built since the original pass (Money Hub, Outlook/Insights placeholders,
drawer restructure) — not just copied from the draft uncritically.

## ID Ranges

```
Home      H001-H099
Money     M001-M099
Add       A001-A099
Outlook   O001-O199
Insights  I001-I099
Settings  S001-S099
Shared    X001-X099
```

---

## HOME

| ID | Screen | Status |
|---|---|---|
| H001 | Home Dashboard | Existing |
| H002 | Widget Customization | New |
| H003 | Financial Health Detail | Existing |
| H004 | Today's Focus | **Partial** — Action Centre exists under its old name; the rename + "ask Forecast Engine for top 3" intelligence (per ADR-021 addendum/IA) is not yet built. Not "Existing" as drafted. |
| H005 | Goals Preview | Existing |
| H006 | Events Preview | Existing |
| H007 | Recent Activity | Existing |
| H008 | Search | Existing |

## MONEY

| ID | Screen | Status |
|---|---|---|
| M001 | Money Dashboard | **Existing now** — built this sprint (`MoneyPage`), not "New" as drafted |
| M002 | Net Worth | Existing (reused, unchanged calc) |
| M003 | Assets | Existing |
| M004 | Asset Detail | Existing |
| M005 | Add Asset | Existing |
| M006 | Liabilities | Existing |
| M007 | Liability Detail | Existing |
| M008 | Accounts | Existing |
| M009 | Account Detail | Existing |
| M010 | Cash | Existing |
| M011 | Investments | Existing |
| M012 | Investment Detail | Existing |
| M013 | Credit Cards | **Existing, position view built this sprint** — Outstanding Balance real; Available Limit/Utilisation show "Not set"/"—" since no credit-limit field exists on CC accounts (confirmed by code check, not a display bug) |
| M014 | Card Detail | Existing |
| M015 | Loans | Existing |
| M016 | Loan Detail | Existing |
| M017 | Money to Receive | Existing (built this sprint as its own Money section, reusing `settlements`) |
| M018 | Money You Owe | Existing (same) |
| M019 | Vehicles | Existing — shows "Value not set" per Progressive Enrichment, since `purchaseValue` doesn't exist on the Vehicle record yet |
| M020 | Vehicle Detail | Existing |
| M021 | Property | New (placeholder only, no CRUD, built this sprint) |
| M022 | Business Assets | New (placeholder only, no CRUD, built this sprint) |

## ADD

| ID | Screen | Status |
|---|---|---|
| A001 | Quick Add Menu | Existing |
| A002 | Expense | Existing |
| A003 | Income | Existing |
| A004 | Transfer | Existing |
| A005 | Investment | Existing |
| A006 | Loan | Existing |
| A007 | Borrow | Existing |
| A008 | Lend | Existing |
| A009 | Goal Contribution | Existing |
| A010 | Attachment | Existing (per-transaction only — not yet the shared platform Attachment service from ADR-021) |
| A011 | OCR Import | New — deliberately parked |
| A012 | Voice Entry | New — deliberately parked |

## OUTLOOK (largest module, most genuinely new work)

| ID | Screen | Status |
|---|---|---|
| O001 | Outlook Dashboard | **Partial** — placeholder built this sprint (shows Bills/Budget/Scheduled Income links + Coming Soon list), not the real unified dashboard yet |
| O002 | Overview | New |
| O003 | Upcoming Bills | Existing |
| O004 | Bill Detail | Existing |
| O005 | Budget Progress | Existing |
| O006 | Budget Detail | Existing |
| O007 | Subscriptions | **Refactor** — filtered view of `Bill.type=Subscription`, per ADR-021; no separate entity |
| O008 | Subscription Detail | Refactor (same basis) |
| O009 | Investment Plans (SIPs) | Refactor (same basis) |
| O010 | SIP Detail | Refactor |
| O011 | Insurance | **Existing — confirmed live**, corrected after later grep evidence (`InsuranceScreen.jsx`, 3 modals, Archive status all real). Built outside this design process. |
| O012 | EMI | Existing |
| O013 | Scheduled Income | Existing (Financial Engine Phase 1) |
| O014 | Cash Forecast | New — `calculateProjectedBalance` is an explicit engine stub |
| O015 | Calendar | New |
| O016 | Alerts | Partial — exists inline in Action Centre, not centralized per the Forecast Engine's intended ownership |
| O017 | Monthly Planner | New |
| O018 | Forecast Timeline | New |
| O019 | Decision Detail | New |
| O020 | AI Recommendation | New — deliberately parked (AI Engine out of scope until later) |

## INSIGHTS (confirmed least existing work of any module)

| ID | Screen | Status |
|---|---|---|
| I001 | Insights Dashboard | **Partial** — placeholder built this sprint ("under development"), not real |
| I002-I015 | Spending, Categories, Merchants, Trends, Heatmaps, Income, Income Sources, Salary History, Passive Income, Net Worth Growth, Financial Health, Savings Rate, Reports, Comparison | **All New** — 0% built, confirmed in the original inventory and unchanged since |

## SETTINGS

| ID | Screen | Status |
|---|---|---|
| S001 | Settings | Existing, restructured this sprint into Manage/Data/Settings/Help |
| S002 | Appearance | Existing |
| S003 | Security | Existing |
| S004 | Accounts | Existing (now under Manage) |
| S005 | Categories | Existing (now under Manage; still a hub of separate tables per ADR-021, not unified) |
| S006 | Import | **New** — confirmed nowhere in the app, no fake link added anywhere |
| S007 | Export | Existing (CSV) |
| S008 | Backup | Existing |
| S009 | Sync | Existing |
| S010 | Notifications | Existing |
| S011 | About | Existing (Release Notes) |

## SHARED

| ID | Screen/Pattern | Status |
|---|---|---|
| X001 | Search | Existing (per-screen, not unified — same gap noted in Pattern Library) |
| X002 | Filter | Existing (per-screen) |
| X003 | Sort | Existing (per-screen) |
| X004 | Date Picker | Existing |
| X005 | Attachment Viewer | Existing (per-transaction only) |
| X006 | Confirmation Dialog | **Existing, extracted this sprint** — PAT-006 |
| X007 | Success Screen | Existing (Toast, PAT-003) |
| X008 | Error Screen | New — no dedicated pattern, inline warnings only |
| X009 | Empty State | Existing — PAT-002 |
| X010 | Loading State | Partial — sync spinner exists; no general skeleton loader |

---

## Order to complete detailed specs (per the agreed sequence)

1. Home (8 screens)
2. Money (22 screens)
3. Outlook (20 screens)
4. Insights (15 screens)
5. Settings (11 screens)
6. Shared (10 patterns)

---

# Phase 2 v1.1 — Refinements

**Owner Engine + Priority added** (P0=must ship v2, P1=next milestone, P2=nice to have, P3=future roadmap).

## HOME

| ID | Screen | Engine | Priority |
|---|---|---|---|
| H001 | Home Dashboard | Home | P0 |
| H002 | Widget Customization | Home | P2 |
| H003 | Financial Health Detail | Analytics | P1 |
| H004 | Today's Focus | Forecast | P0 |
| H005 | Goals Preview | Goals | P0 |
| H006 | Events Preview | Forecast | P1 |
| H007 | Recent Activity | Ledger | P0 |
| H008 | Search | Ledger | P1 |

## MONEY

| ID | Screen | Engine | Priority |
|---|---|---|---|
| M001 | Money Dashboard | Balance | P0 |
| M002 | Net Worth | Balance | P0 |
| M003 | Assets | Balance | P0 |
| M004 | Asset Detail | Balance | P1 |
| M005 | Add Asset | Balance | P1 |
| M006 | Liabilities | Balance | P0 |
| M007 | Liability Detail | Balance | P1 |
| M008 | Accounts | Balance | P0 |
| M009 | Account Detail | Balance | P0 |
| M010 | Cash | Balance | P0 |
| M011 | Investments | Balance | P0 |
| M012 | Investment Detail | Balance | P1 |
| M013 | Credit Cards | Balance | P0 |
| M014 | Credit Card Detail | Balance | P1 |
| M015 | Loans | Balance | P1 |
| M016 | Loan Detail | Balance | P1 |
| M017 | Money to Receive | Balance | P0 |
| M018 | Money You Owe | Balance | P0 |
| M019 | Vehicles | Balance | P1 |
| M020 | Vehicle Detail | Balance | P1 |
| M021 | Property | Balance | P2 |
| M022 | Business Assets | Balance | P3 |

## OUTLOOK — regrouped internally (per this refinement; not new screens)

```
Overview
────────
Commitments: Bills, Subscriptions, Insurance, EMIs, Investment Plans
────────
Planning: Budget, Planner, Cash Forecast, Calendar
────────
Intelligence: Alerts, Recommendations, Forecast Timeline
```

| ID | Screen | Engine | Priority |
|---|---|---|---|
| O001 | Outlook Dashboard | Forecast | P0 |
| O003 | Upcoming Bills | Forecast | P0 |
| O004 | Bill Detail | Forecast | P0 |
| O005 | Budget Progress | Forecast | P0 |
| O007 | Subscriptions | Forecast | P1 |
| O009 | Investment Plans | Forecast | P1 |
| O011 | Insurance | Forecast | P0 (per prior decision: largest missing piece) |
| O012 | EMI | Forecast | P1 |
| O013 | Scheduled Income | Forecast | P0 |
| O014 | Cash Forecast | Forecast | **P0** — Outlook isn't useful without it |
| O015 | Calendar | Forecast | P2 |
| O016 | Alerts | Forecast | P0 |
| O017 | Monthly Planner | Forecast | P2 |
| O018 | Forecast Timeline | Forecast | P1 |
| O019 | **Commitment Detail** (renamed from "Decision Detail" — Decision is a user action, not a business object) | Forecast | P1 |
| O020 | AI Recommendation | AI | **P3** |

## SHARED — split into Patterns vs Services

```
Patterns (UI): Search, Filter, Sort, Loading, Dialogs, Empty/Error States, Chip, EntityCard
Services (reusable logic, not screens): Attachment, OCR, Voice, Export, Import
```

## Dependencies + Entry Points — worked example (per the requested format)

**O014 Cash Forecast**
- Depends on: Forecast Engine, Bills, Scheduled Income, Investments, Budget, Accounts
- Entry: Outlook Dashboard, Home (Today's Focus), Notification

**M013 Credit Cards**
- Depends on: Balance Engine, Accounts
- Entry: Money Dashboard, Search, Notification, Deep Link

Full Dependencies/Entry Points for every remaining screen are captured at the point each screen's individual one-page spec is written (Phase 3), rather than duplicated here — avoids two documents drifting out of sync with each other.
