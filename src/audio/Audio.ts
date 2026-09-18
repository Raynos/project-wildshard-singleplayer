import type { Vector3 } from 'three';

/**
 * Audio — every sound is synthesised with WebAudio (no files).
 *
 *   const audio = new Audio();          // safe to construct before any gesture (context stays suspended)
 *   audio.resume();                     // call on the first user gesture (ENTER THE CHUNK click / keydown)
 *   audio.listenerYaw = player.yaw;     // each frame, for stereo panning of positional sounds
 *
 *   audio.crossbowFire()  audio.boltImpact('wood'|'ground'|'flesh')  audio.reload()   audio.dryFire()
 *   audio.rifleFire()  audio.rifleReload()  audio.weaponSwap()          // AR-15 (src/player/Rifle.ts) + swap (Weapons.ts)
 *   audio.swordSwing()  audio.swordHit('flesh'|'wood', pan?, gain?)          // wooden sword (src/player/Sword.ts)
 *   audio.footstep(sprinting)  audio.jump()  audio.land(hard)  audio.hitMarker()  audio.kill()
 *   audio.splash(impact)  audio.wadeStep(depth, sprinting)  audio.swimStroke()  audio.waterExit()   // water (Player.onEnterWater / onStep while wading / onStroke / onExitWater)
 *   audio.animal('deer_call'|'boar_grunt'|'hoofsteps'|'boar_squeal'|'bear_growl'|'bear_roar'|'bear_hurt', position, listenerPos, yaw?)
 *   audio.setAmbient(true|false)   audio.muted = true|false   audio.master.gain (0.6)
 *
 * Ambient (wind gusts + distant birds) starts on resume() and runs on its own scheduler.
 */

export type ImpactKind = 'wood' | 'ground' | 'flesh';
export type AnimalSound = 'deer_call' | 'boar_grunt' | 'hoofsteps' | 'boar_squeal' | 'elk_bugle' | 'bear_growl' | 'bear_roar' | 'bear_hurt';

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

  /** sword swing: a whoosh — bandpass noise sweeping up then down over ~0.2 s, a hair of low air under it (src/player/Sword.ts onFire) */
  swordSwing() {
    const t = this.ctx.currentTime;
    this.burst({ t, type: 'bandpass', freq: 500, freqEnd: 2200, q: 0.6, gain: 0.32, attack: 0.05, decay: 0.09, rate: 1.1 });
    this.burst({ t: t + 0.09, type: 'bandpass', freq: 2200, freqEnd: 700, q: 0.7, gain: 0.4, attack: 0.02, decay: 0.13 });
    this.burst({ t: t + 0.02, type: 'lowpass', freq: 300, gain: 0.12, attack: 0.06, decay: 0.16 });
  }

  /** sword hit: a wooden thud on flesh (or a knock on wood) — low thump, a damp mid knock, a short bright crack; panned like boltImpact */
  swordHit(kind: ImpactKind = 'flesh', pan = 0, gain = 1) {
    const t = this.ctx.currentTime;
    if (kind === 'wood') {
      this.burst({ t, type: 'bandpass', freq: 1400, q: 2, gain: 0.5 * gain, decay: 0.05, pan });
      this.tone({ t, type: 'triangle', f0: 520, f1: 300, glide: 0.05, gain: 0.25 * gain, decay: 0.1, pan });
    } else {
      this.burst({ t, type: 'lowpass', freq: 420, gain: 0.7 * gain, decay: 0.11, pan });
      this.burst({ t, type: 'bandpass', freq: 1100, q: 1, gain: 0.25 * gain, decay: 0.03, pan });
    }
    this.tone({ t, type: 'sine', f0: 160, f1: 60, glide: 0.09, gain: 0.7 * gain, decay: 0.18, pan });
    this.burst({ t: t + 0.004, type: 'highpass', freq: 2800, gain: 0.18 * gain, decay: 0.012, pan });
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

  /** AR-15 semi-auto report: a hard supersonic crack, the gas-port bark, a 150 → 45 Hz chest thump and a short forest echo tail */
  rifleFire() {
    const t = this.ctx.currentTime;
    // the crack: a ~5 ms highpass transient at full tilt
    this.burst({ t, type: 'highpass', freq: 3800, gain: 0.9, decay: 0.018 });
    // muzzle bark: bandpass noise sweeping down, the "bang" body
    this.burst({ t: t + 0.002, type: 'bandpass', freq: 1500, freqEnd: 320, q: 0.7, gain: 1.0, decay: 0.09 });
    // chest thump
    this.tone({ t: t + 0.001, type: 'sine', f0: 150, f1: 45, glide: 0.09, gain: 0.9, decay: 0.2 });
    // action cycling: bolt carrier slam + a tiny brass tink
    this.burst({ t: t + 0.055, type: 'bandpass', freq: 2200, q: 2.5, gain: 0.22, decay: 0.03 });
    this.tone({ t: t + 0.11 + rnd(0, 0.03), type: 'sine', f0: rnd(5200, 6400), gain: 0.05, decay: 0.05 });
    // forest echo tail: low-passed noise dying over ~0.35 s, a little off to one side each shot
    this.burst({ t: t + 0.04, type: 'lowpass', freq: 900, freqEnd: 250, gain: 0.35, attack: 0.01, decay: 0.34, pan: rnd(-0.25, 0.25) });
  }

  /** mag release · mag drops out · fresh mag seated · bolt release slams home (matches the 1.6 s reload) */
  rifleReload() {
    const t0 = this.ctx.currentTime + 0.05;
    // mag release button
    this.burst({ t: t0, type: 'bandpass', freq: 2600, q: 3, gain: 0.25, decay: 0.015 });
    // mag sliding out + hitting the dirt
    this.burst({ t: t0 + 0.08, type: 'bandpass', freq: 1400, freqEnd: 700, q: 1, gain: 0.18, decay: 0.09 });
    this.burst({ t: t0 + 0.42, type: 'lowpass', freq: 420, gain: 0.3, decay: 0.08 });
    // fresh mag seated with a slap, then the tug check
    const ts = t0 + 1.0;
    this.burst({ t: ts, type: 'bandpass', freq: 1100, q: 1.2, gain: 0.5, decay: 0.05 });
    this.tone({ t: ts, type: 'sine', f0: 260, f1: 140, glide: 0.04, gain: 0.3, decay: 0.07 });
    this.burst({ t: ts + 0.12, type: 'bandpass', freq: 1800, q: 2, gain: 0.15, decay: 0.03 });
    // bolt release: heavy steel clack + receiver ring
    const tb = t0 + 1.4;
    this.burst({ t: tb, type: 'bandpass', freq: 1900, q: 1.5, gain: 0.55, decay: 0.04 });
    this.tone({ t: tb, type: 'triangle', f0: 720, f1: 480, glide: 0.05, gain: 0.2, decay: 0.09 });
    this.tone({ t: tb, type: 'sine', f0: 200, f1: 110, glide: 0.05, gain: 0.35, decay: 0.09 });
  }

  /** weapon swap: sling rustle as one drops, a strap snap and the other's grip clack as it comes up */
  weaponSwap() {
    const t = this.ctx.currentTime;
    this.burst({ t, type: 'bandpass', freq: 900, freqEnd: 1600, q: 0.5, gain: 0.16, attack: 0.03, decay: 0.2 });
    this.burst({ t: t + 0.22, type: 'highpass', freq: 3000, gain: 0.18, decay: 0.012 });
    this.burst({ t: t + 0.30, type: 'bandpass', freq: 1800, freqEnd: 2600, q: 0.5, gain: 0.14, attack: 0.02, decay: 0.16 });
    this.burst({ t: t + 0.46, type: 'bandpass', freq: 1300, q: 1.5, gain: 0.3, decay: 0.035 });
    this.tone({ t: t + 0.46, type: 'sine', f0: 220, f1: 130, glide: 0.04, gain: 0.2, decay: 0.06 });
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

  // ─────────────── water (wading / swimming) ───────────────
  /** feet break the surface. `impact` = entry speed m/s: ~0–1 walking in (a slosh), 10+ off the pier (a full plunge with a spray tail) */
  splash(impact = 0) {
    const t = this.ctx.currentTime;
    const k = Math.min(1, impact / 10);            // 0 = stepping in, 1 = a dive off the pier
    // the body of the splash: a low "gloop" plus a mid slap that scales with how hard we hit
    this.tone({ t, type: 'sine', f0: 160 + 60 * k, f1: 45, glide: 0.12 + 0.08 * k, gain: 0.25 + 0.55 * k, attack: 0.008, decay: 0.2 + 0.2 * k });
    this.burst({ t, type: 'lowpass', freq: 700 + 900 * k, freqEnd: 180, gain: 0.35 + 0.6 * k, attack: 0.004, decay: 0.12 + 0.18 * k });
    // spray: bright noise that opens up after the hit and rains back down
    this.burst({ t: t + 0.02, type: 'bandpass', freq: 2600, freqEnd: 1100, q: 0.5, gain: 0.12 + 0.45 * k, attack: 0.03 + 0.03 * k, decay: 0.3 + 0.5 * k });
    if (k > 0.35) {
      // droplets pattering back onto the surface
      for (let i = 0; i < 5 + Math.floor(k * 6); i++) {
        const ti = t + 0.25 + rnd(0, 0.55) * (0.5 + k);
        this.burst({ t: ti, type: 'bandpass', freq: rnd(1800, 4200), q: 3, gain: rnd(0.03, 0.09) * k, decay: rnd(0.02, 0.05), pan: rnd(-0.6, 0.6) });
      }
    }
  }

  /** a footstep in shallow water: the crunch of the dry step is replaced by a slosh that deepens with the water */
  wadeStep(depth: number, sprinting = false) {
    const t = this.ctx.currentTime;
    this.stepSide = -this.stepSide;
    const pan = this.stepSide * 0.14;
    const d = Math.min(1, depth / 1.1);
    this.burst({ t, type: 'lowpass', freq: 900 - 400 * d, freqEnd: 250, gain: (sprinting ? 0.42 : 0.28) * (0.6 + 0.6 * d), attack: 0.006, decay: 0.09 + 0.1 * d, pan });
    this.burst({ t: t + 0.01, type: 'bandpass', freq: rnd(1900, 3000), freqEnd: 1200, q: 0.7, gain: 0.08 + 0.14 * d, attack: 0.015, decay: 0.12 + 0.12 * d, pan });
    this.tone({ t, type: 'sine', f0: rnd(90, 130), f1: 50, glide: 0.07, gain: 0.12 + 0.12 * d, decay: 0.09, pan });
  }

  /** one swim stroke: an arm sweeping through the water, a soft wash off to one side */
  swimStroke() {
    const t = this.ctx.currentTime;
    this.stepSide = -this.stepSide;
    const pan = this.stepSide * 0.35;
    this.burst({ t, type: 'bandpass', freq: rnd(500, 700), freqEnd: 1400, q: 0.6, gain: 0.16, attack: 0.09, decay: 0.28, pan });
    this.burst({ t: t + 0.06, type: 'bandpass', freq: 2400, freqEnd: 1300, q: 0.8, gain: 0.07, attack: 0.05, decay: 0.22, pan });
    this.tone({ t, type: 'sine', f0: 110, f1: 70, glide: 0.2, gain: 0.06, attack: 0.05, decay: 0.2, pan });
  }

  /** climbing / wading out: water sheeting off and a few drips */
  waterExit() {
    const t = this.ctx.currentTime;
    this.burst({ t, type: 'bandpass', freq: 1200, freqEnd: 500, q: 0.6, gain: 0.16, attack: 0.02, decay: 0.3 });
    for (let i = 0; i < 4; i++) this.burst({ t: t + 0.15 + rnd(0, 0.5), type: 'bandpass', freq: rnd(2200, 4000), q: 4, gain: rnd(0.02, 0.05), decay: 0.03, pan: rnd(-0.4, 0.4) });
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
      case 'elk_bugle': { // bull elk bugle (~1.5 s): a breathy whistle climbing an octave and a half, holding, then dropping into a chesty bellow + grunts
        const rise = rnd(0.45, 0.6), hold = rnd(0.35, 0.5), fall = rnd(0.3, 0.45);
        const top = rnd(1350, 1650);
        // the whistle: a near-sine with a faint harmonic, slow wide vibrato once it reaches the top
        this.tone({ t, type: 'sine', f0: top * 0.42, f1: top, glide: rise, gain: 0.55, attack: 0.08, hold: rise + hold - 0.08, decay: 0.06, vibrato: { rate: 5.5, depth: 28 }, out: bus });
        this.tone({ t, type: 'triangle', f0: top * 0.42, f1: top, glide: rise, gain: 0.16, attack: 0.08, hold: rise + hold - 0.08, decay: 0.06, vibrato: { rate: 5.5, depth: 28 }, lowpass: 4200, out: bus });
        // breath around the whistle
        this.burst({ t, type: 'bandpass', freq: top * 0.6, freqEnd: top * 1.1, q: 2.5, gain: 0.14, attack: 0.1, hold: rise + hold - 0.1, decay: 0.1, out: bus });
        // the drop: the whistle breaks into a rasping bellow that slides down into the chest
        const tb = t + rise + hold;
        this.tone({ t: tb, type: 'sawtooth', f0: top * 0.55, f1: 180, glide: fall, gain: 0.5, attack: 0.02, hold: 0.05, decay: fall, vibrato: { rate: 18, depth: 40 }, lowpass: 2600, out: bus });
        this.tone({ t: tb + 0.04, type: 'sawtooth', f0: 320, f1: 110, glide: fall, gain: 0.45, attack: 0.03, decay: fall + 0.1, vibrato: { rate: 12, depth: 14 }, lowpass: 900, out: bus });
        this.burst({ t: tb, type: 'bandpass', freq: 1400, freqEnd: 400, q: 0.8, gain: 0.22, attack: 0.02, decay: fall, out: bus });
        // two or three chuckle-grunts on the tail
        const n = 2 + Math.floor(rnd(0, 1.9));
        for (let i = 0; i < n; i++) {
          const ti = tb + fall + 0.05 + i * rnd(0.14, 0.2);
          this.tone({ t: ti, type: 'sawtooth', f0: rnd(120, 150), f1: 85, glide: 0.1, gain: 0.4, attack: 0.015, hold: 0.03, decay: 0.09, lowpass: 700, out: bus });
          this.burst({ t: ti, type: 'lowpass', freq: 500, gain: 0.3, attack: 0.01, hold: 0.02, decay: 0.08, out: bus });
        }
        break;
      }
      case 'bear_growl': { // low chesty huff-growl: a slow sawtooth rumble under a breathy lowpass exhale, one or two huffs
        const n = 1 + Math.floor(rnd(0, 1.8));
        for (let i = 0; i < n; i++) {
          const ti = t + i * rnd(0.45, 0.65), dur = rnd(0.5, 0.8);
          this.tone({ t: ti, type: 'sawtooth', f0: rnd(48, 58), f1: 40, glide: dur, gain: 0.85, attack: 0.08, hold: dur * 0.45, decay: dur * 0.55, vibrato: { rate: 9, depth: 5 }, lowpass: 260, out: bus });
          this.tone({ t: ti + 0.02, type: 'square', f0: rnd(70, 84), f1: 58, glide: dur, gain: 0.25, attack: 0.1, hold: dur * 0.4, decay: dur * 0.5, vibrato: { rate: 11, depth: 8 }, lowpass: 380, out: bus });
          this.burst({ t: ti, type: 'lowpass', freq: 520, gain: 0.55, attack: 0.05, hold: dur * 0.35, decay: dur * 0.6, out: bus });
        }
        break;
      }
      case 'bear_roar': { // the charge: a rising bellow — two detuned sawtooths sweeping up then tearing off, with a breath-noise rasp
        const dur = rnd(0.9, 1.2);
        this.tone({ t, type: 'sawtooth', f0: 70, f1: 150, glide: dur * 0.45, gain: 1.0, attack: 0.05, hold: dur * 0.5, decay: dur * 0.5, vibrato: { rate: 14, depth: 14 }, lowpass: 900, out: bus });
        this.tone({ t: t + 0.03, type: 'sawtooth', f0: 104, f1: 226, glide: dur * 0.45, gain: 0.55, attack: 0.06, hold: dur * 0.5, decay: dur * 0.5, vibrato: { rate: 14, depth: 20 }, lowpass: 1400, out: bus });
        this.tone({ t: t + dur * 0.5, type: 'sawtooth', f0: 150, f1: 90, glide: dur * 0.5, gain: 0.5, attack: 0.01, decay: dur * 0.55, vibrato: { rate: 18, depth: 18 }, lowpass: 700, out: bus });
        this.burst({ t, type: 'bandpass', freq: 700, q: 0.5, gain: 0.5, attack: 0.05, hold: dur * 0.55, decay: dur * 0.5, out: bus });
        this.burst({ t: t + 0.05, type: 'lowpass', freq: 1600, gain: 0.3, attack: 0.1, hold: dur * 0.4, decay: dur * 0.5, out: bus });
        break;
      }
      case 'bear_hurt': { // a hit: a sharp bark-roar, higher and shorter than the charge bellow, dropping into a grunt
        this.tone({ t, type: 'sawtooth', f0: 220, f1: 330, glide: 0.08, gain: 0.9, attack: 0.01, hold: 0.12, decay: 0.28, vibrato: { rate: 22, depth: 30 }, lowpass: 1800, out: bus });
        this.tone({ t: t + 0.05, type: 'sawtooth', f0: 330, f1: 120, glide: 0.35, gain: 0.6, attack: 0.01, decay: 0.4, vibrato: { rate: 16, depth: 20 }, lowpass: 1000, out: bus });
        this.tone({ t: t + 0.32, type: 'sawtooth', f0: 64, f1: 46, glide: 0.25, gain: 0.5, attack: 0.03, hold: 0.1, decay: 0.25, lowpass: 320, out: bus });
        this.burst({ t, type: 'bandpass', freq: 1100, q: 0.6, gain: 0.4, attack: 0.01, hold: 0.15, decay: 0.3, out: bus });
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
