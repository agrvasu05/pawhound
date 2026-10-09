#!/usr/bin/env bash
# One-shot Pinterest re-authorization for the posting pipeline.
#
#   bash scripts/reauth.sh
#
# 1. Asks for the app secret (App ID 1574960 → https://developers.pinterest.com/apps/1574960/
#    → "App secret key" → eye icon). It is written to .env.local only (gitignored).
# 2. Runs the OAuth flow: the consent URL opens in your default browser (it is also printed) — be logged into the
#    ValueFindsDaily Pinterest account and click Allow.
# 3. Stores the new refresh token in the GitHub repo secret and kicks off one
#    posting run so you can see pins land within minutes.
set -euo pipefail
cd "$(dirname "$0")/.."

REPO="agrvasu05/pawhound"
CLIENT_ID="${PINTEREST_CLIENT_ID:-1574960}"

if ! grep -q '^PINTEREST_CLIENT_SECRET=' .env.local 2>/dev/null; then
  read -r -s -p "Pinterest app secret for app ${CLIENT_ID}: " SECRET; echo
  touch .env.local
  grep -v '^PINTEREST_CLIENT_ID=\|^PINTEREST_CLIENT_SECRET=' .env.local > .env.local.tmp || true
  { cat .env.local.tmp; echo "PINTEREST_CLIENT_ID=${CLIENT_ID}"; echo "PINTEREST_CLIENT_SECRET=${SECRET}"; } > .env.local
  rm -f .env.local.tmp
fi

echo "→ Starting OAuth. Approve the request in the browser tab that opens."
node scripts/pinterest-auth.js

TOKEN=$(grep '^PINTEREST_REFRESH_TOKEN=' .env.local | cut -d= -f2-)
[ -n "$TOKEN" ] || { echo "No refresh token in .env.local — OAuth did not complete."; exit 1; }

echo "→ Saving the refresh token to GitHub secrets"
gh secret set PINTEREST_REFRESH_TOKEN --repo "$REPO" --body "$TOKEN"
gh secret set PINTEREST_PAT --repo "$REPO" --body "$(gh auth token)"

echo "→ Posting the first batch now (Ops → post-now)"
gh workflow run "Ops (manual maintenance tasks)" --repo "$REPO" -f task=post-now -f apply=false -f arg=""
echo "Done. Watch it at: https://github.com/$REPO/actions"
echo "Then run the board consolidation: gh workflow run 'Ops (manual maintenance tasks)' --repo $REPO -f task=consolidate-boards -f apply=true"
