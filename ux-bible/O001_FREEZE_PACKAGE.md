# O001 Freeze Package

**Status: 🟢 Validated → 🔒 Frozen** (behavior), **🟡 Deferred** (code
architecture) — same multi-area model as H001.

---

## 1. UX Spec (Revision 2)

**Screen ID:** O001 | **Module:** Outlook | **Priority:** P0

**Purpose:** Answers "Can I comfortably get through what's ahead?" —
the flagship of the Outlook domain, built on the same Safe to Spend /
Forecast Status foundation as Home's compact version, but with the
full detail (Explanation Panel, grouped Commitments, Timeline).

**Layout, actual render order:**
```
Header (shared branding, not Home-specific)
  |
Safe to Spend + Forecast Status
  |
Forecast Timeline
  |
Forecast Status banner
  |
Grouped Commitments (Overdue / Due Today / Next 7 Days / Later)
  |
Budget Progress link
  |
What Changed (Facts tier)
```

---

## 2. Architecture Diagram

```
Outlook Dashboard (O001)
├── Safe to Spend + Protected Money split [ADR-024]
├── Forecast Status classifier [ADR-022]
├── Forecast Timeline (buildCashFlowTimeline — real engine call)
├── Grouped Commitments (Overdue/DueToday/Next7/Later)
├── Budget Progress entry point
└── What Changed (wealthSnapshots-based)
```

---

## 3. Widget Registry

Outlook doesn't have a customization/hide system like Home's — every
section is currently always-visible, no equivalent to `hiddenCards`
exists for this screen. Not a gap being tracked as debt (Home's
customization was a specific, requested feature); just a real,
noted difference between the two screens' capabilities.

---

## 4. Data Mapping — and the direct comparison to H001

| Element | Claimed source | **Actual source (verified)** |
|---|---|---|
| Opening Balance | Balance Engine | Real filter logic (bank/cash/upi, excl. investments) — **identical code to Home's, duplicated, not shared (AD-002)** |
| SIP/CC merge into forecast | Forecast Engine | Real, inline in `OutlookPage` — **also duplicated in Home's Protected Money calculation, separately** |
| `calculateProjectedBalance` / `buildCashFlowTimeline` | Forecast Engine (`engine.js`) | **Real engine.js function calls** — confirmed, unlike Home |
| Safe to Spend (budget-based) | Forecast Engine | Same `monthBudget − monthSpend` formula as Home, **computed inline here too, not shared** |
| Forecast Status | ADR-022 classifier | Real, inline — thresholds hardcoded (AD-007) |

**The key finding, confirming the hypothesis that prompted this
package:** O001 and H001 **do** duplicate the same opening-balance and
commitment-merging logic, exactly as predicted. But O001 goes one step
further than Home — it actually calls the real `engine.js` functions
(`calculateProjectedBalance`, `buildCashFlowTimeline`) for the
timeline/projection, while **Home's Protected Money never reaches
`engine.js` at all** — it stops at a simple `.reduce()` sum. So the
duplication isn't just "the same logic copy-pasted twice" — it's
**two different levels of engine integration for the same concept**,
which is arguably a more important finding than the plain duplication
itself. Recorded as a refinement to AD-002, not a new debt item.

---

## 5. Interaction Map

| Element | Action |
|---|---|
| Safe to Spend card | (already on this screen — no further navigation) |
| Bill/SIP/CC row in grouped Commitments | `setEditingBill(b)` for real bills; synthetic SIP/CC rows are display-only (guarded, confirmed working) |
| Budget Progress card | `setTab("budget")` |
| What Changed | informational only, no tap action |

---

## 6. Component Map

Same finding as H001 — no dedicated `SummaryCard`/`CommitmentCard`
component exists; everything uses the `card` style token inline.
CMP-016 (Commitment Card, from the design phase) was never actually
implemented in code — the grouped Commitments list uses a simpler
inline `BillRow`, not the richer CMP-016 shape (icon/frequency/status
chip) designed earlier. Real gap between design and code, consistent
with the pattern this whole Freeze Package process exists to catch.

---

## 7. Developer Notes

- Real, working: Forecast Status classifier, SIP/CC merge into Safe to Spend, grouped Commitments by urgency, Budget entry point restoration (a real regression fix from earlier)
- **New debt confirmed by this comparison:** AD-002 should be understood as two-tiered — Home's version is shallower (no real engine.js calls) than Outlook's. Fixing the duplication should standardize on Outlook's deeper integration, not Home's shallower one.
- **New debt, not previously in the register:** CMP-016 (Commitment Card) was designed but never implemented — the real grouped Commitments list uses a simpler ad-hoc row, not the richer designed component.

---

## O001 Status

| Area | Status |
|---|---|
| UX | 🔒 Frozen |
| Visual Design | 🔒 Frozen |
| Navigation | 🔒 Frozen |
| Business Rules | 🔒 Frozen |
| Code Architecture | 🟡 Deferred — AD-002 (refined), AD-003, new: CMP-016 never implemented |
