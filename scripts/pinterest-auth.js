/**
 * pinterest-auth.js — run ONCE locally to get Pinterest tokens
 * Usage: node scripts/pinterest-auth.js
 *
 * Boards are created automatically by 5-post-pins.js — no manual selection needed.
 */

require('dotenv').config({ path: require('path').resolve(process.cwd(), '.env.local') });

const http = require('http');
const https = require('https');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const CLIENT_ID = process.env.PINTEREST_CLIENT_ID;
const CLIENT_SECRET = process.env.PINTEREST_CLIENT_SECRET;
const REDIRECT_URI = 'http://localhost:3737/callback';

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error('\nMissing PINTEREST_CLIENT_ID or PINTEREST_CLIENT_SECRET in .env.local');
  console.error('Add these lines to .env.local:');
  console.error('  PINTEREST_CLIENT_ID=1574960');
  console.error('  PINTEREST_CLIENT_SECRET=your_secret_here\n');
  process.exit(1);
}

function generateCodeVerifier() {
  return crypto.randomBytes(32).toString('base64url');
}
function generateCodeChallenge(v) {
  return crypto.createHash('sha256').update(v).digest('base64url');
}

function pinterestPost(endpoint, body) {
  return new Promise((resolve, reject) => {
    const auth = 'Basic ' + Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64');
    const payload = new URLSearchParams(body).toString();
    const options = {
      hostname: 'api.pinterest.com',
      path: endpoint,
      method: 'POST',
      headers: {
        Authorization: auth,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(payload),
      },
    };
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => { try { resolve(JSON.parse(data)); } catch { reject(new Error(data)); } });
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

(async () => {
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = generateCodeChallenge(codeVerifier);
  const state = crypto.randomBytes(8).toString('hex');

  // boards:write needed so the posting script can auto-create boards
  const authUrl =
    `https://www.pinterest.com/oauth/` +
    `?client_id=${CLIENT_ID}` +
    `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}` +
    `&response_type=code` +
    `&scope=boards:read,boards:write,pins:read,pins:write,user_accounts:read` +
    `&state=${state}` +
    `&code_challenge=${codeChallenge}` +
    `&code_challenge_method=S256`;

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  Pinterest OAuth Setup');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('\nOpen this URL in your browser (WeValue account):\n');
  console.log('  ' + authUrl);
  console.log('\nApprove the permissions — you will be redirected to localhost automatically.\n');

  const code = await new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const url = new URL(req.url, 'http://localhost:3737');
      if (url.searchParams.get('state') !== state) {
        res.end('State mismatch.'); server.close(); reject(new Error('State mismatch')); return;
      }
      res.end('<h2 style="font-family:sans-serif;padding:40px">✅ Done! Close this tab and go back to the terminal.</h2>');
      server.close();
      resolve(url.searchParams.get('code'));
    });
    server.listen(3737, () => console.log('Waiting for Pinterest callback on localhost:3737 ...\n'));
    server.on('error', reject);
  });

  console.log('✓ Got code. Exchanging for tokens...');

  const tokenRes = await pinterestPost('/v5/oauth/token', {
    grant_type: 'authorization_code',
    code,
    redirect_uri: REDIRECT_URI,
    code_verifier: codeVerifier,
  });

  if (!tokenRes.access_token) {
    console.error('Token exchange failed:', JSON.stringify(tokenRes, null, 2));
    process.exit(1);
  }

  const { access_token, refresh_token } = tokenRes;

  // Save to .env.local
  const envPath = path.resolve(process.cwd(), '.env.local');
  let env = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf-8') : '';
  const upsert = (c, k, v) => {
    const r = new RegExp(`^${k}=.*$`, 'm');
    return r.test(c) ? c.replace(r, `${k}=${v}`) : c + `\n${k}=${v}`;
  };
  env = upsert(env, 'PINTEREST_CLIENT_ID', CLIENT_ID);
  env = upsert(env, 'PINTEREST_CLIENT_SECRET', CLIENT_SECRET);
  env = upsert(env, 'PINTEREST_ACCESS_TOKEN', access_token);
  env = upsert(env, 'PINTEREST_REFRESH_TOKEN', refresh_token);
  fs.writeFileSync(envPath, env.trimStart());

  console.log('\n✅ Tokens saved to .env.local\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  Add these 4 secrets to GitHub:');
  console.log('  https://github.com/agrvasu05/pawhound/settings/secrets/actions');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`\n  PINTEREST_CLIENT_ID      = ${CLIENT_ID}`);
  console.log(`  PINTEREST_CLIENT_SECRET  = ${CLIENT_SECRET}`);
  console.log(`  PINTEREST_REFRESH_TOKEN  = ${refresh_token}`);
  console.log('\n  Also create a GitHub PAT at https://github.com/settings/tokens');
  console.log('  (select: repo → secrets permission) and add it as:');
  console.log('  PINTEREST_PAT = <your PAT>\n');
  console.log('Then run: node scripts/5-post-pins.js\n');
})();
