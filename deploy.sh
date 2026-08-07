#!/bin/bash
set -e
cd D:/arth-app
VERSION=$(date +"%d%m%y-%H%M")

# NOTE: this script no longer runs `git add -A`. Stage exactly the files
# you intend to deploy yourself first, e.g.:
#   git add src/main.jsx
#   git add domain/allocations/adapter.js domain/allocations/adapter.test.js
# Then run this script. This exists because a blanket `git add -A` once
# let a corrupted src/main.jsx ride along inside an unrelated commit
# undetected, and shipped a blank-screen production outage.

echo "== Staged for this deploy =="
git diff --cached --stat
echo ""

if git diff --cached --quiet; then
  echo "Nothing is staged. Stage your intended files first with 'git add <path>', then re-run this script."
  exit 1
fi

echo "== NOT staged (will be left OUT of this deploy) =="
git status --short | grep -v '^[AM] ' || echo "  (none — everything modified is staged)"
echo ""

read -p "Proceed with deploy of exactly the staged files above? (y/N) " confirm
if [[ "$confirm" != "y" && "$confirm" != "Y" ]]; then
  echo "Aborted — nothing committed, nothing deployed."
  exit 1
fi

git commit -m "v$VERSION — ${1:-deploy}"
git push
vercel --prod --force
echo ""
echo "Deployed as v$VERSION"
