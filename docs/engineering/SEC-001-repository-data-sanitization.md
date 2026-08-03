# SEC-001 — Repository Data Sanitization

`Opened 2026-08-01` · Status: **Engineering complete — governance decision (history rewrite) pending**
**Severity: High** *(reclassified from Critical — see below)* · Priority: **P0**

## Severity reclassification

Originally flagged Critical on ARCH-001 ("possible exposure of live financial data"), based on the presence of a `snapshot` key alone. After actually inspecting contents:

**Reclassified: High — repository hygiene issue involving development snapshot data containing limited personal identifiers.**

| | |
|---|---|
| ❌ Not live production financial history | `txns`/`bills`/`investments`/`loans` empty or near-empty in all 3 files |
| ❌ Not a catastrophic data leak | No full account numbers, no real transaction history |
| ✅ Real bank names | ICICI Savings, HDFC Sapphire, GPay, Cash Wallet |
| ✅ Real account last-4 digits | Present per account |
| ✅ Real personal name | One person entry with name + relation |
| ✅ Should not remain in git | Regardless of severity tier |


## What was found on inspection

`.claude/settings.local.json` — checked, clean. Just Claude Code tool-permission settings, no secrets. No action needed.

The two duplicate PDFs (`...vaf.pdf`, `...vaf (1).pdf`) — filename pattern suggests a personal document (visa application form). I did not open these; a personal identity document has no reason to be in a code repository regardless of content, so removal is warranted without needing to inspect it further.

## Executed

- [x] Added `arth-backup-*.json`, `arth-merged-*.json`, `arth-drive-export-*.json` patterns to `.gitignore`
- [x] Removed the 3 backup files from the working tree (`git rm --cached` + delete)
- [x] Confirmed `.claude/settings.local.json` contains no secrets

## Still needs you — cannot be executed from here

**The git history question.** I only have a local extracted copy of your repo in this session, not push access to your actual GitHub remote — so the removal above needs to be applied to your real repo, and the history decision is yours to make (it depends on who's had clone access, which I can't know):

```bash
cd /d/arth-app
# Apply the same removal + .gitignore update to your real working copy,
# then commit normally first:
git add .gitignore
git rm arth-backup-2026-04-09T17-20-12-916Z.json arth-merged-2026-04-12.json arth-drive-export-2026-04-09T17-31-17-788Z.json
git commit -m "sec: remove app data backups from repo, gitignore the pattern (SEC-001)"
git push
```

**Then decide on history.** If this repo has ever been public, or cloned by anyone beyond you, the files above are still recoverable from history after a normal commit. To actually purge them:

```bash
# Requires git-filter-repo (pip install git-filter-repo or brew install git-filter-repo)
git filter-repo --path arth-backup-2026-04-09T17-20-12-916Z.json --path arth-merged-2026-04-12.json --path arth-drive-export-2026-04-09T17-31-17-788Z.json --invert-paths
# This rewrites history - requires a force-push and anyone else with a clone
# must re-clone (their local history will diverge otherwise).
git push origin --force --all
```

Given what's actually in these files (metadata + one name, not full transaction history), I'd call this a judgment call rather than an emergency — but it's still yours to make, not mine.

## Acceptance criteria

- [x] Sensitive files no longer in working tree, gitignored going forward
- [ ] Decision recorded in EDL on whether history was rewritten and why — **pending your call above**
- [x] `.claude/settings.local.json` reviewed — clean
- [x] PDF files flagged for removal on the same principle

