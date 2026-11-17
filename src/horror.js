/* ============================================================
   HORROR: "WARD 9". A dead hospital, one flashlight, four fuses.
   Something tall walks the halls and it hunts by light and sound.
   The mannequins only move when you are not looking.
   ============================================================ */
const HR = { fuses: 0, need: 4, power: false, battery: 100, light: true, stalker: null, awake: false, scares: [], whisperT: 30, heartT: 0, rooms: [], exitOpen: false, chaseT: 0, lastSeenT: -99 };

function hrCss() {
  if ($('hr-css')) return;
  const s = document.createElement('style'); s.id = 'hr-css'; s.textContent = `
  body.mode-horror #mission-name{color:#8a1010;letter-spacing:6px}
  body.mode-horror #radar{display:none}
  #hr-bat{position:fixed;left:34px;bottom:120px;font:600 13px Rajdhani,sans-serif;letter-spacing:3px;color:#c8c0b0;pointer-events:none;z-index:6}
  #hr-bat i{display:block;width:120px;height:6px;margin-top:4px;background:rgba(255,255,255,.12)}
  #hr-bat i b{display:block;height:100%;background:#e8dcb0}
  #hr-noise{position:fixed;inset:0;pointer-events:none;z-index:5;opacity:.09;mix-blend-mode:screen;background-size:256px}
  #hr-vig{position:fixed;inset:0;pointer-events:none;z-index:5;background:radial-gradient(ellipse at center,rgba(0,0,0,0) 35%,rgba(0,0,0,.85) 100%);opacity:.8;transition:background .3s}
  #hr-vig.near{background:radial-gradient(ellipse at center,rgba(40,0,0,0) 25%,rgba(70,0,0,.9) 100%)}
  #hr-scare{position:fixed;inset:0;pointer-events:none;z-index:7;background:#000;opacity:0}`;
  document.head.appendChild(s);
  const b = document.createElement('div'); b.id = 'hr-bat'; b.innerHTML = 'FLASHLIGHT · L<i><b id="hr-batf"></b></i>'; $('hud').appendChild(b);
  const n = document.createElement('div'); n.id = 'hr-noise'; document.body.appendChild(n);
  const cv = document.createElement('canvas'); cv.width = cv.height = 256; const c = cv.getContext('2d'), im = c.createImageData(256, 256);
  for (let i = 0; i < im.data.length; i += 4) { const v = Math.random() * 255; im.data[i] = im.data[i + 1] = im.data[i + 2] = v; im.data[i + 3] = 255; } c.putImageData(im, 0, 0); n.style.backgroundImage = `url(${cv.toDataURL()})`;
  const v = document.createElement('div'); v.id = 'hr-vig'; document.body.appendChild(v);
  const sc = document.createElement('div'); sc.id = 'hr-scare'; document.body.appendChild(sc);
  document.addEventListener('keydown', e => { if (e.code === 'KeyL' && state === 'play') { HR.light = !HR.light; AudioSys.ui('click'); } });
}

function buildHorror() {
  WORLD = 60;
  const dirty = M.wall.clone(); dirty.color.setHex(0x8a8678);
  const floor = M.floor.clone(); floor.color.setHex(0x6a6a62);
  floorPlane(-42, -32, 42, 32, 0, floor, 3); ceilPlane(-42, -32, 42, 32, 3.6, M.ceil);
  const o = { h: 3.6, mat: dirty, t: 0.3, dw: 2.2, dh: 2.4 };
  const W = (x0, z0, x1, z1, doors, extra) => wall(x0, z0, x1, z1, Object.assign({}, o, { doors: doors || [] }, extra || {}));
  // outer shell (exit doors on the west end)
  W(-40, -30, 40, -30); W(-40, 30, 40, 30); W(40, -30, 40, 30); W(-40, -30, -40, 30, [0], { dw: 3.6, dh: 3 });
  // main corridors: E-W at z=0 and N-S at x=0, both 4 m wide
  const roomX = k => 2 + 9.5 * (k + 0.5);
  for (const sz of [-1, 1]) {
    W(-40, 2 * sz, 40, 2 * sz, [0, ...[0, 1, 2, 3].flatMap(k => [roomX(k), -roomX(k)])].filter((v, i) => i === 0 || Math.abs(v) > 3), {});
  }
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    // gap in the N-S corridor wall where it meets the E-W corridor is already there (wall stops at z=±2)
    W(2 * sx, 2 * sz, 2 * sx, 30 * sz, [23 * sz], {});
    for (let k = 1; k <= 3; k++) W(sx * (2 + 9.5 * k), 2 * sz, sx * (2 + 9.5 * k), 30 * sz, [9 * sz], {});
    W(2 * sx, 16 * sz, 40 * sx, 16 * sz, [0, 1, 2, 3].map(k => sx * roomX(k)));
    for (let k = 0; k < 4; k++) for (const zc of [9, 23]) HR.rooms.push(new V3(sx * roomX(k), 0, sz * zc));
  }
  // corridor lights: most are dead, a few flicker
  for (let x = -36; x <= 36; x += 8) { const alive = Math.random() < 0.35; lightPanel(x, 3.6, 0, { light: alive, color: 0xcfe0d8, i: 0.7, dist: 9, flicker: alive ? 0.85 : 0 }); }
  for (let z = -26; z <= 26; z += 8) if (Math.abs(z) > 3) { const alive = Math.random() < 0.3; lightPanel(0, 3.6, z, { light: alive, color: 0xcfe0d8, i: 0.6, dist: 8, flicker: alive ? 0.9 : 0 }); }
  // furniture: gurneys, beds, cabinets, wheelchairs
  for (const r of HR.rooms) {
    const n = 2 + Math.floor(Math.random() * 3);
    for (let i = 0; i < n; i++) {
      const x = r.x + (Math.random() < 0.5 ? -1 : 1) * rand(1.9, 3.4), z = r.z + rand(-4.5, 4.5);
      if (Math.random() < 0.5) { const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = rand(0, TAU); scene.add(g); part(g, B(0.9, 0.12, 2.0), new THREE.MeshStandardMaterial({ color: 0xb8b4a8, roughness: 0.7 }), 0, 0.75, 0); part(g, B(0.85, 0.08, 1.9), M.metal, 0, 0.62, 0); for (const [a, b2] of [[-0.4, -0.9], [0.4, -0.9], [-0.4, 0.9], [0.4, 0.9]]) part(g, B(0.04, 0.6, 0.04), M.metal, a, 0.3, b2); g.updateMatrixWorld(true); colliderFromObject(g.children[0], 0.05, { cover: true }); }
      else solid(rand(0.6, 1.2), rand(1, 1.9), 0.5, M.metal, x, 0, z, { cover: true, ry: rand(0, 3) });
    }
  }
  // blood smears and papers
  const bm = new THREE.MeshBasicMaterial({ color: 0x2a0303, transparent: true, opacity: 0.75, depthWrite: false });
  for (let i = 0; i < 40; i++) { const m = new THREE.Mesh(new THREE.CircleGeometry(rand(0.2, 0.9), 9), bm); m.rotation.x = -Math.PI / 2; m.scale.set(1, rand(1, 3), 1); m.rotation.z = rand(0, 3); m.position.set(rand(-38, 38), 0.02, rand(-1.8, 1.8) + (Math.random() < 0.5 ? 0 : rand(-26, 26))); scene.add(m); }
  // fuse box (central hall) and the exit
  HR.box = solid(1.2, 1.6, 0.4, new THREE.MeshStandardMaterial({ color: 0x3a4038, roughness: 0.6, metalness: 0.5 }), 0, 0.6, -1.85, {});
  sign('WARD 9', 0, 3.1, -1.6, 0, { w: 2.2, fg: '#9a2a1a', bg: '#0a0a0a' });
  HR.exitDoor = solid(0.3, 3.0, 3.6, M.metal, -40.2, 0, 0, {});
  HR.exitSign = sign('EXIT', -39.6, 3.1, 0, Math.PI / 2, { w: 1.4, fg: '#3a0a0a', bg: '#050505' });
  // nav
  const pts = []; for (let x = -38; x <= 38; x += 6) pts.push([x, 0]); for (let z = -28; z <= 28; z += 6) if (Math.abs(z) > 2) pts.push([0, z]);
  // rooms + a node on each side of every door (never in the doorway itself, so nothing cuts the corner)
  for (const r of HR.rooms) { pts.push([r.x, r.z]); const sz = Math.sign(r.z); if (Math.abs(r.z) < 16) { pts.push([r.x, sz * 0.9], [r.x, sz * 3.1], [r.x, sz * 14.9], [r.x, sz * 17.1]); } }
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) { pts.push([sx * 0.9, sz * 23], [sx * 3.1, sz * 23]); for (let k = 1; k <= 3; k++) { const x = sx * (2 + 9.5 * k); pts.push([x - 1.1, sz * 9], [x + 1.1, sz * 9]); } }
  buildNav(pts);
  // flashlight
  HR.spot = new THREE.SpotLight(0xfff0d8, 0, 34, 0.48, 0.85, 1.4); HR.spot.castShadow = true; HR.spot.shadow.mapSize.set(512, 512); HR.spot.shadow.bias = -0.0008;
  scene.add(HR.spot, HR.spot.target);
  HR.fill = new THREE.PointLight(0xfff0d8, 0, 6, 2); scene.add(HR.fill);
}
function hrScare(kind) {
  const el = $('hr-scare');
  if (kind === 'flash') { el.style.transition = 'none'; el.style.opacity = 0.95; setTimeout(() => { el.style.transition = 'opacity .5s'; el.style.opacity = 0; }, 90); }
  Growl.play('sting', null, { gain: 0.9 }); addShake(0.35);
}
function hrLightsOut(dur) { for (const f of Fixtures.list) if (!f.dead) { f.wasOn = f.on !== false; f.on = false; } HR.dark = dur; }
function hrApparition(p, yaw, dur) {
  const s = standIn(p.x, p.z, { char: pick(['h_nightshade', 'h_mutant']), arch: 'creature', noGun: true, yaw, aim: 0, scale: 1.12 });
  after(dur, () => { scene.remove(s.root); });
}
const HR_SCARES = [
  { x: 20, z: 0, r: 3, fn() { const p = new V3(36, 0, 0); hrApparition(p, Math.PI / 2, 1.4); hrLightsOut(1.6); hrScare('flash'); } },
  { x: 0, z: 18, r: 3, fn() { Growl.play('roar', new V3(0, 1, 28), { gain: 1.2 }); hrLightsOut(3); } },
  { x: -20, z: 0, r: 3, fn() { Growl.play('whisper', null, { gain: 1 }); hrApparition(new V3(-21, 0, -6), 0, 0.8); } },
  { x: 0, z: -18, r: 3, fn() { HR.battery = Math.min(HR.battery, 12); HUD.feed('…your flashlight is dying', 'red'); Growl.play('heart', null, { gain: 1.2 }); } },
  { x: 30, z: 0, r: 3, fn() { if (HR.stalker && HR.stalker.alive) { HR.stalker.pos.set(38, 0, 0); HR.stalker.chase = 6; Growl.play('roar', HR.stalker.pos, { gain: 1.5 }); } } }
];

LEVELS.horror = {
  id: 'horror', mode: true, music: 'horror', name: 'HORROR · WARD 9', chapter: 'BLACKLINE 2 · HORROR', title: 'WARD 9', sub: 'DON\'T LET IT SEE THE LIGHT',
  env: { grade: { lift: [0.0, 0.0, 0.0], gain: [0.95, 0.98, 1.0], sat: 0.55, contrast: 1.25, vig: 0.7, bloom: 0.6, threshold: 1.6 }, indoor: true, sky: [0, 0, 0], fog: [0x000000, 3, 30], bg: 0x000000, sunCol: 0xffffff, sunI: 0, noShadow: true, hemi: [0x30343a, 0x080808, 0.05], amb: [0x101418, 0.04], exposure: 1.1, fixtures: 6, envCol: 0x050608, groundCol: 0x0a0a0a, vmHemi: 0x404850, vmI: 0.25, vmSun: 0xfff0d8, vmSunI: 0.6 },
  cast: CASTS.stalker.concat(CASTS.mannequin),
  h: () => 0, bounds: 60,
  build() { buildHorror(); },
  menuFocus: new V3(0, 0, 0),
  menuCam(t) { return { pos: new V3(-30 + Math.sin(t * 0.1) * 4, 1.7, 0.5), look: new V3(10, 1.4, 0) }; },
  radar() {},
  tips: ['It hunts by light and sound. Turn your flashlight off with L.', 'Shooting it only stuns it. Then run.', 'The mannequins move when you look away. Keep your eyes on them.', 'Gunshots carry. It will come.'],
  cpStep: [0],
  reset() {
    hrCss(); Object.assign(HR, { fuses: 0, power: false, battery: 100, light: true, awake: false, whisperT: 25, exitOpen: false, dark: 0 });
    HR.scares = HR_SCARES.map(s => Object.assign({}, s, { done: false }));
    if (!HR.exitDoor.parent) { scene.add(HR.exitDoor); colliders.push(HR.exitDoor.userData.col); }
    for (const f of Fixtures.list) f.on = true;
    // fuses in random far rooms
    const rooms = HR.rooms.slice().sort(() => Math.random() - 0.5);
    for (let i = 0; i < HR.need; i++) {
      const r = rooms[i], p = new V3(r.x + rand(-2, 2), 1.0, r.z + rand(-3, 3));
      const g = spriteGlow(TEX.flash, 0.45, 0xff8a2a); g.position.copy(p); scene.add(g);
      const fuse = new THREE.Mesh(B(0.12, 0.3, 0.12), new THREE.MeshStandardMaterial({ color: 0xc89040, emissive: 0x6a3008, metalness: 0.6, roughness: 0.4 })); fuse.position.copy(p); scene.add(fuse);
      new Interact(p, 'Take the fuse', () => { scene.remove(g); scene.remove(fuse); HR.fuses++; AudioSys.ui('pickup'); HUD.feed('FUSE ' + HR.fuses + ' / ' + HR.need, 'gold'); hrOnFuse(); }, { range: 2.2 });
    }
    // batteries and a little ammo
    for (let i = 0; i < 6; i++) { const r = rooms[HR.need + i], p = new V3(r.x + rand(-2, 2), 0.9, r.z + rand(-3, 3)); const m = new THREE.Mesh(B(0.12, 0.22, 0.12), new THREE.MeshStandardMaterial({ color: 0x2a6aa0, emissive: 0x0a2040 })); m.position.copy(p); scene.add(m); new Interact(p, 'Take the battery', () => { scene.remove(m); HR.battery = Math.min(100, HR.battery + 45); HUD.feed('+ BATTERY'); AudioSys.ui('pickup'); }, { range: 2 }); }
    for (let i = 0; i < 4; i++) { const r = rooms[HR.need + 6 + i]; pickups.push(new Pickup('ammo', new V3(r.x, 0.15, r.z))); }
    // the mannequins
    for (let i = 0; i < 6; i++) { const r = rooms[rooms.length - 1 - i]; const m = addMonster('mannequin', r.x + rand(-1.5, 1.5), r.z + rand(-2, 2), { char: 'h_mannequin', arch: 'civilian', yaw: rand(0, TAU) }); m.isStatue = true; }
    // it
    HR.stalker = addMonster('stalker', 34, 24, { yaw: 0 }); HR.stalker.wp = null; HR.stalker.chase = 0;
    stats.kills = 0;
    return { spawn: [-36, 0, -Math.PI / 2], loadout: ['pistol'], cur: 'pistol', armor: 0, nades: 0 };
  },
  afterReset() { inv.pistol.res = 24; HUD.slots(); },
  monsterThink(m, dt) {
    if (m.T.statue) { if (!HR.awake) { m.moveTarget = null; return true; } return false; }
    if (!m.T.stalker) return false;
    // senses
    const d = m.pos.distanceTo(player.pos); m.chase = Math.max(0, (m.chase || 0) - dt);
    const lit = HR.light && HR.battery > 0;
    if (player.alive && d < (lit ? 26 : 7)) { m.eye(_e); _d.copy(player.pos).setY(player.pos.y + 1.5).sub(_e); const dd = _d.length(); _d.divideScalar(dd); if (!castRay(_e, _d, dd - 0.3, { noEnemies: true })) { if (m.chase < 1) Growl.play('roar', m.pos, { gain: 1.3 }); m.chase = 5; } }
    if (m.chase > 0 && player.alive) { m.target = null; m.speedMul = 2.85; return false; }
    m.speedMul = 1;
    if (!m.target || m.pos.distanceTo(m.target) < 2) m.target = (HR.noise && gameTime - HR.noise.t < 8) ? HR.noise.p.clone() : pick(HR.rooms).clone();
    return false;
  },
  onAlert() {},
  onMonsterHear(m, p) { if (m.T.stalker) hrNoise(p); },
  playerPhys() {},
  steps: [
    { id: 'fuses', cp: 0, silent: true, text: 'Find the fuses', marker: () => null, update(dt) { hrTick(dt); $('obj-sub').textContent = HR.fuses + ' / ' + HR.need + ' fuses'; return HR.fuses >= HR.need; } },
    { id: 'box', text: 'Restore the power at the fuse box', marker: () => new V3(0, 1.4, -1.6), enter() { new Interact(new V3(0, 1.4, -1.4), 'Insert the fuses', () => { HR.power = true; hrPower(); }, { range: 2.4 }); }, update(dt) { hrTick(dt); return HR.power; } },
    { id: 'exit', text: 'GET OUT', marker: () => new V3(-40, 1.5, 0), update(dt) { hrTick(dt); return player.pos.x < -41; } }
  ],
  intro: null,
  complete() {
    Store.set('hr_escapes', Store.get('hr_escapes', 0) + 1); achieve('ward9', 'Discharged', 'Escape Ward 9');
    showEnding({ chapter: 'HORROR · WARD 9', title: 'YOU GOT OUT', tease: 'It is still in there. It will be waiting next time.', lines: [], cardAt: 400 });
  }
};
function hrOnFuse() {
  if (HR.fuses === 1) { Growl.play('roar', HR.stalker.pos, { gain: 1.6, sos: false }); HUD.notify('IT HEARD YOU', 'Keep moving. Light draws it in.', 'obj'); }
  if (HR.fuses === 2) { HR.awake = true; Growl.play('whisper', null, { gain: 1.2 }); HUD.feed('…the mannequins have moved', 'red'); }
  if (HR.fuses === 3) { hrLightsOut(4); hrScare('flash'); HR.stalker.chase = 4; }
}
function hrPower() {
  AudioSys.boom && AudioSys.boom(new V3(0, 2, -2), 0.4);
  for (const f of Fixtures.list) { f.on = true; f.color.setHex(0xff2010); f.flicker = 0.25; f.i = 1.2; }
  scene.remove(HR.exitDoor); const i = colliders.indexOf(HR.exitDoor.userData.col); if (i >= 0) colliders.splice(i, 1);
  HR.exitSign.material.map = canvasTex(256, 64, (c, w, h) => { c.fillStyle = '#022a08'; c.fillRect(0, 0, w, h); c.fillStyle = '#4aff6a'; c.font = 'bold 36px Arial'; c.textAlign = 'center'; c.fillText('EXIT', w / 2, 46); }); HR.exitSign.material.needsUpdate = true;
  HUD.notify('POWER RESTORED', 'The exit is open. So is everything else.', 'obj');
  HR.stalker.chase = 30; HR.stalker.pos.set(30, 0, 0); HR.awake = true;
  for (const e of enemies) if (e.isStatue) e.speedMul = 1.3;
}
function hrTick(dt) {
  // flashlight follows the camera with a little lag and sway
  const bat = HR.battery; HR.battery = Math.max(0, HR.battery - (HR.light ? dt * 0.55 : 0));
  const flick = bat < 15 ? (Math.random() < 0.12 ? 0 : 1) : 1, on = HR.light && bat > 0 && player.alive;
  camera.getWorldDirection(_v1);
  HR.spot.position.copy(camera.position).addScaledVector(_v1, 0.2).add(_v2.set(0.15, -0.15, 0).applyQuaternion(camera.quaternion));
  HR.spot.target.position.lerp(_v3.copy(camera.position).addScaledVector(_v1, 10), Math.min(1, dt * 14));
  HR.spot.intensity = on ? 9 * flick : 0; HR.fill.position.copy(camera.position); HR.fill.intensity = on ? 0.25 : 0.04;
  $('hr-batf').style.width = HR.battery + '%'; $('hr-batf').style.background = HR.battery < 15 ? '#e04030' : '#e8dcb0';
  if (HR.dark > 0) { HR.dark -= dt; if (HR.dark <= 0) for (const f of Fixtures.list) if (f.wasOn) f.on = true; }
  // scripted scares
  for (const s of HR.scares) if (!s.done && Math.hypot(player.pos.x - s.x, player.pos.z - s.z) < s.r && HR.fuses >= 1) { s.done = true; s.fn(); }
  // whispers, heartbeat, red vignette
  HR.whisperT -= dt; if (HR.whisperT <= 0) { HR.whisperT = rand(20, 45); camera.getWorldDirection(_v1); Growl.play('whisper', player.pos.clone().addScaledVector(_v1, -3), { gain: 0.9 }); }
  const st = HR.stalker, d = st && st.alive ? st.pos.distanceTo(player.pos) : 99;
  HR.heartT -= dt; if (d < 16 && HR.heartT <= 0) { HR.heartT = 0.45 + d / 16 * 0.7; Growl.play('heart', null, { gain: 1.1 - d / 20, rate: 1 }); }
  $('hr-vig').classList.toggle('near', d < 10);
  AudioSys.combatTarget = st && st.chase > 0 ? 0.9 : d < 20 ? 0.4 : 0.1;
  if (!player.alive) showDeath.msg = HR.fuses ? `It found you with ${HR.fuses} of ${HR.need} fuses.` : 'It found you.';
}
/* gunshots in Ward 9 tell it exactly where you are */
function hrNoise(p) { if (LV && LV.id === 'horror') { HR.noise = { p: p.clone(), t: gameTime }; if (HR.stalker && HR.stalker.pos.distanceTo(p) < 35) HR.stalker.chase = Math.max(HR.stalker.chase || 0, 3); } }
