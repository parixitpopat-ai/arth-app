#!/bin/bash
set -e
cd D:/arth-app

VERSION=$(date +"%d%m%y-%H%M")

git add -A

if ! git diff --cached --quiet; then
  git commit -m "v$VERSION — ${1:-force deploy}"
  git push
else
  echo "No local changes to commit — nothing was missing, redeploying current HEAD as-is."
fi

vercel --prod --force

echo ""
echo "Deployed as v$VERSION"
