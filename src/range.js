/* ============================================================
   FIRING RANGE: every weapon, target lanes at 10–200 m,
   a kill house of live hostiles on demand, and the new characters.
   Opened from Campaign → Firing Range (index.html?m=range&start=1).
   ============================================================ */
const RANGE = { lanes: [10, 25, 50, 100, 200], hits: 0, best: 0 };
function buildRange() {
  WORLD = 400;
  const sand = new THREE.MeshStandardMaterial({ color: 0xb79a6c, roughness: 1, map: TEX.sand || null });
  const g = new THREE.Mesh(new THREE.PlaneGeometry(900, 900, 1, 1).rotateX(-Math.PI / 2), sand); g.receiveShadow = true; scene.add(g);
  // firing line: concrete pad, roof, benches
  solid(40, 0.15, 10, M.concrete, 0, 0, 4, { noGround: false });
  for (const x of [-19.8, 19.8]) solid(0.3, 3.6, 10, M.concrete, x, 0, 4);
  // lane dividers and distance boards
  for (let i = -2; i <= 3; i++) solid(0.15, 1.0, 210, M.concrete, -15 + i * 6, 0, -104);
  RANGE.lanes.forEach((d, i) => {
    const x = -12 + i * 6;
    sign(d + ' m', x, 2.6, -d + 0.3, 0, { w: 1.6, fg: '#ffcf7a', bg: '#1a1a1a' });
    for (const [tx, sc] of [[x, 1], [x + 1.6, 0.8]]) rangeTarget(tx, -d, sc * (d > 60 ? 1.6 : 1));
  });
  // berm at the back
  for (let x = -60; x <= 60; x += 12) { const b = new THREE.Mesh(new THREE.SphereGeometry(10, 12, 8), M.sand); b.scale.set(1, 0.55, 0.6); b.position.set(x, 0, -215); b.receiveShadow = true; scene.add(b); colliderFromObject(b, 0); }
  // kill house to the east
  const K = { x: 45, z: -20 };
  const W = { h: 3, mat: M.concrete, t: 0.4, dw: 2.2, dh: 2.4 };
  wall(K.x - 12, K.z - 12, K.x + 12, K.z - 12, W); wall(K.x - 12, K.z + 12, K.x + 12, K.z + 12, Object.assign({}, W, { doors: [K.x] }));
  wall(K.x - 12, K.z - 12, K.x - 12, K.z + 12, Object.assign({}, W, { doors: [K.z] })); wall(K.x + 12, K.z - 12, K.x + 12, K.z + 12, W);
  wall(K.x, K.z - 12, K.x, K.z + 4, Object.assign({}, W, { doors: [K.z - 6] })); wall(K.x - 12, K.z + 4, K.x + 6, K.z + 4, Object.assign({}, W, { doors: [K.x - 6, K.x + 3] }));
  for (const [x, z] of [[K.x - 6, K.z - 6], [K.x + 6, K.z - 4], [K.x - 4, K.z + 8], [K.x + 8, K.z + 8]]) crate(x, 0, z, 1.2, rand(0, 3));
  RANGE.K = K;
  // lights
  Fixtures.add(new V3(-10, 3.4, 4), 0xffe2b0, 1.4, 16, 0); Fixtures.add(new V3(10, 3.4, 4), 0xffe2b0, 1.4, 16, 0);
  buildNav([[0, 14], [K.x - 16, K.z], [K.x - 6, K.z], [K.x - 6, K.z - 6], [K.x + 6, K.z - 6], [K.x + 6, K.z + 8], [K.x - 6, K.z + 8], [K.x, K.z + 16], [K.x + 3, K.z + 4]]);
}
function rangeTarget(x, z, s) {
  const grp = new THREE.Group(); grp.position.set(x, 0, z); scene.add(grp);
  const post = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.0, 0.08), M.darkMetal); post.position.y = 0.5; grp.add(post);
  const plate = new THREE.Mesh(new THREE.CylinderGeometry(0.32 * s, 0.32 * s, 0.03, 24).rotateX(Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0xd8d4c8, roughness: 0.5, metalness: 0.5 }));
  plate.position.y = 1.15 + 0.3 * s; grp.add(plate);
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.1 * s, 0.16 * s, 24), new THREE.MeshBasicMaterial({ color: 0xc02818 })); ring.position.set(0, plate.position.y, 0.017); grp.add(ring);
  grp.updateMatrixWorld(true);
  const col = colliderFromObject(plate, 0.02, { metal: true });
  col.target = { damage() { plate.material.color.setRGB(1, 0.6, 0.2); setTimeout(() => plate.material.color.setRGB(0.85, 0.83, 0.78), 160); grp.rotation.x = -0.25; setTimeout(() => grp.rotation.x = 0, 140); AudioSys.ui('hit'); RANGE.hits++; HUD.feed('HIT · ' + Math.round(Math.hypot(player.pos.x - x, player.pos.z - z)) + ' m', 'gold'); }, pos: new V3(x, 1.4, z) };
}
function rangeHostiles() {
  const K = RANGE.K; for (const e of enemies) if (e.alive) e.dispose();
  const pts = [[K.x - 6, K.z - 7], [K.x + 7, K.z - 6], [K.x - 5, K.z + 8], [K.x + 8, K.z + 9], [K.x + 3, K.z - 2], [K.x - 9, K.z]];
  for (const [x, z] of pts) addEnemy(pick(['rifle', 'rifle', 'shotgun', 'heavy']), x, z, { group: 'kill', yaw: rand(0, TAU) });
  HUD.feed('⚠ KILL HOUSE ARMED · ' + pts.length + ' HOSTILES', 'red');
}
LEVELS.range = {
  id: 'range', name: 'FIRING RANGE', chapter: 'BLACKLINE 2', title: 'FIRING RANGE', sub: 'TRY EVERY WEAPON',
  env: Object.assign({}, LEVELS[1].env, { fog: [0xd8b088, 300, 1400] }),
  cast: CASTS.campaign,
  h: () => 0, onRoad: () => false, bounds: 400,
  build() { buildRange(); },
  menuFocus: new V3(0, 0, -20),
  menuCam(t) { return { pos: new V3(Math.cos(t * 0.5) * 20, 8, 20 + Math.sin(t * 0.5) * 8), look: new V3(0, 1.5, -30) }; },
  radar() {},
  tips: ['Every weapon is on the rack. Walk up and press E.', 'Number keys switch between the weapons you carry, Q cycles.', 'T swaps optics on rifles that have two.'],
  cpStep: [0],
  reset() {
    RANGE.hits = 0;
    const guns = SLOTS.filter(s => s !== 'golden');
    guns.forEach((k, i) => pickups.push(new Pickup('weapon', new V3(-12 + i * 2, 1.0, 7.8), { weapon: k, table: true })));
    for (let i = 0; i < 6; i++) pickups.push(new Pickup('ammo', new V3(-14 + i * 5.5, 0.15, 1.5)));
    pickups.push(new Pickup('grenades', new V3(16, 0.15, 2))); pickups.push(new Pickup('armor', new V3(17, 0.15, 3))); pickups.push(new Pickup('jack', new V3(18, 0.15, 2)));
    solid(28, 0.9, 1.0, M.wood, 0, 0, 7.8, { cover: true });
    new Interact(new V3(RANGE.K.x - 16, 1.3, RANGE.K.z + 2), 'Arm the kill house', () => rangeHostiles(), { range: 3 });
    // a lineup of the new characters to look at
    const show = ['swat', 'gasmask', 'maya', 'silas', 'voss', 'civ_kate', 'civ_remy'];
    show.forEach((k, i) => { if (CharLib.has(k)) { const s = standIn(-26 + i * 1.6, 12 - i * 0.6, { char: k, noGun: !['swat', 'gasmask', 'maya'].includes(k), yaw: Math.PI * 0.85, aim: 0 }); void s; } });
    return { spawn: [0, 4, 0], loadout: ['pistol', 'ar', 'sniper'], cur: 'ar', armor: 100, nades: 6 };
  },
  steps: [{ id: 'range', cp: 0, text: 'Try every weapon on the rack · arm the kill house to the east', marker: () => null, update() { $('obj-sub').textContent = RANGE.hits ? RANGE.hits + ' target hits' : ''; return false; } }],
  intro: null,
  complete() {}
};
