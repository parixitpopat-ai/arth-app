# Sprint 3E, Part A — Settings (S001–S011), v2

Restructured into Profile / Manage / Data / Preferences / Help. Full
template per screen. Cross-references existing specs rather than
duplicating them (e.g. Accounts = M008) to avoid two docs drifting apart.

```
Settings
  Profile
  Manage: Accounts, Categories, People, Groups, Insurance, Vehicles, Property
  Data: Import, Export, Backup, Sync
  Preferences: Theme, Currency, Notifications, Security
  Help: Release Notes, Feedback, About
```

---

# S001 — Settings Dashboard
**Current Status:** Existing, restructured this sprint into the 5 sections above.
**Purpose:** Entry point to Profile, Manage, Data, Preferences, Help.
**Owner Engine:** Settings (config only)
**Business Rules:** Manage is not itself a screen — tapping an item opens that module directly (ADR-021). Four content sections plus Profile, none nested inside another.
**Navigation:** Drawer → Settings → any section
**Error States:** N/A (static navigation list)
**Empty States:** N/A
**Acceptance Criteria:** all 5 sections present; every item routes to a real destination, no dead links.
**Complexity:** S | **Migration Impact:** None — navigation-only, already shipped this session.

---

# S002 — Profile
**Current Status:** Partial — a basic "Me / My Arth" identity exists (confirmed in the app's drawer header); no dedicated editable profile screen.
**Purpose:** User's own identity within Arth (name, avatar) — distinct from financial data.
**Owner Engine:** Settings
**Business Rules:** profile data is presentation-only, never used in any financial calculation.
**Navigation:** Settings → Profile
**Empty States:** default avatar/name shown if never customized.
**Acceptance Criteria:** name/avatar editable and persist.
**Complexity:** S | **Migration Impact:** None — additive, no schema conflicts.

---

## Manage

# S003 — Accounts
**Cross-reference:** Same screen as **M008** (Money module) — one implementation, two entry points, not a duplicate. See M008 for full spec.
**Current Status:** Existing.
**Complexity:** S | **Migration Impact:** None.

# S004 — Categories
**Current Status:** Existing as separate scattered lists; Refactor needed to present as one unified hub.
**Business Rules:** per ADR-021, a hub over multiple independent tables (Expense, Income Types, Account Types, Asset Types, Liability Types, Investment Types, Bill Types, Payment Methods). **Never merge into one database table** — the hub is presentation-only.
**Acceptance Criteria:** all 8 category families reachable from one entry point; none accidentally merged into a shared table.
**Complexity:** M | **Migration Impact:** Presentation-layer unification only.

# S005 — People
**Current Status:** Existing — mature system (settlements, gifts, debt transfer) reached via its own tab today; needs this Manage entry point added.
**Navigation:** Settings → Manage → People (new entry point to the existing `people` tab).
**Complexity:** S | **Migration Impact:** None — navigation only.

# S006 — Groups
**Current Status:** Existing, same basis as People — Manage owns the definition only (id/name/icon/members/description); all settlement/split/balance behavior belongs to the relevant engine (ADR-021 "nouns vs verbs" rule).
**Complexity:** S | **Migration Impact:** None.

# S007 — Insurance
**Cross-reference:** **O011** (Outlook) for the Premium/Bill side; this is the Manage/Policy side.
**Current Status:** **Existing — confirmed live.** `InsuranceScreen.jsx` exists as its own extracted file (matching GoalsScreen/EventsScreen/ExpectedIncomeScreen's pattern), with `AddInsurancePolicyModal`, `InsurancePolicyListModal`, `InsurancePolicyDetailModal` all wired in. Archive is real too — the list filters `p.status!=="archived"`. **Built outside this design process** (confirmed via `git log` + live grep, not documented here first) — this correction reflects reality catching up to the spec, not the other way around.
**Business Rules:** Policy → Bill → Transaction, never Policy → Transaction directly (UX-004's core rule) — not yet verified whether the live implementation actually enforces this; worth checking directly.
**Complexity:** ~~XL~~ N/A — already built. | **Migration Impact:** None remaining.

# S008 — Vehicles
**Cross-reference:** Same screen as **M019/M020**.
**Current Status:** Existing.
**Complexity:** S | **Migration Impact:** Shares M019's flagged gap (`purchaseValue` field missing).

# S009 — Property
**Cross-reference:** Same placeholder as **M021**.
**Current Status:** New (placeholder only).
**Complexity:** XL | **Migration Impact:** Same as M021 — new entity, CRUD, valuation logic, Net Worth integration.

---

## Data

# S010 — Import
**Current Status:** **New — confirmed nowhere in the app**, no fake link exists anywhere (deliberate).
**Complexity:** L | **Migration Impact:** Genuinely new file-parsing/mapping flow.

# S011 — Export
**Current Status:** Existing (CSV).
**Complexity:** S | **Migration Impact:** None.

# S012 — Backup
**Current Status:** Existing, **hardened this session** — pre-sync and daily-auto backups now use independent rotation pools (previously shared one 3-slot pool, which directly caused a real data-loss incident this session).
**Error States:** conflict/rotation edge cases now handled — see ADR/session notes for the specific bug history.
**Complexity:** S | **Migration Impact:** None further — already shipped.

# S013 — Sync
**Current Status:** Existing, **hardened this session twice** — (1) pending-push flush before pull, (2) sync-conflict flag blocking auto-push until explicitly resolved, with "Sync Now" now genuinely force-pulling on a second tap.
**Complexity:** S | **Migration Impact:** None further.

---

## Preferences

# S014 — Theme
**Cross-reference:** Same as the old S002 (Appearance).
**Current Status:** Existing (Dark Mode, Auto-suggest Category).
**Complexity:** S | **Migration Impact:** None.

# S015 — Currency
**Current Status:** Existing (INR symbol/formatting already used throughout; a currency-selection UI itself not separately confirmed — likely fixed to INR today).
**Complexity:** S | **Migration Impact:** If multi-currency is ever wanted, that's an L/XL — flagging the distinction rather than assuming.

# S016 — Notifications
**Cross-reference:** **H009** (Notification Centre) for the full experience; this is the preferences/toggle side.
**Current Status:** Existing.
**Complexity:** S | **Migration Impact:** Will need to point at O016's centralized alert source once that migration lands, same as H009.

# S017 — Security
**Current Status:** Existing (PIN & Lock).
**Business Rules:** PIN never leaves the device — explicitly excluded from cloud backup payloads.
**Complexity:** S | **Migration Impact:** None.

---

## Help

# S018 — Release Notes
**Cross-reference:** Same as old S011 (About's release-notes content).
**Current Status:** Existing.
**Complexity:** S | **Migration Impact:** None.

# S019 — Feedback
**Current Status:** New — no in-app feedback mechanism confirmed to exist.
**Complexity:** M | **Migration Impact:** New, but low-risk (no financial logic involved).

# S020 — About
**Current Status:** Existing.
**Complexity:** S | **Migration Impact:** None.

---

## Settings Module Summary

| Status | Count |
|---|---|
| Existing | 13 |
| Partial | 1 (Profile) |
| Refactor | 1 (Categories) |
| New | 5 (Insurance, Property, Import, Feedback + noting Currency's untested multi-currency scope) |

**Settings remains the most stable module overall** — the two genuinely
large new items (Insurance XL, Property XL) are the *same* two gaps
already flagged in Money and Outlook, not new discoveries — confirms
those three module specs are consistent with each other rather than
contradicting.

## Settings Module Completion Scorecard

| Category | Status |
|---|---|
| Architecture | ✅ |
| UX Spec | ✅ |
| Wireframe | ⏳ |
| High Fidelity | ⏳ |
| Development | ⏳ |
| QA | ⏳ |
