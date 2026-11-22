/* ============================================================
   ACCOUNTS + CLOUD SAVE. Sign in once and your campaign save,
   settings, achievements and mode records follow you to any
   device (browser, Mac app, Render site). Stored on the BLACKLINE 2
   server in Postgres. Without an account everything still saves
   on this device as before.
   ============================================================ */
const Account = {
  dirtyT: null, busy: false,
  user() { return Store.get('acct', null); },
  api() { return MP.server().replace(/^ws/, 'http').replace(/\/ws$/, ''); },
  async call(path, method, body) {
    const u = this.user(), h = { 'Content-Type': 'application/json' }; if (u) h.Authorization = 'Bearer ' + u.token;
    const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), 70000);
    try {
      const r = await fetch(this.api() + path, { method: method || 'GET', headers: h, body: body ? JSON.stringify(body) : undefined, signal: ctl.signal });
      const j = await r.json().catch(() => ({ error: 'Bad reply from server' })); if (r.status === 401 && u && path !== '/api/login') { this.signOut(true); }
      return j;
    } catch (e) { return { error: e.name === 'AbortError' ? 'The server did not answer (it may be waking up, try again)' : 'Could not reach the server' }; }
    finally { clearTimeout(t); }
  },
  /* everything worth keeping, as one object */
  snapshot() {
    const store = {};
    for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (!k.startsWith('blackline_')) continue; const s = k.slice(10); if (/^acct/.test(s)) continue; try { store[s] = JSON.parse(localStorage.getItem(k)); } catch (e) { } }
    const mp = store.mp_stats || {};
    const stats = { mpKills: mp.kills || 0, mpDeaths: mp.deaths || 0, mpWins: mp.wins || 0, zmBest: store.zm_best || 0, brWins: store.br_wins || 0, hrEscapes: store.hr_escapes || 0, achievements: Object.keys(store.achievements || store.ach || {}).length };
    return { store, stats, at: Date.now() };
  },
  apply(data) {
    if (!data || !data.store) return false; let changed = false;
    for (const k in data.store) { const v = JSON.stringify(data.store[k]); if (localStorage.getItem('blackline_' + k) !== v) { localStorage.setItem('blackline_' + k, v); changed = true; } }
    return changed;
  },
  markDirty() { if (!this.user()) return; localStorage.setItem('blackline_acct_dirty', '1'); clearTimeout(this.dirtyT); this.dirtyT = setTimeout(() => this.push(), 2500); },
  async push() {
    if (!this.user() || this.busy) return; this.busy = true;
    const r = await this.call('/api/save', 'PUT', { data: this.snapshot() }); this.busy = false;
    if (!r.error) { localStorage.removeItem('blackline_acct_dirty'); this.setStatus('Saved to the cloud ✓'); } else this.setStatus(r.error);
  },
  /* on boot: newer local changes go up, otherwise the cloud copy comes down */
  async boot() {
    if (!this.user()) return;
    if (localStorage.getItem('blackline_acct_dirty')) return this.push();
    const r = await this.call('/api/me');
    if (r.error) return;
    if (!r.data || !r.data.store || !Object.keys(r.data.store).length) return this.push();
    if (this.apply(r.data) && (state === 'menu' || state === 'loading')) { sessionStorage.setItem('bl_synced', '1'); location.reload(); }
  },
  async auth(kind, name, pass) {
    const r = await this.call(kind === 'new' ? '/api/register' : '/api/login', 'POST', { name, pass });
    if (r.error) return r;
    const had = r.data && r.data.store && Object.keys(r.data.store).length;
    Store.set('acct', { name: r.name, token: r.token }); Store.set('mp_name', r.name);
    if (had) { this.apply(r.data); location.reload(); }   // bring this device up to date
    else await this.push();                               // first sign-in: this device's progress becomes the account's
    return r;
  },
  signOut(silent) { Store.del('acct'); localStorage.removeItem('blackline_acct_dirty'); if (!silent) this.render(); },
  setStatus(s) { const el = $('acct-status'); if (el) el.textContent = s; },
  /* ---------- profile screen ---------- */
  open() {
    acctCss();
    let el = $('profile');
    if (!el) {
      el = document.createElement('div'); el.id = 'profile'; el.className = 'screen hidden';
      el.innerHTML = '<div class="pf-in" id="pf-body"></div>'; document.body.appendChild(el);
    }
    showScreen('profile'); this.render();
  },
  render() {
    const b = $('pf-body'); if (!b) return; const u = this.user(), s = this.snapshot().stats;
    const stat = (n, l) => `<div class="pf-st"><b>${n}</b><small>${l}</small></div>`;
    const stats = `<div class="pf-stats">${stat(s.mpKills, 'MP KILLS')}${stat(s.mpWins, 'MP WINS')}${stat(s.brWins, 'BR WINS')}${stat(s.zmBest, 'BEST ZOMBIE ROUND')}${stat(s.hrEscapes, 'WARD 9 ESCAPES')}</div>`;
    b.innerHTML = `<div class="pf-t">PROFILE</div>` + (u
      ? `<div class="pf-s">SIGNED IN AS <span>${u.name.replace(/</g, '')}</span></div>${stats}
         <div class="pf-note">Your campaign save, settings, achievements and records are backed up to your account and load on any device you sign in on.</div>
         <div class="pf-row"><button class="mpb main" id="pf-sync">SYNC NOW</button><button class="mpb" id="pf-out">SIGN OUT</button></div>`
      : `<div class="pf-s">NOT SIGNED IN · PROGRESS IS SAVED ON THIS DEVICE ONLY</div>${stats}
         <label>CALLSIGN<input id="pf-name" maxlength="16" autocomplete="username" value="${(Store.get('mp_name', '') || '').replace(/"/g, '')}"></label>
         <label>PASSWORD<input id="pf-pass" type="password" maxlength="64" autocomplete="current-password"></label>
         <div class="pf-row"><button class="mpb main" id="pf-in">SIGN IN</button><button class="mpb" id="pf-new">CREATE ACCOUNT</button></div>`)
      + `<div id="acct-status"></div><div class="pf-lb" id="pf-lb"><small>LEADERBOARD</small><div>Loading…</div></div><div class="pf-row"><button class="mpb" id="pf-back">BACK</button></div>`;
    $('pf-back').onclick = () => { AudioSys.ui('back'); showScreen('menu'); };
    if (u) { $('pf-sync').onclick = () => { this.setStatus('Saving…'); this.push(); }; $('pf-out').onclick = () => this.signOut(); }
    else for (const [id, kind] of [['pf-in', 'in'], ['pf-new', 'new']]) $(id).onclick = async () => {
      const n = $('pf-name').value.trim(), p = $('pf-pass').value; if (!n || !p) return this.setStatus('Type a callsign and a password.');
      this.setStatus(kind === 'new' ? 'Creating your account…' : 'Signing in…'); const r = await this.auth(kind, n, p);
      if (r.error) this.setStatus(r.error); else { this.render(); this.setStatus(kind === 'new' ? 'Account created. Your progress is now backed up.' : 'Signed in.'); }
    };
    this.board();
  },
  async board() {
    const r = await this.call('/api/leaderboard'), el = $('pf-lb'); if (!el) return;
    if (r.error) { el.innerHTML = '<small>LEADERBOARD</small><div class="pf-dim">Offline. ' + r.error + '</div>'; return; }
    const col = (t, a, f) => `<div class="pf-lc"><small>${t}</small>${(a || []).slice(0, 5).map((x, i) => `<div><span>${i + 1}. ${x.name.replace(/</g, '')}</span><b>${f ? f(x.v) : x.v}</b></div>`).join('') || '<div class="pf-dim">No one yet</div>'}</div>`;
    el.innerHTML = `<small>LEADERBOARD · ${r.players} PLAYERS</small><div class="pf-lg">${col('MP KILLS', r.mpKills)}${col('ZOMBIES · ROUND', r.zmBest)}${col('BR WINS', r.brWins)}</div>`;
  }
};
/* every save on this device schedules a cloud backup */
{ const set = Store.set.bind(Store), del = Store.del.bind(Store);
  Store.set = (k, v) => { set(k, v); if (!/^acct/.test(k)) Account.markDirty(); };
  Store.del = (k) => { del(k); if (!/^acct/.test(k)) Account.markDirty(); }; }

function acctCss() {
  if ($('acct-css')) return; mpCss();
  const s = document.createElement('style'); s.id = 'acct-css'; s.textContent = `
  #profile{position:fixed;inset:0;display:flex;align-items:center;justify-content:center;background:radial-gradient(ellipse at 30% 20%,rgba(30,40,60,.75),rgba(4,6,10,.94));z-index:40;font-family:Inter,sans-serif}
  #profile.hidden{display:none}
  .pf-in{width:min(640px,92vw);max-height:92vh;overflow:auto;padding:30px 36px;background:rgba(12,15,20,.85);border:1px solid rgba(255,255,255,.1);box-shadow:0 30px 80px rgba(0,0,0,.6)}
  .pf-t{font:700 40px Rajdhani,sans-serif;letter-spacing:6px;color:#f2ead8}.pf-s{font:600 13px Rajdhani,sans-serif;letter-spacing:3px;color:#8a94a2;margin:2px 0 16px}.pf-s span{color:#e0a040}
  .pf-stats{display:grid;grid-template-columns:repeat(5,1fr);gap:8px;margin-bottom:16px}.pf-st{background:#0c0f14;border:1px solid #20262f;padding:10px 6px;text-align:center}
  .pf-st b{display:block;font:700 26px Rajdhani,sans-serif;color:#f2ead8}.pf-st small{font:600 10px Rajdhani,sans-serif;letter-spacing:1.5px;color:#7a8492}
  #profile label{display:block;font:600 12px Rajdhani,sans-serif;letter-spacing:3px;color:#8a94a2;margin-bottom:12px}
  #profile input{display:block;width:100%;margin-top:6px;padding:10px 12px;background:#0a0c10;border:1px solid #2a303a;color:#f2ead8;font:600 18px Rajdhani,sans-serif;letter-spacing:1px;box-sizing:border-box}
  .pf-row{display:flex;gap:10px;margin:10px 0}.pf-note{color:#9aa4b0;font-size:13px;line-height:1.5;margin-bottom:6px}
  #acct-status{min-height:18px;color:#e0a040;font-size:13px;margin:6px 0}
  .pf-lb{margin-top:12px;border-top:1px solid #20262f;padding-top:12px}.pf-lb>small,.pf-lc small{font:600 11px Rajdhani,sans-serif;letter-spacing:2.5px;color:#e0a040}
  .pf-lg{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin-top:8px}.pf-lc div{display:flex;justify-content:space-between;font:600 15px Rajdhani,sans-serif;color:#dcd6c8;padding:2px 0}
  .pf-dim{color:#5a6472!important;font-size:13px!important}`;
  document.head.appendChild(s);
}
window.Account = Account;
