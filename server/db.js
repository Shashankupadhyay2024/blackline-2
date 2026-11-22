/* Player accounts and cloud saves.
   - With DATABASE_URL set (free Neon Postgres): data survives restarts and redeploys.
   - Without it: a JSON file in DATA_DIR (default ./data). Fine locally, but Render's free
     disk is wiped on every restart, which is why the Render deploy uses Postgres. */
const fs = require('fs'), path = require('path'), crypto = require('crypto');

function hashPass(pass, salt) { return crypto.scryptSync(pass, salt, 32).toString('hex'); }
const key = n => n.trim().toLowerCase();

function fileStore() {
  const dir = process.env.DATA_DIR || path.join(__dirname, '..', 'data'), f = path.join(dir, 'players.json');
  let db = {}; try { db = JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { }
  let t = null; const flush = () => { clearTimeout(t); t = setTimeout(() => { fs.mkdirSync(dir, { recursive: true }); fs.writeFileSync(f + '.tmp', JSON.stringify(db)); fs.renameSync(f + '.tmp', f); }, 300); };
  return {
    kind: 'file', persistent: !process.env.RENDER,
    async init() { },
    async get(name) { return db[key(name)] || null; },
    async byToken(tok) { return Object.values(db).find(p => p.token === tok) || null; },
    async create(p) { if (db[key(p.name)]) return false; db[key(p.name)] = p; flush(); return true; },
    async saveData(name, data) { const p = db[key(name)]; if (!p) return; p.data = data; p.updated = Date.now(); flush(); },
    async all() { return Object.values(db).map(p => ({ name: p.name, stats: (p.data && p.data.stats) || {} })); }
  };
}

function pgStore(url) {
  const { Pool } = require('pg');
  const pool = new Pool({ connectionString: url, ssl: /localhost|127\.0\.0\.1/.test(url) ? false : { rejectUnauthorized: false }, max: 4, idleTimeoutMillis: 20000 });
  const row = r => r && { name: r.name, salt: r.salt, pass: r.pass, token: r.token, data: r.data || {}, created: +r.created, updated: +r.updated };
  return {
    kind: 'postgres', persistent: true,
    async init() {
      await pool.query(`CREATE TABLE IF NOT EXISTS players (
        id TEXT PRIMARY KEY, name TEXT NOT NULL, salt TEXT NOT NULL, pass TEXT NOT NULL, token TEXT UNIQUE NOT NULL,
        data JSONB NOT NULL DEFAULT '{}'::jsonb, created BIGINT NOT NULL, updated BIGINT NOT NULL)`);
    },
    async get(name) { const r = await pool.query('SELECT * FROM players WHERE id=$1', [key(name)]); return row(r.rows[0]); },
    async byToken(tok) { const r = await pool.query('SELECT * FROM players WHERE token=$1', [tok]); return row(r.rows[0]); },
    async create(p) { const r = await pool.query('INSERT INTO players (id,name,salt,pass,token,data,created,updated) VALUES ($1,$2,$3,$4,$5,$6,$7,$7) ON CONFLICT (id) DO NOTHING', [key(p.name), p.name, p.salt, p.pass, p.token, p.data, p.created]); return r.rowCount === 1; },
    async saveData(name, data) { await pool.query('UPDATE players SET data=$2, updated=$3 WHERE id=$1', [key(name), data, Date.now()]); },
    async all() { const r = await pool.query(`SELECT name, data->'stats' AS stats FROM players ORDER BY updated DESC LIMIT 5000`); return r.rows.map(x => ({ name: x.name, stats: x.stats || {} })); }
  };
}

const store = process.env.DATABASE_URL ? pgStore(process.env.DATABASE_URL) : fileStore();

const NAME_OK = /^[A-Za-z0-9_\- ]{3,16}$/;
async function register(name, pass) {
  name = String(name || '').trim(); pass = String(pass || '');
  if (!NAME_OK.test(name)) return { error: 'Callsign must be 3-16 letters, numbers, spaces, _ or -' };
  if (pass.length < 4) return { error: 'Password must be at least 4 characters' };
  const salt = crypto.randomBytes(16).toString('hex'), p = { name, salt, pass: hashPass(pass, salt), token: crypto.randomBytes(24).toString('hex'), data: {}, created: Date.now() };
  if (!(await store.create(p))) return { error: 'That callsign is taken' };
  return { name: p.name, token: p.token, data: p.data };
}
async function login(name, pass) {
  const p = await store.get(String(name || ''));
  if (!p || hashPass(String(pass || ''), p.salt) !== p.pass) return { error: 'Wrong callsign or password' };
  return { name: p.name, token: p.token, data: p.data };
}
async function me(token) { const p = token && await store.byToken(token); return p ? { name: p.name, data: p.data } : { error: 'Signed out' }; }
async function save(token, data) {
  const p = token && await store.byToken(token); if (!p) return { error: 'Signed out' };
  if (!data || typeof data !== 'object') return { error: 'Bad save' };
  const s = JSON.stringify(data); if (s.length > 200000) return { error: 'Save too large' };
  await store.saveData(p.name, data); return { ok: true };
}
let lbCache = null, lbT = 0;
async function leaderboard() {
  if (lbCache && Date.now() - lbT < 30000) return lbCache;
  const all = await store.all(), top = (k) => all.filter(p => +p.stats[k] > 0).sort((a, b) => b.stats[k] - a.stats[k]).slice(0, 10).map(p => ({ name: p.name, v: +p.stats[k] }));
  lbCache = { mpKills: top('mpKills'), mpWins: top('mpWins'), zmBest: top('zmBest'), brWins: top('brWins'), hrEscapes: top('hrEscapes'), players: all.length }; lbT = Date.now();
  return lbCache;
}
module.exports = { store, register, login, me, save, leaderboard };
