import type { Vector3 } from 'three';
import { getActiveChunk } from '../chunks/registry';
import { shipped } from './Stems';
import { getSfxSet, onSfxSet, type SfxSet } from '../ui/Settings';
import { setSfxCredit } from './credits';
import { Voices } from './Voices';

/**
 * Audio — every sound is synthesised with WebAudio (no files).
 *
 *   const audio = new Audio();          // safe to construct before any gesture (context stays suspended)
 *   audio.resume();                     // call on the first user gesture (ENTER THE CHUNK click / keydown)
 *   audio.listenerYaw = player.yaw;     // each frame, for stereo panning of positional sounds
 *
 *   audio.crossbowFire()  audio.boltImpact('wood'|'ground'|'flesh')  audio.reload()   audio.dryFire()
 *   audio.rifleFire()  audio.rifleReload()  audio.weaponSwap()          // AR-15 (src/player/Rifle.ts) + swap (Weapons.ts)
 *   audio.pickupHum(on)                                           // the pickup orb's hum while inside its prompt radius
 *   audio.swordSwing()  audio.swordHeavy()  audio.swordHit('flesh'|'wood', pan?, gain?)   // sword (src/player/Sword.ts): a light swing, the heavy's release (layered over swordSwing), a hit
 *   audio.dodge()  audio.lunge()                                         // Player.onDodge / onLunge (the dash moves, E27)
 *   audio.footstep(sprinting)  audio.jump()  audio.land(hard)  audio.hitMarker()  audio.kill()
 *   audio.splash(impact)  audio.wadeStep(depth, sprinting)  audio.swimStroke()  audio.waterExit()   // water (Player.onEnterWater / onStep while wading / onStroke / onExitWater)
 *   audio.dive()  audio.surface()  audio.setUnderwater(on)   // diving (Player.onSubmerge / onSurface): plunge + gasp, and the whole mix muffled (master lowpass) with a low hum + bubbles while under
 *   audio.animal('deer_call'|'boar_grunt'|'hoofsteps'|'boar_squeal'|'bear_growl'|'bear_roar'|'bear_hurt', position, listenerPos, yaw?)
 *   audio.gullCall(pan?, gain?)  audio.gullCallAt(position, listenerPos, yaw?)   // gulls (src/world/Gulls.ts onCall)
 *   audio.footstep(sprinting, 'litter'|'planks'|'sand')                          // surface: pine litter (default), the pier deck, the beach
 *   audio.setAmbient(true|false)  audio.setAmbient('forest'|'island')   audio.muted = true|false   audio.master.gain (0.6)
 *   audio.worldMuted = true|false        // sfx + ambient only (the title screen: the music plays, the frozen world is quiet)
 *   audio.useZonedAmbience()             // Driftwood: src/audio/IslandAmbience.ts owns the island's beds — the synth island bed is not started
 *   audio.world                          // the bus sfx + ambient share (IslandAmbience sends its reverb returns here)
 *   audio.hurt(strength, pan)  audio.death()   // the player takes a hit (strength = dmg / 20, pan toward the attacker) / dies — both shards (B3)
 *   audio.voices                         // the procedural one-shot bank (src/audio/Voices.ts + gen.ts): Driftwood's footsteps + combat layers (IslandSfx)
 *
 * Samples (docs/plans/MUSIC.md v3 row 7): `audio.loadSamples()` (main.ts calls it after ENTER WORLD — never at boot) reads
 * the selected set's public/assets/sfx/<set>/sfx.json (Settings 'sfxSet': 'sa3-medium' Stable Audio 3 Medium · 'sa3' Small-SFX · 'synth')
 * when the build ships one and decodes what it lists: ambient `beds` (forest / island /
 * underwater, looped loopStart → loopEnd, replacing that synth bed), `hums` (pickup / shrine) and `oneshots` (a family →
 * variant files; each call picks one at random with ±40 cents / −1.5 dB of jitter). Every sound sfx.json does not cover
 * keeps its synth version, and the synth is the fallback for everything (no file, a failed fetch or decode, offline).
 * One-shot families are the method names, with the variant after a dash where the method takes one — see `OneShot`.
 * Switching the set (the pause menu) releases the old set's buffers (every sound back on its synth version) and loads the
 * new one lazily; a set's `credit` goes to src/audio/credits.ts for the menu.
 *
 * Ambient starts on resume() and runs on its own scheduler. The bed follows the chunk: `new Audio()` reads
 * `getActiveChunk().ocean` — an ocean shard gets surf swells, a warm breeze and gulls ('island'); otherwise the
 * pine wind, tree hiss and distant birds ('forest'). `setAmbient('island')` switches it (before or after resume()).
 */

export type ImpactKind = 'wood' | 'ground' | 'flesh';
export type AnimalSound = 'deer_call' | 'boar_grunt' | 'hoofsteps' | 'boar_squeal' | 'elk_bugle' | 'bear_growl' | 'bear_roar' | 'bear_hurt'
  | 'crab_click' | 'crab_snap' | 'monkey_chatter' | 'monkey_shriek' | 'sailor_groan' | 'sailor_slash' | 'coconut_hit' | 'coconut_land';   // Driftwood Isle's enemies (src/entities/Enemies.ts)
export type AmbientBed = 'forest' | 'island';
export type StepSurface = 'litter' | 'planks' | 'sand';
/** sfx.json `oneshots` keys: the method each replaces (`footstep-sand`, `boltImpact-wood`, `land-hard`, the AnimalSound ids, `gull`) */
export type OneShot = 'crossbowFire' | 'dryFire' | `boltImpact-${ImpactKind}` | 'swordSwing' | 'swordHeavy' | `swordHit-${'flesh' | 'wood'}`
  | 'dodge' | 'lunge' | 'reload' | 'rifleFire' | 'rifleReload' | 'weaponSwap' | `footstep-${StepSurface}` | 'jump' | 'land' | 'land-hard'
  | 'splash' | 'wadeStep' | 'swimStroke' | 'waterExit' | 'dive' | 'surface' | 'hitMarker' | 'kill' | AnimalSound | 'gull';
export type LoopName = AmbientBed | 'underwater' | 'pickup' | 'shrine';
/** a decoded loop (a bed or a hum): the buffer, its loop points in the file, and a gain from sfx.json (default per kind) */
export interface SampleLoop { buffer: AudioBuffer; loopStart: number; loopEnd: number; gain: number }
const sfxDir = (set: SfxSet) => `/assets/sfx/${set}/`;
/** a sample's level before sfx.json's own `gain` (beds sit under the synth bed's ~0.1 winds; hums near the synth hum's 0.11) */
const LOOP_GAIN: Record<LoopName, number> = { forest: 0.5, island: 0.5, underwater: 0.5, pickup: 0.35, shrine: 0.6 };

const rnd = (a: number, b: number) => a + Math.random() * (b - a);

interface Graph { ctx: AudioContext; master: GainNode; world: GainNode; sfx: GainNode; ambient: GainNode; muffle: BiquadFilterNode; noise: AudioBuffer }

export class Audio {
  listenerYaw = 0;
  /** the procedural one-shot bank (gen.ts rendered to AudioBuffers after the first gesture) — src/audio/IslandSfx.ts plays it */
  readonly voices = new Voices(this);
  /** the WebAudio graph, built on the first gesture (resume) — creating the first AudioContext is a ~150 ms main-thread
   *  task on the phone tier, so boot never pays it; sounds asked for before then are dropped (the context could not play them) */
  private g: Graph | undefined;
  private started = false;
  private ambientOn = true;
  private stepSide = 1;
  private birdTimer = 0; private gustTimer = 0;
  private windGain: GainNode | undefined; private windGain2: GainNode | undefined;
  private _muted = false;
  private _worldMuted = false;
  private bed: AmbientBed;
  private bedNodes: AudioNode[] = [];
  private surfTimer = 0;
  private hum: { out: GainNode; level: number; sample: boolean; stop: () => void } | undefined;
  private humOn = false;
  private underwater = false; private underGain?: GainNode; private bubbleTimer = 0;
  /** the synth hum's sources under water (swapped for the underwater bed when one decodes) */
  private underFeed: AudioScheduledSourceNode[] = []; private underSample = false;
  // ── samples (sfx.json) ──
  private sfxSet: SfxSet = getSfxSet();
  /** loadSamples() was called (the player is in): a set switch loads the new set straight away */
  private samplesArmed = false;
  /** bumps on every set switch — a decode of the old set that lands afterwards is dropped */
  private setGen = 0;
  private sfxLoad: Promise<void> | undefined;
  private loops = new Map<LoopName, SampleLoop>();
  private shots = new Map<string, { bufs: AudioBuffer[]; gain: number }>();
  private sampleBed = false;

  constructor() {
    this.bed = getActiveChunk().ocean ? 'island' : 'forest';
    onSfxSet((v) => { this.switchSet(v); });
  }

  /** the graph, built on first use: master → muffle → compressor → out, with the sfx and ambient buses and a 2 s noise buffer */
  private graph(): Graph {
    if (this.g) return this.g;
    const w: { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext } = window; // old Safari: prefixed only
    const AC = w.AudioContext ?? w.webkitAudioContext;
    if (AC === undefined) throw new Error('WebAudio unsupported');
    const ctx = new AC({ latencyHint: 'interactive' });
    const master = ctx.createGain(); master.gain.value = this._muted ? 0 : 0.6;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -12; comp.knee.value = 18; comp.ratio.value = 4; comp.attack.value = 0.004; comp.release.value = 0.16;
    const muffle = ctx.createBiquadFilter(); muffle.type = 'lowpass'; muffle.frequency.value = 20000; muffle.Q.value = 0.5;
    master.connect(muffle).connect(comp).connect(ctx.destination);
    // sfx + ambient share a `world` gain, so the title screen can hush the (frozen) world while the music plays on the master
    const world = ctx.createGain(); world.gain.value = this._worldMuted ? 0 : 1; world.connect(master);
    const sfx = ctx.createGain(); sfx.gain.value = 1; sfx.connect(world);
    const ambient = ctx.createGain(); ambient.gain.value = this.ambientOn ? 0.55 : 0; ambient.connect(world);
    const len = ctx.sampleRate * 2, noise = ctx.createBuffer(1, len, ctx.sampleRate), d = noise.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.g = { ctx, master, world, sfx, ambient, muffle, noise };
    return this.g;
  }
  get ctx(): AudioContext { return this.graph().ctx; }
  get master(): GainNode { return this.graph().master; }
  get sfx(): GainNode { return this.graph().sfx; }
  get ambient(): GainNode { return this.graph().ambient; }
  /** sfx + ambient's shared bus (hushed on the title screen) — reverb returns go here */
  get world(): GainNode { return this.graph().world; }
  /** the master low-pass under water: cutoff (Hz) and ramp (s); Driftwood sets 500 / 0.15 (S2), Pine Hollow keeps 520 / 0.3 */
  underwaterCutoff = 520; underwaterRamp = 0.3;
  private zoned = false;
  /** a zoned ambience (IslandAmbience) replaces the synth island bed: it is stopped / never started (a sampled bed still plays) */
  useZonedAmbience(): void {
    if (this.zoned) return;
    this.zoned = true;
    if (this.started && !this.sampleBed && this.bed === 'island') { this.stopBed(); this.startBed(); }
  }
  /** the graph exists (a gesture has happened) — per-frame callers check this so they never create the context */
  get ready(): boolean { return this.g !== undefined; }
  /** a decoded bed / hum from sfx.json, or undefined (the caller plays its synth version) */
  loop(name: LoopName): SampleLoop | undefined { return this.loops.get(name); }
  /** diagnostics: which sounds sfx.json replaced */
  get samples(): { set: SfxSet; loops: LoopName[]; oneshots: string[]; sampleBed: boolean; underSample: boolean } {
    return { set: this.sfxSet, loops: [...this.loops.keys()], oneshots: [...this.shots.keys()], sampleBed: this.sampleBed, underSample: this.underSample };
  }

  /** fetch + decode the selected set's sfx.json files, once, after the player is in the world (needs the graph: call after
   *  resume()). The bed that is playing comes first and swaps in the moment it decodes; nothing is fetched when the build
   *  ships no sfx.json for the set (or the set is 'synth'). */
  loadSamples(): void {
    if (!this.g) return;
    this.samplesArmed = true;
    this.sfxLoad ??= this.loadSet(this.sfxSet, this.setGen);
  }
  /** the pause menu picked another set: every sampled sound back on its synth version, the old buffers dropped, the new set loaded */
  private switchSet(v: SfxSet): void {
    if (v === this.sfxSet) return;
    this.sfxSet = v; this.setGen++;
    this.loops.clear(); this.shots.clear();
    if (this.g) {
      if (this.sampleBed && this.started) { this.stopBed(); this.startBed(); }
      if (this.underSample) this.feedUnder();
      if (this.hum?.sample === true) { const h = this.hum; this.hum = undefined; h.stop(); if (this.humOn) this.pickupHum(true); }
    }
    this.sfxLoad = this.samplesArmed ? this.loadSet(v, this.setGen) : undefined;
  }
  private async loadSet(set: SfxSet, gen: number): Promise<void> {
    const g = this.g, dir = sfxDir(set), json = `${dir}sfx.json`;
    if (!g || set === 'synth' || !shipped(json)) return;
    const ctx = g.ctx, live = () => gen === this.setGen;
    const decode = async (file: string): Promise<AudioBuffer> => {
      const url = `${dir}${file}`;
      if (file.includes('..') || !shipped(url)) throw new Error(`${url} is not in this build`);
      const r = await fetch(url); if (!r.ok) throw new Error(`${url} ${r.status}`);
      return ctx.decodeAudioData(await r.arrayBuffer());
    };
    const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
    const num = (v: unknown, d: number) => (typeof v === 'number' && Number.isFinite(v) ? v : d);
    const loopOf = async (name: LoopName, v: unknown): Promise<void> => {
      if (!isObj(v) || typeof v['file'] !== 'string') return;
      try {
        const buffer = await decode(v['file']), loopEnd = Math.min(buffer.duration, num(v['loopEnd'], buffer.duration)), loopStart = Math.max(0, Math.min(loopEnd - 0.05, num(v['loopStart'], 0)));
        if (!live()) return;
        this.loops.set(name, { buffer, loopStart, loopEnd, gain: LOOP_GAIN[name] * num(v['gain'], 1) });
        this.onLoop(name);
      } catch (e) { console.info(`[sfx] ${set}/${name}: ${e instanceof Error ? e.message : String(e)} — synth kept`); }
    };
    try {
      const r = await fetch(json); if (!r.ok) throw new Error(`${json} ${r.status}`);
      const j: unknown = await r.json();
      if (!isObj(j)) throw new Error(`${json} malformed`);
      if (!live()) return;
      if (typeof j['credit'] === 'string') setSfxCredit(set, j['credit']);
      const beds = isObj(j['beds']) ? j['beds'] : {}, hums = isObj(j['hums']) ? j['hums'] : {}, shots = isObj(j['oneshots']) ? j['oneshots'] : {};
      // the bed that is playing first, then the rest in parallel (never the other shard's bed: a shard change reloads the page)
      await loopOf(this.bed, beds[this.bed]);
      await Promise.all([
        loopOf('underwater', beds['underwater']), loopOf('pickup', hums['pickup']), loopOf('shrine', hums['shrine']),
        ...Object.entries(shots).map(async ([family, v]) => {
          const files = Array.isArray(v) ? v : isObj(v) && Array.isArray(v['files']) ? v['files'] : [];
          const gain = isObj(v) ? num(v['gain'], 1) : 1;
          const bufs = (await Promise.all(files.filter((f): f is string => typeof f === 'string').map((f) => decode(f).catch(() => undefined)))).filter((b): b is AudioBuffer => b !== undefined);
          if (bufs.length > 0 && live()) this.shots.set(family, { bufs, gain });
        }),
      ]);
    } catch (e: unknown) { console.info(`[sfx] ${set}: ${e instanceof Error ? e.message : String(e)} — synth sounds kept`); }
  }
  /** a loop just decoded: swap it in where its synth version is sounding */
  private onLoop(name: LoopName): void {
    if (name === this.bed && this.started && !this.sampleBed) { this.stopBed(); this.startBed(); }
    else if (name === 'underwater' && this.underGain && !this.underSample) this.feedUnder();
  }
  /** a random variant of `family` with a little pitch / gain jitter, routed like the synth call; false = not sampled, play the synth */
  private shot(family: OneShot, o: { pan?: number; gain?: number; out?: AudioNode } = {}): boolean {
    const set = this.shots.get(family);
    if (!set || !this.g) return false;
    const buf = set.bufs[Math.floor(Math.random() * set.bufs.length)];
    if (!buf) return false;
    const c = this.g.ctx, src = c.createBufferSource(); src.buffer = buf;
    src.playbackRate.value = 2 ** (rnd(-40, 40) / 1200);
    const g = c.createGain(); g.gain.value = set.gain * (o.gain ?? 1) * rnd(0.84, 1);
    src.connect(g); this.route(g, o.pan ?? 0, o.out); src.start();
    return true;
  }
  /** a looping source of `l` (loopStart → loopEnd) started now, from a random point inside the loop so two plays never phase */
  private loopSource(l: SampleLoop): AudioBufferSourceNode {
    const c = this.ctx, s = c.createBufferSource(); s.buffer = l.buffer; s.loop = true; s.loopStart = l.loopStart; s.loopEnd = l.loopEnd;
    s.start(c.currentTime, l.loopStart + Math.random() * (l.loopEnd - l.loopStart));
    return s;
  }
  /** the master lowpass: wide open on land, shut down to ~500 Hz under water (setUnderwater) */
  private get muffle(): BiquadFilterNode { return this.graph().muffle; }
  private get noise(): AudioBuffer { return this.graph().noise; }

  /** the world's sounds (sfx + ambient) silenced while the music (on the master) plays — the title / main menu (main.ts) */
  get worldMuted(): boolean { return this._worldMuted; }
  set worldMuted(v: boolean) { this._worldMuted = v; if (this.g) this.g.world.gain.setTargetAtTime(v ? 0 : 1, this.g.ctx.currentTime, 0.08); }
  get muted(): boolean { return this._muted; }
  set muted(v: boolean) { this._muted = v; if (this.g) this.g.master.gain.setTargetAtTime(v ? 0 : 0.6, this.g.ctx.currentTime, 0.05); }

  /** Call from a user gesture (it builds the graph there — iOS unlocks a context made inside a gesture). Idempotent. */
  resume(): void {
    const built = this.g !== undefined, c = this.ctx;
    if (c.state !== 'running') void c.resume();
    if (!built && this.underwater) { this.underwater = false; this.setUnderwater(true); } // dove before the first gesture
    if (!this.started) { this.started = true; this.startAmbient(); }
    if (!built) window.setTimeout(() => this.voices.prewarm(['hurt', 'death']), 1500); // rendered in the background, before the first hit
  }

  /** `true`/`false` mutes the bed; `'forest'`/`'island'` swaps it (pine wind + birds ↔ surf + breeze + gulls) */
  setAmbient(on: boolean | AmbientBed): void {
    if (typeof on === 'string') {
      if (on === this.bed) return;
      this.bed = on;
      if (this.started) { this.stopBed(); this.startBed(); }
      return;
    }
    this.ambientOn = on; if (this.g) this.g.ambient.gain.setTargetAtTime(on ? 0.55 : 0, this.g.ctx.currentTime, 0.4);
  }

  // ─────────────── building blocks ───────────────
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
    if (pan !== 0 && 'createStereoPanner' in this.ctx) { const p = this.ctx.createStereoPanner(); p.pan.value = Math.max(-1, Math.min(1, pan)); node.connect(p).connect(out ?? this.sfx); }
    else node.connect(out ?? this.sfx);
  }

  // ─────────────── weapon ───────────────
  crossbowFire(): void {
    if (!this.g || this.shot('crossbowFire')) return;
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

  dryFire(): void {
    if (!this.g || this.shot('dryFire')) return;
    const t = this.ctx.currentTime;
    this.burst({ t, type: 'highpass', freq: 3000, gain: 0.25, decay: 0.01 });
    this.tone({ t, type: 'square', f0: 700, gain: 0.05, decay: 0.03, lowpass: 2000 });
  }

  boltImpact(kind: ImpactKind, pan = 0, gain = 1): void {
    if (!this.g || this.shot(`boltImpact-${kind}`, { pan, gain })) return;
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
  swordSwing(): void {
    if (!this.g || this.shot('swordSwing')) return;
    const t = this.ctx.currentTime;
    this.burst({ t, type: 'bandpass', freq: 500, freqEnd: 2200, q: 0.6, gain: 0.32, attack: 0.05, decay: 0.09, rate: 1.1 });
    this.burst({ t: t + 0.09, type: 'bandpass', freq: 2200, freqEnd: 700, q: 0.7, gain: 0.4, attack: 0.02, decay: 0.13 });
    this.burst({ t: t + 0.02, type: 'lowpass', freq: 300, gain: 0.12, attack: 0.06, decay: 0.16 });
  }

  /** a dodge (Player.onDodge): a body whoosh — lower and airier than a blade, a cloth flap, the scuff of the push-off */
  dodge(): void {
    if (!this.g || this.shot('dodge')) return;
    const t = this.ctx.currentTime;
    this.burst({ t, type: 'bandpass', freq: 260, freqEnd: 1100, q: 0.5, gain: 0.34, attack: 0.03, decay: 0.16, rate: 1.2 });
    this.burst({ t: t + 0.04, type: 'highpass', freq: 3200, gain: 0.08, attack: 0.01, decay: 0.07 });
    this.burst({ t, type: 'lowpass', freq: 520, gain: 0.26, decay: 0.05 });
  }

  /** a lunge (Player.onLunge, under the swing's whoosh): a short low rush of closing distance */
  lunge(): void {
    if (!this.g || this.shot('lunge')) return;
    const t = this.ctx.currentTime;
    this.burst({ t, type: 'bandpass', freq: 180, freqEnd: 620, q: 0.6, gain: 0.3, attack: 0.02, decay: 0.12, rate: 1.4 });
    this.tone({ t, type: 'sine', f0: 90, f1: 60, glide: 0.1, gain: 0.18, attack: 0.01, decay: 0.12 });
  }

  /** the heavy's release (Sword.onHeavy, on top of swordSwing): a longer, deeper whoosh — a low rush that climbs, a chest-thump of effort, a breathy tail */
  swordHeavy(): void {
    if (!this.g || this.shot('swordHeavy')) return;
    const t = this.ctx.currentTime;
    this.burst({ t, type: 'bandpass', freq: 220, freqEnd: 900, q: 0.8, gain: 0.45, attack: 0.09, decay: 0.22, rate: 0.9 });
    this.burst({ t: t + 0.12, type: 'bandpass', freq: 1400, freqEnd: 380, q: 0.9, gain: 0.5, attack: 0.03, decay: 0.26 });
    this.tone({ t: t + 0.02, type: 'sine', f0: 110, f1: 55, glide: 0.18, gain: 0.35, attack: 0.02, decay: 0.3 });
    this.burst({ t: t + 0.05, type: 'lowpass', freq: 240, gain: 0.2, attack: 0.08, decay: 0.3 });
  }

  /** sword hit: a wooden thud on flesh (or a knock on wood) — low thump, a damp mid knock, a short bright crack; panned like boltImpact */
  swordHit(kind: ImpactKind = 'flesh', pan = 0, gain = 1): void {
    if (!this.g || this.shot(kind === 'wood' ? 'swordHit-wood' : 'swordHit-flesh', { pan, gain })) return;
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
  reload(): void {
    if (!this.g || this.shot('reload')) return;
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
  rifleFire(): void {
    if (!this.g || this.shot('rifleFire')) return;
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
  rifleReload(): void {
    if (!this.g || this.shot('rifleReload')) return;
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
  weaponSwap(): void {
    if (!this.g || this.shot('weaponSwap')) return;
    const t = this.ctx.currentTime;
    this.burst({ t, type: 'bandpass', freq: 900, freqEnd: 1600, q: 0.5, gain: 0.16, attack: 0.03, decay: 0.2 });
    this.burst({ t: t + 0.22, type: 'highpass', freq: 3000, gain: 0.18, decay: 0.012 });
    this.burst({ t: t + 0.30, type: 'bandpass', freq: 1800, freqEnd: 2600, q: 0.5, gain: 0.14, attack: 0.02, decay: 0.16 });
    this.burst({ t: t + 0.46, type: 'bandpass', freq: 1300, q: 1.5, gain: 0.3, decay: 0.035 });
    this.tone({ t: t + 0.46, type: 'sine', f0: 220, f1: 130, glide: 0.04, gain: 0.2, decay: 0.06 });
  }

  /** the item-pickup orb's hum while the player stands inside its prompt radius (WeaponPickup.onNear): a low-passed
   *  220 Hz sine with a 5.5 Hz tremolo and a faint fifth, looped, faded in over 0.35 s and out over 0.5 s */
  pickupHum(on: boolean): void {
    this.humOn = on;
    if (!this.g) return;
    const c = this.ctx, t = c.currentTime;
    if (on) {
      const sample = this.loops.get('pickup');
      if (!this.hum && sample) {
        const out = c.createGain(); out.gain.value = 0;
        const s = this.loopSource(sample); s.connect(out).connect(this.sfx);
        this.hum = { out, level: sample.gain, sample: true, stop: () => { s.stop(); out.disconnect(); } };
      }
      if (!this.hum) {
        const out = c.createGain(); out.gain.value = 0;
        const trem = c.createGain(); trem.gain.value = 0.7;
        const lfo = c.createOscillator(); lfo.frequency.value = 5.5;
        const lg = c.createGain(); lg.gain.value = 0.3; lfo.connect(lg).connect(trem.gain); lfo.start(t);
        const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 700; lp.Q.value = 0.7;
        const o1 = c.createOscillator(); o1.type = 'sine'; o1.frequency.value = 220;
        const o2 = c.createOscillator(); o2.type = 'triangle'; o2.frequency.value = 330; // a soft fifth
        const g2 = c.createGain(); g2.gain.value = 0.18;
        o1.connect(lp); o2.connect(g2).connect(lp); lp.connect(trem).connect(out).connect(this.sfx);
        o1.start(t); o2.start(t);
        this.hum = { out, level: 0.11, sample: false, stop: () => { o1.stop(); o2.stop(); lfo.stop(); out.disconnect(); } };
      }
      this.hum.out.gain.cancelScheduledValues(t); this.hum.out.gain.setTargetAtTime(this.hum.level, t, 0.12);
    } else if (this.hum) {
      const h = this.hum; this.hum = undefined;
      h.out.gain.cancelScheduledValues(t); h.out.gain.setTargetAtTime(0, t, 0.16);
      setTimeout(() => h.stop(), 700);
    }
  }

  // ─────────────── movement ───────────────
  footstep(sprinting: boolean, surface: StepSurface = 'litter'): void {
    if (!this.g) return;
    const t = this.ctx.currentTime;
    this.stepSide = -this.stepSide;
    const pan = this.stepSide * 0.14;
    if (this.shot(`footstep-${surface}`, { pan, gain: sprinting ? 1 : 0.7 })) return;
    if (surface === 'planks') {
      // a boot on a pier deck: a hollow wooden knock that rings down the planks, a hint of a creak
      this.burst({ t, type: 'bandpass', freq: rnd(220, 320), q: 1.6, gain: sprinting ? 0.55 : 0.38, decay: sprinting ? 0.09 : 0.12, pan });
      this.tone({ t, type: 'triangle', f0: rnd(150, 190), f1: 90, glide: 0.07, gain: sprinting ? 0.3 : 0.2, decay: 0.11, pan, lowpass: 900 });
      this.tone({ t, type: 'sine', f0: rnd(60, 75), f1: 40, glide: 0.06, gain: sprinting ? 0.35 : 0.22, decay: 0.09, pan });
      if (Math.random() < 0.25) this.tone({ t: t + 0.03, type: 'sawtooth', f0: rnd(400, 700), f1: rnd(300, 500), glide: 0.12, gain: 0.03, attack: 0.03, decay: 0.12, pan, lowpass: 1400, vibrato: { rate: 18, depth: 20 } });
      return;
    }
    if (surface === 'sand') {
      // a soft grainy scuff, no knock: broadband hiss that swells and settles, a dull thud under it
      this.burst({ t, type: 'bandpass', freq: rnd(1400, 2200), freqEnd: 700, q: 0.5, gain: sprinting ? 0.3 : 0.2, attack: 0.02, decay: sprinting ? 0.1 : 0.14, pan });
      this.burst({ t: t + 0.01, type: 'lowpass', freq: 380, gain: sprinting ? 0.32 : 0.2, attack: 0.012, decay: 0.09, pan });
      this.tone({ t, type: 'sine', f0: rnd(60, 80), f1: 42, glide: 0.06, gain: sprinting ? 0.18 : 0.1, decay: 0.07, pan });
      return;
    }
    const f = rnd(380, 720);
    this.burst({ t, type: 'lowpass', freq: f, gain: sprinting ? 0.5 : 0.32, decay: sprinting ? 0.06 : 0.08, pan });
    // needle-litter crunch
    this.burst({ t: t + 0.006, type: 'bandpass', freq: rnd(1800, 3200), q: 0.8, gain: sprinting ? 0.14 : 0.09, decay: 0.045, pan });
    this.tone({ t, type: 'sine', f0: rnd(70, 95), f1: 45, glide: 0.05, gain: sprinting ? 0.3 : 0.18, decay: 0.07, pan });
  }

  jump(): void {
    if (!this.g || this.shot('jump')) return;
    const t = this.ctx.currentTime;
    this.burst({ t, type: 'bandpass', freq: 400, freqEnd: 1400, q: 0.6, gain: 0.16, attack: 0.02, decay: 0.16 });
    this.burst({ t, type: 'lowpass', freq: 500, gain: 0.25, decay: 0.05 });
  }

  land(hard: boolean): void {
    if (!this.g || this.shot(hard ? 'land-hard' : 'land')) return;
    const t = this.ctx.currentTime;
    this.burst({ t, type: 'lowpass', freq: hard ? 380 : 500, gain: hard ? 0.8 : 0.45, decay: hard ? 0.16 : 0.09 });
    this.tone({ t, type: 'sine', f0: hard ? 75 : 85, f1: 40, glide: 0.08, gain: hard ? 0.7 : 0.35, decay: hard ? 0.22 : 0.12 });
    this.burst({ t: t + 0.01, type: 'bandpass', freq: 2400, q: 0.8, gain: 0.12, decay: 0.05 });
    if (hard) this.burst({ t: t + 0.06, type: 'lowpass', freq: 300, gain: 0.3, decay: 0.12 });
  }

  // ─────────────── water (wading / swimming) ───────────────
  /** feet break the surface. `impact` = entry speed m/s: ~0–1 walking in (a slosh), 10+ off the pier (a full plunge with a spray tail) */
  splash(impact = 0): void {
    if (!this.g) return;
    const t = this.ctx.currentTime;
    const k = Math.min(1, impact / 10);            // 0 = stepping in, 1 = a dive off the pier
    if (this.shot('splash', { gain: 0.35 + 0.65 * k })) return;
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
  wadeStep(depth: number, sprinting = false): void {
    if (!this.g) return;
    const t = this.ctx.currentTime;
    this.stepSide = -this.stepSide;
    const pan = this.stepSide * 0.14;
    const d = Math.min(1, depth / 1.1);
    if (this.shot('wadeStep', { pan, gain: (sprinting ? 1 : 0.7) * (0.6 + 0.4 * d) })) return;
    this.burst({ t, type: 'lowpass', freq: 900 - 400 * d, freqEnd: 250, gain: (sprinting ? 0.42 : 0.28) * (0.6 + 0.6 * d), attack: 0.006, decay: 0.09 + 0.1 * d, pan });
    this.burst({ t: t + 0.01, type: 'bandpass', freq: rnd(1900, 3000), freqEnd: 1200, q: 0.7, gain: 0.08 + 0.14 * d, attack: 0.015, decay: 0.12 + 0.12 * d, pan });
    this.tone({ t, type: 'sine', f0: rnd(90, 130), f1: 50, glide: 0.07, gain: 0.12 + 0.12 * d, decay: 0.09, pan });
  }

  /** one swim stroke: an arm sweeping through the water, a soft wash off to one side */
  swimStroke(): void {
    if (!this.g || this.shot('swimStroke')) return;
    const t = this.ctx.currentTime;
    this.stepSide = -this.stepSide;
    const pan = this.stepSide * 0.35;
    this.burst({ t, type: 'bandpass', freq: rnd(500, 700), freqEnd: 1400, q: 0.6, gain: 0.16, attack: 0.09, decay: 0.28, pan });
    this.burst({ t: t + 0.06, type: 'bandpass', freq: 2400, freqEnd: 1300, q: 0.8, gain: 0.07, attack: 0.05, decay: 0.22, pan });
    this.tone({ t, type: 'sine', f0: 110, f1: 70, glide: 0.2, gain: 0.06, attack: 0.05, decay: 0.2, pan });
  }

  /** climbing / wading out: water sheeting off and a few drips */
  waterExit(): void {
    if (!this.g || this.shot('waterExit')) return;
    const t = this.ctx.currentTime;
    this.burst({ t, type: 'bandpass', freq: 1200, freqEnd: 500, q: 0.6, gain: 0.16, attack: 0.02, decay: 0.3 });
    for (let i = 0; i < 4; i++) this.burst({ t: t + 0.15 + rnd(0, 0.5), type: 'bandpass', freq: rnd(2200, 4000), q: 4, gain: rnd(0.02, 0.05), decay: 0.03, pan: rnd(-0.4, 0.4) });
  }

  // ─────────────── diving (Player.onSubmerge / onSurface) ───────────────
  /** the head goes under: a soft whump of water closing over the ears and a trail of bubbles */
  dive(): void {
    if (!this.g || this.shot('dive')) return;
    const t = this.ctx.currentTime;
    this.tone({ t, type: 'sine', f0: 140, f1: 40, glide: 0.25, gain: 0.35, attack: 0.02, decay: 0.35 });
    this.burst({ t, type: 'lowpass', freq: 900, freqEnd: 160, gain: 0.4, attack: 0.02, decay: 0.32 });
    for (let i = 0; i < 9; i++) {
      const ti = t + 0.08 + rnd(0, 0.7);
      this.tone({ t: ti, type: 'sine', f0: rnd(420, 900), f1: rnd(900, 1800), glide: 0.06, gain: rnd(0.02, 0.05), attack: 0.004, decay: rnd(0.03, 0.07), pan: rnd(-0.5, 0.5) });
    }
  }

  /** breaking the surface: water sheeting off the head, a gasp of air, a couple of drips */
  surface(): void {
    if (!this.g || this.shot('surface')) return;
    const t = this.ctx.currentTime;
    this.burst({ t, type: 'bandpass', freq: 1400, freqEnd: 500, q: 0.6, gain: 0.34, attack: 0.01, decay: 0.28 });
    this.burst({ t: t + 0.03, type: 'lowpass', freq: 1200, freqEnd: 300, gain: 0.22, attack: 0.01, decay: 0.16 });
    // the gasp: a breathy inhale (bandpassed noise sweeping up) then a short exhale
    this.burst({ t: t + 0.12, type: 'bandpass', freq: 700, freqEnd: 1900, q: 1.4, gain: 0.13, attack: 0.16, decay: 0.12, hold: 0.05 });
    this.burst({ t: t + 0.5, type: 'bandpass', freq: 1500, freqEnd: 600, q: 1.1, gain: 0.07, attack: 0.05, decay: 0.2 });
    for (let i = 0; i < 4; i++) this.burst({ t: t + 0.2 + rnd(0, 0.5), type: 'bandpass', freq: rnd(2200, 4000), q: 4, gain: rnd(0.02, 0.05), decay: 0.03, pan: rnd(-0.4, 0.4) });
  }

  /** under the surface everything is muffled (master lowpass down to ~500 Hz) under a low pressure hum with the odd bubble */
  setUnderwater(on: boolean): void {
    if (on === this.underwater) return;
    this.underwater = on;
    if (!this.g) return; // resume() applies it
    const c = this.ctx, t = c.currentTime;
    this.muffle.frequency.cancelScheduledValues(t);
    this.muffle.frequency.setValueAtTime(this.muffle.frequency.value, t);
    this.muffle.frequency.exponentialRampToValueAtTime(on ? this.underwaterCutoff : 20000, t + this.underwaterRamp);
    if (!this.underGain) {
      // the hum: brown-ish noise through a 90 Hz lowpass, swelling on a slow LFO; lives on the ambient bus (mutes with it)
      this.underGain = c.createGain(); this.underGain.gain.value = 0; this.underGain.connect(this.ambient);
      this.feedUnder();
    }
    this.underGain.gain.cancelScheduledValues(t);
    this.underGain.gain.setValueAtTime(this.underGain.gain.value, t);
    this.underGain.gain.linearRampToValueAtTime(on ? 1.4 : 0, t + (on ? 0.6 : 0.3));
    clearTimeout(this.bubbleTimer);
    if (on) this.scheduleBubble();
  }

  /** what feeds the underwater gain: the set's underwater bed when one decoded, else the synth hum (re-run when either changes;
   *  the envelope in setUnderwater is untouched) */
  private feedUnder(): void {
    const g = this.underGain;
    if (!g) return;
    const c = this.ctx, l = this.loops.get('underwater');
    for (const n of this.underFeed) { try { n.stop(); } catch { /* not started */ } }
    if (l) {
      const lvl = c.createGain(); lvl.gain.value = l.gain / 1.4; // the synth hum's envelope peaks at 1.4
      const s = this.loopSource(l); s.connect(lvl).connect(g);
      this.underFeed = [s]; this.underSample = true;
      return;
    }
    const src = c.createBufferSource(); src.buffer = this.noise; src.loop = true; src.start(0, Math.random());
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 90; lp.Q.value = 0.9;
    const lp2 = c.createBiquadFilter(); lp2.type = 'lowpass'; lp2.frequency.value = 220;
    const lfo = c.createOscillator(); lfo.frequency.value = 0.13; const lg = c.createGain(); lg.gain.value = 0.35;
    const sw = c.createGain(); sw.gain.value = 1; lfo.connect(lg).connect(sw.gain); lfo.start();
    src.connect(lp).connect(lp2).connect(sw).connect(g);
    this.underFeed = [src, lfo]; this.underSample = false;
  }

  private scheduleBubble() {
    this.bubbleTimer = window.setTimeout(() => {
      if (!this.underwater) return;
      const t = this.ctx.currentTime, n = 1 + Math.floor(rnd(0, 4)), pan = rnd(-0.7, 0.7);
      for (let i = 0; i < n; i++) this.tone({ t: t + i * rnd(0.05, 0.12), type: 'sine', f0: rnd(300, 700), f1: rnd(800, 1600), glide: 0.07, gain: rnd(0.015, 0.04), attack: 0.004, decay: rnd(0.04, 0.08), pan, out: this.ambient });
      this.scheduleBubble();
    }, rnd(1.2, 4.5) * 1000);
  }

  // ─────────────── feedback ───────────────
  hitMarker(): void {
    if (!this.g || this.shot('hitMarker')) return;
    const t = this.ctx.currentTime;
    this.tone({ t, type: 'sine', f0: 1900, gain: 0.16, decay: 0.045 });
    this.tone({ t: t + 0.012, type: 'sine', f0: 2600, gain: 0.1, decay: 0.05 });
  }

  /** the player takes a hit (both shards, B3): a short grunt ("uh" / "ah" / "oof") over a body blow, from the bank (gen.ts
   *  hurt). `strength` ≈ dmg / 20 (0.1 … 1.5): louder and a little lower / heavier as it grows; `pan` −1 … 1 toward the attacker. */
  hurt(strength = 0.5, pan = 0): void {
    if (!this.g) return;
    const s = Math.max(0.1, Math.min(1, strength));
    this.voices.play('hurt', { gain: 0.45 + 0.4 * s, rate: 1.05 - 0.12 * s, pan: Math.max(-1, Math.min(1, pan)) * 0.6 });
  }

  /** the player dies (both shards): the hit, a groan falling out of breath, the body hitting the ground (~1.6 s) */
  death(): void {
    if (!this.g) return;
    this.voices.play('death', { gain: 0.85, jitter: 0.03 });
  }

  kill(): void {
    if (!this.g || this.shot('kill')) return;
    const t = this.ctx.currentTime;
    this.tone({ t, type: 'sine', f0: 660, gain: 0.18, decay: 0.16 });
    this.tone({ t: t + 0.09, type: 'sine', f0: 990, gain: 0.2, decay: 0.32 });
    this.tone({ t: t + 0.09, type: 'triangle', f0: 1980, gain: 0.05, decay: 0.3 });
    this.burst({ t, type: 'bandpass', freq: 1200, q: 0.5, gain: 0.08, attack: 0.05, decay: 0.3 });
  }

  // ─────────────── positional animal sounds ───────────────
  /** distance attenuation + stereo pan from direction relative to the listener yaw */
  animal(kind: AnimalSound, position: Vector3, listenerPos: Vector3, yaw = this.listenerYaw): void {
    if (!this.g) return;
    const dx = position.x - listenerPos.x, dz = position.z - listenerPos.z, dy = position.y - listenerPos.y;
    const dist = Math.sqrt(dx * dx + dz * dz + dy * dy);
    if (dist > 140) return;
    const att = 1 / (1 + dist / 9) ** 1.4;
    const rx = Math.cos(yaw), rz = -Math.sin(yaw); // listener right vector
    const pan = dist > 0.5 ? Math.max(-1, Math.min(1, (dx * rx + dz * rz) / dist)) * 0.8 : 0;
    // distance low-pass into a per-call bus
    const bus = this.ctx.createGain(); bus.gain.value = att;
    const lp = this.ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 9000 / (1 + dist / 25);
    bus.connect(lp); this.route(lp, pan);
    if (this.shot(kind, { out: bus })) return;
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
      // ── Driftwood Isle enemies (species/{crab,monkey,sailor}.ts + Enemies.ts) ──
      case 'crab_click': { // the reef crab: two to four dry clicks of the mouthparts
        const n = 2 + Math.floor(rnd(0, 2.9));
        for (let i = 0; i < n; i++) { const ti = t + i * rnd(0.06, 0.1); this.burst({ t: ti, type: 'bandpass', freq: rnd(2200, 3200), q: 5, gain: 0.55, decay: 0.03, out: bus }); this.tone({ t: ti, type: 'square', f0: 1800, f1: 900, glide: 0.02, gain: 0.12, decay: 0.025, out: bus }); }
        break;
      }
      case 'crab_snap': { // the pincer shutting: a hard crack with a knock under it
        this.burst({ t, type: 'highpass', freq: 1800, gain: 0.9, decay: 0.05, out: bus });
        this.burst({ t: t + 0.005, type: 'bandpass', freq: 900, q: 2, gain: 0.6, decay: 0.08, out: bus });
        this.tone({ t, type: 'sine', f0: 140, f1: 70, glide: 0.06, gain: 0.5, decay: 0.09, out: bus });
        break;
      }
      case 'monkey_chatter': { // three to five quick "ook-ook" chirps
        const n = 3 + Math.floor(rnd(0, 2.9)), base = rnd(520, 720);
        for (let i = 0; i < n; i++) { const ti = t + i * rnd(0.09, 0.14); this.tone({ t: ti, type: 'sawtooth', f0: base, f1: base * 1.5, glide: 0.05, gain: 0.45, attack: 0.01, hold: 0.03, decay: 0.06, vibrato: { rate: 30, depth: 40 }, lowpass: 2600, out: bus }); this.burst({ t: ti, type: 'bandpass', freq: base * 2.2, q: 1.5, gain: 0.12, decay: 0.06, out: bus }); }
        break;
      }
      case 'monkey_shriek': { // a rising screech that breaks up
        this.tone({ t, type: 'sawtooth', f0: 800, f1: 1900, glide: 0.18, gain: 0.7, attack: 0.01, hold: 0.12, decay: 0.22, vibrato: { rate: 38, depth: 120 }, lowpass: 4200, out: bus });
        this.tone({ t: t + 0.05, type: 'square', f0: 1200, f1: 2400, glide: 0.2, gain: 0.2, attack: 0.01, decay: 0.3, vibrato: { rate: 44, depth: 200 }, lowpass: 3800, out: bus });
        this.burst({ t, type: 'bandpass', freq: 2600, q: 0.8, gain: 0.25, attack: 0.02, hold: 0.15, decay: 0.2, out: bus });
        break;
      }
      case 'sailor_groan': { // a drowned groan: a long low rasp under a watery gurgle
        const dur = rnd(0.9, 1.4);
        this.tone({ t, type: 'sawtooth', f0: rnd(78, 92), f1: 58, glide: dur, gain: 0.8, attack: 0.15, hold: dur * 0.4, decay: dur * 0.5, vibrato: { rate: 6, depth: 6 }, lowpass: 420, out: bus });
        this.tone({ t: t + 0.05, type: 'square', f0: 120, f1: 84, glide: dur, gain: 0.18, attack: 0.2, hold: dur * 0.35, decay: dur * 0.5, vibrato: { rate: 9, depth: 10 }, lowpass: 600, out: bus });
        this.burst({ t, type: 'bandpass', freq: 520, freqEnd: 240, q: 3, gain: 0.35, attack: 0.1, hold: dur * 0.5, decay: dur * 0.5, rate: 0.6, out: bus });
        for (let i = 0; i < 5; i++) this.burst({ t: t + rnd(0.1, dur), type: 'bandpass', freq: rnd(300, 700), q: 6, gain: 0.25, decay: 0.05, out: bus });   // bubbles
        break;
      }
      case 'sailor_slash': { // the cutlass: a rising whoosh
        this.burst({ t, type: 'bandpass', freq: 700, freqEnd: 2600, q: 1.2, gain: 0.6, attack: 0.03, hold: 0.06, decay: 0.16, out: bus });
        this.burst({ t: t + 0.02, type: 'highpass', freq: 3000, gain: 0.2, attack: 0.04, decay: 0.14, out: bus });
        break;
      }
      case 'coconut_hit': { // a coconut off your skull: a hard hollow knock
        this.tone({ t, type: 'sine', f0: 260, f1: 120, glide: 0.05, gain: 0.8, decay: 0.12, out: bus });
        this.burst({ t, type: 'lowpass', freq: 900, gain: 0.5, decay: 0.05, out: bus });
        break;
      }
      case 'coconut_land': { // a coconut in the sand: a dull thump and a hiss of grains
        this.tone({ t, type: 'sine', f0: 150, f1: 70, glide: 0.06, gain: 0.55, decay: 0.12, out: bus });
        this.burst({ t: t + 0.01, type: 'lowpass', freq: 1400, gain: 0.3, attack: 0.01, decay: 0.12, out: bus });
        break;
      }
      case 'bear_hurt': { // a hit: a sharp bark-roar, higher and shorter than the charge bellow, dropping into a grunt
        this.tone({ t, type: 'sawtooth', f0: 220, f1: 330, glide: 0.08, gain: 0.9, attack: 0.01, hold: 0.12, decay: 0.28, vibrato: { rate: 22, depth: 30 }, lowpass: 1800, out: bus });
        this.tone({ t: t + 0.05, type: 'sawtooth', f0: 330, f1: 120, glide: 0.35, gain: 0.6, attack: 0.01, decay: 0.4, vibrato: { rate: 16, depth: 20 }, lowpass: 1000, out: bus });
        this.tone({ t: t + 0.32, type: 'sawtooth', f0: 64, f1: 46, glide: 0.25, gain: 0.5, attack: 0.03, hold: 0.1, decay: 0.25, lowpass: 320, out: bus });
        this.burst({ t, type: 'bandpass', freq: 1100, q: 0.6, gain: 0.4, attack: 0.01, hold: 0.15, decay: 0.3, out: bus });
        break;
      }
      default: break; // every AnimalSound has a case above
    }
  }

  // ─────────────── gulls ───────────────
  /** a gull: a short two-note squawk — a nasal sawtooth "kyow" that breaks up, then a lower "ow"; sometimes a third yelp */
  gullCall(pan = 0, gain = 1): void {
    if (!this.g || this.shot('gull', { pan, gain, out: this.ambient })) return;
    const c = this.ctx, t = c.currentTime;
    const bus = c.createGain(); bus.gain.value = 0.28 * gain;
    const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1900; bp.Q.value = 0.7;
    bus.connect(bp); this.route(bp, pan, this.ambient);
    const base = rnd(1050, 1350);
    // note 1: rises fast then bends down, wide fast vibrato (the rasp)
    this.tone({ t, type: 'sawtooth', f0: base * 0.85, f1: base * 1.25, glide: 0.06, gain: 1, attack: 0.015, hold: 0.05, decay: 0.09, vibrato: { rate: 42, depth: 90 }, lowpass: 4200, out: bus });
    this.tone({ t: t + 0.06, type: 'sawtooth', f0: base * 1.25, f1: base * 0.9, glide: 0.12, gain: 0.7, attack: 0.005, decay: 0.12, vibrato: { rate: 42, depth: 90 }, lowpass: 3600, out: bus });
    this.burst({ t, type: 'bandpass', freq: base * 2, q: 2, gain: 0.25, attack: 0.02, hold: 0.06, decay: 0.1, out: bus });
    // note 2: lower, shorter
    const t2 = t + rnd(0.2, 0.27);
    this.tone({ t: t2, type: 'sawtooth', f0: base * 0.95, f1: base * 0.62, glide: 0.16, gain: 0.8, attack: 0.012, hold: 0.03, decay: 0.15, vibrato: { rate: 36, depth: 70 }, lowpass: 3200, out: bus });
    this.burst({ t: t2, type: 'bandpass', freq: base * 1.6, q: 2, gain: 0.18, attack: 0.02, decay: 0.12, out: bus });
    if (Math.random() < 0.35) {
      const t3 = t2 + rnd(0.2, 0.28);
      this.tone({ t: t3, type: 'sawtooth', f0: base * 0.8, f1: base * 0.55, glide: 0.14, gain: 0.55, attack: 0.012, decay: 0.14, vibrato: { rate: 30, depth: 60 }, lowpass: 2800, out: bus });
    }
  }

  /** gullCall positioned like `animal()`: distance attenuation + a stereo pan from the listener yaw */
  gullCallAt(position: Vector3, listenerPos: Vector3, yaw = this.listenerYaw): void {
    if (!this.g) return;
    const dx = position.x - listenerPos.x, dz = position.z - listenerPos.z, dy = position.y - listenerPos.y;
    const dist = Math.sqrt(dx * dx + dz * dz + dy * dy);
    if (dist > 160) return;
    const att = 1 / (1 + dist / 14) ** 1.3;
    const rx = Math.cos(yaw), rz = -Math.sin(yaw);
    const pan = dist > 0.5 ? Math.max(-1, Math.min(1, (dx * rx + dz * rz) / dist)) * 0.8 : 0;
    this.gullCall(pan, att);
  }

  // ─────────────── ambient loop ───────────────
  private startAmbient() { this.startBed(); }

  private stopBed() {
    clearTimeout(this.birdTimer); clearTimeout(this.gustTimer); clearTimeout(this.surfTimer);
    const t = this.ctx.currentTime;
    for (const n of this.bedNodes) {
      if (n instanceof GainNode) { n.gain.cancelScheduledValues(t); n.gain.setTargetAtTime(0, t, 0.6); }
      if (n instanceof AudioScheduledSourceNode) n.stop(t + 3);
    }
    this.bedNodes = [];
    this.windGain = this.windGain2 = undefined;
  }

  private startBed() {
    const l = this.loops.get(this.bed);
    this.sampleBed = l !== undefined;
    if (l) this.startSampleBed(l);
    else if (this.bed === 'island') { if (!this.zoned) this.startIsland(); } else this.startForest();
  }
  /** sfx.json's bed for this shard: one looping source faded in over 2 s (replaces the synth winds, birds, gusts and surf) */
  private startSampleBed(l: SampleLoop) {
    const c = this.ctx, t = c.currentTime, g = c.createGain();
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(l.gain, t + 2);
    const s = this.loopSource(l); s.connect(g).connect(this.ambient);
    this.bedNodes.push(g, s);
  }

  /** a looping noise band: bandpass + lowpass, slow amplitude and filter LFOs, panned into the ambient bus */
  private mkWind(freq: number, q: number, pan: number, lfoRate: number, base: number, lowpass = 1200) {
    const c = this.ctx;
    const src = c.createBufferSource(); src.buffer = this.noise; src.loop = true; src.start(0, Math.random());
    const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = q;
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = lowpass;
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
    this.bedNodes.push(g, src, lfo, lfo2);
    return g;
  }

  /** the island: a warm low breeze, a wide surf hiss bed, and a slow swell rolling up the beach every 6–9 s */
  private startIsland() {
    this.windGain = this.mkWind(180, 0.4, -0.3, 0.05, 0.05, 900);   // a lighter, warmer breeze than the pines
    this.windGain2 = this.mkWind(420, 0.6, 0.3, 0.08, 0.03, 1100);
    this.mkWind(1500, 0.35, 0.0, 0.03, 0.02, 5000);                  // the constant far surf hiss
    this.scheduleGust(1.4);
    this.scheduleSurf();
  }

  /** the pines: the original three wind bands, the tree hiss, gusts and distant birds */
  private startForest() {
    this.windGain = this.mkWind(260, 0.5, -0.55, 0.07, 0.11);
    this.windGain2 = this.mkWind(620, 0.8, 0.55, 0.11, 0.06);
    this.mkWind(140, 0.4, 0.0, 0.05, 0.09);
    // tree hiss (very quiet high band)
    this.mkWind(2400, 0.5, 0.2, 0.09, 0.012);
    this.scheduleGust();
    this.scheduleBird();
  }

  private scheduleSurf() {
    const wait = rnd(6, 9);
    this.surfTimer = window.setTimeout(() => {
      if (this.ambientOn) this.surfSwell();
      this.scheduleSurf();
    }, wait * 1000);
  }

  /** one wave: a low rumble building over ~2 s, the break (a wide bright hiss), then the wash sliding back down the sand */
  private surfSwell() {
    const c = this.ctx, t = c.currentTime;
    const pan = rnd(-0.35, 0.35), size = rnd(0.7, 1.15);
    const bus = c.createGain(); bus.gain.value = 0.42 * size;
    this.route(bus, pan, this.ambient);
    const build = rnd(1.6, 2.4), wash = rnd(2.6, 4.0);
    // the build: low noise rising in pitch and level
    this.burst({ t, type: 'lowpass', freq: 240, freqEnd: 700, gain: 0.5, attack: build, decay: 1.2, hold: 0.2, out: bus });
    // the break: wide, bright, a fast swell then the long wash tail that darkens as it drains
    this.burst({ t: t + build * 0.75, type: 'bandpass', freq: 1800, freqEnd: 500, q: 0.4, gain: 0.55, attack: 0.5, hold: 0.4, decay: wash, out: bus });
    this.burst({ t: t + build * 0.85, type: 'highpass', freq: 2600, gain: 0.16, attack: 0.35, hold: 0.3, decay: wash * 0.6, out: bus });
    // the foam fizz on the sand at the end
    this.burst({ t: t + build + 1.2, type: 'bandpass', freq: 4200, q: 0.6, gain: 0.08, attack: 0.6, decay: wash * 0.7, out: bus });
  }
  private scheduleGust(gentle = 1) {
    const wait = rnd(5, 12) * gentle;
    this.gustTimer = window.setTimeout(() => {
      if (this.ambientOn && this.windGain && this.windGain2) {
        const t = this.ctx.currentTime, rise = rnd(1.5, 3), fall = rnd(2, 4), amt = 1 + rnd(0.5, 1.6) / gentle;
        for (const g of [this.windGain, this.windGain2]) {
          const base = this.bed === 'island' ? (g === this.windGain ? 0.05 : 0.03) : (g === this.windGain ? 0.11 : 0.06);
          g.gain.cancelScheduledValues(t);
          g.gain.setValueAtTime(g.gain.value, t);
          g.gain.linearRampToValueAtTime(base * amt, t + rise);
          g.gain.linearRampToValueAtTime(base, t + rise + fall);
        }
      }
      this.scheduleGust(gentle);
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

  dispose(): void { clearTimeout(this.birdTimer); clearTimeout(this.surfTimer); clearTimeout(this.gustTimer); clearTimeout(this.bubbleTimer); if (this.g) void this.g.ctx.close(); }
}

export { Audio as GameAudio };
