import type { Vector3 } from 'three';

/**
 * Audio — every sound is synthesised with WebAudio (no files).
 *
 *   const audio = new Audio();          // safe to construct before any gesture (context stays suspended)
 *   audio.resume();                     // call on the first user gesture (ENTER THE CHUNK click / keydown)
 *   audio.listenerYaw = player.yaw;     // each frame, for stereo panning of positional sounds
 *
 *   audio.crossbowFire()  audio.boltImpact('wood'|'ground'|'flesh')  audio.reload()   audio.dryFire()
 *   audio.footstep(sprinting)  audio.jump()  audio.land(hard)  audio.hitMarker()  audio.kill()
 *   audio.animal('deer_call'|'boar_grunt'|'hoofsteps'|'boar_squeal', position, listenerPos, yaw?)
 *   audio.setAmbient(true|false)   audio.muted = true|false   audio.master.gain (0.6)
 *
 * Ambient (wind gusts + distant birds) starts on resume() and runs on its own scheduler.
 */

export type ImpactKind = 'wood' | 'ground' | 'flesh';
export type AnimalSound = 'deer_call' | 'boar_grunt' | 'hoofsteps' | 'boar_squeal';

const rnd = (a: number, b: number) => a + Math.random() * (b - a);

export class Audio {
  ctx: AudioContext;
  master: GainNode;
  sfx: GainNode;
  ambient: GainNode;
  listenerYaw = 0;
  private noise!: AudioBuffer;
  private started = false;
  private ambientOn = true;
  private stepSide = 1;
  private birdTimer = 0; private gustTimer = 0;
  private windGain?: GainNode; private windGain2?: GainNode;
  private _muted = false;

  constructor() {
    const AC = (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext);
    this.ctx = new AC({ latencyHint: 'interactive' });
    this.master = this.ctx.createGain(); this.master.gain.value = 0.6;
    const comp = this.ctx.createDynamicsCompressor();
    comp.threshold.value = -12; comp.knee.value = 18; comp.ratio.value = 4; comp.attack.value = 0.004; comp.release.value = 0.16;
    this.master.connect(comp).connect(this.ctx.destination);
    this.sfx = this.ctx.createGain(); this.sfx.gain.value = 1; this.sfx.connect(this.master);
    this.ambient = this.ctx.createGain(); this.ambient.gain.value = 0.55; this.ambient.connect(this.master);
    this.makeNoise();
  }

  get muted() { return this._muted; }
  set muted(v: boolean) { this._muted = v; this.master.gain.setTargetAtTime(v ? 0 : 0.6, this.ctx.currentTime, 0.05); }

  /** Call from a user gesture. Idempotent. */
  resume() {
    if (this.ctx.state !== 'running') void this.ctx.resume();
    if (!this.started) { this.started = true; this.startAmbient(); }
  }

  setAmbient(on: boolean) { this.ambientOn = on; this.ambient.gain.setTargetAtTime(on ? 0.55 : 0, this.ctx.currentTime, 0.4); }

  // ─────────────── building blocks ───────────────
  private makeNoise() {
    const len = this.ctx.sampleRate * 2;
    this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  }

  private env(g: GainNode, t: number, peak: number, attack: number, decay: number, hold = 0) {
    g.gain.cancelScheduledValues(t);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(peak, t + attack);
    if (hold > 0) g.gain.setValueAtTime(peak, t + attack + hold);
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + hold + decay);
  }

  /** filtered noise burst */
  private burst(opts: { t?: number; type?: BiquadFilterType; freq: number; freqEnd?: number; q?: number; gain: number; attack?: number; decay: number; hold?: number; pan?: number; out?: AudioNode; rate?: number }) {
    const c = this.ctx, t = opts.t ?? c.currentTime;
    const src = c.createBufferSource(); src.buffer = this.noise; src.loop = true; src.playbackRate.value = opts.rate ?? 1;
    src.start(t, Math.random() * 1.5);
    const f = c.createBiquadFilter(); f.type = opts.type ?? 'bandpass'; f.frequency.setValueAtTime(opts.freq, t); f.Q.value = opts.q ?? 1;
    if (opts.freqEnd) f.frequency.exponentialRampToValueAtTime(opts.freqEnd, t + (opts.attack ?? 0.002) + opts.decay);
    const g = c.createGain(); this.env(g, t, opts.gain, opts.attack ?? 0.002, opts.decay, opts.hold);
    const dur = (opts.attack ?? 0.002) + (opts.hold ?? 0) + opts.decay + 0.05;
    src.stop(t + dur);
    src.connect(f).connect(g);
    this.route(g, opts.pan ?? 0, opts.out);
    return g;
  }

  /** oscillator with pitch glide */
  private tone(opts: { t?: number; type?: OscillatorType; f0: number; f1?: number; glide?: number; gain: number; attack?: number; decay: number; hold?: number; pan?: number; out?: AudioNode; vibrato?: { rate: number; depth: number }; lowpass?: number }) {
    const c = this.ctx, t = opts.t ?? c.currentTime;
    const o = c.createOscillator(); o.type = opts.type ?? 'sine';
    o.frequency.setValueAtTime(opts.f0, t);
    if (opts.f1) o.frequency.exponentialRampToValueAtTime(Math.max(1, opts.f1), t + (opts.glide ?? opts.decay));
    if (opts.vibrato) {
      const lfo = c.createOscillator(); lfo.frequency.value = opts.vibrato.rate;
      const lg = c.createGain(); lg.gain.value = opts.vibrato.depth;
      lfo.connect(lg).connect(o.frequency); lfo.start(t);
      lfo.stop(t + (opts.attack ?? 0.002) + (opts.hold ?? 0) + opts.decay + 0.1);
    }
    const g = c.createGain(); this.env(g, t, opts.gain, opts.attack ?? 0.002, opts.decay, opts.hold);
    let node: AudioNode = o;
    if (opts.lowpass) { const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = opts.lowpass; node.connect(f); node = f; }
    node.connect(g);
    o.start(t); o.stop(t + (opts.attack ?? 0.002) + (opts.hold ?? 0) + opts.decay + 0.05);
    this.route(g, opts.pan ?? 0, opts.out);
    return g;
  }

  private route(node: AudioNode, pan: number, out?: AudioNode) {
    if (pan !== 0 && this.ctx.createStereoPanner) { const p = this.ctx.createStereoPanner(); p.pan.value = Math.max(-1, Math.min(1, pan)); node.connect(p).connect(out ?? this.sfx); }
    else node.connect(out ?? this.sfx);
  }

  // ─────────────── weapon ───────────────
  crossbowFire() {
    const t = this.ctx.currentTime;
    // latch release click
    this.burst({ t, type: 'highpass', freq: 2500, gain: 0.35, decay: 0.012 });
    // string twang: bright noise + a plucked triangle that drops fast
    this.burst({ t: t + 0.004, type: 'bandpass', freq: 2600, freqEnd: 900, q: 0.8, gain: 0.7, decay: 0.07 });
    this.tone({ t: t + 0.004, type: 'triangle', f0: 210, f1: 95, glide: 0.08, gain: 0.35, decay: 0.16 });
    // body thump 120 → 60 Hz
    this.tone({ t: t + 0.002, type: 'sine', f0: 120, f1: 60, glide: 0.1, gain: 0.8, decay: 0.24 });
    // stock resonance / limb rattle
    this.burst({ t: t + 0.02, type: 'lowpass', freq: 500, gain: 0.3, decay: 0.12 });
  }

  dryFire() {
    const t = this.ctx.currentTime;
    this.burst({ t, type: 'highpass', freq: 3000, gain: 0.25, decay: 0.01 });
    this.tone({ t, type: 'square', f0: 700, gain: 0.05, decay: 0.03, lowpass: 2000 });
  }

  boltImpact(kind: ImpactKind, pan = 0, gain = 1) {
    const t = this.ctx.currentTime;
    if (kind === 'wood') {
      this.burst({ t, type: 'bandpass', freq: 1900, q: 2.5, gain: 0.55 * gain, decay: 0.05, pan });
      this.tone({ t, type: 'triangle', f0: 620, f1: 380, glide: 0.05, gain: 0.25 * gain, decay: 0.09, pan });
      this.tone({ t, type: 'sine', f0: 240, f1: 120, glide: 0.04, gain: 0.35 * gain, decay: 0.08, pan });
      // shaft vibration hum
      this.tone({ t: t + 0.01, type: 'sine', f0: 95, gain: 0.12 * gain, decay: 0.35, vibrato: { rate: 14, depth: 6 }, pan });
    } else if (kind === 'ground') {
      this.burst({ t, type: 'lowpass', freq: 520, gain: 0.55 * gain, decay: 0.09, pan });
      this.burst({ t, type: 'bandpass', freq: 3200, q: 1, gain: 0.12 * gain, decay: 0.03, pan });
      this.tone({ t, type: 'sine', f0: 85, f1: 50, glide: 0.06, gain: 0.4 * gain, decay: 0.12, pan });
    } else {
      this.burst({ t, type: 'lowpass', freq: 380, gain: 0.7 * gain, decay: 0.12, pan });
      this.burst({ t, type: 'bandpass', freq: 950, q: 0.7, gain: 0.3 * gain, decay: 0.035, pan });
      this.tone({ t, type: 'sine', f0: 110, f1: 55, glide: 0.08, gain: 0.5 * gain, decay: 0.16, pan });
    }
  }

  /** ratchet clicks over ~1.2 s (matches the crossbow's span animation) */
  reload() {
    const t0 = this.ctx.currentTime + 0.12;
    const n = 11;
    for (let i = 0; i < n; i++) {
      const t = t0 + (i / n) * 1.05 + rnd(-0.008, 0.008);
      const f = 2200 + i * 110;
      this.burst({ t, type: 'bandpass', freq: f, q: 3, gain: 0.22 + i * 0.012, decay: 0.014 });
      this.tone({ t, type: 'square', f0: 900 + i * 40, gain: 0.03, decay: 0.012, lowpass: 3000 });
      this.tone({ t, type: 'sine', f0: 180, f1: 120, glide: 0.02, gain: 0.08, decay: 0.03 });
    }
    // string tension creak
    this.tone({ t: t0, type: 'sawtooth', f0: 70, f1: 110, glide: 1.0, gain: 0.035, attack: 0.3, decay: 0.5, hold: 0.4, lowpass: 600, vibrato: { rate: 9, depth: 4 } });
    // final latch clack + bolt seated
    const tl = t0 + 1.12;
    this.burst({ t: tl, type: 'bandpass', freq: 1400, q: 1.5, gain: 0.45, decay: 0.04 });
    this.tone({ t: tl, type: 'sine', f0: 320, f1: 160, glide: 0.04, gain: 0.3, decay: 0.07 });
    this.burst({ t: tl + 0.16, type: 'lowpass', freq: 900, gain: 0.2, decay: 0.05 });
  }

  // ─────────────── movement ───────────────
  footstep(sprinting: boolean) {
    const t = this.ctx.currentTime;
    this.stepSide = -this.stepSide;
    const pan = this.stepSide * 0.14;
    const f = rnd(380, 720);
    this.burst({ t, type: 'lowpass', freq: f, gain: sprinting ? 0.5 : 0.32, decay: sprinting ? 0.06 : 0.08, pan });
    // needle-litter crunch
    this.burst({ t: t + 0.006, type: 'bandpass', freq: rnd(1800, 3200), q: 0.8, gain: sprinting ? 0.14 : 0.09, decay: 0.045, pan });
    this.tone({ t, type: 'sine', f0: rnd(70, 95), f1: 45, glide: 0.05, gain: sprinting ? 0.3 : 0.18, decay: 0.07, pan });
  }

  jump() {
    const t = this.ctx.currentTime;
    this.burst({ t, type: 'bandpass', freq: 400, freqEnd: 1400, q: 0.6, gain: 0.16, attack: 0.02, decay: 0.16 });
    this.burst({ t, type: 'lowpass', freq: 500, gain: 0.25, decay: 0.05 });
  }

  land(hard: boolean) {
    const t = this.ctx.currentTime;
    this.burst({ t, type: 'lowpass', freq: hard ? 380 : 500, gain: hard ? 0.8 : 0.45, decay: hard ? 0.16 : 0.09 });
    this.tone({ t, type: 'sine', f0: hard ? 75 : 85, f1: 40, glide: 0.08, gain: hard ? 0.7 : 0.35, decay: hard ? 0.22 : 0.12 });
    this.burst({ t: t + 0.01, type: 'bandpass', freq: 2400, q: 0.8, gain: 0.12, decay: 0.05 });
    if (hard) this.burst({ t: t + 0.06, type: 'lowpass', freq: 300, gain: 0.3, decay: 0.12 });
  }

  // ─────────────── feedback ───────────────
  hitMarker() {
    const t = this.ctx.currentTime;
    this.tone({ t, type: 'sine', f0: 1900, gain: 0.16, decay: 0.045 });
    this.tone({ t: t + 0.012, type: 'sine', f0: 2600, gain: 0.1, decay: 0.05 });
  }

  kill() {
    const t = this.ctx.currentTime;
    this.tone({ t, type: 'sine', f0: 660, gain: 0.18, decay: 0.16 });
    this.tone({ t: t + 0.09, type: 'sine', f0: 990, gain: 0.2, decay: 0.32 });
    this.tone({ t: t + 0.09, type: 'triangle', f0: 1980, gain: 0.05, decay: 0.3 });
    this.burst({ t, type: 'bandpass', freq: 1200, q: 0.5, gain: 0.08, attack: 0.05, decay: 0.3 });
  }

  // ─────────────── positional animal sounds ───────────────
  /** distance attenuation + stereo pan from direction relative to the listener yaw */
  animal(kind: AnimalSound, position: Vector3, listenerPos: Vector3, yaw = this.listenerYaw) {
    const dx = position.x - listenerPos.x, dz = position.z - listenerPos.z, dy = position.y - listenerPos.y;
    const dist = Math.sqrt(dx * dx + dz * dz + dy * dy);
    if (dist > 140) return;
    const att = 1 / Math.pow(1 + dist / 9, 1.4);
    const rx = Math.cos(yaw), rz = -Math.sin(yaw); // listener right vector
    const pan = dist > 0.5 ? Math.max(-1, Math.min(1, (dx * rx + dz * rz) / dist)) * 0.8 : 0;
    // distance low-pass into a per-call bus
    const bus = this.ctx.createGain(); bus.gain.value = att;
    const lp = this.ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 9000 / (1 + dist / 25);
    bus.connect(lp); this.route(lp, pan);
    const t = this.ctx.currentTime;
    switch (kind) {
      case 'deer_call': { // bleat: FM-ish sawtooth with a rising-falling contour
        const dur = rnd(0.35, 0.55);
        this.tone({ t, type: 'sawtooth', f0: 560, f1: 780, glide: dur * 0.4, gain: 0.5, attack: 0.05, hold: dur * 0.4, decay: dur * 0.5, vibrato: { rate: 26, depth: 45 }, lowpass: 2200, out: bus });
        this.tone({ t: t + dur * 0.4, type: 'sawtooth', f0: 780, f1: 520, glide: dur * 0.6, gain: 0.3, attack: 0.02, decay: dur * 0.6, vibrato: { rate: 26, depth: 45 }, lowpass: 1800, out: bus });
        this.burst({ t, type: 'bandpass', freq: 1400, q: 0.6, gain: 0.12, attack: 0.05, hold: dur * 0.5, decay: dur * 0.5, out: bus });
        break;
      }
      case 'boar_grunt': {
        const n = 1 + Math.floor(rnd(0, 2.5));
        for (let i = 0; i < n; i++) {
          const ti = t + i * rnd(0.22, 0.32);
          this.tone({ t: ti, type: 'sawtooth', f0: rnd(80, 100), f1: 62, glide: 0.2, gain: 0.7, attack: 0.03, hold: 0.06, decay: 0.16, vibrato: { rate: 13, depth: 9 }, lowpass: 520, out: bus });
          this.burst({ t: ti, type: 'lowpass', freq: 420, gain: 0.5, attack: 0.02, hold: 0.05, decay: 0.15, out: bus });
        }
        break;
      }
      case 'hoofsteps': {
        for (let i = 0; i < 4; i++) {
          const ti = t + i * rnd(0.11, 0.16);
          this.burst({ t: ti, type: 'lowpass', freq: rnd(260, 360), gain: 0.45, decay: 0.06, out: bus });
          this.tone({ t: ti, type: 'sine', f0: rnd(62, 80), f1: 40, glide: 0.04, gain: 0.35, decay: 0.07, out: bus });
        }
        break;
      }
      case 'boar_squeal': {
        this.tone({ t, type: 'sawtooth', f0: 900, f1: 1500, glide: 0.12, gain: 0.8, attack: 0.02, hold: 0.15, decay: 0.3, vibrato: { rate: 32, depth: 70 }, lowpass: 3500, out: bus });
        this.tone({ t: t + 0.12, type: 'sawtooth', f0: 1500, f1: 700, glide: 0.4, gain: 0.5, attack: 0.01, decay: 0.4, vibrato: { rate: 32, depth: 70 }, lowpass: 3000, out: bus });
        this.burst({ t, type: 'bandpass', freq: 2200, q: 0.7, gain: 0.25, attack: 0.02, hold: 0.2, decay: 0.3, out: bus });
        break;
      }
    }
  }

  // ─────────────── ambient loop ───────────────
  private startAmbient() {
    const c = this.ctx;
    const mkWind = (freq: number, q: number, pan: number, lfoRate: number, base: number) => {
      const src = c.createBufferSource(); src.buffer = this.noise; src.loop = true; src.start(0, Math.random());
      const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = q;
      const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1200;
      const g = c.createGain(); g.gain.value = base;
      const lfo = c.createOscillator(); lfo.type = 'sine'; lfo.frequency.value = lfoRate;
      const lg = c.createGain(); lg.gain.value = base * 0.6;
      lfo.connect(lg).connect(g.gain); lfo.start();
      // slow filter drift for movement
      const lfo2 = c.createOscillator(); lfo2.frequency.value = lfoRate * 0.7 + 0.01;
      const lg2 = c.createGain(); lg2.gain.value = freq * 0.35;
      lfo2.connect(lg2).connect(f.frequency); lfo2.start();
      src.connect(f).connect(lp).connect(g);
      const p = c.createStereoPanner(); p.pan.value = pan;
      g.connect(p).connect(this.ambient);
      return g;
    };
    this.windGain = mkWind(260, 0.5, -0.55, 0.07, 0.11);
    this.windGain2 = mkWind(620, 0.8, 0.55, 0.11, 0.06);
    mkWind(140, 0.4, 0.0, 0.05, 0.09);
    // tree hiss (very quiet high band)
    mkWind(2400, 0.5, 0.2, 0.09, 0.012);
    this.scheduleGust();
    this.scheduleBird();
  }

  private scheduleGust() {
    const wait = rnd(5, 12);
    this.gustTimer = window.setTimeout(() => {
      if (this.ambientOn && this.windGain && this.windGain2) {
        const t = this.ctx.currentTime, rise = rnd(1.5, 3), fall = rnd(2, 4), amt = rnd(1.5, 2.6);
        for (const g of [this.windGain, this.windGain2]) {
          const base = g === this.windGain ? 0.11 : 0.06;
          g.gain.cancelScheduledValues(t);
          g.gain.setValueAtTime(g.gain.value, t);
          g.gain.linearRampToValueAtTime(base * amt, t + rise);
          g.gain.linearRampToValueAtTime(base, t + rise + fall);
        }
      }
      this.scheduleGust();
    }, wait * 1000);
  }

  private scheduleBird() {
    const wait = rnd(4, 12);
    this.birdTimer = window.setTimeout(() => {
      if (this.ambientOn) this.birdsong();
      this.scheduleBird();
    }, wait * 1000);
  }

  /** a short distant phrase of 2–5 FM chirps, random pan */
  private birdsong() {
    const c = this.ctx, t0 = c.currentTime;
    const pan = rnd(-0.9, 0.9), dist = rnd(0.35, 1), base = rnd(2400, 4200);
    const notes = 2 + Math.floor(rnd(0, 4));
    const bus = c.createGain(); bus.gain.value = 0.11 * dist;
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 6000 * dist;
    bus.connect(lp); this.route(lp, pan, this.ambient);
    let t = t0;
    for (let i = 0; i < notes; i++) {
      const f0 = base * rnd(0.85, 1.2), f1 = f0 * rnd(0.7, 1.4), dur = rnd(0.05, 0.13);
      this.tone({ t, type: 'sine', f0, f1, glide: dur, gain: 1, attack: 0.012, decay: dur, vibrato: { rate: rnd(30, 60), depth: rnd(80, 260) }, out: bus });
      t += dur + rnd(0.03, 0.12);
    }
  }

  dispose() { clearTimeout(this.birdTimer); clearTimeout(this.gustTimer); void this.ctx.close(); }
}

export { Audio as GameAudio };
