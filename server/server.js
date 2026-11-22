/* BLACKLINE 2 server: serves the web build and runs the multiplayer lobby.
   - GET /            → the game (docs/index.html + docs/assets, same build as GitHub Pages)
   - GET /health      → ok (Render health check)
   - WS  /ws          → lobby + match relay
   - POST /api/register, /api/login {name, pass} · GET /api/me · PUT /api/save {data} (Bearer token)
   - GET /api/leaderboard · player data lives in Postgres when DATABASE_URL is set (see server/db.js)
   Protocol (JSON): {t:'list'} · {t:'host', name, mode, map, max, public} · {t:'join', code, name}
                    {t:'leave'} · {t:'msg', to?, d} (relayed to room; host-authoritative games)  */
const http = require('http'), fs = require('fs'), path = require('path');
const { WebSocketServer } = require('ws');
const DB = require('./db');
const WEB = path.join(__dirname, '..', 'docs'), PORT = process.env.PORT || 10000;
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.ico': 'image/x-icon' };

const server = http.createServer((req, res) => {
  const url = decodeURIComponent(req.url.split('?')[0]);
  if (url === '/health') { res.writeHead(200, { 'Content-Type': 'text/plain' }); return res.end('ok'); }
  if (url.startsWith('/api/') && url !== '/api/rooms') return api(req, res, url);
  if (url === '/api/rooms') { res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }); return res.end(JSON.stringify(publicRooms())); }
  let f = path.normalize(path.join(WEB, url === '/' ? 'index.html' : url));
  if (!f.startsWith(WEB)) { res.writeHead(403); return res.end(); }
  fs.stat(f, (err, st) => {
    if (err || !st.isFile()) { res.writeHead(404); return res.end('not found'); }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream', 'Content-Length': st.size, 'Cache-Control': url.startsWith('/assets/') ? 'public, max-age=86400' : 'no-cache' });
    fs.createReadStream(f).pipe(res);
  });
});

/* ---------- accounts + cloud saves ---------- */
const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type, Authorization', 'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS' };
const hits = new Map();   // ip -> [count, windowStart]   (simple brute-force guard on login/register)
function api(req, res, url) {
  const out = (code, o) => { res.writeHead(code, Object.assign({ 'Content-Type': 'application/json' }, CORS)); res.end(JSON.stringify(o)); };
  if (req.method === 'OPTIONS') { res.writeHead(204, CORS); return res.end(); }
  const tok = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  let body = ''; req.on('data', c => { body += c; if (body.length > 300000) req.destroy(); });
  req.on('end', async () => {
    let b = {}; try { b = body ? JSON.parse(body) : {}; } catch (e) { return out(400, { error: 'Bad JSON' }); }
    try {
      if (url === '/api/register' || url === '/api/login') {
        const ip = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0], h = hits.get(ip) || [0, Date.now()];
        if (Date.now() - h[1] > 60000) { h[0] = 0; h[1] = Date.now(); } h[0]++; hits.set(ip, h);
        if (h[0] > 20) return out(429, { error: 'Too many attempts. Wait a minute.' });
        const r = url === '/api/register' ? await DB.register(b.name, b.pass) : await DB.login(b.name, b.pass);
        return out(r.error ? 400 : 200, r);
      }
      if (url === '/api/me') { const r = await DB.me(tok); return out(r.error ? 401 : 200, r); }
      if (url === '/api/save' && (req.method === 'PUT' || req.method === 'POST')) { const r = await DB.save(tok, b.data); return out(r.error ? 401 : 200, r); }
      if (url === '/api/leaderboard') return out(200, await DB.leaderboard());
      if (url === '/api/status') return out(200, { storage: DB.store.kind, persistent: DB.store.persistent });
      out(404, { error: 'Not found' });
    } catch (e) { console.error('api', url, e.message); out(500, { error: 'Server error' }); }
  });
}

const rooms = new Map();   // code -> { code, host, name, mode, map, max, public, players: Map(id -> ws), created }
let nextId = 1;
const ABC = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const newCode = () => { let c; do { c = Array.from({ length: 6 }, () => ABC[Math.floor(Math.random() * ABC.length)]).join(''); } while (rooms.has(c)); return c; };
const send = (ws, o) => { if (ws.readyState === 1) ws.send(JSON.stringify(o)); };
function publicRooms() { return [...rooms.values()].filter(r => r.public && r.players.size < r.max).map(r => ({ code: r.code, name: r.name, mode: r.mode, map: r.map, players: r.players.size, max: r.max })); }
function roster(r) { return [...r.players.values()].map(p => ({ id: p.id, name: p.name, host: p.id === r.host })); }
function leave(ws) {
  const r = ws.room && rooms.get(ws.room); if (!r) return;
  r.players.delete(ws.id); ws.room = null;
  if (!r.players.size) { rooms.delete(r.code); return; }
  if (r.host === ws.id) { r.host = r.players.keys().next().value; }       // host migration
  for (const p of r.players.values()) send(p, { t: 'roster', code: r.code, host: r.host, players: roster(r), left: ws.id });
}

const wss = new WebSocketServer({ server, path: '/ws', maxPayload: 64 * 1024 });
wss.on('connection', ws => {
  ws.id = nextId++; ws.name = 'Player' + ws.id; ws.alive = true;
  ws.on('pong', () => { ws.alive = true; });
  send(ws, { t: 'hello', id: ws.id });
  ws.on('message', raw => {
    let m; try { m = JSON.parse(raw); } catch { return; }
    if (m.t === 'list') return send(ws, { t: 'list', rooms: publicRooms() });
    if (m.t === 'host') {
      leave(ws); const code = newCode();
      const r = { code, host: ws.id, name: String(m.name || ws.name).slice(0, 24) + "'s match", mode: String(m.mode || 'tdm').slice(0, 16), map: String(m.map || 'city').slice(0, 16), max: Math.min(16, Math.max(2, m.max | 0 || 8)), public: m.public !== false, players: new Map(), created: Date.now() };
      ws.name = String(m.name || ws.name).slice(0, 24); r.players.set(ws.id, ws); rooms.set(code, r); ws.room = code;
      return send(ws, { t: 'joined', code, host: ws.id, you: ws.id, mode: r.mode, map: r.map, players: roster(r) });
    }
    if (m.t === 'join') {
      const r = rooms.get(String(m.code || '').toUpperCase()); if (!r) return send(ws, { t: 'error', e: 'No match with that code.' });
      if (r.players.size >= r.max) return send(ws, { t: 'error', e: 'That match is full.' });
      leave(ws); ws.name = String(m.name || ws.name).slice(0, 24); r.players.set(ws.id, ws); ws.room = r.code;
      send(ws, { t: 'joined', code: r.code, host: r.host, you: ws.id, mode: r.mode, map: r.map, players: roster(r) });
      for (const p of r.players.values()) if (p !== ws) send(p, { t: 'roster', code: r.code, host: r.host, players: roster(r), joined: ws.id });
      return;
    }
    if (m.t === 'leave') return leave(ws);
    if (m.t === 'msg') {
      const r = ws.room && rooms.get(ws.room); if (!r) return;
      const out = JSON.stringify({ t: 'msg', from: ws.id, d: m.d });
      if (m.to) { const p = r.players.get(m.to); if (p && p.readyState === 1) p.send(out); }
      else for (const p of r.players.values()) if (p !== ws && p.readyState === 1) p.send(out);
    }
  });
  ws.on('close', () => leave(ws));
});
setInterval(() => { for (const ws of wss.clients) { if (!ws.alive) { ws.terminate(); continue; } ws.alive = false; ws.ping(); } }, 25000);
DB.store.init().then(() => server.listen(PORT, () => console.log('BLACKLINE 2 server on :' + PORT + ' · player data: ' + DB.store.kind + (DB.store.persistent ? '' : ' (NOT persistent: set DATABASE_URL)'))))
  .catch(e => { console.error('Database init failed:', e.message); process.exit(1); });
