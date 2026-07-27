# Arth Engineering Documentation Index

## Core Documents (Read First)

1. **`DOCS_INDEX.md`** — this file. Navigation guide for all engineering
   documentation.
2. **`CODING_STANDARDS.md`** — engineering principles, both extraction
   checklists (screen-level and function-level), and lessons learned.
3. **`architecture/ARCHITECTURE_DECISIONS.md`** — ADR-lite log of intentional design
   choices and why they were made. Includes ADR-022 (Forecast Status
   Classifier) and ADR-023 (Commitments are first-class citizens).
4. **`DEPENDENCY_MAP.md`** — current dependency measurements,
   classifications, and extraction status.

## Design Phase Documents (new — this covers the full ADS v2.0 effort)

Everything below was produced during the Arth v2.0 architecture →
UX Bible → wireframe → high-fidelity design process. Read
`architecture/ARTH_V2_IA.md` first if you're new to this set — it's the
frozen source of truth everything else builds on.

### `architecture/`
- **`ARTH_V2_IA.md`** — frozen Information Architecture (5 domains, 7 engines, drawer structure)
- **`ARCHITECTURE_DECISIONS.md`** — all ADRs (see Core Documents above)
- **`SCREEN_REGISTRY.md`** — permanent version identity for every screen (134 registered items)
- **`SPRINT_PLAN.md`** — the sprint roadmap, Development Principle, Stop Work Rule
- **`SPRINT_3.5_DEPENDENCY_MATRIX.md`** — engine consumption matrix, screen-blocking matrix

### `ux-bible/`
Full per-screen specifications (Purpose/Owner Engine/Priority/Complexity/
Migration Impact/Acceptance Criteria), one file per module batch:
- `UX_BIBLE_H001_HOME_DASHBOARD.md`, `UX_BIBLE_HOME_SPRINT_H002-H008.md`, `UX_BIBLE_HOME_SPRINT_H009-H015.md`
- `UX_BIBLE_MONEY_SPRINT_M001-M022.md`
- `UX_BIBLE_OUTLOOK_SPRINT_O001-O020.md`
- `UX_BIBLE_INSIGHTS_SPRINT_I001-I015.md`
- `UX_BIBLE_SETTINGS_SPRINT_S001-S011.md`
- `UX_BIBLE_SHARED_COMPONENTS.md`
- `UX_BIBLE_MODULE_COMPLETION_SUMMARY.md` — executive dashboard, read this for a fast status overview

### `ads/` (Arth Design Specification appendices)
- `ADS_SHARED_DESIGN_PATTERNS.md` — PAT-001 through PAT-014, plus the frozen Outlook rules, Commitment Timeline convention, and Three Action Types convention
- `ADS_APPENDIX_A_USER_JOURNEYS.md` — J001-J028, 4 fully detailed
- `ADS_APPENDIX_B_BUSINESS_RULES.md` — 23 global rules, each traceable to its source decision
- `ADS_APPENDIX_C_NAVIGATION_ARCHITECTURE.md` — navigation map, cross-module flows, deep links

### `design-system/`
- `design_system_v2.html` — colors, typography, spacing, radius, elevation, chart system, form components, card catalogue, CMP-001 through CMP-016 component registry

### `wireframes/`
HTML mockup files — open directly in a browser, not meant to be read as text:
- `money_sheet1-4_*.html` (low-fidelity)
- `outlook_sheet1-5_*.html` (low-fidelity)
- `insights_sheet1-3_*.html`, `settings_sheet1-2_*.html` (low-fidelity)
- `hifi_home_pack.html`
- `hifi_money_HF001.html` through `HF004.html` (high-fidelity, Money — 🟢 module frozen)
- `hifi_outlook_HF005A.html` through `HF005E.html`, plus `hifi_outlook_O014_final.html` (high-fidelity, Outlook — 🟢 module frozen)

### `screens/InsuranceScreen.jsx` — confirmed live, corrected from earlier docs

Built outside this design process. `AddInsurancePolicyModal`,
`InsurancePolicyListModal`, `InsurancePolicyDetailModal` all real, wired
in App.jsx around line 14784-14786. Archive status real
(`p.status!=="archived"`). Every doc above that referenced Insurance as
"New/doesn't exist" has been corrected — if you find one that hasn't,
that's a doc bug, file an issue against it.

## Design Documents

Describe planned architecture and implementation approaches — not yet
fully built, or built but still evolving.

- **`USE_ARTH_DATA_DESIGN.md`** — the shared data layer's design spec.
  Design only, not yet implemented.
- **`COMPONENT_INVENTORY.md`** — UI primitives audit: what's real, what's
  shared styling but not a component, what's still duplicated.
- **`EXTRACTION_CHECKLIST.md`** — the 8-point checklist every screen
  extraction must pass.

## Product

- **`ARTH_SCOPE.md`** — what's in scope for V1 vs. deferred to V2.
- **`RELEASE_NOTES.md`** — user-facing history: what's new, improved,
  fixed, known limitations.
- **`SCREEN_ARCHITECTURE.md`** — per-screen status and implementation
  notes.

---

## Living Documents

Evolve continuously during development — expect to edit these often.

- `CODING_STANDARDS.md`
- `DEPENDENCY_MAP.md`
- `COMPONENT_INVENTORY.md`
- `REGRESSION_CHECKLIST.md`
- `TECH_DEBT.md`
- `ux-bible/UX_BIBLE_MODULE_COMPLETION_SUMMARY.md` — update as each module freezes

## Historical Record

Record *why* and *when* — append to these, don't rewrite history in them.

- `architecture/ARCHITECTURE_DECISIONS.md`
- `CHANGELOG.md`
- `RELEASE_NOTES.md`

---

## Document Ownership

| Document | Purpose |
|---|---|
| `CODING_STANDARDS.md` | Rules |
| `DEPENDENCY_MAP.md` | Measurements |
| `CHANGELOG.md` | Completed work (developer-facing) |
| `RELEASE_NOTES.md` | Completed work (user-facing) |
| `TECH_DEBT.md` | Known defects, deferred engineering work |
| `architecture/ARCHITECTURE_DECISIONS.md` | Design rationale |
| `REGRESSION_CHECKLIST.md` | Release verification |
| `COMPONENT_INVENTORY.md` | UI primitive audit |
| `USE_ARTH_DATA_DESIGN.md` | Data layer design |
| `SCREEN_ARCHITECTURE.md` | Per-screen status |
| `ARTH_SCOPE.md` | Product scope |
| `EXTRACTION_CHECKLIST.md` | Extraction process |
| `architecture/ARTH_V2_IA.md` | Frozen Information Architecture |
| `ux-bible/*` | Per-screen UX specifications |
| `ads/*` | Cross-cutting design system, journeys, rules, navigation |
| `design-system/design_system_v2.html` | Visual tokens + component registry |
| `wireframes/*` | Visual mockups (low- and high-fidelity) |

---

## Current Milestone

**Name:** Arth v2.0 — Design phase (Money + Outlook frozen), real code
partially caught up to spec

**Status:**
- 🟢 **Money Module** — Specification ✅ · Wireframes ✅ · High-fidelity ✅ · Design System compliant ✅ (M001-M022)
- 🟢 **Outlook Module** — same, all 4 layers ✅ (O001-O020), Freeze Checklist passed
- ⏳ **Home** — specified, low-fidelity wireframed; high-fidelity refinement pass pending (orchestration layer between Money/Outlook)
- ⏳ **Insights** — specified, low-fidelity wireframed; blocked on Analytics Engine (doesn't exist)
- ⏳ **Settings** — specified, low-fidelity wireframed

**Real code shipped and confirmed live** (verified via Vercel deployment
history + `git log`, not assumed):
- Sprint 1 — drawer reorg, bottom nav migration (Home/Money/Add/Outlook/Insights)
- Money Hub — ⚠️ not confirmed in deployment history, verify directly
- Backup rotation bug fix (pre-sync/daily pools were sharing one 3-slot pool)
- Multi-device sync conflict bug fix
- Forecast Engine — `calculateCommittedOutflow`/`ProjectedBalance`/`SafeToSpend` now real (`calculateRecognition` still blocked on Bill schema)
- **Insurance entity** — built outside this design process, confirmed live via grep (`InsuranceScreen.jsx`)
- Biller picker two-step hierarchy fix — built outside this design process, not yet reviewed against docs

**Next**
1. Confirm whether Money Hub actually deployed (flagged gap above)
2. Home high-fidelity refinement pass (orchestration between Money/Outlook)
3. Analytics Engine — prerequisite for all 15 Insights screens
4. Review the biller picker fix and any other out-of-band changes against the docs, same method as the Insurance correction

**Blocked by**
- Insights entirely blocked on Analytics Engine (doesn't exist yet)
- `calculateRecognition` blocked on Bill schema (`recognitionMethod`/`recognitionDuration` fields don't exist)

---

## Documentation Maintenance Rules

Every architectural extraction should update:
- `CHANGELOG.md`
- `DEPENDENCY_MAP.md`
- `COMPONENT_INVENTORY.md` — if applicable (a UI primitive was touched)
- `architecture/ARCHITECTURE_DECISIONS.md` — if an intentional design decision was made
- `REGRESSION_CHECKLIST.md` — if runtime behavior requires verification

`TECH_DEBT.md` should only be updated for known defects or deliberately
deferred engineering work — never for intentional decisions (those go in
`architecture/ARCHITECTURE_DECISIONS.md` instead).

**New rule from this phase:** whenever code is found to have shipped
outside this design process (like Insurance was), correct every doc that
referenced it as "New/not built" in the same pass — don't let the
UX Bible silently drift from what `grep` actually shows. Verify with
`grep -n "<feature>" App.jsx` before updating status, same method used
throughout.

## How to Use These Documents

Before making architectural changes:

1. Read `CODING_STANDARDS.md`.
2. Check `DEPENDENCY_MAP.md` for current measurements.
3. Review relevant ADRs in `architecture/ARCHITECTURE_DECISIONS.md`.
4. Make the change.
5. Run the regression checklist.
6. Update all affected documentation listed in this index.

This keeps the engineering documentation synchronized with the codebase.

## Reading order for someone new to the project

1. `ARTH_SCOPE.md` — what Arth is
2. `architecture/ARTH_V2_IA.md` — the frozen Information Architecture
3. `ux-bible/UX_BIBLE_MODULE_COMPLETION_SUMMARY.md` — fast status overview
4. `SCREEN_ARCHITECTURE.md` — what's built
5. `architecture/ARCHITECTURE_DECISIONS.md` — why it's built this way
6. `CODING_STANDARDS.md` — how to add to it correctly
7. Everything else, as needed
