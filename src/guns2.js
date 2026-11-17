/* ============================================================
   GUNS 2: detailed procedural weapon models, gloved arms,
   and the expanded arsenal. Overrides buildGun/addArms from
   models.js (later function declarations win in the bundle).
   Gun space: x right, y up, -z toward the muzzle; origin at the
   top of the pistol grip. Models are original designs.
   ============================================================ */
const GK = {
  mats: null,
  noiseTex(size, fn, rep) {
    const c = document.createElement('canvas'); c.width = c.height = size; const x = c.getContext('2d'), im = x.createImageData(size, size);
    for (let i = 0; i < size * size; i++) { const v = fn(i % size, (i / size) | 0); im.data[i * 4] = im.data[i * 4 + 1] = im.data[i * 4 + 2] = v; im.data[i * 4 + 3] = 255; }
    x.putImageData(im, 0, 0); const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep || 1, rep || 1); return t;
  },
  init() {
    if (this.mats) return this.mats;
    const h = (x, y, s) => { const n = Math.sin(x * 127.1 + y * 311.7 + s * 74.7) * 43758.5453; return n - Math.floor(n); };
    const wear = this.noiseTex(256, (x, y) => { let v = 0, a = 1, f = 1; for (let o = 0; o < 4; o++) { v += a * h(Math.floor(x / (32 / f)), Math.floor(y / (32 / f)), o); a *= 0.5; f *= 2; } return 110 + v * 60 + (h(x, y, 9) > 0.985 ? 70 : 0); }, 3);
    const stipple = this.noiseTex(128, (x, y) => 128 + (h(x, y, 2) - 0.5) * 120, 8);
    const brushed = this.noiseTex(256, (x, y) => 128 + (h(0, y, 5) - 0.5) * 50 + (h(x, y, 6) - 0.5) * 20, 2);
    const grain = this.noiseTex(256, (x, y) => 100 + Math.sin(y * 0.18 + Math.sin(x * 0.05) * 3 + h(0, (y / 7) | 0, 3) * 2) * 40 + h(x, y, 4) * 30, 2);
    const S = (o) => new THREE.MeshStandardMaterial(o);
    this.mats = {
      steel: S({ color: 0x3a3d44, metalness: 0.78, roughness: 0.42, roughnessMap: wear, bumpMap: brushed, bumpScale: 0.0004 }),
      parker: S({ color: 0x46474b, metalness: 0.5, roughness: 0.62, roughnessMap: wear }),
      polymer: S({ color: 0x2a2b2e, metalness: 0.05, roughness: 0.78, bumpMap: stipple, bumpScale: 0.0008 }),
      grip: S({ color: 0x222325, metalness: 0.0, roughness: 0.9, bumpMap: stipple, bumpScale: 0.002 }),
      tan: S({ color: 0x8c7654, metalness: 0.1, roughness: 0.7, roughnessMap: wear, bumpMap: stipple, bumpScale: 0.0005 }),
      od: S({ color: 0x4c5138, metalness: 0.1, roughness: 0.75, roughnessMap: wear }),
      wood: S({ color: 0x6a4126, metalness: 0.0, roughness: 0.55, map: grain, bumpMap: grain, bumpScale: 0.0006 }),
      rubber: S({ color: 0x0f0f10, roughness: 0.95 }),
      chrome: S({ color: 0xa4a9b0, metalness: 1, roughness: 0.16, bumpMap: brushed, bumpScale: 0.0002 }),
      bluedSteel: S({ color: 0x2c313c, metalness: 0.9, roughness: 0.28, bumpMap: brushed, bumpScale: 0.0003 }),
      gold: S({ color: 0xe0b040, metalness: 1, roughness: 0.18, bumpMap: brushed, bumpScale: 0.0003 }),
      ivory: S({ color: 0xe8dcc0, roughness: 0.4 }),
      white: S({ color: 0xd8dade, metalness: 0.2, roughness: 0.35 }),
      lens: S({ color: 0x1a3048, metalness: 0.95, roughness: 0.04, emissive: new THREE.Color(0x0a1626) }),
      dark: S({ color: 0x050506, roughness: 0.9 }),
      brass: S({ color: 0xc8a046, metalness: 0.95, roughness: 0.25 }),
      glow: new THREE.MeshBasicMaterial({ color: new THREE.Color(0.4, 2.2, 3.2) }),
      red: new THREE.MeshBasicMaterial({ color: new THREE.Color(4, 0.4, 0.3) }),
      glove: S({ color: 0x1e1c1a, roughness: 0.88, bumpMap: stipple, bumpScale: 0.0015 }),
      knuckle: S({ color: 0x2a2826, roughness: 0.6 }),
      sleeve: S({ color: 0x3a3a30, roughness: 0.95, bumpMap: brushed, bumpScale: 0.002 }),
      cuff: S({ color: 0x2a2a24, roughness: 0.9 }),
      watch: S({ color: 0x101010, metalness: 0.6, roughness: 0.3 })
    };
    for (const k in this.mats) if (this.mats[k].isMeshStandardMaterial) this.mats[k].envMapIntensity = 1.6;
    return this.mats;
  },
  mesh(g, geo, mat, cast) { const m = new THREE.Mesh(geo, mat); m.castShadow = cast !== false; m.receiveShadow = true; g.add(m); return m; },
  /* extruded side silhouette: pts [[z,y],...] in gun space, width w along x */
  side(g, pts, w, mat, x, bevel) {
    const s = new THREE.Shape(); pts.forEach(([z, y], i) => i ? s.lineTo(-z, y) : s.moveTo(-z, y));
    const b = bevel === undefined ? Math.min(0.003, w * 0.12) : bevel;
    const geo = new THREE.ExtrudeGeometry(s, { depth: w - b * 2, bevelEnabled: b > 0, bevelThickness: b, bevelSize: b, bevelSegments: 2, curveSegments: 6 });
    geo.rotateY(Math.PI / 2); geo.translate((x || 0) - w / 2 + b, 0, 0);
    return this.mesh(g, geo, mat);
  },
  /* rounded box centered at (x,y,z) */
  box(g, w, h, d, x, y, z, mat, r) {
    r = Math.min(r === undefined ? 0.004 : r, w / 2.2, h / 2.2, d / 2.2);
    const s = new THREE.Shape(), hw = d / 2 - r, hh = h / 2 - r;
    s.moveTo(-hw, -h / 2); s.lineTo(hw, -h / 2); s.quadraticCurveTo(d / 2, -h / 2, d / 2, -hh); s.lineTo(d / 2, hh); s.quadraticCurveTo(d / 2, h / 2, hw, h / 2);
    s.lineTo(-hw, h / 2); s.quadraticCurveTo(-d / 2, h / 2, -d / 2, hh); s.lineTo(-d / 2, -hh); s.quadraticCurveTo(-d / 2, -h / 2, -hw, -h / 2);
    const geo = new THREE.ExtrudeGeometry(s, { depth: Math.max(0.0005, w - r * 2), bevelEnabled: r > 0.0005, bevelThickness: r, bevelSize: r * 0.9, bevelSegments: 2, curveSegments: 3 });
    geo.rotateY(Math.PI / 2); geo.translate(-w / 2 + r, 0, 0);
    const m = this.mesh(g, geo, mat); m.position.set(x || 0, y || 0, z || 0); return m;
  },
  /* cylinder along -z starting at z0 */
  cyl(g, r, len, x, y, z0, mat, seg, r2) {
    const geo = new THREE.CylinderGeometry(r2 !== undefined ? r2 : r, r, len, seg || 18).rotateX(Math.PI / 2);
    const m = this.mesh(g, geo, mat); m.position.set(x || 0, y || 0, z0 - len / 2); return m;
  },
  rail(g, len, x, y, z0, mat, lod) {
    this.box(g, 0.022, 0.006, len, x, y, z0 - len / 2, mat, 0.001);
    if (lod) return;
    const n = Math.floor(len / 0.01);
    for (let i = 0; i < n; i++) this.box(g, 0.022, 0.005, 0.005, x, y + 0.0055, z0 - 0.005 - i * 0.01, mat, 0.0008);
  },
  slots(g, x, y, z0, len, n, mat) { for (let i = 0; i < n; i++) this.box(g, 0.002, 0.008, 0.022, x, y, z0 - (i + 0.5) * len / n, mat, 0.0008); },
  brake(g, r, len, y, z0, M) { this.cyl(g, r, len, 0, y, z0, M.steel, 16); for (let i = 0; i < 3; i++) this.cyl(g, r * 1.02, 0.006, 0, y, z0 - 0.012 - i * 0.016, M.dark, 16); }
};

/* ---------- optics as reusable groups ---------- */
function opticHolo(M) { const g = new THREE.Group(); GK.box(g, 0.036, 0.012, 0.075, 0, 0.006, 0, M.parker, 0.003); GK.box(g, 0.004, 0.04, 0.07, -0.017, 0.03, 0, M.parker, 0.002); GK.box(g, 0.004, 0.04, 0.07, 0.017, 0.03, 0, M.parker, 0.002);
  GK.box(g, 0.036, 0.006, 0.07, 0, 0.051, 0, M.parker, 0.002); const w = GK.mesh(g, new THREE.PlaneGeometry(0.03, 0.034), M.lens, false); w.position.set(0, 0.03, -0.034); w.material = M.lens; w.rotation.y = Math.PI; return g; }
function opticScope(M, len, r, mag) {
  const g = new THREE.Group();
  GK.cyl(g, r, len * 0.55, 0, 0, len * 0.27, M.steel, 22); GK.cyl(g, r * 1.45, len * 0.28, 0, 0, -len * 0.28, M.steel, 22, r); GK.cyl(g, r * 1.3, len * 0.18, 0, 0, len * 0.5, M.steel, 22, r);
  GK.cyl(g, r * 0.6, 0.02, 0, r + 0.01, 0.01, M.steel, 14).rotation.x = 0; GK.cyl(g, r * 0.55, 0.02, r + 0.008, 0, 0.01, M.steel, 14).rotation.set(0, Math.PI / 2, 0);
  const t = GK.cyl(g, r * 0.55, 0.026, 0, r + 0.012, 0.0, M.steel, 14); t.rotation.x = 0; t.geometry.rotateX(-Math.PI / 2);
  const lf = GK.mesh(g, new THREE.CircleGeometry(r * 1.38, 22), M.lens, false); lf.position.z = -len * 0.56 - 0.001; lf.rotation.y = Math.PI;
  const lb = GK.mesh(g, new THREE.CircleGeometry(r * 1.2, 22), M.lens, false); lb.position.z = len * 0.59 + 0.001;
  for (const z of [len * 0.18, -len * 0.12]) { GK.box(g, r * 1.6, 0.016, 0.018, 0, -r - 0.004, z, M.parker, 0.002); }
  return g;
}

function buildGun(kind, o) {
  o = o || {}; const M = GK.init(), lod = !!o.lod, g = new THREE.Group(); let muzzle = -0.5, sightY = 0.06, pump = null, mag = null, bolt = null, holo = null, acog = null, cylinder = null, glow = null;
  const S = (pts, w, mat, x, b) => GK.side(g, pts, w, mat, x, b), Bx = (...a) => GK.box(g, ...a), C = (...a) => GK.cyl(g, ...a);
  switch (kind) {
    case 'pistol': case 'golden': {
      const gold = kind === 'golden', slideM = gold ? M.gold : M.parker, frameM = gold ? M.bluedSteel : M.polymer;
      S([[0.06, 0.012], [0.06, 0.052], [-0.13, 0.052], [-0.135, 0.046], [-0.135, 0.012]], 0.03, slideM);           // slide
      if (!lod) for (let i = 0; i < 7; i++) Bx(0.031, 0.022, 0.002, 0, 0.034, 0.05 - i * 0.005, M.dark, 0.0005); // rear serrations
      Bx(0.006, 0.006, 0.006, 0, 0.056, -0.12, M.dark, 0.001); Bx(0.022, 0.007, 0.008, 0, 0.056, 0.05, M.dark, 0.001); // sights
      if (!lod) { Bx(0.002, 0.003, 0.003, 0, 0.06, -0.12, M.red, 0.0005); }
      Bx(0.018, 0.012, 0.03, 0.0155, 0.04, -0.02, M.dark, 0.002);                                                        // ejection port
      S([[0.055, 0.014], [0.058, -0.004], [0.03, -0.004], [0.06, -0.12], [0.03, -0.128], [0.0, -0.012], [-0.12, -0.004], [-0.125, 0.014]], 0.028, frameM); // frame + grip
      if (gold) S([[0.052, -0.02], [0.054, -0.11], [0.034, -0.116], [0.012, -0.02]], 0.0305, M.ivory, 0, 0.001);
      S([[-0.005, -0.004], [-0.01, -0.03], [-0.05, -0.03], [-0.055, -0.004]], 0.012, frameM, 0, 0.001);                 // trigger guard
      S([[-0.022, -0.006], [-0.026, -0.022], [-0.03, -0.022], [-0.028, -0.006]], 0.005, M.steel, 0, 0.0008);              // trigger
      C(0.007, 0.012, 0, 0.032, -0.135, M.dark, 12);                                                                      // bore
      mag = Bx(0.026, 0.012, 0.034, 0, -0.123, 0.047, frameM, 0.002); mag.rotation.x = 0.25;
      muzzle = -0.14; sightY = 0.06; break;
    }
    case 'revolver': {
      S([[0.05, 0.0], [0.05, 0.03], [0.02, 0.05], [-0.04, 0.05], [-0.04, -0.005], [0.0, -0.01]], 0.03, M.chrome);        // frame
      cylinder = C(0.024, 0.045, 0, 0.022, -0.0, M.chrome, 6); cylinder.rotation.z = Math.PI / 6;
      if (!lod) for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; C(0.004, 0.047, Math.cos(a) * 0.024, 0.022 + Math.sin(a) * 0.024, 0.001, M.dark, 8); }
      C(0.011, 0.2, 0, 0.032, -0.04, M.chrome, 16); Bx(0.014, 0.016, 0.2, 0, 0.044, -0.14, M.chrome, 0.003);                // barrel + top rib
      S([[-0.04, 0.02], [-0.24, 0.022], [-0.24, 0.012], [-0.04, 0.008]], 0.026, M.chrome, 0, 0.002);                        // underlug
      Bx(0.005, 0.01, 0.01, 0, 0.056, -0.23, M.dark, 0.001); Bx(0.016, 0.008, 0.01, 0, 0.055, 0.045, M.dark, 0.001);
      S([[0.05, 0.03], [0.07, 0.04], [0.075, 0.03], [0.055, 0.01]], 0.01, M.chrome, 0, 0.001);                              // hammer
      S([[0.05, 0.0], [0.07, -0.02], [0.085, -0.12], [0.045, -0.13], [0.02, -0.02]], 0.03, M.wood);                          // grip
      S([[0.0, -0.01], [-0.005, -0.03], [-0.045, -0.03], [-0.045, -0.005]], 0.01, M.chrome, 0, 0.001);
      muzzle = -0.245; sightY = 0.062; break;
    }
    case 'smg': {
      S([[0.06, 0.0], [0.06, 0.05], [-0.18, 0.05], [-0.2, 0.03], [-0.2, -0.02], [-0.05, -0.04], [0.06, -0.02]], 0.05, M.polymer); // receiver
      GK.rail(g, 0.2, 0, 0.053, 0.05, M.parker, lod);
      C(0.018, 0.14, 0, 0.018, -0.2, M.steel, 16); C(0.022, 0.1, 0, 0.018, -0.34, M.parker, 16);                                // barrel + suppressor stub
      S([[0.03, -0.03], [0.055, -0.035], [0.07, -0.14], [0.045, -0.145], [0.01, -0.035]], 0.032, M.grip);                       // grip
      S([[-0.01, -0.035], [-0.015, -0.06], [-0.05, -0.06], [-0.055, -0.035]], 0.012, M.polymer, 0, 0.001);
      mag = Bx(0.028, 0.18, 0.036, 0, -0.12, -0.11, M.steel, 0.003); mag.rotation.x = 0.06;
      S([[-0.12, -0.02], [-0.125, -0.1], [-0.15, -0.1], [-0.155, -0.02]], 0.03, M.polymer);                                    // front grip
      S([[0.06, 0.03], [0.22, 0.03], [0.24, 0.0], [0.24, -0.06], [0.22, -0.06], [0.2, -0.0], [0.06, 0.0]], 0.012, M.parker, 0, 0.002); // folding stock frame
      const ro = opticHolo(M); ro.scale.setScalar(0.85); ro.position.set(0, 0.06, -0.06); g.add(ro); holo = [ro];
      muzzle = -0.44; sightY = 0.086; break;
    }
    case 'ar': {
      Bx(0.046, 0.045, 0.3, 0, 0.022, -0.02, M.parker, 0.004);                                                                   // upper
      S([[0.1, 0.0], [0.1, -0.035], [0.02, -0.045], [-0.02, -0.08], [-0.09, -0.08], [-0.095, -0.042], [-0.15, -0.035], [-0.15, 0.0]], 0.044, M.parker); // lower + magwell
      Bx(0.003, 0.016, 0.05, 0.0245, 0.026, -0.03, M.dark, 0.001);                                                                // ejection port
      Bx(0.02, 0.01, 0.025, 0, 0.044, 0.12, M.steel, 0.002);                                                                      // charging handle
      GK.rail(g, 0.28, 0, 0.048, 0.12, M.parker, lod);
      Bx(0.058, 0.056, 0.32, 0, 0.018, -0.33, M.polymer, 0.006);                                                                 // handguard
      if (!lod) for (const sx of [-1, 1]) GK.slots(g, sx * 0.0292, 0.012, -0.19, 0.28, 6, M.dark);
      GK.rail(g, 0.3, 0, 0.0485, -0.17, M.parker, lod);
      C(0.011, 0.12, 0, 0.018, -0.49, M.steel, 14); C(0.016, 0.03, 0, 0.018, -0.52, M.steel, 14);                                  // barrel + gas block
      GK.brake(g, 0.016, 0.06, 0.018, -0.6, M);
      S([[0.075, -0.035], [0.045, -0.04], [0.075, -0.16], [0.11, -0.155]], 0.032, M.grip);                                       // pistol grip
      S([[0.0, -0.04], [-0.005, -0.065], [-0.07, -0.07], [-0.075, -0.045]], 0.012, M.parker, 0, 0.001);
      S([[-0.028, -0.042], [-0.032, -0.06], [-0.036, -0.06], [-0.034, -0.042]], 0.005, M.steel, 0, 0.0008);
      C(0.017, 0.18, 0, 0.02, 0.3, M.parker, 16);                                                                                // buffer tube
      S([[0.2, 0.04], [0.36, 0.045], [0.37, -0.065], [0.34, -0.08], [0.3, -0.03], [0.2, -0.0]], 0.046, M.polymer);              // stock
      Bx(0.048, 0.12, 0.02, 0, -0.012, 0.37, M.rubber, 0.006);
      mag = S([[-0.03, -0.07], [-0.088, -0.07], [-0.108, -0.21], [-0.05, -0.222]], 0.03, M.steel, 0, 0.003);                   // curved mag
      holo = [opticHolo(M)]; holo[0].position.set(0, 0.054, -0.02); g.add(holo[0]);
      acog = new THREE.Group(); const sc = opticScope(M, 0.15, 0.019); sc.position.set(0, 0.034, 0); acog.add(sc); GK.box(acog, 0.03, 0.022, 0.07, 0, 0.012, 0, M.parker, 0.003);
      acog.position.set(0, 0.052, 0.0); acog.visible = false; g.add(acog);
      if (!lod) { const fs = new THREE.Group(); GK.box(fs, 0.012, 0.03, 0.012, 0, 0.015, 0, M.parker, 0.002); fs.position.set(0, 0.05, -0.47); g.add(fs); }
      muzzle = -0.66; sightY = 0.086; break;
    }
    case 'burst': { // bullpup
      S([[0.22, 0.01], [0.22, -0.07], [0.12, -0.08], [-0.02, -0.04], [-0.3, -0.035], [-0.32, 0.0], [-0.3, 0.04], [0.2, 0.045]], 0.056, M.tan); // shell
      Bx(0.06, 0.03, 0.12, 0, 0.012, 0.2, M.rubber, 0.008);
      S([[0.03, -0.04], [0.06, -0.045], [0.08, -0.15], [0.05, -0.155], [0.015, -0.045]], 0.032, M.grip);
      S([[-0.06, -0.04], [-0.07, -0.13], [-0.095, -0.13], [-0.1, -0.04]], 0.03, M.tan);                                         // front grip
      mag = S([[0.12, -0.07], [0.17, -0.07], [0.19, -0.19], [0.14, -0.2]], 0.028, M.steel, 0, 0.003);
      C(0.012, 0.1, 0, 0.012, -0.32, M.steel, 14); GK.brake(g, 0.015, 0.05, 0.012, -0.42, M);
      // integrated carry-handle optic
      S([[0.12, 0.045], [0.12, 0.08], [-0.12, 0.08], [-0.12, 0.045], [-0.08, 0.045], [-0.08, 0.06], [0.08, 0.06], [0.08, 0.045]], 0.03, M.tan);
      acog = new THREE.Group(); const sc = opticScope(M, 0.12, 0.016); acog.add(sc); acog.position.set(0, 0.098, 0); g.add(acog);
      muzzle = -0.47; sightY = 0.098; break;
    }
    case 'dmr': {
      S([[0.42, 0.02], [0.42, -0.1], [0.38, -0.11], [0.12, -0.04], [0.08, -0.15], [0.04, -0.15], [0.04, -0.04], [-0.42, -0.02], [-0.44, 0.02]], 0.05, M.wood); // one-piece stock
      Bx(0.052, 0.13, 0.02, 0, -0.04, 0.42, M.rubber, 0.006);
      Bx(0.044, 0.05, 0.26, 0, 0.035, -0.04, M.steel, 0.004);                                                                     // receiver
      C(0.0125, 0.42, 0, 0.03, -0.17, M.steel, 14); GK.brake(g, 0.017, 0.06, 0.03, -0.59, M);
      mag = Bx(0.03, 0.08, 0.07, 0, -0.06, -0.05, M.steel, 0.003);
      S([[-0.0, -0.035], [-0.005, -0.065], [-0.07, -0.065], [-0.075, -0.035]], 0.012, M.steel, 0, 0.001);
      acog = new THREE.Group(); const sc = opticScope(M, 0.28, 0.019); sc.position.y = 0.04; acog.add(sc); for (const z of [0.06, -0.06]) GK.box(acog, 0.03, 0.03, 0.02, 0, 0.012, z, M.steel, 0.003); acog.position.set(0, 0.06, -0.03); g.add(acog);
      muzzle = -0.66; sightY = 0.1; break;
    }
    case 'lmg': {
      Bx(0.07, 0.08, 0.34, 0, 0.02, -0.02, M.od, 0.006);                                                                       // receiver
      Bx(0.074, 0.02, 0.2, 0, 0.068, 0.02, M.od, 0.004);                                                                       // feed cover
      GK.rail(g, 0.18, 0, 0.081, 0.11, M.parker, lod);
      C(0.024, 0.28, 0, 0.02, -0.19, M.parker, 16); if (!lod) for (let i = 0; i < 7; i++) C(0.0245, 0.012, 0, 0.02, -0.21 - i * 0.035, M.dark, 16); // heat shroud
      C(0.014, 0.16, 0, 0.02, -0.47, M.steel, 14); GK.brake(g, 0.02, 0.07, 0.02, -0.63, M);
      mag = new THREE.Group(); GK.box(mag, 0.1, 0.12, 0.12, 0.0, -0.09, -0.04, M.od, 0.01); GK.box(mag, 0.102, 0.02, 0.122, 0, -0.04, -0.04, M.dark, 0.004); g.add(mag); // box mag
      S([[0.11, -0.02], [0.14, -0.03], [0.16, -0.15], [0.13, -0.155], [0.09, -0.03]], 0.034, M.grip);
      S([[0.15, 0.04], [0.42, 0.03], [0.43, -0.1], [0.38, -0.11], [0.3, -0.05], [0.15, -0.02]], 0.05, M.polymer);
      Bx(0.06, 0.03, 0.16, 0, 0.12, -0.02, M.od, 0.006); Bx(0.012, 0.04, 0.012, 0, 0.1, -0.08, M.od, 0.003); Bx(0.012, 0.04, 0.012, 0, 0.1, 0.04, M.od, 0.003); // carry handle
      for (const sx of [-1, 1]) { const l = C(0.005, 0.22, sx * 0.012, -0.012, -0.36, M.steel, 8); l.rotation.y = sx * 0.06; }   // folded bipod
      holo = [opticHolo(M)]; holo[0].position.set(0, 0.086, 0.09); g.add(holo[0]);
      muzzle = -0.7; sightY = 0.117; break;
    }
    case 'shotgun': {
      S([[0.09, 0.0], [0.09, 0.045], [-0.15, 0.045], [-0.16, 0.01], [-0.16, -0.035], [0.05, -0.04]], 0.05, M.steel);             // receiver
      C(0.016, 0.5, 0, 0.026, -0.15, M.bluedSteel, 16); C(0.0145, 0.42, 0, -0.012, -0.15, M.bluedSteel, 16);                       // barrel + tube
      Bx(0.006, 0.006, 0.006, 0, 0.046, -0.64, M.brass, 0.001);
      pump = Bx(0.06, 0.05, 0.16, 0, -0.012, -0.33, M.wood, 0.01); if (!lod) for (let i = 0; i < 6; i++) Bx(0.062, 0.004, 0.006, 0, -0.012, -0.27 - i * 0.022, M.dark, 0.001);
      S([[0.09, 0.03], [0.4, 0.0], [0.41, -0.11], [0.36, -0.12], [0.12, -0.05], [0.07, -0.05]], 0.048, M.wood);                   // stock
      Bx(0.05, 0.12, 0.02, 0, -0.05, 0.405, M.rubber, 0.006);
      S([[0.0, -0.035], [-0.005, -0.065], [-0.07, -0.065], [-0.075, -0.035]], 0.012, M.steel, 0, 0.001);
      muzzle = -0.66; sightY = 0.05; break;
    }
    case 'autoshotgun': {
      Bx(0.064, 0.08, 0.36, 0, 0.01, -0.06, M.polymer, 0.008); GK.rail(g, 0.3, 0, 0.051, 0.1, M.parker, lod);
      C(0.02, 0.24, 0, 0.012, -0.24, M.steel, 16); GK.brake(g, 0.024, 0.06, 0.012, -0.48, M);
      mag = new THREE.Group(); const dr = GK.cyl(mag, 0.075, 0.06, 0, -0.1, 0.03, M.polymer, 24); dr.rotation.set(0, Math.PI / 2, 0); GK.box(mag, 0.04, 0.05, 0.05, 0, -0.04, -0.03, M.polymer, 0.004); mag.position.z = -0.03; g.add(mag);
      S([[0.06, -0.03], [0.09, -0.035], [0.11, -0.15], [0.08, -0.155], [0.04, -0.035]], 0.034, M.grip);
      S([[0.12, 0.04], [0.36, 0.035], [0.37, -0.1], [0.32, -0.11], [0.12, -0.03]], 0.05, M.polymer);
      holo = [opticHolo(M)]; holo[0].position.set(0, 0.057, -0.0); g.add(holo[0]);
      muzzle = -0.54; sightY = 0.09; break;
    }
    case 'sniper': {
      S([[0.12, 0.01], [0.12, 0.05], [-0.16, 0.05], [-0.16, 0.0], [0.0, -0.035]], 0.05, M.steel);                                  // action
      C(0.014, 0.66, 0, 0.026, -0.16, M.bluedSteel, 16); if (!lod) for (let i = 0; i < 4; i++) Bx(0.004, 0.004, 0.4, Math.cos(i * 1.57) * 0.0135, 0.026 + Math.sin(i * 1.57) * 0.0135, -0.42, M.dark, 0.001); // fluted barrel
      GK.brake(g, 0.022, 0.08, 0.026, -0.82, M);
      S([[0.12, 0.02], [0.46, 0.03], [0.47, -0.12], [0.42, -0.13], [0.3, -0.07], [0.14, -0.07], [0.12, -0.15], [0.08, -0.155], [0.06, -0.04], [-0.38, -0.03], [-0.4, 0.0]], 0.056, M.tan); // chassis stock
      Bx(0.06, 0.03, 0.12, 0, 0.065, 0.37, M.tan, 0.008); Bx(0.058, 0.15, 0.02, 0, -0.05, 0.465, M.rubber, 0.006);              // cheek riser + pad
      mag = Bx(0.034, 0.07, 0.08, 0, -0.06, -0.06, M.steel, 0.003);
      bolt = new THREE.Group(); GK.cyl(bolt, 0.005, 0.07, 0, 0, 0.0, M.chrome, 10).rotation.set(0, Math.PI / 2, 0); const kn = GK.mesh(bolt, new THREE.SphereGeometry(0.011, 12, 10), M.dark); kn.position.x = 0.07; bolt.position.set(0.028, 0.03, 0.08); g.add(bolt);
      S([[-0.0, -0.035], [-0.005, -0.065], [-0.07, -0.065], [-0.075, -0.035]], 0.012, M.steel, 0, 0.001);
      const sc = opticScope(M, 0.36, 0.021); sc.position.set(0, 0.092, -0.04); g.add(sc); for (const z of [0.05, -0.12]) Bx(0.03, 0.04, 0.02, 0, 0.068, z, M.steel, 0.003);
      for (const sx of [-1, 1]) { const l = C(0.006, 0.24, sx * 0.016, -0.03, -0.3, M.parker, 8); l.rotation.y = sx * 0.05; }
      muzzle = -0.9; sightY = 0.092; break;
    }
    case 'rocket': {
      C(0.062, 0.98, 0, 0.0, 0.38, M.od, 24); C(0.072, 0.12, 0, 0.0, -0.56, M.steel, 24, 0.064); C(0.075, 0.12, 0, 0.0, 0.44, M.steel, 24, 0.064);
      const tip = GK.mesh(g, new THREE.ConeGeometry(0.045, 0.14, 18).rotateX(-Math.PI / 2), M.od); tip.position.z = -0.75; GK.cyl(g, 0.048, 0.06, 0, 0, -0.62, M.steel, 18);
      S([[0.05, -0.06], [0.08, -0.065], [0.095, -0.18], [0.065, -0.185], [0.03, -0.065]], 0.034, M.grip); S([[-0.18, -0.06], [-0.19, -0.17], [-0.22, -0.17], [-0.225, -0.06]], 0.032, M.grip);
      Bx(0.035, 0.07, 0.12, -0.08, 0.04, -0.15, M.parker, 0.005); const ls = GK.mesh(g, new THREE.PlaneGeometry(0.026, 0.05), M.lens, false); ls.position.set(-0.08, 0.04, -0.211); ls.rotation.y = Math.PI;
      Bx(0.008, 0.008, 0.01, -0.08, 0.08, -0.19, M.red, 0.001);
      muzzle = -0.82; sightY = 0.09; break;
    }
    case 'arc': {
      S([[0.32, 0.03], [0.3, -0.08], [0.12, -0.05], [0.06, -0.16], [0.03, -0.16], [0.02, -0.03], [-0.34, -0.02], [-0.4, 0.02], [-0.36, 0.05], [0.2, 0.06]], 0.06, M.white); // shell
      S([[0.2, 0.06], [-0.3, 0.05], [-0.32, 0.035], [0.18, 0.04]], 0.064, M.polymer, 0, 0.003);
      glow = [];
      for (let i = 0; i < 5; i++) { const r = GK.mesh(g, new THREE.TorusGeometry(0.03, 0.006, 8, 20), M.glow, false); r.position.set(0, 0.012, -0.1 - i * 0.05); glow.push(r); }
      C(0.016, 0.3, 0, 0.012, -0.08, M.steel, 14); const cell = GK.cyl(g, 0.02, 0.1, 0, -0.045, 0.2, M.glow, 14); glow.push(cell);
      mag = Bx(0.044, 0.06, 0.12, 0, -0.05, 0.2, M.white, 0.006);
      GK.rail(g, 0.2, 0, 0.068, 0.12, M.polymer, lod); holo = [opticHolo(M)]; holo[0].position.set(0, 0.074, 0.03); g.add(holo[0]);
      muzzle = -0.42; sightY = 0.104; break;
    }
  }
  g.traverse(m => { if (m.isMesh && !lod) { m.castShadow = false; } });
  const len = -muzzle;
  return { g, muzzle, sightY, pump, mag, bolt, holo, acog, cylinder, glow, len, gripZ: 0.07, foreZ: kind === 'pistol' || kind === 'golden' || kind === 'revolver' ? 0.06 : -len * 0.45 };
}
function buildWorldGun(kind) { const b = buildGun(kind, { lod: true }); if (b.acog) b.acog.visible = true; if (b.holo && b.acog) b.holo.forEach(h => h.visible = false); return b; }

/* ---------- gloved hands + sleeves ---------- */
function handMesh(left) {
  const M = GK.init(), h = new THREE.Group();
  GK.box(h, 0.045, 0.085, 0.09, 0, 0, 0, M.glove, 0.018);                         // palm
  GK.box(h, 0.047, 0.02, 0.07, 0, 0.032, -0.005, M.knuckle, 0.008);               // knuckle guard
  for (let i = 0; i < 4; i++) { const f = new THREE.Group(); f.position.set(0, 0.028 - i * 0.02, -0.045); h.add(f);
    const a = GK.mesh(f, new THREE.CapsuleGeometry(0.0085, 0.028, 4, 8).rotateX(Math.PI / 2), M.glove); a.position.z = -0.018;
    const b2 = GK.mesh(f, new THREE.CapsuleGeometry(0.008, 0.022, 4, 8).rotateX(Math.PI / 2), M.glove); b2.position.set(left ? 0.016 : -0.016, 0, -0.04); b2.rotation.y = left ? -1.3 : 1.3; }
  const th = GK.mesh(h, new THREE.CapsuleGeometry(0.01, 0.032, 4, 8), M.glove); th.position.set(left ? -0.026 : 0.026, 0.02, -0.02); th.rotation.set(0.6, 0, left ? 0.5 : -0.5);
  return h;
}
function sleeveMesh(len, watch) {
  const M = GK.init(), s = new THREE.Group();
  const prof = [new THREE.Vector2(0.034, 0), new THREE.Vector2(0.038, 0.02), new THREE.Vector2(0.042, len * 0.4), new THREE.Vector2(0.046, len * 0.7), new THREE.Vector2(0.05, len)];
  const sl = GK.mesh(s, new THREE.LatheGeometry(prof, 14).rotateX(Math.PI / 2), M.sleeve); sl.position.z = 0;
  const cf = GK.mesh(s, new THREE.CylinderGeometry(0.037, 0.035, 0.03, 14).rotateX(Math.PI / 2), M.cuff); cf.position.z = 0.012;
  if (watch) { const w = GK.mesh(s, new THREE.CylinderGeometry(0.036, 0.036, 0.018, 14).rotateX(Math.PI / 2), M.watch); w.position.z = -0.02; const face = GK.box(s, 0.016, 0.006, 0.02, 0, 0.038, -0.02, M.lens, 0.002); void face; }
  return s;
}
function addArms(g, grip, fore) {
  const R = handMesh(false); R.position.set(grip[0], grip[1], grip[2]); R.rotation.set(0.25, 0, 0); g.add(R);
  const rs = sleeveMesh(0.38); rs.position.set(grip[0] + 0.01, grip[1] - 0.02, grip[2] + 0.04); g.add(rs);
  rs.lookAt(new V3(grip[0] + 0.12, grip[1] - 0.32, grip[2] + 0.4));
  if (fore) {
    const L = handMesh(true); L.position.set(fore[0], fore[1], fore[2]); L.rotation.set(0, 0, 0.35); g.add(L);
    const ls = sleeveMesh(0.4, true); ls.position.set(fore[0] - 0.03, fore[1] - 0.03, fore[2] + 0.04); g.add(ls);
    ls.lookAt(new V3(fore[0] - 0.22, fore[1] - 0.34, fore[2] + 0.42));
  }
}

/* ---------- expanded arsenal ---------- */
Object.assign(WDEF, {
  revolver: { name: 'KODIAK .50', dmg: 72, rpm: 160, auto: false, mag: 6, res: 30, maxRes: 72, reload: 2.4, spread: 0.012, ads: 0.0025, recoil: 0.065, kick: 0.11, range: 220, pellets: 1, zoom: 1.25, snd: 'revolver', hip: [0.16, -0.17, -0.5], adsP: [0, 0, -0.4], grip: [0, -0.07, 0.07], fore: [-0.03, -0.1, 0.03] },
  burst: { name: 'SR-3 TALON', dmg: 31, rpm: 1000, burst: 3, burstDelay: 0.3, auto: false, mag: 30, res: 90, maxRes: 300, reload: 2.1, spread: 0.018, ads: 0.003, recoil: 0.011, kick: 0.035, range: 320, pellets: 1, zoom: 1.6, snd: 'burst', hip: [0.2, -0.2, -0.44], adsP: [0, 0, -0.27], grip: [0, -0.09, 0.05], fore: [0, -0.1, -0.08] },
  dmr: { name: 'M21 WARDEN', dmg: 75, rpm: 270, auto: false, mag: 15, res: 45, maxRes: 120, reload: 2.4, spread: 0.035, ads: 0.0007, recoil: 0.036, kick: 0.07, range: 650, pellets: 1, zoom: 4, snd: 'dmr', hip: [0.2, -0.2, -0.44], adsP: [0, 0, -0.26], grip: [0, -0.08, 0.06], fore: [0, -0.04, -0.3] },
  lmg: { name: 'RK-100 RAMPART', dmg: 27, rpm: 760, auto: true, mag: 100, res: 200, maxRes: 400, reload: 4.2, spread: 0.034, ads: 0.011, recoil: 0.01, kick: 0.034, range: 320, pellets: 1, zoom: 1.4, snd: 'lmg', heavy: 0.86, hip: [0.21, -0.21, -0.44], adsP: [0, 0, -0.32], grip: [0, -0.07, 0.14], fore: [0, -0.02, -0.25] },
  autoshotgun: { name: 'AA-20 DRAGON', dmg: 14, rpm: 300, auto: true, mag: 12, res: 36, maxRes: 96, reload: 2.9, spread: 0.09, ads: 0.07, recoil: 0.042, kick: 0.08, range: 55, pellets: 8, zoom: 1.2, snd: 'autoshotgun', hip: [0.2, -0.2, -0.44], adsP: [0, 0, -0.33], grip: [0, -0.07, 0.07], fore: [0, -0.04, -0.22] },
  arc: { name: 'ARC-9 PROTOTYPE', dmg: 48, rpm: 330, auto: true, mag: 24, res: 72, maxRes: 144, reload: 2.2, spread: 0.008, ads: 0.002, recoil: 0.014, kick: 0.04, range: 240, pellets: 1, zoom: 1.5, snd: 'arc', arc: true, hip: [0.2, -0.2, -0.44], adsP: [0, 0, -0.3], grip: [0, -0.08, 0.05], fore: [0, -0.06, -0.24] }
});
WDEF.lmg.slot = 0; // slots are now positional (owned order)
OPTICS.dmr = { name: '4x SCOPE', zoom: 4, scope: true, reticle: 'acog', r: 0.33, sway: 0.0018 };
OPTICS.talon = { name: '2x OPTIC', zoom: 2, scope: true, reticle: 'acog', r: 0.3, sway: 0.0008 };
Object.assign(WOPT, { revolver: ['iron'], burst: ['talon'], dmr: ['dmr'], lmg: ['holo'], autoshotgun: ['holo'], arc: ['holo'], smg: ['holo'] });
SLOTS.length = 0; SLOTS.push('pistol', 'revolver', 'smg', 'ar', 'burst', 'dmr', 'lmg', 'shotgun', 'autoshotgun', 'sniper', 'rocket', 'arc', 'golden');
GUN_SND.revolver && 0;
