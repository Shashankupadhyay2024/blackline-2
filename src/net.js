/* ============================================================
   MULTIPLAYER: free-for-all on "THE YARD" over the BLACKLINE 2
   lobby server (server/server.js on Render). Quick match, private
   room codes, or practice against bots offline.
   Shooter-side hit detection; the victim applies damage and
   announces its own death, so nobody has to be the authority.
   ============================================================ */
const MP_DEFAULT_SERVER = 'wss://blackline-2.onrender.com/ws';
const MP = {
  ws: null, id: 0, code: '', host: 0, players: {}, remotes: {}, scores: {}, names: {}, online: false, practice: false,
  sendT: 0, lastHitBy: 0, goal: 20, roundOver: 0, status: '',
  server() {
    const q = PARAMS.get('server'); if (q) return q;
    if (/^https?:$/.test(location.protocol) && !/github\.io$/.test(location.hostname) && location.hostname) return (location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + '/ws';
    return Store.get('mp_server', MP_DEFAULT_SERVER);
  },
  name() { const a = Account.user(); if (a) return a.name; let n = Store.get('mp_name', ''); if (!n) { n = 'Operator' + Math.floor(100 + Math.random() * 900); Store.set('mp_name', n); } return n; },
  connect(cb) {
    if (this.ws && this.ws.readyState === 1) { cb && cb(); return; }
    const url = this.server(); this.setStatus('Connecting to ' + url.replace(/^wss?:\/\//, '').replace(/\/ws$/, '') + '… (a sleeping server can take up to a minute to wake)');
    let ws; try { ws = new WebSocket(url); } catch (e) { this.setStatus('Could not reach the server: ' + e.message); return; }
    this.ws = ws; const t0 = Date.now();
    ws.onopen = () => { this.online = true; this.setStatus('Online'); this.send({ t: 'list' }); cb && cb(); };
    ws.onclose = () => { const was = this.online; this.online = false; if (was) { HUD.feed && $('hud') && HUD.feed('DISCONNECTED FROM SERVER', 'red'); this.setStatus('Disconnected'); } else if (Date.now() - t0 < 90000 && !this.practice) { this.setStatus('Server is waking up… retrying'); setTimeout(() => { if (!this.online) this.connect(cb); }, 4000); } };
    ws.onerror = () => {};
    ws.onmessage = ev => { let m; try { m = JSON.parse(ev.data); } catch (e) { return; } this.onMsg(m); };
  },
  send(o) { if (this.ws && this.ws.readyState === 1) this.ws.send(JSON.stringify(o)); },
  relay(d, to) { this.send(to ? { t: 'msg', to, d } : { t: 'msg', d }); },
  setStatus(s) { this.status = s; const el = $('mp-status'); if (el) el.textContent = s; },
  onMsg(m) {
    if (m.t === 'hello') this.id = m.id;
    else if (m.t === 'list') this.renderRooms(m.rooms || []);
    else if (m.t === 'error') { this.setStatus(m.e); AudioSys.ui('deny'); }
    else if (m.t === 'joined') { this.code = m.code; this.host = m.host; this.id = m.you; this.roster(m.players); this.startMatch(); }
    else if (m.t === 'roster') { this.host = m.host; this.roster(m.players); if (m.left && this.remotes[m.left]) { HUD.feed(this.names[m.left] + ' left', ''); this.remotes[m.left].dispose(); const i = enemies.indexOf(this.remotes[m.left]); if (i >= 0) enemies.splice(i, 1); delete this.remotes[m.left]; } if (m.joined) { HUD.feed((this.names[m.joined] || 'Someone') + ' joined', 'gold'); this.relay({ k: 'sc', s: this.scores }, m.joined); } }
    else if (m.t === 'msg') this.onGame(m.from, m.d || {});
  },
  roster(list) { this.players = {}; for (const p of list) { this.players[p.id] = p; this.names[p.id] = p.name; if (!(p.id in this.scores)) this.scores[p.id] = 0; } this.renderScores(); },
  onGame(from, d) {
    if (d.k === 's') { let r = this.remotes[from]; if (!r) { r = this.remotes[from] = new RemotePlayer(from, d); enemies.push(r); } r.net(d); }
    else if (d.k === 'shot') { const r = this.remotes[from]; if (r) r.shot(d); }
    else if (d.k === 'hit') { if (player.alive && state === 'play' && !(this.spawnProt > 0)) { this.lastHitBy = from; const r = this.remotes[from]; hurtPlayer(d.d, r ? r.pos : null); if (!player.alive) { this.relay({ k: 'kill', by: from, h: !!d.h }); this.addKill(from, this.id, d.h); } } }
    else if (d.k === 'kill') this.addKill(d.by, from, d.h);
    else if (d.k === 'sc') { for (const id in d.s) this.scores[id] = Math.max(this.scores[id] || 0, d.s[id]); this.renderScores(); }
    else if (d.k === 'win') this.endRound(d.id);
  },
  addKill(by, victim, head) {
    this.scores[by] = (this.scores[by] || 0) + 1; this.renderScores();
    const n = id => id === this.id ? 'You' : (this.names[id] || 'Player');
    HUD.feed(n(by) + (head ? ' ✦ ' : ' ✕ ') + n(victim), by === this.id ? 'gold' : victim === this.id ? 'red' : '');
    if (!this.practice && (by === this.id || victim === this.id)) { const s = Store.get('mp_stats', { kills: 0, deaths: 0, wins: 0 }); if (by === this.id) s.kills++; else s.deaths++; Store.set('mp_stats', s); }
    if (by === this.id && !this.practice) { stats.kills++; if (head) stats.heads++; HUD.kill(head); }
    const r = this.remotes[victim]; if (r) r.kill();
    if (this.scores[by] >= this.goal && !this.roundOver) { this.relay({ k: 'win', id: by }); this.endRound(by); }
  },
  endRound(id) {
    if (this.roundOver) return; this.roundOver = 8;
    HUD.notify(id === this.id ? 'YOU WIN THE MATCH' : (this.names[id] || 'Someone') + ' wins the match', 'Next match in 8 seconds', 'obj');
    if (id === this.id && !this.practice) { achieve('mpwin', 'Top Fragger', 'Win an online match'); const s = Store.get('mp_stats', { kills: 0, deaths: 0, wins: 0 }); s.wins++; Store.set('mp_stats', s); }
  },
  renderScores() {
    const el = $('mp-score'); if (!el) return;
    const ids = Object.keys(this.practice ? this.scores : this.players).map(Number).filter(id => id in this.scores);
    ids.sort((a, b) => this.scores[b] - this.scores[a]);
    el.innerHTML = `<div class="mps-h">${this.practice ? 'PRACTICE' : 'ROOM ' + this.code} · FIRST TO ${this.goal}</div>` + ids.slice(0, 6).map(id => `<div class="${id === this.id ? 'me' : ''}"><span>${(id === this.id ? this.name() : this.names[id] || 'Player').replace(/</g, '')}</span><b>${this.scores[id]}</b></div>`).join('');
  },
  /* ---------- lobby ---------- */
  openLobby() {
    mpCss();
    let el = $('mp-lobby');
    if (!el) {
      el = document.createElement('div'); el.id = 'mp-lobby'; el.className = 'screen';
      el.innerHTML = `<div class="mpl-in"><div class="mpl-t">MULTIPLAYER</div><div class="mpl-s">FREE-FOR-ALL · THE YARD · FIRST TO 20</div>
        <label>CALLSIGN<input id="mp-name" maxlength="16"></label>
        <div class="mpl-row"><button id="mp-quick" class="mpb main">QUICK MATCH</button><button id="mp-host" class="mpb">HOST PRIVATE MATCH</button></div>
        <div class="mpl-row"><input id="mp-code" maxlength="6" placeholder="ROOM CODE"><button id="mp-join" class="mpb">JOIN</button></div>
        <div id="mp-rooms"></div>
        <div class="mpl-row"><button id="mp-practice" class="mpb">PRACTICE VS BOTS (OFFLINE)</button><button id="mp-back" class="mpb">BACK</button></div>
        <div id="mp-status"></div>
        <details><summary>Server</summary><input id="mp-server" spellcheck="false"><small>Your Render address, ending in /ws</small></details></div>`;
      document.body.appendChild(el);
      $('mp-name').value = this.name(); $('mp-name').onchange = () => Store.set('mp_name', $('mp-name').value.trim().slice(0, 16) || this.name());
      $('mp-server').value = this.server(); $('mp-server').onchange = () => { Store.set('mp_server', $('mp-server').value.trim()); if (this.ws) this.ws.close(); this.ws = null; this.connect(); };
      $('mp-quick').onclick = () => { AudioSys.init(); this.connect(() => { const r = (this.lastRooms || [])[0]; if (r) this.send({ t: 'join', code: r.code, name: this.name() }); else this.send({ t: 'host', name: this.name(), mode: 'ffa', map: 'yard', max: 12, public: true }); }); };
      $('mp-host').onclick = () => { AudioSys.init(); this.connect(() => this.send({ t: 'host', name: this.name(), mode: 'ffa', map: 'yard', max: 12, public: false })); };
      $('mp-join').onclick = () => { AudioSys.init(); const c = $('mp-code').value.trim().toUpperCase(); if (c.length < 4) return this.setStatus('Type the 6-letter room code first.'); this.connect(() => this.send({ t: 'join', code: c, name: this.name() })); };
      $('mp-practice').onclick = () => { AudioSys.init(); this.practice = true; this.startMatch(); };
      $('mp-back').onclick = () => { location.href = location.pathname; };
      const PJ = PARAMS.get('join'); if (PJ) $('mp-code').value = PJ;
    }
    showScreen('mp-lobby'); this.connect(); this.renderRooms(this.lastRooms || []);
    clearInterval(this.listT); this.listT = setInterval(() => { if ($('mp-lobby') && !$('mp-lobby').classList.contains('hidden')) this.send({ t: 'list' }); }, 4000);
  },
  renderRooms(rooms) {
    this.lastRooms = rooms; const el = $('mp-rooms'); if (!el) return;
    el.innerHTML = rooms.length ? rooms.map(r => `<button class="mpr" data-c="${r.code}"><span>${r.name.replace(/</g, '')}</span><small>${r.players}/${r.max}</small></button>`).join('') : `<div class="mpr-none">${this.online ? 'No open matches right now. Host one and share the code.' : ''}</div>`;
    for (const b of el.querySelectorAll('.mpr')) b.onclick = () => this.send({ t: 'join', code: b.dataset.c, name: this.name() });
  },
  startMatch() {
    clearInterval(this.listT); showScreen(null); AudioSys.init();
    this.scores = {}; this.scores[this.id] = 0; this.renderScores(); this.roundOver = 0;
    resetLevel(0, null); beginPlay();
    if (this.practice) { HUD.notify('PRACTICE', 'Bots fight back. First to ' + this.goal + '.', 'obj'); mpBots(); }
    else HUD.notify('ROOM ' + this.code, 'Share this code with friends so they can join', 'obj');
    $('mp-room').textContent = this.practice ? '' : 'ROOM CODE ' + this.code;
  },
  tick(dt) {
    if (this.spawnProt > 0) this.spawnProt -= dt;
    if (this.roundOver > 0) { this.roundOver -= dt; if (this.roundOver <= 0) { for (const k in this.scores) this.scores[k] = 0; this.renderScores(); this.respawnNow(); HUD.notify('NEW MATCH', 'First to ' + this.goal, 'obj'); } }
    if (this.practice || !this.online) return;
    this.sendT -= dt;
    if (this.sendT <= 0) {
      this.sendT = 1 / 15; const p = player.pos;
      this.relay({ k: 's', p: [+p.x.toFixed(2), +p.y.toFixed(2), +p.z.toFixed(2)], y: +player.yaw.toFixed(3), pi: +player.pitch.toFixed(3), w: cur, c: player.crouch ? 1 : 0, a: player.alive ? 1 : 0, n: this.name(), ch: Store.get('mp_char', '') });
    }
  },
  respawnNow() {
    const sp = pick(YARD.spawns.filter(s => Object.values(this.remotes).every(r => !r.alive || r.pos.distanceTo(s) > 12)).concat([pick(YARD.spawns)]));
    player.alive = true; player.hp = 100; player.armor = 0; player.pos.set(sp.x, 0, sp.z); player.vel.set(0, 0, 0); player.yaw = Math.atan2(sp.x, sp.z); player.pitch = 0;
    inv = {}; for (const w of ['pistol', 'ar']) giveWeapon(w, true); cur = 'ar'; player.nades = 1; W.reloading = false; showVM(cur); HUD.slots(); vmRoot.visible = true; timeScale = 1;
    this.spawnProt = 2;
  }
};

class RemotePlayer {
  constructor(id, d) {
    this.id = id; this.isRemote = true; this.isBoss = true; this.alive = true; this.mount = null; this.state = 'combat'; this.group = 'remote'; this.T = { scale: 1, hp: 100 }; this.hp = 100;
    this.pos = new V3(d.p[0], d.p[1], d.p[2]); this.tgt = this.pos.clone(); this.yaw = d.y; this.pitch = d.pi || 0;
    const ch = CharLib.has(d.ch) ? d.ch : pick(CASTS.rifle.concat(['maya', 'gasmask']).filter(k => CharLib.has(k)).concat(['swat']));
    const m = buildHuman('rifle', { char: ch, arch: 'soldier' }); this.parts = m; this.mesh = m.root; m.owner = this; scene.add(this.mesh);
    this.tag = mpTag(MP.names[id] || d.n || 'Player'); this.mesh.add(this.tag);
  }
  net(d) {
    this.tgt.set(d.p[0], d.p[1], d.p[2]); this.yawT = d.y; this.pitch = d.pi || 0; this.crouch = !!d.c;
    if (d.a && !this.alive) { this.alive = true; this.respawned = true; scene.remove(this.mesh); const ch = this.parts.rig && this.parts.rig.key; const m = buildHuman('rifle', { char: ch, arch: 'soldier' }); this.parts = m; this.mesh = m.root; m.owner = this; scene.add(this.mesh); this.mesh.add(this.tag); this.pos.copy(this.tgt); }
    if (!d.a && this.alive) this.kill();
  }
  kill() { if (!this.alive) return; this.alive = false; this.deadT = 0; }
  shot(d) { const o = new V3(d.o[0], d.o[1], d.o[2]), e = new V3(d.e[0], d.e[1], d.e[2]); Tracers.add(o, e, false); AudioSys.shot && AudioSys.shot(d.w || 'ar', o); if (this.parts.flash) { this.parts.flash.visible = true; this.flashT = 0.05; } }
  headSphere(s) { s.center.set(this.pos.x, this.pos.y + (this.crouch ? 1.2 : 1.64), this.pos.z); s.radius = 0.2; return s; }
  bodyBox(b) { b.min.set(this.pos.x - 0.32, this.pos.y, this.pos.z - 0.32); b.max.set(this.pos.x + 0.32, this.pos.y + (this.crouch ? 1.05 : 1.47), this.pos.z + 0.32); return b; }
  eye(v) { return v.set(this.pos.x, this.pos.y + 1.6, this.pos.z); }
  damage(d, dir, head) { if (!this.alive) return; MP.relay({ k: 'hit', d: Math.round(d), h: head ? 1 : 0 }, this.id); }
  hear() {} enterCombat() {}
  update(dt) {
    if (!this.alive) { this.deadT += dt; return; }
    this.pos.lerp(this.tgt, Math.min(1, dt * 14)); if (this.pos.distanceTo(this.tgt) > 6) this.pos.copy(this.tgt);
    this.yaw += angDiff(this.yaw, this.yawT || 0) * Math.min(1, dt * 14);
    const P = this.parts; this.mesh.position.copy(this.pos); this.mesh.rotation.set(0, this.yaw, 0);
    P.hips.position.y = this.crouch ? 0.58 : 0.95; P.legs[0].rotation.x = 0; P.legs[1].rotation.x = 0; P.aim.rotation.x = clamp(this.pitch, -1, 1);
    if (this.flashT > 0) { this.flashT -= dt; if (this.flashT <= 0) P.flash.visible = false; }
  }
  dispose() { this.alive = false; this.gone = true; scene.remove(this.mesh); }
}
function mpTag(name) {
  const t = canvasTex(256, 48, (c, w, h) => { c.font = '600 28px Rajdhani, Arial'; c.textAlign = 'center'; c.fillStyle = 'rgba(0,0,0,.45)'; c.fillRect(0, 6, w, h - 12); c.fillStyle = '#ffd890'; c.fillText(name.slice(0, 16), w / 2, 34); });
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthTest: true, transparent: true })); s.scale.set(1.4, 0.26, 1); s.position.y = 2.15; return s;
}
function mpCss() {
  if ($('mp-css')) return;
  const s = document.createElement('style'); s.id = 'mp-css'; s.textContent = `
  #mp-lobby{position:fixed;inset:0;display:flex;align-items:center;justify-content:center;background:radial-gradient(ellipse at 30% 20%,rgba(30,40,60,.75),rgba(4,6,10,.94));z-index:40;font-family:Inter,sans-serif}
  #mp-lobby.hidden{display:none}
  .mpl-in{width:min(560px,92vw);padding:34px 38px;background:rgba(12,15,20,.82);border:1px solid rgba(255,255,255,.1);box-shadow:0 30px 80px rgba(0,0,0,.6)}
  .mpl-t{font:700 44px Rajdhani,sans-serif;letter-spacing:6px;color:#f2ead8}.mpl-s{font:600 13px Rajdhani,sans-serif;letter-spacing:3px;color:#e0a040;margin-bottom:18px}
  #mp-lobby label{display:block;font:600 12px Rajdhani,sans-serif;letter-spacing:3px;color:#8a94a2;margin-bottom:14px}
  #mp-lobby input{display:block;width:100%;margin-top:6px;padding:10px 12px;background:#0a0c10;border:1px solid #2a303a;color:#f2ead8;font:600 18px Rajdhani,sans-serif;letter-spacing:2px;box-sizing:border-box}
  .mpl-row{display:flex;gap:10px;margin:10px 0}.mpl-row input{margin:0;flex:1;text-transform:uppercase}
  .mpb{flex:1;padding:12px 14px;background:#1a1f28;border:1px solid #2e3644;color:#e8e2d2;font:700 15px Rajdhani,sans-serif;letter-spacing:2px;cursor:pointer}
  .mpb:hover{background:#262d3a;border-color:#e0a040}.mpb.main{background:#e0a040;color:#120c04;border-color:#e0a040}
  #mp-rooms{max-height:150px;overflow:auto;margin:8px 0}.mpr{display:flex;justify-content:space-between;width:100%;padding:9px 12px;margin-bottom:6px;background:#10141a;border:1px solid #232a34;color:#dcd6c8;font:600 15px Rajdhani,sans-serif;cursor:pointer}
  .mpr:hover{border-color:#e0a040}.mpr-none{color:#6a7482;font-size:13px;padding:6px 0}
  #mp-status{min-height:20px;margin-top:10px;color:#9aa8b8;font-size:13px}
  #mp-lobby details{margin-top:10px;color:#6a7482;font-size:12px}#mp-lobby details input{font-size:13px;letter-spacing:0}
  #mp-score{position:fixed;top:236px;right:24px;min-width:190px;background:rgba(8,10,14,.55);border:1px solid rgba(255,255,255,.1);font:600 15px Rajdhani,sans-serif;color:#e6e0d0;pointer-events:none;z-index:6}
  #mp-score .mps-h{font-size:11px;letter-spacing:2px;color:#e0a040;padding:5px 10px;border-bottom:1px solid rgba(255,255,255,.08)}
  #mp-score div:not(.mps-h){display:flex;justify-content:space-between;padding:2px 10px}#mp-score .me{color:#ffd890}
  #mp-room{position:fixed;left:50%;bottom:16px;transform:translateX(-50%);font:600 13px Rajdhani,sans-serif;letter-spacing:3px;color:rgba(255,255,255,.55);pointer-events:none;z-index:6}`;
  document.head.appendChild(s);
}

/* ---------------- THE YARD: container port arena ---------------- */
const YARD = { spawns: [] };
function buildYard() {
  WORLD = 70;
  floorPlane(-70, -70, 70, 70, 0, M.cityRoad, 10);
  const cols = [0x8a2a1c, 0x2a5a8a, 0x3a6a3a, 0xb07a20, 0x5a5a60, 0x7a3a6a];
  const cmat = cols.map(c => new THREE.MeshStandardMaterial({ color: c, roughness: 0.7, metalness: 0.35, map: TEX.wall || null }));
  const R = mulberry(1234);
  const box = (x, z, rot, stack) => { for (let i = 0; i < stack; i++) { const m = solid(rot ? 2.5 : 6.1, 2.6, rot ? 6.1 : 2.5, cmat[Math.floor(R() * cmat.length)], x, i * 2.6, z, { cover: true, noGround: i > 0 }); m.userData.col.metal = true; } };
  // perimeter wall
  for (const [x0, z0, x1, z1] of [[-60, -60, 60, -60], [-60, 60, 60, 60], [-60, -60, -60, 60], [60, -60, 60, 60]]) wall(x0, z0, x1, z1, { h: 5, mat: M.concrete, t: 0.6 });
  // container rows with lanes between them
  for (let gx = -45; gx <= 45; gx += 15) for (let gz = -45; gz <= 45; gz += 15) {
    if (Math.abs(gx) < 8 && Math.abs(gz) < 8) continue;
    if (R() < 0.25) continue;
    const rot = R() < 0.5, st = 1 + (R() < 0.35 ? 1 : 0) + (R() < 0.1 ? 1 : 0);
    box(gx + (R() - 0.5) * 4, gz + (R() - 0.5) * 4, rot, st);
    if (R() < 0.4) box(gx + (rot ? 3 : 0), gz + (rot ? 0 : 3), rot, 1);
  }
  // center: crane base + crates
  for (const [x, z] of [[-4, -4], [4, -4], [-4, 4], [4, 4]]) solid(1, 14, 1, M.hazard || M.metal, x, 0, z, {});
  solid(10, 0.8, 10, M.metal, 0, 14, 0, { col: false });
  for (let i = 0; i < 10; i++) crate(rand(-40, 40), 0, rand(-40, 40), 1.3, rand(0, 3));
  for (let x = -50; x <= 50; x += 20) for (const z of [-50, 50]) Fixtures.add(new V3(x, 6, z), 0xffd8a0, 1.3, 24, 0);
  for (let i = 0; i < 14; i++) { const a = i / 14 * TAU, r = i % 2 ? 50 : 30; YARD.spawns.push(new V3(Math.cos(a) * r, 0, Math.sin(a) * r)); }
  const pts = []; for (let x = -52; x <= 52; x += 7.5) for (let z = -52; z <= 52; z += 7.5) pts.push([x, z]);
  buildNav(pts);
}
function mpBots() {
  const names = ['Hex', 'Vale', 'Corvo', 'Dune', 'Shard', 'Kite', 'Brick'];
  names.forEach((n, i) => { const id = 1000 + i; MP.names[id] = n; MP.scores[id] = 0; mpSpawnBot(id); });
  MP.renderScores();
}
function mpSpawnBot(id) {
  const sp = pick(YARD.spawns.filter(s => s.distanceTo(player.pos) > 18));
  const e = addEnemy(pick(['rifle', 'rifle', 'shotgun']), sp.x, sp.z, { group: 'b' + id, combat: true, patrol: [[rand(-40, 40), rand(-40, 40)], [rand(-40, 40), rand(-40, 40)]] });
  e.botId = id; e.T = Object.assign({}, e.T, { sight: 90, acc: e.T.acc * 1.3 }); e.tag = mpTag(MP.names[id]); e.mesh.add(e.tag);
}

LEVELS.mp = {
  id: 'mp', mode: true, music: 'br', name: 'MULTIPLAYER · THE YARD', chapter: 'BLACKLINE 2 · MULTIPLAYER', title: 'THE YARD', sub: 'FREE-FOR-ALL',
  env: Object.assign({}, LEVELS[5].env, { fog: [0x2c2226, 60, 300], fixtures: 8, shadowSize: 70 }),
  cast: CASTS.rifle.concat(CASTS.heavy, ['maya', 'alex', 'swatguy']),
  h: () => 0, onRoad: () => true, bounds: 70,
  build() { buildYard(); mpCss(); const sc = document.createElement('div'); sc.id = 'mp-score'; $('hud').appendChild(sc); const rc = document.createElement('div'); rc.id = 'mp-room'; $('hud').appendChild(rc); },
  menuFocus: new V3(0, 0, 0),
  menuCam(t) { return { pos: new V3(Math.cos(t * 0.1) * 50, 22, Math.sin(t * 0.1) * 50), look: new V3(0, 0, 0) }; },
  lobby() { MP.openLobby(); },
  radar() {},
  tips: [],
  cpStep: [0],
  reset() {
    for (const k in MP.remotes) { MP.remotes[k].alive = false; }
    const sp = pick(YARD.spawns);
    return { spawn: [sp.x, sp.z, Math.atan2(sp.x, sp.z)], loadout: ['pistol', 'ar'], cur: 'ar', armor: 0, nades: 1 };
  },
  afterReset() { for (const k in MP.remotes) { const r = MP.remotes[k]; if (!enemies.includes(r)) { r.alive = true; enemies.push(r); scene.add(r.mesh); } } },
  respawn() { if (MP.lastHitBy === 0 && !MP.practice) {} MP.respawnNow(); },
  onShot(o, e) { if (!MP.practice) MP.relay({ k: 'shot', o: [+o.x.toFixed(2), +o.y.toFixed(2), +o.z.toFixed(2)], e: [+e.x.toFixed(2), +e.y.toFixed(2), +e.z.toFixed(2)], w: WDEF[cur] && WDEF[cur].snd }); },
  onKill(e) {
    if (!MP.practice || !e.botId) return;
    MP.addKill(MP.id, e.botId, false); const id = e.botId; after(4, () => { if (LV.id === 'mp') mpSpawnBot(id); });
  },
  steps: [{ id: 'mp', cp: 0, silent: true, text: 'Free-for-all · first to 20', marker: () => null,
    update(dt) {
      MP.tick(dt);
      // practice: a bot that kills you scores
      if (MP.practice && !player.alive && !MP.deathCounted) { MP.deathCounted = true; const b = enemies.filter(e => e.alive && e.botId).sort((a, b2) => a.pos.distanceTo(player.pos) - b2.pos.distanceTo(player.pos))[0]; if (b) MP.addKill(b.botId, MP.id, false); }
      if (player.alive) MP.deathCounted = false;
      $('obj-sub').textContent = MP.practice ? 'Offline practice' : (Object.keys(MP.players).length + ' player' + (Object.keys(MP.players).length === 1 ? '' : 's') + ' in room ' + MP.code + (Object.keys(MP.players).length < 2 ? ' · waiting for others to join' : ''));
      return false;
    } }],
  intro: null,
  complete() {}
};
