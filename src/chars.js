/* ============================================================
   CHARACTERS: realistic skinned humans, zombies and creatures
   (Mixamo models + motion capture, loaded per level from
   assets/char_*.js and assets/anims.js).
   CharLib: registry, lazy loading, mesh/material rebuild, clip retarget.
   HumanRig: per-character animation state machine + gun hold.
   ============================================================ */
const CharLib = {
  packs: {}, geo: {}, mats: {}, tex: {}, clipCache: {}, loading: {},
  add(name, data, b64) { this.packs[name] = { data, b64, bin: null }; },
  bin(pk) { if (!pk.bin) { const s = atob(pk.b64), u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i); pk.bin = u.buffer; pk.b64 = null; } return pk.bin; },
  view(pk, ref) { const C = { f32: Float32Array, u16: Uint16Array, u32: Uint32Array, u8: Uint8Array }[ref.t]; return new C(this.bin(pk), ref.o, ref.n); },
  has(key) { return !!this.packs['char:' + key]; },
  /* load asset scripts; resolves when all are present (missing files resolve too, callers fall back) */
  require(keys) {
    const want = ['anims'].concat(keys.map(k => 'char:' + k)).filter(n => !this.packs[n]);
    return Promise.all(want.map(n => this.loading[n] || (this.loading[n] = new Promise(res => {
      const s = document.createElement('script'); s.src = 'assets/' + (n === 'anims' ? 'anims' : 'char_' + n.slice(5)) + '.js';
      s.onload = s.onerror = () => res(); document.head.appendChild(s);
    }))));
  },
  pack(key) { return this.packs['char:' + key] || this.packs['char:legacy']; },
  texture(pk, key, i, srgb) {
    const k = key + ':' + i + ':' + (srgb ? 1 : 0); if (this.tex[k]) return this.tex[k];
    const img = new Image(), t = new THREE.Texture(img); img.onload = () => { t.needsUpdate = true; }; img.src = pk.data.tex[i];
    t.flipY = false; if (srgb) t.encoding = THREE.sRGBEncoding; t.anisotropy = 4; t.wrapS = t.wrapT = THREE.RepeatWrapping; return this.tex[k] = t;
  },
  material(key, mi, o) {
    o = o || {}; const k = key + ':' + mi + ':' + (o.tint ?? '') + ':' + (o.skin || '') + ':' + (o.tintAmt ?? '');
    if (this.mats[k]) return this.mats[k];
    const pk = this.pack(key), d = pk.data.mats[mi];
    const m = new THREE.MeshStandardMaterial({ color: new THREE.Color(d.color[0], d.color[1], d.color[2]), roughness: Math.max(0.45, d.rough), metalness: Math.min(d.metal, 0.4), side: THREE.FrontSide });
    if (d.map !== null) m.map = this.texture(pk, key, d.map, true);
    if (d.nrm !== null) m.normalMap = this.texture(pk, key, d.nrm, false);
    if (d.mr !== null) { m.roughnessMap = m.metalnessMap = this.texture(pk, key, d.mr, false); }
    if (d.em !== null) { m.emissiveMap = this.texture(pk, key, d.em, true); m.emissive = new THREE.Color(1, 1, 1); }
    if (d.alpha === 'BLEND' || d.alpha === 'MASK') { m.alphaTest = 0.5; m.transparent = false; m.side = THREE.DoubleSide; }
    if (o.tint !== undefined && o.tint !== null) m.color.lerp(new THREE.Color(o.tint), o.tintAmt ?? 0.4);
    if (o.skin) this.skinShader(m, o.skin);
    return this.mats[k] = m;
  },
  geometry(key, mi, pi) {
    const k = key + ':' + mi + ':' + pi; if (this.geo[k]) return this.geo[k];
    const pk = this.pack(key), p = pk.data.meshes[mi].prims[pi], g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.view(pk, p.pos), 3));
    g.setAttribute('normal', new THREE.BufferAttribute(this.view(pk, p.nrm), 3));
    g.setAttribute('uv', new THREE.BufferAttribute(this.view(pk, p.uv), 2));
    g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(this.view(pk, p.j), 4));
    g.setAttribute('skinWeight', new THREE.BufferAttribute(this.view(pk, p.w), 4, true));
    g.setIndex(new THREE.BufferAttribute(this.view(pk, p.idx), 1));
    g.computeBoundingSphere(); g.boundingSphere.radius *= 2.5;
    return this.geo[k] = g;
  },
  build(key, o) {
    o = o || {}; const pk = this.pack(key), P = pk.data, jointSet = new Set();
    for (const s of P.skins) for (const j of s.joints) jointSet.add(j);
    const objs = P.nodes.map((n, i) => { const ob = jointSet.has(i) ? new THREE.Bone() : new THREE.Group(); ob.name = n.name.replace(/^mixamorig\d+/, 'mixamorig'); ob.position.fromArray(n.t); ob.quaternion.fromArray(n.r); ob.scale.fromArray(n.s); return ob; });
    P.nodes.forEach((n, i) => { for (const c of n.c) objs[i].add(objs[c]); });
    const root = new THREE.Group(); for (const r of P.roots) root.add(objs[r]);
    root.updateMatrixWorld(true);
    const meshes = [], bones = {};
    P.nodes.forEach((n, i) => { if (jointSet.has(i)) bones[n.name.replace(/^mixamorig\d*/, '')] = objs[i]; });
    P.nodes.forEach((n, i) => {
      if (n.mesh === null || n.mesh === undefined || !P.meshes[n.mesh] || n.skin === null || n.skin === undefined) return;
      const sk = P.skins[n.skin], ibm = this.view(pk, sk.ibm);
      const sb = sk.joints.map(j => objs[j]), inv = sk.joints.map((j, k) => new THREE.Matrix4().fromArray(ibm, k * 16));
      P.meshes[n.mesh].prims.forEach((pr, pi) => {
        const m = new THREE.SkinnedMesh(this.geometry(key, n.mesh, pi), this.material(key, pr.mat, o));
        m.castShadow = true; m.receiveShadow = true; objs[i].add(m); m.bind(new THREE.Skeleton(sb, inv), m.matrixWorld); meshes.push(m);
      });
    });
    return { root, bones, meshes, hipsRestY: bones.Hips ? bones.Hips.position.y : 1 };
  },
  /* clips retargeted to this model: rotations copied, hip height rescaled */
  clips(key, hipsRestY) {
    const ck = key + ':' + hipsRestY.toFixed(3); if (this.clipCache[ck]) return this.clipCache[ck];
    const out = {}, srcs = [];
    if (this.packs.anims && key !== 'legacy') srcs.push(this.packs.anims);
    if (this.packs['char:legacy'] && this.packs['char:legacy'].data.clips) srcs.push(this.packs['char:legacy']);
    const srcHips = this.srcHipsY || (this.srcHipsY = (() => { const s = this.packs['char:swat']; if (!s) return null; const h = s.data.nodes.find(n => /Hips$/.test(n.name)); return h ? h.t[1] : null; })());
    for (const pk of srcs) for (const c of pk.data.clips) {
      if (out[c.name]) continue;
      const tracks = [];
      for (const t of c.tracks) {
        const times = this.view(pk, t.t); let vals = this.view(pk, t.v);
        const bone = t.n.replace(/^mixamorig\d*/, 'mixamorig');
        if (t.p === 'p') { const sh = srcHips || vals[1]; const r = hipsRestY / sh; const v2 = new Float32Array(vals.length); for (let i = 0; i < vals.length; i += 3) { v2[i] = 0; v2[i + 1] = vals[i + 1] * r; v2[i + 2] = 0; } vals = v2; }
        tracks.push(t.p === 'q' ? new THREE.QuaternionKeyframeTrack(bone + '.quaternion', times, vals) : new THREE.VectorKeyframeTrack(bone + '.position', times, vals));
      }
      out[c.name] = new THREE.AnimationClip(c.name, -1, tracks);
    }
    return this.clipCache[ck] = out;
  },
  skinShader(m, kind) {
    m.onBeforeCompile = sh => {
      sh.fragmentShader = sh.fragmentShader.replace('#include <map_fragment>', `#include <map_fragment>
        { float n = fract(sin(dot(floor(vViewPosition.xy * 23.0), vec2(12.9898, 78.233))) * 43758.5453);
          ${kind === 'pale' ? 'diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.62, 0.6, 0.58) * (0.8 + 0.2 * n), 0.55);' : 'diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(0.75, 0.85, 0.65), 0.6);'} }`);
    };
    m.customProgramCacheKey = () => 'skin' + kind;
  }
};
window.CharLib = CharLib;
// the original embedded soldier (fallback when an asset file is missing)
if (typeof CHARPACK !== 'undefined') { CharLib.add('char:legacy', Object.assign({}, CHARPACK.models.soldier, { clips: CHARPACK.clips }), CHARBIN); CharLib.packs['char:legacy'].sharedBin = true; }

/* ---------- archetypes: which clips drive which state ---------- */
const ARCH = {
  soldier: { idle: 'rifle_aim', calm: 'rifle_idle', walk: 'rifle_walk', run: 'rifle_run', cidle: 'crouch_idle', cwalk: 'crouch_walk', reload: 'reload', hit: 'hit', throw: 'grenade', deaths: ['death_rifle', 'death_head', 'death_back', 'death_fall', 'death_fwd'], gun: true, fb: { idle: 'idle', walk: 'walk', run: 'run' } },
  pistol: { idle: 'pistol_idle', walk: 'pistol_walk', run: 'pistol_run', cidle: 'crouch_idle', cwalk: 'crouch_walk', hit: 'hit', deaths: ['death_head', 'death_fall', 'death_fwd'], gun: true },
  civilian: { idle: 'idle', walk: 'walk', run: 'run', panic: 'terrified', talk: 'talk', sit: 'sit', hit: 'hit', deaths: ['death_fall', 'death_fwd', 'death_back'], cidle: 'idle', cwalk: 'crouch_sneak' },
  zombie: { idle: 'z_idle', walk: 'z_walk', run: 'z_running', attack: ['z_attack', 'z_punch', 'z_bite'], scream: 'z_scream', hit: 'z_hit', deaths: ['z_dying', 'z_death'], cidle: 'z_idle', cwalk: 'z_walk', crawl: 'z_crawl' },
  creature: { idle: 'm_breath', walk: 'm_walk', run: 'm_run', attack: ['m_swipe', 'm_jump'], scream: 'm_roar', hit: 'z_hit', deaths: ['m_dying'], cidle: 'm_idle', cwalk: 'm_walk' },
  crawler: { idle: 'crawl', walk: 'crawl', run: 'crawl_run', attack: ['z_bite'], scream: 'z_scream', hit: 'z_hit', deaths: ['z_death'], cidle: 'crawl', cwalk: 'crawl' }
};

/* ---------- small IK helpers (aim layer) ---------- */
const _ik = { q: new THREE.Quaternion(), q2: new THREE.Quaternion(), pq: new THREE.Quaternion(), a: new V3(), b: new V3(), m: new THREE.Matrix4(), up: new V3(0, 1, 0) };
function addBoneRot(bone, axis, ang) { if (!bone) return; _ik.q.setFromAxisAngle(axis, ang); bone.quaternion.multiply(_ik.q); }
/* rotate a bone about a WORLD axis */
function boneWorldRot(bone, axis, ang) { if (!bone) return; bone.getWorldQuaternion(_ik.q2); _ik.q.setFromAxisAngle(axis, ang); _ik.q2.premultiply(_ik.q); bone.parent.getWorldQuaternion(_ik.pq); bone.quaternion.copy(_ik.pq.invert().multiply(_ik.q2)); bone.updateMatrixWorld(true); }
const AX = { X: new V3(1, 0, 0), Y: new V3(0, 1, 0), Z: new V3(0, 0, 1) };

const Rigs = { list: [], update(dt) { for (let i = this.list.length - 1; i >= 0; i--) { const r = this.list[i]; if (!r.root.parent) { r.detached = (r.detached || 0) + dt; if (r.detached > 3) { r.dispose(); } continue; } r.detached = 0; r.update(dt); } } };

class HumanRig {
  /* o: { char, arch, tint, tintAmt, gun, height, skin } */
  constructor(o) {
    this.o = o; this.key = CharLib.has(o.char) ? o.char : 'legacy';
    const B = CharLib.build(this.key, o); this.model = B.root; this.bones = B.bones; this.meshes = B.meshes;
    this.root = new THREE.Group(); this.inner = new THREE.Group(); this.root.add(this.inner); this.inner.add(this.model);
    this.model.rotation.y = Math.PI;   // Mixamo characters face +Z; the game's forward is -Z
    // normalize height from the hips
    this.model.updateMatrixWorld(true); const hp = new V3(); if (B.bones.Hips) B.bones.Hips.getWorldPosition(hp);
    const hipW = hp.y > 0.01 ? hp.y : 1; this.model.scale.multiplyScalar((o.height || 1.8) * 0.545 / hipW);
    this.arch = ARCH[o.arch || 'soldier'];
    this.clips = CharLib.clips(this.key, B.hipsRestY);
    this.mixer = new THREE.AnimationMixer(this.model);
    this.loco = {}; this.w = {};
    const names = ['idle', 'calm', 'walk', 'run', 'cidle', 'cwalk'];
    const used = new Set();
    for (const n of names) {
      let c = this.clips[this.arch[n]] || (this.arch.fb && this.clips[this.arch.fb[n]]) || this.clips[this.arch.idle] || this.clips.idle || this.clips.Idle;
      if (!c || used.has(c)) continue; used.add(c); const a = this.mixer.clipAction(c); a.play(); a.setEffectiveWeight(0); a.time = Math.random() * c.duration; this.loco[n] = a; this.w[n] = 0;
    }
    if (this.loco.idle) { this.loco.idle.setEffectiveWeight(1); this.w.idle = 1; }
    this.one = null; this.oneT = 0;
    this.lastPos = new V3(); this.speed = 0; this.first = true; this.dead = false; this.crouchK = 0; this.flinchK = 0; this.sitK = 0;
    this.tmp = { p: new V3(), q: new THREE.Quaternion(), v: new V3(), w: new V3(), m: new THREE.Matrix4() };
    // gun rides the right hand, aimed through the left hand (follows any mocap)
    this.gunKind = o.gun || null;
    if (this.gunKind && this.arch.gun) {
      const g = buildWorldGun(this.gunKind); this.gun = g; this.root.add(g.g);
      g.g.traverse(m => { if (m.isMesh) m.castShadow = true; });
    }
    this.yawFix = 0; this.yawFixT = 0;
    Rigs.list.push(this);
  }
  play(name, o) { // one-shot clip over locomotion
    o = o || {}; const nm = Array.isArray(name) ? pick(name) : name, c = this.clips[nm]; if (!c) return 0;
    if (this.one) this.one.fadeOut(0.15);
    const a = this.mixer.clipAction(c); a.reset(); a.setLoop(THREE.LoopOnce, 1); a.clampWhenFinished = !!o.hold; a.setEffectiveWeight(1); a.fadeIn(o.fade ?? 0.12); a.play();
    this.one = a; this.oneT = c.duration; this.oneHold = !!o.hold; this.oneUpper = !!o.upper;
    return c.duration;
  }
  die() {
    if (this.dead) return; this.dead = true;
    for (const k in this.loco) this.loco[k].fadeOut(0.2);
    if (!this.play(this.arch.deaths, { hold: true, fade: 0.1 })) this.procDeath = true;
    if (this.gun) { this.gunDrop = { t: 0 }; }
  }
  update(dt) {
    const P = this.proxies, B = this.bones, T = this.tmp;
    this.root.getWorldPosition(T.p);
    if (this.first) { this.lastPos.copy(T.p); this.first = false; }
    const mv = Math.hypot(T.p.x - this.lastPos.x, T.p.z - this.lastPos.z) / Math.max(dt, 1e-4); this.lastPos.copy(T.p);
    this.speed += (Math.min(mv, 10) - this.speed) * Math.min(1, dt * 8);
    const owner = P && P.owner, deadNow = owner && owner.alive === false;
    if (deadNow && !this.dead) this.die();
    const sit = P && P.legs && P.legs[0].rotation.x < -1.0;
    const crouch = P && P.hips && !sit ? clamp((0.95 - P.hips.position.y) / 0.37, 0, 1) : 0;
    const pitch = P && P.aim ? P.aim.rotation.x : 0;
    const flinch = P && P.torso ? clamp(P.torso.rotation.x, 0, 0.6) : 0;
    this.crouchK += (crouch - this.crouchK) * Math.min(1, dt * 8); this.sitK += ((sit ? 1 : 0) - this.sitK) * Math.min(1, dt * 6);
    if (flinch > 0.2 && this.flinchK < 0.1 && !this.dead && !this.one && this.arch.hit) this.play(this.arch.hit, { fade: 0.08 });
    this.flinchK += (flinch - this.flinchK) * Math.min(1, dt * 12);
    if (!this.dead) {
      const s = this.sitK > 0.5 ? 0 : this.speed, c = this.crouchK > 0.5;
      const calm = owner && owner.state && owner.state !== 'combat' && this.loco.calm;
      let tgt = s < 0.35 ? (c ? 'cidle' : calm ? 'calm' : 'idle') : s < 3.4 ? (c ? 'cwalk' : 'walk') : (c ? 'cwalk' : 'run');
      if (!this.loco[tgt]) tgt = ({ cidle: 'idle', calm: 'idle', cwalk: 'walk', run: 'walk' })[tgt] || 'idle';
      for (const k in this.loco) { this.w[k] += ((k === tgt ? 1 : 0) - this.w[k]) * Math.min(1, dt * 7); this.loco[k].setEffectiveWeight(this.w[k] * (this.one && !this.oneUpper ? 0.15 : 1)); }
      if (this.loco.walk) this.loco.walk.timeScale = clamp(s / 1.6, 0.6, 1.8); if (this.loco.run) this.loco.run.timeScale = clamp(s / 5.5, 0.75, 1.5); if (this.loco.cwalk) this.loco.cwalk.timeScale = clamp(s / 1.4, 0.6, 1.6);
    }
    if (this.one && !this.oneHold) { this.oneT -= dt; if (this.oneT < 0.15) { this.one.fadeOut(0.15); this.one = null; } }
    this.mixer.update(dt);
    // hips stay in place (mocap drifts) except deaths
    if (B.Hips && !this.dead) { B.Hips.position.x = 0; B.Hips.position.z = 0; }
    if (this.sitK > 0.01 && B.Hips) { const k = this.sitK; B.Hips.position.y *= 1 - 0.42 * k; for (const sd of ['Left', 'Right']) { addBoneRot(B[sd + 'UpLeg'], AX.X, -k * 1.5); addBoneRot(B[sd + 'Leg'], AX.X, k * 1.5); } }
    if (this.procDeath) this.deathPose(dt);
    this.model.updateMatrixWorld(true);
    // aim layer: bend the spine toward the target pitch
    if (!this.dead && this.arch.gun && Math.abs(pitch) > 0.01) { this.root.getWorldQuaternion(T.q); T.v.set(1, 0, 0).applyQuaternion(T.q); const ap = clamp(pitch, -1, 1); boneWorldRot(B.Spine1, T.v, -ap * 0.45); boneWorldRot(B.Spine2, T.v, -ap * 0.45); }
    // auto-correct body yaw so the weapon points where the AI faces
    if (this.gun && !this.dead && B.RightHand && B.LeftHand) {
      B.RightHand.getWorldPosition(T.v); B.LeftHand.getWorldPosition(T.w);
      this.root.getWorldQuaternion(T.q); const inv = T.q.clone().invert();
      const d = T.w.clone().sub(T.v).applyQuaternion(inv); const yawGun = Math.atan2(-d.x, -d.z);
      if (this.speed < 3.4 && Math.hypot(d.x, d.z) > 0.15) { this.yawFix += (-yawGun - this.yawFix) * Math.min(1, dt * 3); }
      else this.yawFix += (0 - this.yawFix) * Math.min(1, dt * 3);
      this.inner.rotation.y = clamp(this.yawFix, -1.2, 1.2);
      this.inner.updateMatrixWorld(true);
    }
    // place the gun: grip at right hand, barrel through the left hand
    if (this.gun) {
      const g = this.gun.g;
      if (!this.dead || !this.gunDrop) {
        B.RightHand.getWorldPosition(T.v); B.LeftHand.getWorldPosition(T.w);
        const dir = T.w.clone().sub(T.v); if (dir.lengthSq() < 0.0004) dir.set(0, 0, -1).applyQuaternion(this.root.quaternion); dir.normalize();
        T.m.lookAt(new V3(0, 0, 0), dir.clone().negate(), _ik.up); g.quaternion.setFromRotationMatrix(T.m);
        this.root.worldToLocal(T.v); this.root.getWorldQuaternion(T.q); g.quaternion.premultiply(T.q.invert());
        g.position.copy(T.v).add(new V3(0, -0.03, 0)); g.updateMatrix();
        g.position.add(new V3(0, 0, -0.04).applyQuaternion(g.quaternion));
      } else {
        this.gunDrop.t += dt; const k = Math.min(1, this.gunDrop.t / 0.5);
        g.position.y = Math.max(0.04, g.position.y - dt * 4 * k); g.rotation.z = lerp(g.rotation.z, Math.PI / 2, k * 0.2);
      }
    }
  }
  deathPose(dt) {
    this.dt2 = (this.dt2 || 0) + dt; const B = this.bones, k = Math.min(1, this.dt2 / 0.55), e = k * k * (3 - 2 * k);
    for (const s of ['Left', 'Right']) { addBoneRot(B[s + 'UpLeg'], AX.X, -e * 0.5); addBoneRot(B[s + 'Leg'], AX.X, e * 0.9); }
    addBoneRot(B.Spine1, AX.X, e * 0.3); addBoneRot(B.Neck, AX.X, e * 0.5);
  }
  dispose() { const i = Rigs.list.indexOf(this); if (i >= 0) Rigs.list.splice(i, 1); this.mixer.stopAllAction(); }
}

/* ---------- who looks like what ---------- */
const CASTS = {
  rifle: ['swat', 'swatguy', 'alex'], shotgun: ['swatguy', 'alex'], heavy: ['gasmask'], sniper: ['alex', 'swat'],
  blackline: ['gasmask', 'swat'], civilian: ['civ_remy', 'civ_kate', 'civ_brian', 'civ_jody', 'civ_elizabeth', 'civ_bryce', 'civ_martha'],
  zombie: ['z_cop', 'z_war', 'z_girl', 'z_romero', 'z_maynard', 'z_skeleton', 'z_parasite'], brute: ['z_brute'],
  horror: ['h_mutant', 'h_nightshade', 'h_clown', 'h_crypto', 'h_mannequin', 'h_maw']
};
CASTS.mannequin = ['h_mannequin']; CASTS.stalker = ['h_nightshade', 'h_mutant'];
CASTS.campaign = ['swat', 'swatguy', 'gasmask', 'alex', 'maya', 'evan', 'silas', 'voss'].concat(CASTS.civilian);
function pickCast(list) { const have = list.filter(k => CharLib.has(k)); return have.length ? pick(have) : list[0]; }

/* Compatibility: same parts interface the game uses (hips/legs/knees/torso/head/aim/muzzle/flash).
   Proxies are invisible groups the AI writes poses into; HumanRig reads them. */
function buildHuman(type, o) {
  o = o || {}; const T = ETYPES[type] || ETYPES.rifle;
  const gunKind = o.noGun ? null : ({ rifle: 'ar', shotgun: 'shotgun', sniper: 'sniper', heavy: 'lmg' })[type] || 'ar';
  const char = o.char || (o.noGun ? pickCast(CASTS.civilian) : pickCast(CASTS[type] || CASTS.rifle));
  const arch = o.arch || (o.noGun ? 'civilian' : 'soldier');
  const tint = o.char ? undefined : (o.noGun ? undefined : (o.color !== undefined && LV && LV.tintSoldiers ? o.color : undefined));
  const rig = new HumanRig({ char, arch, tint, tintAmt: 0.35, gun: gunKind, height: 1.8 * (o.scale || T.scale || 1), skin: o.skin });
  const root = rig.root;
  const hips = new THREE.Group(); hips.position.y = 0.95; root.add(hips);
  const legs = [new THREE.Group(), new THREE.Group()], knees = [new THREE.Group(), new THREE.Group()];
  legs.forEach((l, i) => { hips.add(l); l.add(knees[i]); });
  const torso = new THREE.Group(); hips.add(torso);
  const head = new THREE.Group(); head.position.y = 0.72; torso.add(head);
  head.add(new THREE.Group()); head.add(new THREE.Group());   // children[1] = helmet slot (story code toggles it)
  const aim = new THREE.Group(); aim.position.y = 0.46; torso.add(aim);
  let muzzle, flash;
  if (rig.gun) { muzzle = new THREE.Object3D(); muzzle.position.set(0, 0.01, rig.gun.muzzle); rig.gun.g.add(muzzle); flash = spriteGlow(TEX.flash, 0.7); }
  else { muzzle = new THREE.Object3D(); aim.add(muzzle); flash = spriteGlow(TEX.flash, 0.1); }
  flash.visible = false; muzzle.add(flash);
  const parts = { root, hips, legs, knees, torso, head, aim, muzzle, flash, rig };
  rig.proxies = parts;
  return parts;
}
