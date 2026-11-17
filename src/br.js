/* ============================================================
   BATTLE ROYALE: "KESTREL VALLEY". 24 drop in, one walks out.
   Skydive in, loot the towns, stay inside the zone.
   ============================================================ */
const BR = { towns: [], zone: null, phase: 0, phaseT: 0, air: false, chute: false, alive: 0, placed: 0, simT: 20, names: [], kills: 0 };
const BR_NAMES = ['Viper', 'Nomad', 'Kestrel', 'Ghost', 'Hollow', 'Rook', 'Cinder', 'Wraith', 'Talon', 'Mako', 'Sable', 'Onyx', 'Drift', 'Havoc', 'Atlas', 'Jinx', 'Raven', 'Vandal', 'Echo', 'Bishop', 'Saint', 'Fable', 'Torque', 'Lynx', 'Banshee', 'Moth'];
const BR_LOOT = [['pistol', 10], ['revolver', 6], ['smg', 10], ['shotgun', 8], ['ar', 9], ['burst', 7], ['dmr', 5], ['autoshotgun', 4], ['lmg', 3], ['sniper', 3], ['rocket', 1], ['arc', 1]];
const BR_ZONES = [{ r: 430, wait: 100, shrink: 45, dps: 1 }, { r: 250, wait: 45, shrink: 35, dps: 2 }, { r: 140, wait: 40, shrink: 30, dps: 4 }, { r: 75, wait: 35, shrink: 25, dps: 7 }, { r: 32, wait: 30, shrink: 20, dps: 10 }, { r: 0, wait: 20, shrink: 30, dps: 15 }];
const BR_TOWNS = [{ n: 'PINE HOLLOW', x: -220, z: -180 }, { n: 'RUSTWATER', x: 180, z: -230 }, { n: 'THE QUARRY', x: 260, z: 120 }, { n: 'MERIDIAN', x: -40, z: 30 }, { n: 'SALT FLATS', x: -260, z: 210 }, { n: 'KESTREL FIELD', x: 70, z: 280 }, { n: 'OLD MILL', x: -330, z: -30 }];

function brH(x, z) {
  let h = (fbm(x * 0.0042 + 3, z * 0.0042 - 5, 4) - 0.5) * 70 + (fbm(x * 0.012, z * 0.012, 3) - 0.5) * 8;
  const e = Math.max(Math.abs(x), Math.abs(z)); h += smooth(380, 470, e) * 90;
  for (const t of BR_TOWNS) { const d = Math.hypot(x - t.x, z - t.z); if (d < 70) { const th = t.h !== undefined ? t.h : (t.h = (fbm(t.x * 0.0042 + 3, t.z * 0.0042 - 5, 4) - 0.5) * 70); h = lerp(th, h, smooth(38, 70, d)); } }
  return h;
}
const BR_COL = {};
function brColor(x, z, h, c) {
  if (!BR_COL.g) Object.assign(BR_COL, { g: new THREE.Color(0x3e5e26), g2: new THREE.Color(0x56702e), dry: new THREE.Color(0x7e7044), rock: new THREE.Color(0x6a6458), dirt: new THREE.Color(0x6e5a40) });
  const C = BR_COL; c.copy(C.g).lerp(C.g2, fbm(x * 0.02, z * 0.02, 3)); c.lerp(C.dry, fbm(x * 0.006 + 9, z * 0.006, 3) * 0.5);
  const s = Math.abs(brH(x + 2, z) - h) + Math.abs(brH(x, z + 2) - h); c.lerp(C.rock, clamp((s - 1.4) / 3, 0, 0.9));
  for (const t of BR_TOWNS) { const d = Math.hypot(x - t.x, z - t.z); if (d < 45) c.lerp(C.dirt, (1 - smooth(25, 45, d)) * 0.6); }
}
function brHouse(x, z, ry, big) {
  const y = brH(x, z), w = big ? 12 : 8, d = big ? 10 : 9, rot = Math.round(ry / (Math.PI / 2)) % 2;
  const W2 = rot ? d / 2 : w / 2, D2 = rot ? w / 2 : d / 2;
  const mat = pick([M.wall, M.wallDark, M.concrete]), o = { h: 3.4, mat, t: 0.3, y0: y, dw: 1.6, dh: 2.4 };
  solid(W2 * 2, 0.25, D2 * 2, M.floor, x, y - 0.2, z, { col: true });
  const side = Math.floor(Math.random() * 4);
  wall(x - W2, z - D2, x + W2, z - D2, Object.assign({}, o, { doors: side === 0 ? [x] : [x - W2 * 0.5] }));
  wall(x - W2, z + D2, x + W2, z + D2, Object.assign({}, o, { doors: side === 1 ? [x] : [] }));
  wall(x - W2, z - D2, x - W2, z + D2, Object.assign({}, o, { doors: side === 2 ? [z] : [] }));
  wall(x + W2, z - D2, x + W2, z + D2, Object.assign({}, o, { doors: side === 3 ? [z + D2 * 0.4] : [] }));
  const roof = new THREE.Mesh(B(W2 * 2 + 0.8, 0.3, D2 * 2 + 0.8), new THREE.MeshStandardMaterial({ color: pick([0x5a2a22, 0x3a3e44, 0x4a3a2a]), roughness: 0.85 }));
  roof.position.set(x, y + 3.55, z); roof.castShadow = true; scene.add(roof); colliderFromObject(roof, 0, { noGround: false });
  if (big) wall(x - W2, z, x + W2 * 0.2, z, Object.assign({}, o, { doors: [x - W2 * 0.4] }));
  return { x, z, y, W2, D2 };
}
function buildBR() {
  WORLD = 470;
  buildTerrain({ size: 1000, seg: 220, color: brColor });
  // towns
  for (const t of BR_TOWNS) {
    t.houses = []; const n = 5 + Math.floor(Math.random() * 4);
    for (let i = 0; i < n; i++) {
      const a = i / n * TAU + rand(-0.2, 0.2), r = rand(12, 32);
      t.houses.push(brHouse(t.x + Math.cos(a) * r, t.z + Math.sin(a) * r, Math.round(rand(0, 3)) * Math.PI / 2, Math.random() < 0.3));
    }
    sign(t.n, t.x, brH(t.x, t.z) + 3.2, t.z - 40, 0, { w: 5, fg: '#f0e0b0', bg: '#2a2420' });
    for (let i = 0; i < 4; i++) { const a = rand(0, TAU), r = rand(4, 10); crate(t.x + Math.cos(a) * r, brH(t.x + Math.cos(a) * r, t.z + Math.sin(a) * r), t.z + Math.sin(a) * r, 1.2, rand(0, 3)); }
    BR.towns.push(t);
  }
  // radio tower in the middle of Meridian
  const mt = BR_TOWNS[3]; const tw = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 1.2, 40, 6), M.metal); tw.position.set(mt.x + 3, brH(mt.x, mt.z) + 20, mt.z + 3); scene.add(tw);
  const bl = new THREE.Mesh(B(0.5, 0.5, 0.5), M.redLamp); bl.position.set(mt.x + 3, brH(mt.x, mt.z) + 40.4, mt.z + 3); scene.add(bl);
  // forest: instanced pines (visual) + trunk colliders
  const N = 900, cone = new THREE.ConeGeometry(2.4, 9, 7), trunk = new THREE.CylinderGeometry(0.3, 0.4, 3, 6);
  const leaves = new THREE.InstancedMesh(cone, new THREE.MeshStandardMaterial({ color: 0x2c4a2a, roughness: 0.95, flatShading: true }), N), trunks = new THREE.InstancedMesh(trunk, new THREE.MeshStandardMaterial({ color: 0x4a3626, roughness: 1 }), N);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sv = new V3(); let k = 0;
  for (let i = 0; i < N * 3 && k < N; i++) {
    const x = rand(-440, 440), z = rand(-440, 440); if (BR_TOWNS.some(t => Math.hypot(x - t.x, z - t.z) < 55)) continue;
    if (fbm(x * 0.01 + 40, z * 0.01, 3) < 0.48) continue;
    const y = brH(x, z), s = rand(0.7, 1.4);
    m4.compose(sv.set(x, y + 6 * s, z), q, new V3(s, s, s)); leaves.setMatrixAt(k, m4);
    m4.compose(sv.set(x, y + 1.5 * s, z), q, new V3(s, s, s)); trunks.setMatrixAt(k, m4);
    addBoxCollider(new V3(x - 0.35, y, z - 0.35), new V3(x + 0.35, y + 4, z + 0.35), null, { cover: true }); k++;
  }
  leaves.count = trunks.count = k; leaves.castShadow = true; scene.add(leaves); scene.add(trunks);
  for (let i = 0; i < 70; i++) { const x = rand(-420, 420), z = rand(-420, 420); if (BR_TOWNS.some(t => Math.hypot(x - t.x, z - t.z) < 50)) continue; addRock(x, z, rand(2, 6), rand(1.5, 4), rand(2, 5), rand(0, 3), i, M.rock, true); }
  // zone wall
  const zg = new THREE.CylinderGeometry(1, 1, 400, 96, 1, true);
  const zm = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, uniforms: { t: { value: 0 } },
    vertexShader: 'varying vec2 vUv; varying vec3 vW; void main(){ vUv=uv; vec4 w=modelMatrix*vec4(position,1.); vW=w.xyz; gl_Position=projectionMatrix*viewMatrix*w; }',
    fragmentShader: 'uniform float t; varying vec2 vUv; varying vec3 vW; void main(){ float s=sin(vUv.x*600.+vUv.y*80.-t*3.)*.5+.5; float fade=smoothstep(0.,.05,vUv.y)*(1.-smoothstep(.3,.9,vUv.y)); gl_FragColor=vec4(vec3(.25,.55,1.)*(.35+.4*s),.55*fade); }' });
  BR.wall = new THREE.Mesh(zg, zm); BR.wall.frustumCulled = false; scene.add(BR.wall);
  NAV.nodes = []; NAV.adj = [];
}
function brLoot(p) {
  const tot = BR_LOOT.reduce((a, b) => a + b[1], 0); let r = Math.random() * tot, w = 'pistol';
  for (const [k, n] of BR_LOOT) { r -= n; if (r <= 0) { w = k; break; } }
  if (!WDEF[w]) w = 'ar';
  pickups.push(new Pickup('weapon', p, { weapon: w }));
}
function brZoneSetup(i) {
  const Z = BR_ZONES[i], prev = BR.zone;
  const c = prev ? (() => { const a = rand(0, TAU), m = Math.max(0, prev.r - Z.r) * Math.sqrt(Math.random()) * 0.9; return new V3(prev.c.x + Math.cos(a) * m, 0, prev.c.z + Math.sin(a) * m); })() : new V3(rand(-120, 120), 0, rand(-120, 120));
  BR.next = { c, r: Z.r }; BR.phase = i; BR.phaseT = Z.wait; BR.shrinking = false;
  if (!prev) BR.zone = { c: c.clone(), r: 470 };
  BR.from = { c: BR.zone.c.clone(), r: BR.zone.r };
  if (i > 0) HUD.notify('THE ZONE IS CLOSING', 'Phase ' + (i + 1) + ' · get inside the new circle', 'obj');
}
function brUpdateZone(dt) {
  const Z = BR_ZONES[BR.phase]; BR.phaseT -= dt;
  if (!BR.shrinking && BR.phaseT <= 0) { BR.shrinking = true; BR.phaseT = Z.shrink; HUD.feed('⚠ ZONE SHRINKING', 'red'); }
  else if (BR.shrinking) {
    const k = 1 - Math.max(0, BR.phaseT) / Z.shrink;
    BR.zone.c.lerpVectors(BR.from.c, BR.next.c, k); BR.zone.r = lerp(BR.from.r, BR.next.r, k);
    if (BR.phaseT <= 0 && BR.phase < BR_ZONES.length - 1) brZoneSetup(BR.phase + 1);
  }
  BR.wall.position.set(BR.zone.c.x, 100, BR.zone.c.z); BR.wall.scale.set(Math.max(0.1, BR.zone.r), 1, Math.max(0.1, BR.zone.r)); BR.wall.material.uniforms.t.value = gameTime;
  const dps = BR_ZONES[BR.phase].dps, out = p => Math.hypot(p.x - BR.zone.c.x, p.z - BR.zone.c.z) > BR.zone.r;
  BR.dmgT = (BR.dmgT || 0) - dt;
  if (BR.dmgT <= 0) {
    BR.dmgT = 1;
    if (player.alive && !BR.air && out(player.pos)) { hurtPlayer(dps, null); HUD.feed('OUTSIDE THE ZONE', 'red'); }
    for (const e of enemies) if (e.alive && out(e.pos)) { e.hp -= dps * 1.5; if (e.hp <= 0) { e.counted = true; e.die(null, false, 'zone'); brElim(e, null); } }
  }
  // bots head for safety
  for (const e of enemies) {
    if (!e.alive || e.state === 'combat') continue;
    const tgt = BR.next && (BR.shrinking || BR.phaseT < 20) ? BR.next : BR.zone;
    if (Math.hypot(e.pos.x - tgt.c.x, e.pos.z - tgt.c.z) > tgt.r * 0.8) { const a = Math.atan2(e.pos.z - tgt.c.z, e.pos.x - tgt.c.x), r = tgt.r * 0.5; e.patrol = [[tgt.c.x + Math.cos(a) * r, tgt.c.z + Math.sin(a) * r]]; e.pi = 0; }
  }
}
function brAliveBots() { return enemies.filter(e => e.alive && e.isBot); }
function brElim(victim, by) {
  const n = 1 + brAliveBots().length + 0;
  HUD.feed((by || 'The zone') + ' eliminated ' + victim.botName + ' · ' + n + ' left', by === 'You' ? 'gold' : '');
}
function brCss() {
  if ($('br-css')) return;
  const s = document.createElement('style'); s.id = 'br-css'; s.textContent = `
  #br-hud{position:fixed;top:18px;left:50%;transform:translateX(-50%);display:flex;gap:10px;font-family:Rajdhani,sans-serif;pointer-events:none;z-index:6}
  #br-hud div{background:rgba(10,12,16,.55);border:1px solid rgba(255,255,255,.12);padding:6px 12px;color:#f2ead8;font-weight:700;font-size:20px;letter-spacing:1px;text-align:center}
  #br-hud small{display:block;font-size:11px;color:#9aa4b0;letter-spacing:2px;font-weight:600}
  #br-alt{position:fixed;left:50%;top:62%;transform:translateX(-50%);font:700 22px Rajdhani,sans-serif;color:#fff;text-shadow:0 2px 8px #000;pointer-events:none;z-index:6;text-align:center}`;
  document.head.appendChild(s);
  const h = document.createElement('div'); h.id = 'br-hud'; h.innerHTML = '<div><small>ALIVE</small><span id="br-alive">24</span></div><div><small>KILLS</small><span id="br-kills">0</span></div><div><small>ZONE</small><span id="br-zone">--</span></div>'; $('hud').appendChild(h);
  const a = document.createElement('div'); a.id = 'br-alt'; $('hud').appendChild(a);
}

LEVELS.br = {
  id: 'br', mode: true, music: 'br', name: 'BATTLE ROYALE · KESTREL VALLEY', chapter: 'BLACKLINE 2 · BATTLE ROYALE', title: 'KESTREL VALLEY', sub: '24 DROP IN. ONE WALKS OUT.',
  env: Object.assign({}, LEVELS[7].env, { fog: [0xc8d8e0, 220, 1100] }),
  cast: CASTS.rifle.concat(CASTS.heavy, ['maya', 'alex', 'swatguy']),
  h: brH, onRoad: () => false, bounds: 470,
  build() { buildBR(); },
  menuFocus: new V3(0, 0, 0),
  menuCam(t) { return { pos: new V3(Math.cos(t * 0.05) * 300, 140, Math.sin(t * 0.05) * 300), look: new V3(0, 0, 0) }; },
  radar() {},
  tips: ['Press Space in the air to open your parachute early.', 'Bots drop their weapons. Loot the bodies.', 'The blue wall is the zone. Being outside it hurts more every phase.', 'Houses hold the best loot. Check every room.'],
  cpStep: [0],
  reset() {
    brCss(); BR.zone = null; BR.kills = 0; BR.air = true; BR.chute = false; BR.simT = 25; stats.kills = 0;
    brZoneSetup(0);
    // loot
    for (const t of BR.towns) for (const h of t.houses) {
      const n = 1 + Math.floor(Math.random() * 3);
      for (let i = 0; i < n; i++) { const p = new V3(h.x + rand(-h.W2 + 1, h.W2 - 1), h.y + 0.15, h.z + rand(-h.D2 + 1, h.D2 - 1)); if (Math.random() < 0.55) brLoot(p); else pickups.push(new Pickup(pick(['ammo', 'ammo', 'armor', 'health', 'grenades']), p)); }
    }
    for (let i = 0; i < 40; i++) { const x = rand(-400, 400), z = rand(-400, 400); const p = new V3(x, brH(x, z) + 0.15, z); Math.random() < 0.5 ? brLoot(p) : pickups.push(new Pickup('ammo', p)); }
    // bots
    const names = BR_NAMES.slice().sort(() => Math.random() - 0.5);
    for (let i = 0; i < 23; i++) {
      const t = BR.towns[i % BR.towns.length], a = rand(0, TAU), r = rand(5, 40), x = t.x + Math.cos(a) * r, z = t.z + Math.sin(a) * r;
      const e = addEnemy(pick(['rifle', 'rifle', 'shotgun', 'rifle', 'sniper']), x, z, { group: 'bot' + i, patrol: [[x, z], [t.x + rand(-30, 30), t.z + rand(-30, 30)]] });
      e.isBot = true; e.botName = names[i]; e.hp *= 1.2; e.T = Object.assign({}, e.T, { acc: e.T.acc * 1.4, sight: e.T.sight * 0.9 });
    }
    const sx = rand(-250, 250), sz = rand(-250, 250);
    return { spawn: [sx, sz, Math.atan2(sx, sz)], y: brH(sx, sz) + 320, unarmed: true, armor: 0, nades: 0 };
  },
  afterReset() { player.vel.set(0, 0, 0); player.onGround = false; BR.air = true; },
  playerPhys(dt) {
    if (!BR.air) return;
    const g = brH(player.pos.x, player.pos.z), alt = player.pos.y - g;
    if (!BR.chute && (alt < 45 || (keys.Space && alt < 300))) { BR.chute = true; AudioSys.ui('pickup'); HUD.feed('PARACHUTE OPEN'); }
    player.vel.y = Math.max(player.vel.y, BR.chute ? -5 : -26);
    camera.getWorldDirection(_v1); _v1.y = 0; _v1.normalize();
    const fwd = (keys.KeyW ? 1 : 0) - (keys.KeyS ? 1 : 0), sd = (keys.KeyD ? 1 : 0) - (keys.KeyA ? 1 : 0), sp = BR.chute ? 11 : 24;
    player.pos.x += (_v1.x * fwd - _v1.z * sd) * sp * dt; player.pos.z += (_v1.z * fwd + _v1.x * sd) * sp * dt;
    $('br-alt').innerHTML = alt > 2 ? `${Math.round(alt)} m<br><small style="font-size:14px;opacity:.75">${BR.chute ? 'WASD to steer' : 'SPACE: open parachute · W to dive forward'}</small>` : '';
    if (player.onGround && alt < 1.5) { BR.air = false; $('br-alt').innerHTML = ''; HUD.notify('YOU HAVE LANDED', 'Find a weapon. Stay in the zone.', 'obj'); }
  },
  onKill(e) { if (e.isBot && !e.counted) { e.counted = true; BR.kills++; brElim(e, 'You'); } },
  steps: [{ id: 'br', cp: 0, silent: true, text: 'Be the last one standing', marker: () => null,
    update(dt) {
      brUpdateZone(dt);
      // the other 23 fight each other off-screen
      BR.simT -= dt;
      if (BR.simT <= 0) {
        BR.simT = rand(10, 24) * (BR.phase >= 3 ? 0.6 : 1);
        const far = brAliveBots().filter(e => e.pos.distanceTo(player.pos) > 140 && e.state !== 'combat');
        if (far.length >= 2) { const v = pick(far), k = pick(far.filter(x => x !== v)); v.counted = true; v.die(null, false, 'bot'); brElim(v, k.botName); }
      }
      for (const e of enemies) if (e.isBot && !e.alive && !e.counted) { e.counted = true; brElim(e, null); }
      const alive = 1 + brAliveBots().length;
      $('br-alive').textContent = player.alive ? alive : alive - 1; $('br-kills').textContent = BR.kills;
      const Z = BR_ZONES[BR.phase]; $('br-zone').textContent = (BR.shrinking ? '◀ ' : '') + Math.floor(Math.max(0, BR.phaseT) / 60) + ':' + String(Math.floor(Math.max(0, BR.phaseT) % 60)).padStart(2, '0'); void Z;
      const dz = Math.hypot(player.pos.x - BR.zone.c.x, player.pos.z - BR.zone.c.z) - BR.zone.r;
      $('obj-sub').textContent = dz > 0 ? `OUTSIDE THE ZONE · ${Math.round(dz)} m to safety` : (BR.next ? (Math.hypot(player.pos.x - BR.next.c.x, player.pos.z - BR.next.c.z) > BR.next.r ? 'Next circle: move ' + Math.round(Math.hypot(player.pos.x - BR.next.c.x, player.pos.z - BR.next.c.z) - BR.next.r) + ' m' : 'You are inside the next circle') : '');
      AudioSys.combatTarget = Math.max(AudioSys.combatTarget * 0.99, enemies.some(e => e.alive && e.state === 'combat') ? 0.8 : 0.15);
      if (!player.alive) { showDeath.msg = `You placed #${alive} of 24 with ${BR.kills} kill${BR.kills === 1 ? '' : 's'}.`; return false; }
      return alive === 1;
    } }],
  marker() { return null; },
  intro: null,
  complete() {
    Store.set('br_wins', Store.get('br_wins', 0) + 1); achieve('brwin', 'Last One Standing', 'Win a Battle Royale');
    showEnding({ chapter: 'BATTLE ROYALE · KESTREL VALLEY', title: '#1 · WINNER', tease: BR.kills + ' eliminations · ' + Store.get('br_wins', 1) + ' total wins', lines: [], cardAt: 400 });
  }
};
