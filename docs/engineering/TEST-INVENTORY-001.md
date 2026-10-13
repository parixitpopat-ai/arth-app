# TEST-INVENTORY-001 — which test files run, and why

`npm test` is an explicit list of files (`package.json`). A test file that is not in the list never runs, and a listed path
that does not exist is skipped without any error. This note records the reconciliation done on 13 Oct 2026.

## Result
* 8 test files were on disk but not registered. All 8 are now registered and pass (128 tests across them after the change below).
* 1 stray root-level test is deliberately **not** registered (retired, below).
* 1 registered path (`src/domain/person/sectionOrder.test.js`) did not exist in any commit. It is now written from the documented contract.
* `src/testInventory.test.js` fails the suite if a test file is neither registered nor named as retired, or if a registered file is missing, so this cannot recur silently.

## Registered now
`src/domain/debt/dateDerivation`, `src/domain/debt/futureMoney`, `src/components/__tests__/PeriodSelector`,
`src/domain/bills/commitments`, `src/domain/transactions/vendorInsights`, `src/domain/financialCalendar/__tests__/calendarMonth`,
`src/domain/futureMoney/debtIntegration`, `src/screens/SchoolFeesScreen.helpers` (all `.test.js`).

## `src/domain/bills/commitments.test.js` — two failures, cause and fix
* **Cause:** three fixtures supply a card's due as `account._testSummary`, but the tests passed the real `getCardSummary`, which never read that field (it appears in no commit of production code). So a card due of ₹15,000 was invisible and the cases failed. The expectation itself is not obsolete.
* **What the code does now (statement-as-bill):** once a real statement Bill exists for a card, that Bill is the obligation and the synthetic card entry is not created; the synthetic entry only covers a card with no generated statement yet (`mapCcAccountToCommittedSpending`).
* **Fix:** `getCommitments` takes the card-summary function as an injected argument, so the tests now inject a stub that reads `_testSummary`. Both failing cases pass unchanged in intent, and a new case asserts that a card with a statement Bill gets no second synthetic entry.

## Retired, not registered: root `adapter.test.js`
It tests the root `adapter.js`, an early 255-line copy of `domain/allocations/adapter.js` (788 lines). Nothing imports the root file. The tests assert superseded behaviour (for example a household zero override falling through to the default), which contradicts the locked D4 rule that a zero override is valid. The live adapter is covered by the registered `domain/allocations/*.test.js`. The files are left on disk, not deleted; removing them is a separate cleanup.
