#!/usr/bin/env bash
# One-time Cloudflare Pages setup for valuefindsdaily.com.
#
#   bash scripts/cf-setup.sh
#
# Before running: Cloudflare dashboard → My Profile → API Tokens → Create Token
# → "Create Custom Token" → Permissions: Account › Cloudflare Pages › Edit
# → Account Resources: your account → Create → copy the token.
#
# The script finds your account id itself, stores both values as GitHub
# secrets, and starts the first deploy. Nothing is printed or written to disk.
set -euo pipefail
cd "$(dirname "$0")/.."
REPO="agrvasu05/pawhound"

read -r -s -p "Cloudflare API token (Account › Cloudflare Pages › Edit): " CF_TOKEN; echo
CF_TOKEN="$(printf '%s' "$CF_TOKEN" | tr -d '[:space:]')"

echo "→ Checking the token and finding your account id"
ACCOUNTS=$(curl -s -H "Authorization: Bearer ${CF_TOKEN}" "https://api.cloudflare.com/client/v4/accounts?per_page=50")
ACCOUNT_ID=$(printf '%s' "$ACCOUNTS" | python3 -c '
import json,sys
d=json.load(sys.stdin)
if not d.get("success"): sys.exit("Token rejected: " + json.dumps(d.get("errors"))[:200])
acc=d.get("result") or []
if not acc: sys.exit("Token has no account access. Add Account > Cloudflare Pages > Edit.")
for a in acc: print(a["id"], a["name"], file=sys.stderr)
print(acc[0]["id"])')
echo "→ Using account ${ACCOUNT_ID}"

gh secret set CLOUDFLARE_API_TOKEN --repo "$REPO" --body "$CF_TOKEN"
gh secret set CLOUDFLARE_ACCOUNT_ID --repo "$REPO" --body "$ACCOUNT_ID"
echo "→ Secrets saved. Starting the first deploy (uploads ~900 MB once; 10–20 min)."
gh workflow run "Deploy site (Cloudflare Pages)" --repo "$REPO"

cat <<'NEXT'

Two dashboard steps once the deploy run is green
(https://github.com/agrvasu05/pawhound/actions):

 1. Cloudflare → Workers & Pages → valuefindsdaily → Custom domains
    → Set up a custom domain → valuefindsdaily.com, then again for
    www.valuefindsdaily.com. Cloudflare swaps the DNS records itself.

 2. Same project → Settings → Variables and Secrets → add
    MAILERLITE_API_KEY and MAILERLITE_GROUP_ID (values are in Netlify →
    Site configuration → Environment variables) → then re-run the deploy
    workflow once so the email form picks them up.

After the domain shows "Active", delete the site in Netlify.
NEXT
