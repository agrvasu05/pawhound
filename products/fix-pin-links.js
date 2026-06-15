require('dotenv').config({ path: require('path').resolve(process.cwd(), '.env.local') });
const https = require('https');
const CID = process.env.PINTEREST_CLIENT_ID, CS = process.env.PINTEREST_CLIENT_SECRET, RT = process.env.PINTEREST_REFRESH_TOKEN;
let ACCESS;
function api(method, endpoint, body) {
  return new Promise((resolve, reject) => {
    const isOAuth = endpoint === '/v5/oauth/token';
    const auth = isOAuth ? 'Basic ' + Buffer.from(`${CID}:${CS}`).toString('base64') : `Bearer ${ACCESS}`;
    const payload = isOAuth ? new URLSearchParams(body).toString() : body ? JSON.stringify(body) : null;
    const opts = { hostname: 'api.pinterest.com', path: endpoint, method, headers: { Authorization: auth, ...(payload ? { 'Content-Type': isOAuth ? 'application/x-www-form-urlencoded' : 'application/json', 'Content-Length': Buffer.byteLength(payload) } : {}) } };
    const req = https.request(opts, (res) => { let d=''; res.on('data',c=>d+=c); res.on('end',()=>{try{resolve({status:res.statusCode,body:JSON.parse(d)})}catch{resolve({status:res.statusCode,body:d})}}); });
    req.on('error', reject); if (payload) req.write(payload); req.end();
  });
}
const PINS = [
  ['1142577367994833452','cozywatercolordogset'],
  ['1142577367994833915','bohominimalistdogart'],
  ['1142577367994834980','cozycottagedogset'],
  ['1142577367994835158','holidayseasonaldogscoloringpag'],
  ['1142577367994835198','printabledogtrainingprogresstr'],
];
(async () => {
  const t = await api('POST','/v5/oauth/token',{grant_type:'refresh_token',refresh_token:RT});
  ACCESS = t.body.access_token;
  if(!ACCESS){console.error('no token',JSON.stringify(t.body));process.exit(1);}
  for (const [id, slug] of PINS) {
    const link = `https://valuefinds.gumroad.com/l/${slug}`;
    const r = await api('PATCH', `/v5/pins/${id}`, { link });
    console.log(`${id}: HTTP ${r.status}${r.status!==200?' '+JSON.stringify(r.body).slice(0,160):' -> '+link}`);
  }
})();
