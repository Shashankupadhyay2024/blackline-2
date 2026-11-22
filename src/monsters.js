/* ============================================================
   MONSTERS: melee enemies for Zombies and Horror.
   Same interface as Enemy (pos, alive, damage, headSphere, bodyBox…)
   so guns, grenades and the HUD treat them like any other hostile.
   ============================================================ */
const MTYPES = {
  walker:  { hp: 110, speed: 1.35, reach: 1.45, dmg: 22, atk: 1.25, arch: 'zombie',   cast: 'zombie',  sight: 200, scale: 1, pts: 60 },
  runner:  { hp: 90,  speed: 5.4,  reach: 1.5,  dmg: 18, atk: 1.0,  arch: 'zombie',   cast: 'zombie',  sight: 200, scale: 1, pts: 80, run: true },
  crawler: { hp: 60,  speed: 1.9,  reach: 1.2,  dmg: 14, atk: 0.9,  arch: 'crawler',  cast: 'zombie',  sight: 200, scale: 1, pts: 70, low: true },
  brute:   { hp: 900, speed: 2.4,  reach: 2.1,  dmg: 45, atk: 1.9,  arch: 'creature', cast: 'brute',   sight: 200, scale: 1.35, pts: 500 },
  stalker: { hp: 400, speed: 2.0,  reach: 1.7,  dmg: 70, atk: 1.4,  arch: 'creature', cast: 'stalker', sight: 26, scale: 1.12, pts: 0, stalker: true },
  mannequin: { hp: 99999, speed: 7.5, reach: 1.3, dmg: 40, atk: 1.2, arch: 'civilian', cast: 'mannequin', sight: 60, scale: 1, pts: 0, statue: true }
};
for (const k in MTYPES) Object.assign(MTYPES[k], { mag: 1, range: 2, acc: 0, rpm: 60, burst: [1, 1], pause: [1, 1], reload: 1, aim: 0, color: 0x555555, gear: 0x333333, snd: 'pistol', drop: null });

/* growls, screams and stingers, synthesized once */
const Growl = {
  bufs: null,
  init() {
    if (this.bufs || !AudioSys.ctx) return; const c = AudioSys.ctx, sr = c.sampleRate, S = Synth; this.bufs = {};
    const voice = (seed, dur, f0, f1, rough, bright) => {
      const R = S.rng(seed), b = S.buf(c, dur, 1), d = b.getChannelData(0), n = d.length; let ph = 0;
      for (let i = 0; i < n; i++) {
        const t = i / sr, k = t / dur, f = f0 + (f1 - f0) * k + Math.sin(t * 23 + seed) * 6;
        ph += 2 * Math.PI * f / sr;
        const buzz = Math.sign(Math.sin(ph)) * 0.35 + Math.sin(ph) * 0.4 + Math.sin(ph * 2.01) * 0.2;
        const env = Math.min(1, t / 0.08) * Math.min(1, (dur - t) / 0.25) * (0.7 + 0.3 * Math.sin(t * (9 + R() * 4)));
        d[i] = (buzz * (1 - rough) + (R() * 2 - 1) * rough) * env;
      }
      S.bp(d, sr, bright, 0.9); S.sat(d, 2.4); S.norm(d, 0.9); return b;
    };
    this.bufs.groan = [1, 2, 3, 4].map(s => voice(s * 7, 1.3 + s * 0.2, 70 + s * 9, 55 + s * 5, 0.55, 520 + s * 60));
    this.bufs.snarl = [1, 2, 3].map(s => voice(s * 13, 0.7, 120 + s * 15, 90, 0.7, 900));
    this.bufs.attack = [1, 2].map(s => voice(s * 31, 0.55, 180, 110, 0.65, 1300));
    this.bufs.roar = [voice(91, 2.2, 95, 60, 0.6, 700)];
    // horror stinger: dissonant screech + low hit
    const st = S.buf(c, 2.8, 2); for (let ch = 0; ch < 2; ch++) { const d = st.getChannelData(ch), R = S.rng(5 + ch);
      for (let i = 0; i < d.length; i++) { const t = i / sr, e = Math.exp(-t / 0.9);
        d[i] = (Math.sin(2 * Math.PI * (1480 + ch * 37) * t + Math.sin(t * 31) * 3) * 0.3 + Math.sin(2 * Math.PI * 1567 * t) * 0.25 + (R() * 2 - 1) * 0.25 * Math.exp(-t / 0.2) + Math.sin(2 * Math.PI * 42 * t) * Math.exp(-t / 0.5) * 0.9) * e * Math.min(1, t / 0.004); }
      S.sat(d, 1.6); S.norm(d, 0.95); }
    this.bufs.sting = [st];
    // heartbeat
    const hb = S.buf(c, 0.9, 1), hd = hb.getChannelData(0); for (let i = 0; i < hd.length; i++) { const t = i / sr; const p = (tt) => tt > 0 ? Math.sin(2 * Math.PI * 48 * tt) * Math.exp(-tt / 0.07) : 0; hd[i] = p(t) + p(t - 0.24) * 0.7; } S.norm(hd, 0.9);
    this.bufs.heart = [hb];
    // whisper: breathy filtered noise with syllable envelope
    this.bufs.whisper = [1, 2, 3].map(s => { const R = S.rng(s * 77), b = S.buf(c, 1.8, 2); for (let ch = 0; ch < 2; ch++) { const d = b.getChannelData(ch);
      for (let i = 0; i < d.length; i++) { const t = i / sr; d[i] = (R() * 2 - 1) * Math.max(0, Math.sin(t * (7 + s))) ** 2 * Math.min(1, (1.8 - t) / 0.4) * (ch ? 0.6 + 0.4 * Math.sin(t * 2) : 0.6 - 0.4 * Math.sin(t * 2)); }
      S.bp(d, sr, 2400 + s * 300, 1.4); S.norm(d, 0.6); } return b; });
  },
  play(kind, pos, o) { this.init(); if (!this.bufs) return; o = o || {}; return AudioSys.play(pick(this.bufs[kind]), pos, Object.assign({ gain: 0.9, rate: rand(0.9, 1.1), ref: 4 }, o)); }
};

class Monster extends Enemy {
  constructor(kind, x, z, o) {
    o = o || {}; const T = MTYPES[kind];
    const ch = o.char || pickCast(CASTS[T.cast] || CASTS.zombie);
    super('rifle', x, z, Object.assign({ T, noGun: true, char: ch, arch: o.arch || (ch === 'z_brute' ? 'creature' : T.arch), scale: T.scale, yaw: o.yaw }, o));
    this.kind = kind; this.state = 'combat'; this.atkT = rand(0.3, 1); this.hitAt = 0; this.groanT = rand(1, 6);
    this.hp *= o.hpMul || 1; this.speedMul = o.speedMul || 1;
    this.stun = 0; this.frozen = false; this.target = null; this.atkT2 = 0; this.unstickT = 0; this.isBoss = true;
    if (o.rise) { this.riseT = 1.6; this.parts.rig && this.parts.rig.play('z_standup', { fade: 0.05 }); }
  }
  headSphere(s) { const k = this.T.scale; s.center.set(this.pos.x, this.pos.y + (this.T.low ? 0.45 : 1.62) * k, this.pos.z); s.radius = 0.2 * k; return s; }
  bodyBox(b) { const k = this.T.scale, h = this.T.low ? 0.6 : 1.45; b.min.set(this.pos.x - 0.32 * k, this.pos.y, this.pos.z - 0.32 * k); b.max.set(this.pos.x + 0.32 * k, this.pos.y + h * k, this.pos.z + 0.32 * k); return b; }
  hear(p, loud) { if (LV.onMonsterHear) LV.onMonsterHear(this, p, loud); }
  enterCombat() { this.state = 'combat'; }
  damage(d, dir, head, src) {
    if (!this.alive) return;
    if (this.T.statue) { if (src === 'player') FX.sparks(this.pos.clone().setY(this.pos.y + 1.4), 6); return; }
    this.hp -= d; this.lastHurt = gameTime; this.flinch = d > 30 ? 0.3 : 0.12;
    if (this.T.stalker) { this.stun += d; if (this.stun > 140) { this.stun = 0; this.flinch = 1.2; this.retreatT = 9; Growl.play('roar', this.pos, { gain: 1.4 }); } return; }
    if (LV.onMonsterHit) LV.onMonsterHit(this, d, head);
    if (this.hp <= 0) this.die(dir, head, src);
  }
  die(dir, head, src) {
    if (!this.alive) return;
    this.alive = false; this.deadT = 0; this.parts.flash.visible = false;
    if (src === 'player' || src === 'explosion') { stats.kills++; if (head) stats.heads++; HUD.kill(head); }
    Growl.play('snarl', this.pos, { gain: 0.6, rate: 0.8 });
    if (LV.onMonsterKill) LV.onMonsterKill(this, head, src);
  }
  update(dt) {
    if (!this.alive) { this.animateDeath(dt); if (this.deadT > 12 && !this.gone) { scene.remove(this.mesh); this.gone = true; } return; }
    const T = this.T, rig = this.parts.rig;
    if (this.riseT > 0) { this.riseT -= dt; this.animate(dt); return; }
    const tp = this.target || player.pos, dx = tp.x - this.pos.x, dz = tp.z - this.pos.z, dist = Math.hypot(dx, dz); this.dist = dist;
    this.flinch = Math.max(0, this.flinch - dt);
    this.groanT -= dt; if (this.groanT <= 0 && !T.statue) { this.groanT = rand(3, 9); if (dist < 40) Growl.play(T.run ? 'snarl' : 'groan', this.pos, { gain: T.stalker ? 1.2 : 0.7, rate: T.stalker ? 0.6 : rand(0.85, 1.15) }); }
    if (LV.monsterThink && LV.monsterThink(this, dt)) { this.animate(dt); return; }
    // statues only move while nobody is looking at them
    if (T.statue) { this.frozen = isSeen(this); if (this.frozen) { this.moveTarget = null; this.moveSpeed = 0; if (rig) rig.mixer.timeScale = 0; this.lastPos.copy(this.pos); this.animate(dt); return; } if (rig) rig.mixer.timeScale = 1; }
    if (this.retreatT > 0) { this.retreatT -= dt; this.moveTarget = new V3(this.pos.x - dx / dist * 10, 0, this.pos.z - dz / dist * 10); }
    else if (player.alive || this.target) this.moveTarget = dist > T.reach * 0.8 ? (this._mt || (this._mt = new V3())).set(tp.x, 0, tp.z) : null;
    if (this.atkT2 > 0) { this.atkT2 -= dt; this.moveTarget = null; }
    this.atkT -= dt;
    if (player.alive && dist < T.reach && this.atkT <= 0 && this.flinch <= 0 && !this.target) {
      this.atkT = T.atk; this.atkT2 = 0.55; this.faceYaw = Math.atan2(-dx, -dz);
      if (rig) rig.play(rig.arch.attack || 'z_attack', { fade: 0.08 });
      Growl.play('attack', this.pos, { gain: 0.8 });
      after(0.38, () => { if (this.alive && player.alive && Math.hypot(player.pos.x - this.pos.x, player.pos.z - this.pos.z) < T.reach + 0.7) { hurtPlayer(T.dmg, this.pos); addShake(0.25); } });
    }
    // unstick: if we want to move but can't, sidestep for a moment
    if (this.unstickT > 0) { this.unstickT -= dt; this.moveTarget = this.unstickP; }
    else if (this.moveTarget && this.moveSpeed < 0.25 && this.atkT2 <= 0) { this.blockT = (this.blockT || 0) + dt; if (this.blockT > 0.7) { this.blockT = 0; this.unstickT = 0.9; const a = this.yaw + (Math.random() < 0.5 ? 1 : -1) * rand(1.2, 2.2); this.unstickP = new V3(this.pos.x - Math.sin(a) * 3, 0, this.pos.z - Math.cos(a) * 3); } }
    else this.blockT = 0;
    const spd = this.T.speed; this.T._s = spd; this.T.speed = spd * this.speedMul * (this.flinch > 0 ? 0.25 : 1) * (this.retreatT > 0 ? 1.8 : 1);
    this.move(dt); this.T.speed = spd;
    // face where we're walking (next waypoint), or the target when attacking / up close
    { const g = this.unstickT > 0 ? this.unstickP : (this.wp && dist > 3 ? this.wp : (this.moveTarget && dist > 2.5 ? this.moveTarget : tp)); if (g) { const gx = g.x - this.pos.x, gz = g.z - this.pos.z; if (gx * gx + gz * gz > 0.01) this.faceYaw = Math.atan2(-gx, -gz); } }
    this.animate(dt);
  }
  animate(dt) {
    const P = this.parts; this.mesh.position.copy(this.pos); this.mesh.rotation.set(0, this.yaw, 0);
    P.hips.position.y = 0.95; P.legs[0].rotation.x = 0; P.legs[1].rotation.x = 0; P.aim.rotation.x = 0;
    P.torso.rotation.x = this.flinch > 0.05 ? 0.3 : 0;
  }
}
/* is a point on screen and not blocked? (for statues) */
function isSeen(m) {
  if (!player.alive) return false;
  const p = _v1.set(m.pos.x, m.pos.y + 1.2, m.pos.z), c = camera.position;
  const d = p.distanceTo(c); if (d > 70) return false;
  const v = p.clone().project(camera); if (v.z > 1 || Math.abs(v.x) > 1.05 || Math.abs(v.y) > 1.1) return false;
  const dir = p.clone().sub(c).normalize(); return !castRay(c, dir, d - 0.5, { noEnemies: true });
}
function addMonster(kind, x, z, o) { const m = new Monster(kind, x, z, o); enemies.push(m); return m; }
