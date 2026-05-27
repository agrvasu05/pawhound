/**
 * pinterest-auth.js — run ONCE locally to get your Pinterest access + refresh tokens
 * Usage: node scripts/pinterest-auth.js
 *
 * It will:
 *  1. Open a local server on port 3001 to catch the OAuth callback
 *  2. Print an auth URL — open it in your browser and approve
 *  3. Exchange the code for tokens
 *  4. List your boards so you can pick the right one
 *  5. Save everything to .env.local
 */

require('dotenv').config({ path: require('path').resolve(process.cwd(), '.env.local') });

const http = require('http');
const https = require('https');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

const CLIENT_ID = process.env.PINTEREST_CLIENT_ID;
const CLIENT_SECRET = process.env.PINTEREST_CLIENT_SECRET;
const REDIRECT_URI = 'http://localhost:3001/callback';

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error('\nMissing PINTEREST_CLIENT_ID or PINTEREST_CLIENT_SECRET in .env.local');
  console.error('Add these lines to .env.local:');
  console.error('  PINTEREST_CLIENT_ID=your_app_id_here');
  console.error('  PINTEREST_CLIENT_SECRET=your_app_secret_here\n');
  process.exit(1);
}

// ── PKCE helpers ──────────────────────────────────────────────────────────────
function generateCodeVerifier() {
  return crypto.randomBytes(32).toString('base64url');
}

function generateCodeChallenge(verifier) {
  return crypto.createHash('sha256').update(verifier).digest('base64url');
}

// ── Pinterest API helpers ─────────────────────────────────────────────────────
function pinterestPost(endpoint, body, accessToken) {
  return new Promise((resolve, reject) => {
    const isTokenEndpoint = endpoint === '/v5/oauth/token';
    const auth = isTokenEndpoint
      ? 'Basic ' + Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64')
      : `Bearer ${accessToken}`;

    const payload = isTokenEndpoint
      ? new URLSearchParams(body).toString()
      : JSON.stringify(body);

    const contentType = isTokenEndpoint
      ? 'application/x-www-form-urlencoded'
      : 'application/json';

    const options = {
      hostname: 'api.pinterest.com',
      path: endpoint,
      method: 'POST',
      headers: {
        Authorization: auth,
        'Content-Type': contentType,
        'Content-Length': Buffer.byteLength(payload),
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch { reject(new Error(data)); }
      });
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

function pinterestGet(endpoint, accessToken) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.pinterest.com',
      path: endpoint,
      method: 'GET',
      headers: { Authorization: `Bearer ${accessToken}` },
    };
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch { reject(new Error(data)); }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

function prompt(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => rl.question(question, (ans) => { rl.close(); resolve(ans.trim()); }));
}

// ── Main flow ─────────────────────────────────────────────────────────────────
(async () => {
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = generateCodeChallenge(codeVerifier);
  const state = crypto.randomBytes(8).toString('hex');

  const authUrl =
    `https://www.pinterest.com/oauth/` +
    `?client_id=${CLIENT_ID}` +
    `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}` +
    `&response_type=code` +
    `&scope=boards:read,pins:write,user_accounts:read` +
    `&state=${state}` +
    `&code_challenge=${codeChallenge}` +
    `&code_challenge_method=S256`;

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  Pinterest OAuth Setup');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('\n1. Open this URL in your browser (the WeValue account):\n');
  console.log('  ' + authUrl);
  console.log('\n2. Approve the permissions.');
  console.log('3. You will be redirected to localhost — the script handles the rest.\n');

  // Start local callback server
  const code = await new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const url = new URL(req.url, 'http://localhost:3001');
      const returnedState = url.searchParams.get('state');
      const returnedCode = url.searchParams.get('code');

      if (returnedState !== state) {
        res.end('State mismatch — please try again.');
        server.close();
        reject(new Error('State mismatch'));
        return;
      }

      res.end('<h2 style="font-family:sans-serif;padding:40px">✅ Authorised! You can close this tab and go back to the terminal.</h2>');
      server.close();
      resolve(returnedCode);
    });
    server.listen(3001, () => console.log('Waiting for Pinterest to redirect to localhost:3001 ...\n'));
    server.on('error', reject);
  });

  console.log('✓ Got authorisation code. Exchanging for tokens...');

  // Exchange code for tokens
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
  console.log('✓ Access token received.');

  // List boards
  console.log('\nFetching your Pinterest boards...\n');
  const boardsRes = await pinterestGet('/v5/boards?page_size=25', access_token);
  const boards = boardsRes.items || [];

  if (boards.length === 0) {
    console.error('No boards found on this account. Create a board on Pinterest first.');
    process.exit(1);
  }

  console.log('Your boards:');
  boards.forEach((b, i) => console.log(`  [${i + 1}] ${b.name}  (ID: ${b.id})`));

  const pick = await prompt('\nWhich board number should pins be posted to? ');
  const boardIndex = parseInt(pick) - 1;
  const board = boards[boardIndex];
  if (!board) { console.error('Invalid selection.'); process.exit(1); }

  console.log(`\n✓ Selected board: "${board.name}" (${board.id})`);

  // Save to .env.local
  const envPath = path.resolve(process.cwd(), '.env.local');
  let envContent = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf-8') : '';

  const upsert = (content, key, value) => {
    const regex = new RegExp(`^${key}=.*$`, 'm');
    const line = `${key}=${value}`;
    return regex.test(content) ? content.replace(regex, line) : content + `\n${line}`;
  };

  envContent = upsert(envContent, 'PINTEREST_CLIENT_ID', CLIENT_ID);
  envContent = upsert(envContent, 'PINTEREST_CLIENT_SECRET', CLIENT_SECRET);
  envContent = upsert(envContent, 'PINTEREST_ACCESS_TOKEN', access_token);
  envContent = upsert(envContent, 'PINTEREST_REFRESH_TOKEN', refresh_token);
  envContent = upsert(envContent, 'PINTEREST_BOARD_ID', board.id);

  fs.writeFileSync(envPath, envContent.trimStart());

  console.log('\n✅ Tokens saved to .env.local');
  console.log('\nNow add these to your GitHub repository secrets:');
  console.log('  PINTEREST_CLIENT_ID        =', CLIENT_ID);
  console.log('  PINTEREST_CLIENT_SECRET    =', CLIENT_SECRET);
  console.log('  PINTEREST_REFRESH_TOKEN    =', refresh_token);
  console.log('  PINTEREST_BOARD_ID         =', board.id);
  console.log('\nGo to: https://github.com/agrvasu05/pawhound/settings/secrets/actions');
  console.log('\nSetup complete! Run `node scripts/5-post-pins.js` to post your first pins.\n');
})();
