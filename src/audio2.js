/* ============================================================
   AUDIO 2: pre-rendered layered weapon sounds, environment
   reverb, distance (air absorption + speed of sound), foley,
   footsteps by surface, and a layered adaptive score.
   Extends AudioSys from fx.js.
   ============================================================ */
const Synth = {
  /* deterministic PRNG so variants differ but stay stable */
  rng(seed) { let s = seed >>> 0 || 1; return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296; },
  buf(ctx, dur, ch) { return ctx.createBuffer(ch || 2, Math.max(1, Math.round(ctx.sampleRate * dur)), ctx.sampleRate); },
  /* one-pole filters operating in place */
  lp(d, sr, fc) { const a = Math.exp(-2 * Math.PI * fc / sr); let y = 0; for (let i = 0; i < d.length; i++) { y = (1 - a) * d[i] + a * y; d[i] = y; } },
  hp(d, sr, fc) { const a = Math.exp(-2 * Math.PI * fc / sr); let y = 0, x0 = 0; for (let i = 0; i < d.length; i++) { const x = d[i]; y = a * (y + x - x0); x0 = x; d[i] = y; } },
  bp(d, sr, f, q) { // RBJ biquad band-pass
    const w = 2 * Math.PI * f / sr, al = Math.sin(w) / (2 * q), a0 = 1 + al, b0 = al / a0, b2 = -al / a0, a1 = -2 * Math.cos(w) / a0, a2 = (1 - al) / a0;
    let x1 = 0, x2 = 0, y1 = 0, y2 = 0; for (let i = 0; i < d.length; i++) { const x = d[i], y = b0 * x + b2 * x2 - a1 * y1 - a2 * y2; x2 = x1; x1 = x; y2 = y1; y1 = y; d[i] = y; } },
  sat(d, k) { const n = Math.tanh(k); for (let i = 0; i < d.length; i++) d[i] = Math.tanh(d[i] * k) / n; },
  norm(d, peak) { let m = 0; for (let i = 0; i < d.length; i++) m = Math.max(m, Math.abs(d[i])); if (m > 0) for (let i = 0; i < d.length; i++) d[i] *= peak / m; },
  /* ---- a gunshot: mechanism + muzzle blast + body thump + supersonic crack + tail ---- */
  gun(ctx, S, seed) {
    const sr = ctx.sampleRate, R = this.rng(seed), dur = S.tail + 0.25, b = this.buf(ctx, dur, 2), n = b.length;
    const L = b.getChannelData(0), Rr = b.getChannelData(1), m = new Float32Array(n);
    // muzzle blast: band-limited noise, very fast attack, two-stage decay
    const blast = new Float32Array(n);
    for (let i = 0; i < n; i++) { const t = i / sr; const env = (t < 0.0006 ? t / 0.0006 : 1) * (0.75 * Math.exp(-t / S.blast) + 0.25 * Math.exp(-t / (S.blast * 4))); blast[i] = (R() * 2 - 1) * env; }
    const lowB = blast.slice(); this.lp(lowB, sr, S.body); this.lp(lowB, sr, S.body * 1.4);
    const hiB = blast.slice(); this.hp(hiB, sr, 2200); this.lp(hiB, sr, 9000);
    // body thump: falling sine
    for (let i = 0; i < n; i++) { const t = i / sr; if (t > 0.22) break; const f = S.thump * (1 + 2.2 * Math.exp(-t / 0.012)); const ph = 2 * Math.PI * (S.thump * t + S.thump * 2.2 * 0.012 * (1 - Math.exp(-t / 0.012))); m[i] += Math.sin(ph) * Math.exp(-t / 0.05) * S.thumpG; void f; }
    // mechanism: damped metallic partials (slide/bolt/hammer)
    const mf = [S.mech, S.mech * 1.47, S.mech * 2.13, S.mech * 2.89, S.mech * 3.71].map(f => f * (0.94 + R() * 0.12));
    for (let i = 0; i < n; i++) { const t = i / sr; if (t > 0.09) break; let s = 0; for (let k = 0; k < mf.length; k++) s += Math.sin(2 * Math.PI * mf[k] * t + k) * Math.exp(-t / (0.012 + k * 0.003)) / (k + 1); m[i] += s * S.mechG; }
    // supersonic crack (N-wave) for rifles
    if (S.crack) { const w = Math.round(sr * 0.00035); for (let i = 0; i < w * 2; i++) m[i] += (i < w ? 1 - i / w : -(1 - (i - w) / w)) * S.crack; }
    // tail: dark noise, slow decay (the "boom" rolling off)
    const tail = new Float32Array(n); for (let i = 0; i < n; i++) { const t = i / sr; tail[i] = (R() * 2 - 1) * Math.exp(-t / S.tail) * (t < 0.01 ? t / 0.01 : 1); }
    this.lp(tail, sr, S.tailF); this.lp(tail, sr, S.tailF);
    for (let i = 0; i < n; i++) m[i] += lowB[i] * S.lowG + hiB[i] * S.hiG + tail[i] * S.tailG;
    this.sat(m, S.drive); this.norm(m, 0.98);
    // stereo: slight decorrelation in the tail
    const tl = tail.slice(); for (let i = 0; i < n; i++) { L[i] = m[i]; Rr[i] = m[i] + (tl[(i + 37) % n] - tl[i]) * S.tailG * 0.25; }
    return b;
  },
  boom(ctx, big, seed) {
    const sr = ctx.sampleRate, R = this.rng(seed), dur = big ? 4.2 : 3, b = this.buf(ctx, dur, 2), n = b.length, m = new Float32Array(n);
    for (let i = 0; i < n; i++) { const t = i / sr; m[i] = (R() * 2 - 1) * (t < 0.003 ? t / 0.003 : 1) * (0.6 * Math.exp(-t / 0.09) + 0.4 * Math.exp(-t / (big ? 1.1 : 0.7))); }
    const low = m.slice(); this.lp(low, sr, 380); this.lp(low, sr, 300);
    const mid = m.slice(); this.bp(mid, sr, 1400, 0.7);
    for (let i = 0; i < n; i++) { const t = i / sr; const sub = Math.sin(2 * Math.PI * (38 * t + 60 * 0.08 * (1 - Math.exp(-t / 0.08)))) * Math.exp(-t / (big ? 0.7 : 0.45)); m[i] = low[i] * 2.4 + mid[i] * 0.5 + sub * 1.1; }
    // debris crackle after the blast
    for (let k = 0; k < (big ? 90 : 55); k++) { const at = Math.round(sr * (0.15 + R() * (big ? 2.2 : 1.5))), len = Math.round(sr * (0.004 + R() * 0.01)), a = (0.08 + R() * 0.2) * Math.exp(-at / sr); for (let i = 0; i < len && at + i < n; i++) m[at + i] += (R() * 2 - 1) * a * (1 - i / len); }
    this.sat(m, 1.8); this.norm(m, 0.98);
    const L = b.getChannelData(0), Rr = b.getChannelData(1); for (let i = 0; i < n; i++) { L[i] = m[i]; Rr[i] = m[(i + 61) % n]; }
    return b;
  },
  /* short noise-and-partials foley one-shot */
  foley(ctx, parts, seed) {
    const sr = ctx.sampleRate, R = this.rng(seed), end = Math.max(...parts.map(p => p.at + p.len)) + 0.05, b = this.buf(ctx, end, 1), d = b.getChannelData(0);
    for (const p of parts) {
      const s0 = Math.round(p.at * sr), len = Math.round(p.len * sr), seg = new Float32Array(len);
      for (let i = 0; i < len; i++) { const t = i / sr; let v = (R() * 2 - 1) * (p.noise || 0); if (p.f) for (let k = 0; k < 4; k++) v += Math.sin(2 * Math.PI * p.f * (1 + k * 0.63) * t + k) * (p.tone || 0.5) / (k + 1); seg[i] = v * Math.exp(-t / p.dec) * (t < 0.0008 ? t / 0.0008 : 1); }
      if (p.bp) this.bp(seg, sr, p.bp, p.q || 2); if (p.lp) this.lp(seg, sr, p.lp);
      for (let i = 0; i < len && s0 + i < d.length; i++) d[s0 + i] += seg[i] * (p.g || 1);
    }
    this.norm(d, 0.9); return b;
  },
  step(ctx, surf, seed) {
    const P = { sand: [{ at: 0, len: 0.16, noise: 1, dec: 0.045, lp: 1800 }, { at: 0.02, len: 0.12, noise: 0.6, dec: 0.05, bp: 3800, q: 0.8, g: 0.35 }],
      concrete: [{ at: 0, len: 0.08, noise: 1, dec: 0.018, bp: 1100, q: 0.9 }, { at: 0.004, len: 0.07, f: 160, tone: 1, dec: 0.02, g: 0.6 }, { at: 0.05, len: 0.06, noise: 0.5, dec: 0.015, bp: 2600, q: 1.5, g: 0.3 }],
      metal: [{ at: 0, len: 0.25, f: 420 + (seed % 7) * 23, tone: 0.8, noise: 0.3, dec: 0.06, g: 0.8 }, { at: 0.003, len: 0.06, noise: 1, dec: 0.012, bp: 3000, q: 2, g: 0.4 }],
      grass: [{ at: 0, len: 0.2, noise: 1, dec: 0.06, bp: 2400, q: 0.6 }, { at: 0.03, len: 0.15, noise: 0.6, dec: 0.05, lp: 900, g: 0.5 }] }[surf] || [];
    return this.foley(ctx, P, seed);
  },
  /* convolution reverb impulse: early reflections + exponential diffuse tail */
  ir(ctx, len, decay, early, bright, seed) {
    const sr = ctx.sampleRate, R = this.rng(seed), b = this.buf(ctx, len, 2);
    for (let c = 0; c < 2; c++) {
      const d = b.getChannelData(c);
      for (let i = 0; i < d.length; i++) { const t = i / sr; d[i] = (R() * 2 - 1) * Math.pow(1 - t / len, 1.5) * Math.exp(-t / decay) * (t < 0.008 ? t / 0.008 : 1); }
      for (const [at, g] of early) { const i = Math.round(sr * (at + (c ? 0.0031 : 0))); if (i < d.length) d[i] += g * (R() < 0.5 ? -1 : 1); }
      this.lp(d, sr, bright);
    }
    return b;
  }
};

/* weapon voice specs: blast decay, body lowpass, thump Hz/gain, mechanism Hz/gain, crack, tail decay/lowpass/gain, drive */
const GUN_SND = {
  pistol: { blast: 0.012, body: 2600, lowG: 1.0, hiG: 0.55, thump: 120, thumpG: 0.5, mech: 2900, mechG: 0.25, crack: 0, tail: 0.32, tailF: 900, tailG: 0.22, drive: 2.2 },
  revolver: { blast: 0.02, body: 1900, lowG: 1.3, hiG: 0.5, thump: 85, thumpG: 0.9, mech: 2100, mechG: 0.3, crack: 0, tail: 0.6, tailF: 700, tailG: 0.32, drive: 2.8 },
  smg: { blast: 0.009, body: 3000, lowG: 0.9, hiG: 0.6, thump: 140, thumpG: 0.4, mech: 3400, mechG: 0.3, crack: 0.2, tail: 0.22, tailF: 1100, tailG: 0.18, drive: 2.0 },
  ar: { blast: 0.014, body: 2200, lowG: 1.15, hiG: 0.55, thump: 100, thumpG: 0.65, mech: 2600, mechG: 0.22, crack: 0.55, tail: 0.45, tailF: 800, tailG: 0.26, drive: 2.5 },
  burst: { blast: 0.013, body: 2400, lowG: 1.1, hiG: 0.6, thump: 105, thumpG: 0.6, mech: 2800, mechG: 0.24, crack: 0.55, tail: 0.4, tailF: 850, tailG: 0.24, drive: 2.4 },
  dmr: { blast: 0.02, body: 1800, lowG: 1.3, hiG: 0.5, thump: 80, thumpG: 0.85, mech: 2300, mechG: 0.25, crack: 0.75, tail: 0.75, tailF: 650, tailG: 0.32, drive: 2.8 },
  lmg: { blast: 0.016, body: 1900, lowG: 1.25, hiG: 0.5, thump: 90, thumpG: 0.75, mech: 2200, mechG: 0.3, crack: 0.6, tail: 0.5, tailF: 700, tailG: 0.28, drive: 2.7 },
  shotgun: { blast: 0.03, body: 1300, lowG: 1.5, hiG: 0.4, thump: 70, thumpG: 1.1, mech: 1700, mechG: 0.2, crack: 0, tail: 0.7, tailF: 600, tailG: 0.34, drive: 3.0 },
  autoshotgun: { blast: 0.024, body: 1500, lowG: 1.45, hiG: 0.45, thump: 75, thumpG: 1.0, mech: 1900, mechG: 0.25, crack: 0, tail: 0.55, tailF: 650, tailG: 0.3, drive: 2.9 },
  sniper: { blast: 0.028, body: 1500, lowG: 1.5, hiG: 0.45, thump: 62, thumpG: 1.15, mech: 1900, mechG: 0.2, crack: 1.0, tail: 1.3, tailF: 520, tailG: 0.4, drive: 3.2 },
  rocket: { blast: 0.06, body: 900, lowG: 1.6, hiG: 0.35, thump: 55, thumpG: 1.0, mech: 900, mechG: 0.1, crack: 0, tail: 0.9, tailF: 500, tailG: 0.5, drive: 2.0 },
  golden: { blast: 0.016, body: 2900, lowG: 1.2, hiG: 0.7, thump: 130, thumpG: 0.7, mech: 4200, mechG: 0.35, crack: 0.4, tail: 0.5, tailF: 1200, tailG: 0.3, drive: 2.6 },
  arc: { blast: 0.006, body: 5000, lowG: 0.5, hiG: 0.9, thump: 220, thumpG: 0.5, mech: 5200, mechG: 0.5, crack: 0.3, tail: 0.5, tailF: 2400, tailG: 0.25, drive: 1.6 }
};

Object.assign(AudioSys, {
  bank: null, surface: 'sand', musicMode: 'campaign',
  initBank() {
    const c = this.ctx; if (!c || this.bank) return;
    this.bank = { gun: {}, boom: [[], []], step: {}, foley: {} };
    for (const k in GUN_SND) this.bank.gun[k] = [11, 23, 37].map(s => Synth.gun(c, GUN_SND[k], s * 97 + k.length));
    this.bank.boom[0] = [3, 5].map(s => Synth.boom(c, false, s)); this.bank.boom[1] = [7, 9].map(s => Synth.boom(c, true, s));
    for (const sfc of ['sand', 'concrete', 'metal', 'grass']) this.bank.step[sfc] = [1, 2, 3, 4, 5, 6].map(s => Synth.step(c, sfc, s * 13));
    const F = (parts, s) => Synth.foley(c, parts, s);
    Object.assign(this.bank.foley, {
      magout: F([{ at: 0, len: 0.05, noise: 1, dec: 0.01, bp: 2600, q: 3 }, { at: 0.012, len: 0.1, f: 900, tone: 0.8, dec: 0.025, g: 0.6 }, { at: 0.09, len: 0.12, noise: 0.7, dec: 0.03, bp: 900, q: 1.5, g: 0.5 }], 3),
      magin: F([{ at: 0, len: 0.05, noise: 1, dec: 0.008, bp: 3200, q: 3 }, { at: 0.004, len: 0.09, f: 1300, tone: 0.9, dec: 0.02, g: 0.7 }, { at: 0.07, len: 0.05, noise: 1, dec: 0.007, bp: 4200, q: 4, g: 0.9 }], 5),
      rack: F([{ at: 0, len: 0.07, noise: 1, dec: 0.012, bp: 1800, q: 2.5 }, { at: 0.006, len: 0.1, f: 700, tone: 0.8, dec: 0.03, g: 0.6 }, { at: 0.13, len: 0.07, noise: 1, dec: 0.01, bp: 2600, q: 3, g: 1 }, { at: 0.135, len: 0.15, f: 1500, tone: 0.8, dec: 0.04, g: 0.6 }], 7),
      bolt: F([{ at: 0, len: 0.06, noise: 1, dec: 0.012, bp: 1500, q: 2 }, { at: 0.18, len: 0.08, noise: 1, dec: 0.015, bp: 2000, q: 2, g: 0.8 }, { at: 0.36, len: 0.08, noise: 1, dec: 0.01, bp: 3000, q: 3, g: 1 }, { at: 0.36, len: 0.15, f: 1100, tone: 0.9, dec: 0.04, g: 0.6 }], 9),
      dry: F([{ at: 0, len: 0.04, noise: 1, dec: 0.006, bp: 3600, q: 4 }, { at: 0.002, len: 0.05, f: 2400, tone: 0.8, dec: 0.012, g: 0.6 }], 11),
      shell: F([{ at: 0, len: 0.2, f: 5200, tone: 1, dec: 0.05 }, { at: 0.11, len: 0.18, f: 5600, tone: 0.8, dec: 0.04, g: 0.5 }, { at: 0.19, len: 0.12, f: 5900, tone: 0.6, dec: 0.03, g: 0.3 }], 13),
      hit: F([{ at: 0, len: 0.06, f: 1750, tone: 1, dec: 0.02 }, { at: 0, len: 0.03, noise: 1, dec: 0.005, bp: 5000, q: 2, g: 0.4 }], 15),
      head: F([{ at: 0, len: 0.25, f: 2350, tone: 1, dec: 0.07 }, { at: 0, len: 0.04, noise: 1, dec: 0.006, bp: 6000, q: 2, g: 0.5 }, { at: 0.01, len: 0.2, f: 3500, tone: 0.6, dec: 0.05, g: 0.4 }], 17),
      kill: F([{ at: 0, len: 0.18, f: 160, tone: 1, dec: 0.06 }, { at: 0, len: 0.08, noise: 1, dec: 0.02, bp: 900, q: 1, g: 0.7 }, { at: 0.03, len: 0.1, f: 1200, tone: 0.5, dec: 0.03, g: 0.4 }], 19),
      flesh: F([{ at: 0, len: 0.12, noise: 1, dec: 0.025, lp: 900 }, { at: 0, len: 0.1, f: 110, tone: 1, dec: 0.03, g: 0.7 }], 21),
      ricochet: F([{ at: 0, len: 0.35, f: 2600, tone: 1, dec: 0.12 }, { at: 0, len: 0.04, noise: 1, dec: 0.008, bp: 4000, q: 2, g: 0.6 }], 23),
      whiz: F([{ at: 0, len: 0.18, noise: 1, dec: 0.06, bp: 4200, q: 5 }], 25)
    });
    // environment reverbs
    this.irs = { outdoor: Synth.ir(c, 2.6, 0.55, [[0.09, 0.5], [0.21, 0.35], [0.43, 0.22], [0.8, 0.12]], 4200, 31), city: Synth.ir(c, 2.2, 0.5, [[0.03, 0.6], [0.06, 0.5], [0.11, 0.4], [0.17, 0.3], [0.28, 0.2]], 5000, 33),
      indoor: Synth.ir(c, 1.6, 0.35, [[0.008, 0.8], [0.015, 0.6], [0.023, 0.5], [0.031, 0.4]], 6500, 35), forest: Synth.ir(c, 2.0, 0.4, [[0.05, 0.3], [0.12, 0.2]], 3000, 37),
      music: Synth.ir(c, 4.5, 1.4, [], 5500, 39) };
    this.verb = c.createConvolver(); this.verb.buffer = this.irs.outdoor; this.verbGain = c.createGain(); this.verbGain.gain.value = 0.55;
    this.verb.connect(this.verbGain); this.verbGain.connect(this.sfx);
    this.verbIn = c.createGain(); this.verbIn.connect(this.verb);
    this.mverb = c.createConvolver(); this.mverb.buffer = this.irs.music; this.mverbIn = c.createGain(); this.mverbIn.gain.value = 0.5; this.mverbIn.connect(this.mverb); this.mverb.connect(this.mus);
    this.setRoom((LV && LV.env && LV.env.room) || 'outdoor');
  },
  setRoom(kind) { if (!this.irs || !this.irs[kind]) return; if (this.room === kind) return; this.room = kind; this.verb.buffer = this.irs[kind]; this.verbGain.gain.value = { outdoor: 0.5, city: 0.6, indoor: 0.7, forest: 0.45 }[kind] || 0.5; },
  play(buf, pos, o) {
    o = o || {}; if (!this.ctx || !buf) return null;
    const c = this.ctx, s = c.createBufferSource(); s.buffer = buf; s.playbackRate.value = o.rate || 1;
    const g = c.createGain(); g.gain.value = o.gain !== undefined ? o.gain : 1;
    let node = s, t = this.now() + (o.delay || 0);
    if (pos) {
      const d = Math.hypot(pos.x - (this.lx || 0), pos.y - (this.ly || 0), pos.z - (this.lz || 0));
      const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = Math.max(500, 19000 * Math.exp(-d / (o.air || 260))); node.connect(f); node = f;
      if (o.sos !== false && d > 35) t += d / 343;   // speed of sound for distant events
      node.connect(g); const p = this.out(pos, o.ref || 6); g.connect(p);
      const sendAmt = Math.min(1, 0.25 + d / 120) * (o.wet !== undefined ? o.wet : 1); if (this.verbIn && sendAmt > 0.02) { const sg = c.createGain(); sg.gain.value = sendAmt * (o.gain || 1) * 0.6; g.connect(sg); sg.connect(this.verbIn); }
    } else {
      node.connect(g); g.connect(this.sfx);
      if (this.verbIn && o.wet !== 0) { const sg = c.createGain(); sg.gain.value = (o.wet !== undefined ? o.wet : 0.35) * (o.gain || 1); g.connect(sg); sg.connect(this.verbIn); }
    }
    s.start(t); return s;
  },
  shot(kind, pos) {
    if (!this.ctx) return; this.initBank();
    const k = this.bank.gun[kind] ? kind : (kind === 'lmg' ? 'lmg' : 'ar'), v = this.bank.gun[k];
    const rate = 0.96 + Math.random() * 0.08;
    if (!pos) { this.play(v[(Math.random() * v.length) | 0], null, { gain: 1.0, rate, wet: 0.45 }); if (!['rocket', 'arc', 'shotgun'].includes(kind)) this.play(this.bank.foley.shell, null, { gain: 0.08, rate: 0.9 + Math.random() * 0.25, delay: 0.32 + Math.random() * 0.15, wet: 0.1 }); }
    else this.play(v[(Math.random() * v.length) | 0], pos, { gain: 1.25, rate: rate * 0.98, ref: 8, air: 300 });
  },
  boom(pos, big) {
    if (!this.ctx) return; this.initBank();
    const v = this.bank.boom[big ? 1 : 0]; this.play(v[(Math.random() * v.length) | 0], pos, { gain: big ? 2.4 : 1.9, ref: big ? 30 : 16, air: 700 });
  },
  footstep(run, crouch) { if (!this.ctx) return; this.initBank(); const v = this.bank.step[this.surface] || this.bank.step.sand; this.play(v[(Math.random() * v.length) | 0], null, { gain: crouch ? 0.07 : run ? 0.32 : 0.2, rate: 0.9 + Math.random() * 0.2, wet: 0.15 }); },
  _ui: AudioSys.ui,
  ui(kind) {
    if (!this.ctx) return; this.initBank();
    const F = this.bank.foley;
    switch (kind) {
      case 'magout': return this.play(F.magout, null, { gain: 0.5, wet: 0.15 });
      case 'magin': return this.play(F.magin, null, { gain: 0.6, wet: 0.15 });
      case 'rack': return this.play(F.rack, null, { gain: 0.6, wet: 0.15 });
      case 'bolt': return this.play(F.bolt, null, { gain: 0.6, wet: 0.15 });
      case 'empty': return this.play(F.dry, null, { gain: 0.5, wet: 0.1 });
      case 'hit': return this.play(F.hit, null, { gain: 0.32, wet: 0 });
      case 'head': return this.play(F.head, null, { gain: 0.45, wet: 0 });
      case 'kill': return this.play(F.kill, null, { gain: 0.5, wet: 0 });
      case 'whiz': return this.play(F.whiz, null, { gain: 0.35, rate: 0.85 + Math.random() * 0.3, wet: 0 });
      case 'step': return this.footstep(false);
    }
    return this._ui.call(this, kind);
  },
  impact(pos, kind) { if (!this.ctx) return; this.initBank(); this.play(kind === 'flesh' ? this.bank.foley.flesh : this.bank.foley.ricochet, pos, { gain: kind === 'flesh' ? 0.5 : 0.25, rate: 0.8 + Math.random() * 0.4, ref: 3, sos: false }); },
  _listener: AudioSys.listener,
  listener(cam) { this._listener.call(this, cam); this.lx = cam.position.x; this.ly = cam.position.y; this.lz = cam.position.z; },

  /* ---------------- adaptive score ----------------
     layers: sub drone · evolving pad · sparse piano motif (calm) · pulse ostinato · drums · braams (combat peaks)
     modes change key, tempo and palette: campaign · br · zombies · horror */
  MODES: {
    campaign: { bpm: 92, root: 38, prog: [[0, 3, 7, 10], [-4, 0, 3, 7], [-2, 2, 5, 9], [-5, -1, 2, 5]], scale: [0, 2, 3, 5, 7, 8, 10], piano: true },
    br: { bpm: 112, root: 40, prog: [[0, 3, 7, 10], [5, 8, 12, 15], [-2, 2, 5, 9], [3, 7, 10, 14]], scale: [0, 2, 3, 5, 7, 8, 10], piano: false },
    zombies: { bpm: 84, root: 37, prog: [[0, 3, 6, 10], [-1, 3, 6, 9], [0, 3, 7, 11], [-3, 0, 3, 6]], scale: [0, 1, 3, 5, 6, 8, 10], piano: true, musicBox: true },
    horror: { bpm: 60, root: 33, prog: [[0, 1, 6], [0, 1, 7], [-1, 0, 6], [0, 6, 11]], scale: [0, 1, 4, 6, 7, 10, 11], piano: false, horror: true }
  },
  startMusic() {
    this.ci = 0; this.bar = 0; this.step = 0; this.nextBar = this.now() + 0.3; this.nextStep = this.now() + 0.3;
    this.setMusicMode(this.musicMode);
  },
  setMusicMode(m) { this.musicMode = this.MODES[m] ? m : 'campaign'; this.MD = this.MODES[this.musicMode]; },
  note(dest, t, midi, dur, type, gain, o) {
    o = o || {}; const c = this.ctx, f = this.midi(midi), g = c.createGain(), lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = o.cut || 1200; lp.Q.value = o.q || 0.7;
    const voices = o.unison || 1;
    for (let v = 0; v < voices; v++) { const os = c.createOscillator(); os.type = type; os.frequency.value = f; os.detune.value = voices > 1 ? (v - (voices - 1) / 2) * (o.spread || 12) : 0; os.connect(lp); os.start(t); os.stop(t + dur + (o.rel || 0.5) + 0.1); }
    if (o.cutEnv) { lp.frequency.setValueAtTime(o.cut * 0.25, t); lp.frequency.linearRampToValueAtTime(o.cut, t + o.cutEnv); }
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(gain / voices, t + (o.att || 0.01)); g.gain.setValueAtTime(gain / voices, t + Math.max(o.att || 0.01, dur - 0.05)); g.gain.exponentialRampToValueAtTime(0.0001, t + dur + (o.rel || 0.5));
    lp.connect(g); g.connect(dest); if (o.verb && this.mverbIn) { const s = c.createGain(); s.gain.value = o.verb; g.connect(s); s.connect(this.mverbIn); }
  },
  piano(t, midi, gain) { // FM-ish piano: sine + decaying 2:1 modulator
    const c = this.ctx, f = this.midi(midi), car = c.createOscillator(), mod = c.createOscillator(), mg = c.createGain(), g = c.createGain();
    car.frequency.value = f; mod.frequency.value = f * 2; mg.gain.setValueAtTime(f * 1.6, t); mg.gain.exponentialRampToValueAtTime(f * 0.05, t + 1.2);
    mod.connect(mg); mg.connect(car.frequency); car.connect(g);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(gain, t + 0.006); g.gain.exponentialRampToValueAtTime(0.0001, t + 3.5);
    g.connect(this.padBus); const s = c.createGain(); s.gain.value = 0.7; g.connect(s); s.connect(this.mverbIn);
    car.start(t); mod.start(t); car.stop(t + 3.6); mod.stop(t + 3.6);
  },
  drum(t, kind, g) {
    const d = this.combat;
    if (kind === 'kick') { this.osc(d, t, 0.32, 'sine', 140, 40, 1.0 * g); this.nz(d, t, 0.02, 'lowpass', 3000, 0.7, 0.3 * g); }
    if (kind === 'snare') { this.nz(d, t, 0.2, 'bandpass', 1800, 0.7, 0.5 * g); this.osc(d, t, 0.09, 'triangle', 210, 160, 0.3 * g); }
    if (kind === 'hat') this.nz(d, t, 0.03, 'highpass', 8000, 0.7, 0.12 * g);
    if (kind === 'tom') { this.osc(d, t, 0.5, 'sine', 110, 55, 0.9 * g); this.nz(d, t, 0.25, 'lowpass', 600, 1, 0.3 * g); }
    if (kind === 'taiko') { this.osc(d, t, 0.9, 'sine', 70, 38, 1.3 * g); this.nz(d, t, 0.4, 'lowpass', 400, 1, 0.6 * g); }
  },
  braam(t, root) { const d = this.combat; for (const iv of [0, 7, 12]) this.note(d, t, root + iv - 12, 2.6, 'sawtooth', 0.22, { unison: 3, spread: 18, cut: 900, cutEnv: 0.35, att: 0.08, rel: 1.5, verb: 0.6 }); this.drum(t, 'taiko', 1); },
  musicTick(dt) {
    if (!this.ctx) return; const c = this.ctx, t = c.currentTime, MD = this.MD || this.MODES.campaign;
    if (!this.mverbIn) this.initBank();
    this.combatLevel += (this.combatTarget - this.combatLevel) * Math.min(1, dt * 0.8);
    this.combat.gain.setTargetAtTime(this.combatLevel * 0.85, t, 0.25);
    const beat = 60 / MD.bpm, barLen = beat * 4;
    // ---- per bar: pad chord, drone, piano motif, braam ----
    if (t > this.nextBar - 0.08) {
      const T = this.nextBar, ch = MD.prog[this.ci], R = MD.root;
      if (MD.horror) {
        // horror: no tune. a low cluster that swells, plus a rare dissonant high string
        for (const iv of ch) this.note(this.padBus, T, R + iv, barLen * 1.8, 'sawtooth', 0.05, { unison: 2, spread: 25, cut: 380, att: barLen * 0.7, rel: barLen, verb: 0.9 });
        if (Math.random() < 0.35) this.note(this.padBus, T + Math.random() * barLen, R + 47 + (Math.random() < 0.5 ? 1 : 6), barLen * 1.2, 'sawtooth', 0.018, { unison: 3, spread: 30, cut: 2600, att: 1.5, rel: 2, verb: 1 });
      } else {
        for (let i = 0; i < ch.length; i++) this.note(this.padBus, T, R + 12 + ch[i], barLen * 1.05, 'sawtooth', i === 0 ? 0.07 : 0.045, { unison: 3, spread: 14, cut: 700 + 500 * this.combatLevel, att: barLen * 0.35, rel: barLen * 0.6, verb: 0.55 });
        this.note(this.padBus, T, R + ch[0], barLen, 'triangle', 0.09, { cut: 300, att: 0.4, rel: 1 });
        if (MD.piano && this.combatLevel < 0.4) {
          const sc = MD.scale, n = MD.musicBox ? 6 : 3;
          for (let k = 0; k < n; k++) if (Math.random() < (MD.musicBox ? 0.7 : 0.55)) { const deg = sc[(Math.random() * sc.length) | 0] + ch[0]; this.piano(T + (k * barLen) / n + Math.random() * 0.05, R + 36 + deg + (MD.musicBox ? 12 : 0), MD.musicBox ? 0.045 : 0.06); }
        }
        if (this.combatLevel > 0.6 && this.bar % 4 === 0) this.braam(T, R + ch[0]);
      }
      this.nextBar += barLen; this.ci = (this.ci + 1) % MD.prog.length; this.bar++;
    }
    // ---- 16th grid: pulse + drums (combat layer) ----
    while (this.nextStep < t + 0.12) {
      const st = this.step % 16, T = this.nextStep, L = this.combatLevel, ch = MD.prog[(this.ci + MD.prog.length - 1) % MD.prog.length], R = MD.root;
      if (MD.horror) {
        if (st === 0 && this.step % 64 === 0 && L > 0.3) this.drum(T, 'taiko', 0.6 * L);
        if (L > 0.5 && st % 4 === 0) this.note(this.combat, T, R + 12 + (st === 8 ? 1 : 0), beat * 0.9, 'sawtooth', 0.06 * L, { cut: 600, att: 0.01, rel: 0.2 });
      } else if (L > 0.04) {
        if (st % 2 === 0) this.note(this.combat, T, R + 12 + ch[0] + (st % 8 === 6 ? 12 : 0), beat / 4, 'sawtooth', 0.07, { cut: 500 + 1400 * L, cutEnv: 0.02, att: 0.003, rel: 0.08 });
        if (st === 0 || st === 10 || (L > 0.7 && st === 7)) this.drum(T, 'kick', L);
        if (st === 4 || st === 12) this.drum(T, 'snare', L);
        if (st % 2 === 1 && L > 0.35) this.drum(T, 'hat', L);
        if (L > 0.75 && (st === 14 || st === 15)) this.drum(T, 'tom', L * 0.7);
      }
      this.nextStep += beat / 4; this.step++;
    }
  }
});
