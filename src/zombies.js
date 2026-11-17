/* ============================================================
   ZOMBIES: "DEAD END". Endless rounds in a walled town square at
   night. Earn points, buy guns off the walls, open the diner,
   gamble on the mystery box, and see how long you last.
   ============================================================ */
const ZM = { round: 0, points: 500, toSpawn: 0, spawnT: 0, breakT: 0, kills: 0, dbl: 0, insta: 0, spawns: [], box: null, boxT: 0, best: 0 };
const ZM_BUYS = [
  // weapon, cost, x, y, z, ry (wall chalk outline position)
  ['smg', 1000, -23.6, 1.6, -8, Math.PI / 2], ['shotgun', 900, 23.6, 1.6, -10, -Math.PI / 2], ['burst', 1400, -10, 1.6, -23.6, 0],
  ['ar', 1600, 8, 1.6, 23.6, Math.PI], ['dmr', 1800, -23.6, 1.6, 12, Math.PI / 2], ['lmg', 2600, 23.6, 1.6, 21, -Math.PI / 2], ['autoshotgun', 2200, 17, 1.6, 23.6, Math.PI]
];
const ZM_BOX = ['revolver', 'smg', 'ar', 'burst', 'dmr', 'lmg', 'shotgun', 'autoshotgun', 'sniper', 'rocket', 'arc', 'arc', 'lmg', 'golden'];

function zmCss() {
  if ($('zm-css')) return;
  const s = document.createElement('style'); s.id = 'zm-css'; s.textContent = `
  #zm-hud{position:fixed;left:34px;bottom:118px;font-family:Rajdhani,sans-serif;pointer-events:none;z-index:6}
  #zm-round{font-size:84px;font-weight:700;color:#b3120c;text-shadow:0 0 18px rgba(200,0,0,.55),0 2px 0 #300;line-height:.9;letter-spacing:2px}
  #zm-round.flash{animation:zmflash 1.2s ease 3}
  @keyframes zmflash{50%{color:#fff;text-shadow:0 0 30px #f33}}
  #zm-pts{font-size:30px;font-weight:700;color:#f3e6c4;margin-top:4px}
  #zm-pts small{font-size:18px;color:#9db86a;margin-left:8px}
  #zm-pu{position:fixed;top:120px;left:50%;transform:translateX(-50%);font:700 26px Rajdhani,sans-serif;color:#7fd0ff;text-shadow:0 0 14px #3af;pointer-events:none;z-index:6}
  body.mode-zombies #mission-name{color:#c8261c}`;
  document.head.appendChild(s);
  const h = document.createElement('div'); h.id = 'zm-hud'; h.innerHTML = '<div id="zm-round"></div><div id="zm-pts"></div>'; $('hud').appendChild(h);
  const p = document.createElement('div'); p.id = 'zm-pu'; $('hud').appendChild(p);
}
function zmPts(n, why) {
  n = Math.round(n * (ZM.dbl > 0 ? 2 : 1)); ZM.points += n;
  $('zm-pts').innerHTML = ZM.points + (n > 0 ? `<small>+${n}</small>` : `<small style="color:#e66">${n}</small>`);
  clearTimeout(zmPts._t); zmPts._t = setTimeout(() => { $('zm-pts').textContent = ZM.points; }, 900);
  void why;
}
function zmSpend(cost) { if (ZM.points < cost) { HUD.feed('NOT ENOUGH POINTS (' + cost + ')', 'red'); AudioSys.ui('deny'); return false; } zmPts(-cost); AudioSys.ui('pickup'); return true; }

function buildZombies() {
  WORLD = 120;
  floorPlane(-70, -70, 70, 70, 0, M.cityRoad, 9);
  floorPlane(-24, -24, 24, 24, 0.02, M.sidewalk, 3);
  const H = [11, 15, 9, 13, 17, 10];
  // perimeter blocks with an alley in the middle of each side
  const blocks = [[-44, -44, -2.2, -24], [2.2, -44, 44, -24], [-44, 24, -2.2, 44], [2.2, 24, 44, 44], [-44, -24, -24, -2.2], [-44, 2.2, -24, 24], [24, -24, 44, -2.2], [24, 2.2, 44, 24]];
  blocks.forEach(([x0, z0, x1, z1], i) => { const h = H[i % H.length]; solid(x1 - x0, h, z1 - z0, M.building, (x0 + x1) / 2, 0, (z0 + z1) / 2, { tile: 6 }); });
  // alley dead ends (zombies come from here)
  const alleys = [[0, -1, 0, -50], [0, 1, 0, 50], [-1, 0, -50, 0], [1, 0, 50, 0]];
  for (const [dx, dz, ex, ez] of alleys) {
    solid(dx ? 0.6 : 5, 6, dz ? 0.6 : 5, M.wallDark, ex, 0, ez);
    for (let k = 0; k < 3; k++) ZM.spawns.push(new V3(ex - dx * (3 + k * 5), 0, ez - dz * (3 + k * 5)));
    const lx = dx ? ex - dx * 10 : 1.6, lz = dz ? ez - dz * 10 : 1.6;
    Fixtures.add(new V3(lx, 4, lz), 0xff5a2a, 0.9, 12, 0.6);
  }
  // corner graves inside the square: dirt patches zombies climb out of
  for (const [x, z] of [[-19, -19], [19, -19], [-19, 19]]) {
    const d = new THREE.Mesh(new THREE.CircleGeometry(2.2, 18).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x2a1e14, roughness: 1 })); d.position.set(x, 0.04, z); scene.add(d);
    ZM.spawns.push(new V3(x, 0, z));
  }
  // the diner (south-east corner, opened for 750)
  const W = { h: 4.2, mat: M.wall, t: 0.4 };
  wall(10, 10, 24, 10, Object.assign({}, W, { doors: [17] })); wall(10, 10, 10, 24, W);
  ceilPlane(10, 10, 24, 24, 4.2);
  ZM.door = solid(3.2, 3.0, 0.3, M.wood, 17, 0, 10, {});
  for (const x of [13, 21]) lightPanel(x, 4.2, 17, { color: 0xffd8a0, i: 1.2, flicker: 0.4 });
  solid(8, 1.05, 1.2, M.wood, 17, 0, 21, { cover: true });
  for (const x of [12.5, 21.5]) for (const z of [13, 16]) solid(1.4, 0.8, 1.4, M.metal, x, 0, z, { cover: true });
  sign('DINER', 17, 4.9, 9.75, Math.PI, { w: 3.2, fg: '#ff4040', bg: '#140606' });
  // square: fountain, wrecks, barricades, lamps
  const f = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 3.4, 0.8, 24), M.concrete); f.position.set(-6, 0.4, 4); f.castShadow = f.receiveShadow = true; scene.add(f); colliderFromObject(f, 0.3, { cover: true });
  const fw = new THREE.Mesh(new THREE.CylinderGeometry(2.8, 2.8, 0.1, 24), new THREE.MeshStandardMaterial({ color: 0x2a1010, roughness: 0.1, metalness: 0.3 })); fw.position.set(-6, 0.78, 4); scene.add(fw);
  for (const [x, z, ry] of [[8, -12, 0.4], [-14, -6, 1.9], [4, 14, -0.2]]) {
    const car = new THREE.Group(); car.position.set(x, 0, z); car.rotation.y = ry; scene.add(car);
    part(car, B(2.0, 0.8, 4.4), M.burnt, 0, 0.75, 0); part(car, B(1.8, 0.65, 2.2), M.burnt, 0, 1.45, -0.2);
    for (const [wx, wz] of [[-0.95, 1.4], [0.95, 1.4], [-0.95, -1.4], [0.95, -1.4]]) part(car, CYZ(0.38, 0.3, 10).rotateY(Math.PI / 2), M.rubber, wx, 0.38, wz);
    car.updateMatrixWorld(true); colliderFromObject(car.children[0], 0, { cover: true });
  }
  sandbags(-4, -16, 4, -16); sandbags(-17, 10, -17, 16);
  for (const [x, z] of [[-20, -20], [20, -20], [-20, 20], [0, 20], [-20, 0], [20, 0], [0, -20]]) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.12, 5.5, 8), M.darkMetal); pole.position.set(x, 2.75, z); scene.add(pole);
    const head = new THREE.Mesh(B(0.5, 0.18, 0.5), M.lamp); head.position.set(x, 5.5, z); scene.add(head);
    Fixtures.add(new V3(x, 5.2, z), 0xffc27a, 1.5, 18, Math.random() < 0.35 ? 0.5 : 0);
  }
  // mystery box
  const box = new THREE.Group(); box.position.set(-10, 0, -18); scene.add(box);
  part(box, B(2.2, 0.85, 0.9), new THREE.MeshStandardMaterial({ color: 0x3a2412, roughness: 0.8 }), 0, 0.43, 0);
  const lid = part(box, B(2.24, 0.12, 0.94), new THREE.MeshStandardMaterial({ color: 0x4a2e16, roughness: 0.8 }), 0, 0.9, 0);
  const q = spriteGlow(TEX.flash, 1.6, 0x66c8ff); q.position.y = 1.4; box.add(q);
  box.updateMatrixWorld(true); colliderFromObject(box.children[0], 0, { cover: true });
  ZM.boxMesh = { box, lid, glow: q };
  Fixtures.add(new V3(-10, 2.5, -17), 0x66c8ff, 1.4, 9, 0.2);
  // nav
  const pts = [[0, 0], [-12, -12], [12, -12], [-12, 12], [12, 12], [0, -18], [0, 18], [-18, 0], [18, 0], [0, -30], [0, -42], [0, 30], [0, 42], [-30, 0], [-42, 0], [30, 0], [42, 0], [17, 7], [17, 13], [13, 18], [21, 18], [-6, -4], [-6, 12], [-14, 4], [2, 4]];
  buildNav(pts);
}

function zmStartRound() {
  ZM.round++; ZM.toSpawn = Math.min(90, 5 + Math.round(ZM.round * 3.2 + ZM.round * ZM.round * 0.25)); ZM.spawnT = 2.5;
  $('zm-round').textContent = ZM.round; $('zm-round').classList.remove('flash'); void $('zm-round').offsetWidth; $('zm-round').classList.add('flash');
  HUD.objective('ROUND ' + ZM.round); HUD.notify('ROUND ' + ZM.round, ZM.round === 1 ? 'They\'re coming.' : ZM.toSpawn + ' undead', 'obj');
  Growl.play('roar', null, { gain: 0.5, rate: 0.7 }); AudioSys.combatTarget = Math.min(1, 0.4 + ZM.round * 0.06);
  if (ZM.round > 1 && ZM.round % 5 === 0) achieveZ();
}
function achieveZ() { if (ZM.round >= 10) achieve('z10', 'Still Breathing', 'Reach round 10 in Zombies'); }
function zmSpawn() {
  const r = ZM.round, alive = enemies.filter(e => e.alive).length;
  if (alive >= Math.min(24, 10 + r)) return;
  const far = ZM.spawns.filter(s => s.distanceTo(player.pos) > 13 && !(s.x > 9 && s.z > 9 && !ZM.dinerOpen));
  const sp = pick(far.length ? far : ZM.spawns);
  let kind = 'walker';
  if (r >= 3 && Math.random() < Math.min(0.75, (r - 2) * 0.12)) kind = 'runner';
  if (Math.random() < 0.07 && r >= 2) kind = 'crawler';
  if (r % 5 === 0 && !ZM.bruteThisRound) { kind = 'brute'; ZM.bruteThisRound = true; HUD.feed('⚠ SOMETHING BIG IS COMING', 'red'); }
  const inSquare = Math.abs(sp.x) < 24 && Math.abs(sp.z) < 24;
  addMonster(kind, sp.x + rand(-1, 1), sp.z + rand(-1, 1), { hpMul: 1 + (r - 1) * 0.16 + (r > 12 ? (r - 12) * 0.2 : 0), speedMul: 1 + Math.min(0.35, r * 0.025), rise: inSquare && kind !== 'brute' && kind !== 'crawler' });
  ZM.toSpawn--;
}
function zmPowerup(p) {
  const kinds = ['maxammo', 'nuke', 'double', 'insta'], k = pick(kinds);
  const g = spriteGlow(TEX.flash, 1.4, { maxammo: 0x66ff66, nuke: 0xff8a2a, double: 0xffe066, insta: 0xff3030 }[k]); g.position.set(p.x, 1.1, p.z); scene.add(g);
  ZM.pu = ZM.pu || []; ZM.pu.push({ k, g, p: p.clone(), t: 25 });
}
function zmUpdatePU(dt) {
  if (ZM.dbl > 0) ZM.dbl -= dt; if (ZM.insta > 0) ZM.insta -= dt;
  $('zm-pu').textContent = [ZM.dbl > 0 ? 'DOUBLE POINTS ' + Math.ceil(ZM.dbl) : '', ZM.insta > 0 ? 'INSTA-KILL ' + Math.ceil(ZM.insta) : ''].filter(Boolean).join('   ');
  for (const u of ZM.pu || []) {
    if (u.done) continue; u.t -= dt; u.g.position.y = 1.1 + Math.sin(gameTime * 3) * 0.15; u.g.visible = u.t > 5 || Math.sin(gameTime * 12) > 0;
    if (u.t <= 0) { u.done = true; scene.remove(u.g); continue; }
    if (u.p.distanceTo(player.pos) < 1.6) {
      u.done = true; scene.remove(u.g); AudioSys.ui('achieve');
      if (u.k === 'maxammo') { for (const w in inv) if (WDEF[w]) inv[w].res = WDEF[w].maxRes; player.nades = Math.max(player.nades, 4); HUD.notify('MAX AMMO', '', 'obj'); }
      if (u.k === 'nuke') { HUD.notify('KABOOM', '+400', 'obj'); FX.flash && FX.flash(); addShake(0.4); for (const e of enemies) if (e.alive && e.kind !== 'brute') { e.die(null, false, 'nuke'); } zmPts(400); }
      if (u.k === 'double') { ZM.dbl = 30; HUD.notify('DOUBLE POINTS', '30 seconds', 'obj'); }
      if (u.k === 'insta') { ZM.insta = 30; HUD.notify('INSTA-KILL', '30 seconds', 'obj'); }
    }
  }
}
function zmBox() {
  if (ZM.boxBusy) return; if (!zmSpend(950)) return;
  ZM.boxBusy = true; const { lid, box } = ZM.boxMesh; lid.position.y = 1.25; lid.rotation.x = -0.6;
  const owned = Object.keys(inv); let pickW = pick(ZM_BOX.filter(w => !owned.includes(w) && WDEF[w]));
  if (!pickW) pickW = pick(ZM_BOX);
  let shown = null, spins = 0;
  const spin = () => {
    if (shown) box.remove(shown);
    const k = spins < 14 ? pick(ZM_BOX) : pickW; const g = buildWorldGun(k); shown = g.g; shown.position.set(0, 1.35 + spins * 0.02, 0); shown.rotation.y = Math.PI / 2; box.add(shown);
    AudioSys.ui('click'); spins++;
    if (spins <= 14) setTimeout(spin, 90 + spins * 18);
    else {
      HUD.feed('MYSTERY BOX: ' + WDEF[pickW].name, 'gold');
      const it = new Interact(new V3(box.position.x, 1.3, box.position.z + 1.3), 'Take ' + WDEF[pickW].name, () => { giveWeapon(pickW); box.remove(shown); closeBox(); }, { range: 2.8 });
      setTimeout(() => { if (!it.used) { it.dead = true; it.used = true; box.remove(shown); closeBox(); } }, 9000);
    }
  };
  const closeBox = () => { lid.position.y = 0.9; lid.rotation.x = 0; ZM.boxBusy = false; };
  spin();
}

LEVELS.zombies = {
  id: 'zombies', mode: true, music: 'zombies', name: 'ZOMBIES · DEAD END', chapter: 'BLACKLINE 2 · ZOMBIES', title: 'DEAD END', sub: 'HOW LONG CAN YOU LAST?',
  env: Object.assign({}, LEVELS[10].env, { fog: [0x140a0c, 30, 160], exposure: 1.25, sunI: 0.35, hemi: [0x5a4a70, 0x1a0c0c, 0.3], amb: [0x2a2a40, 0.3], clouds: 0.6, cloudCol: 0x301018, fixtures: 10, shadowSize: 60 }),
  cast: CASTS.zombie.concat(CASTS.brute),
  h: () => 0, onRoad: () => true, bounds: 120,
  build() { buildZombies(); },
  menuFocus: new V3(0, 0, 0),
  menuCam(t) { return { pos: new V3(Math.cos(t * 0.2) * 16, 7, Math.sin(t * 0.2) * 16), look: new V3(0, 1.5, 0) }; },
  radar() {},
  tips: ['Headshots are worth more points, and they kill faster.', 'Open the diner (750): it has the best guns in the square.', 'The mystery box (950) can give you the ARC or the HX-3.', 'Pick up glowing power-ups that zombies drop.', 'Runners appear from round 3. Brutes every fifth round.'],
  cpStep: [0],
  reset() {
    zmCss();
    Object.assign(ZM, { round: 0, points: 500, toSpawn: 0, spawnT: 0, breakT: 4, kills: 0, dbl: 0, insta: 0, boxBusy: false, dinerOpen: false, bruteThisRound: false });
    for (const u of ZM.pu || []) scene.remove(u.g); ZM.pu = [];
    if (ZM.door && !ZM.door.parent) { scene.add(ZM.door); colliders.push(ZM.door.userData.col); }
    $('zm-round').textContent = ''; $('zm-pts').textContent = ZM.points;
    ZM_BUYS.forEach(([w, cost, x, y, z, ry]) => {
      const g = buildWorldGun(w); g.g.position.set(x, y, z); g.g.rotation.set(0, ry + Math.PI / 2, 0); g.g.scale.setScalar(1.15); scene.add(g.g);
      const chalk = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.7), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.08 })); chalk.position.set(x, y, z); chalk.rotation.y = ry; chalk.translateZ(-0.05); scene.add(chalk);
      new Interact(new V3(x, 1.2, z), () => inv[w] ? `Buy ${WDEF[w].name} ammo · ${Math.round(cost / 2)}` : `Buy ${WDEF[w].name} · ${cost}`, (it) => { it.used = false; if (inv[w]) { if (inv[w].res >= WDEF[w].maxRes) return; if (zmSpend(Math.round(cost / 2))) { inv[w].res = WDEF[w].maxRes; HUD.feed('+ ' + WDEF[w].name + ' AMMO'); } } else if (zmSpend(cost)) giveWeapon(w); }, { range: 2.6, once: false });
    });
    new Interact(new V3(17, 1.4, 9.4), 'Clear the diner barricade · 750', (it) => { if (!zmSpend(750)) { it.used = false; return; } ZM.dinerOpen = true; scene.remove(ZM.door); const i = colliders.indexOf(ZM.door.userData.col); if (i >= 0) colliders.splice(i, 1); Debris.burst(new V3(17, 1, 10), 10, 0.8); HUD.feed('THE DINER IS OPEN', 'gold'); }, { range: 2.8 });
    new Interact(new V3(-10, 1.2, -16.8), () => ZM.boxBusy ? null : 'Mystery box · 950', (it) => { it.used = false; zmBox(); }, { range: 2.6, once: false });
    new Interact(new V3(14, 1.2, 22.8), 'Buy armor · 1200', (it) => { it.used = false; if (player.armor >= 100) return; if (zmSpend(1200)) { player.armor = 100; HUD.feed('+ ARMOR'); } }, { range: 2.4, once: false });
    new Interact(new V3(-22.8, 1.2, -16), 'Buy grenades · 400', (it) => { it.used = false; if (player.nades >= 5) return; if (zmSpend(400)) { player.nades = 5; HUD.feed('+ GRENADES'); } }, { range: 2.4, once: false });
    stats.kills = 0; stats.heads = 0;
    return { spawn: [2, 4, 0], loadout: ['pistol'], cur: 'pistol', armor: 0, nades: 2 };
  },
  onMonsterHit(m, d, head) { if (ZM.insta > 0) { m.hp = 0; } zmPts(head ? 15 : 10); },
  onMonsterKill(m, head, src) {
    if (src === 'nuke') return;
    ZM.kills++; zmPts(head ? 100 : m.kind === 'brute' ? 500 : 60);
    if (Math.random() < (m.kind === 'brute' ? 1 : 0.035)) zmPowerup(m.pos);
  },
  steps: [{ id: 'z', cp: 0, silent: true, text: 'Survive', marker: () => null,
    update(dt) {
      zmUpdatePU(dt);
      if (!player.alive) { showDeath.msg = `You survived ${Math.max(0, ZM.round - 1)} round${ZM.round === 2 ? '' : 's'} · ${ZM.kills} kills. Best: round ${Math.max(Store.get('zm_best', 0), ZM.round)}.`; if (ZM.round > Store.get('zm_best', 0)) Store.set('zm_best', ZM.round); return false; }
      if (ZM.breakT > 0) { ZM.breakT -= dt; $('obj-sub').textContent = ZM.round ? 'Next round in ' + Math.ceil(ZM.breakT) : 'Get ready…'; if (ZM.breakT <= 0) { ZM.bruteThisRound = false; zmStartRound(); } return false; }
      if (ZM.toSpawn > 0) { ZM.spawnT -= dt; if (ZM.spawnT <= 0) { ZM.spawnT = Math.max(0.35, 2.2 - ZM.round * 0.12) * rand(0.6, 1.3); zmSpawn(); } }
      const left = ZM.toSpawn + enemies.filter(e => e.alive).length;
      $('obj-sub').textContent = left + ' left · ' + ZM.points + ' points';
      if (left === 0) { ZM.breakT = 9; AudioSys.combatTarget = 0.1; HUD.feed('ROUND ' + ZM.round + ' SURVIVED', 'gold'); enemies = enemies.filter(e => !e.gone); }
      return false;
    } }],
  intro: null,
  complete() {}
};
