/**
 * IslandAmbience — Driftwood Isle's zoned soundscape (S1) and reverb zones + underwater (S2), docs/plans/DRIFTWOOD-REMASTER.md.
 *
 *   const amb = new IslandAmbience(audio, { sea: OCEAN.level, heightAt, palms: palmSpecs, wreck, cove });
 *   game.onUpdate((dt) => amb.update(dt, game.camera));   // listener + the surf emitter every frame, the zone mix at 10 Hz
 *   amb.setUnderwater(true | false)                       // Player.onSubmerge / onSurface (next to audio.setUnderwater)
 *   amb.night = 0 … 1                                     // the day / night clock (src/world/DayNight.ts, when it lands)
 *   amb.onZone = (zone) => …                              // the dominant zone changed ('sea' | 'beach' | 'palms' | 'jungle' |
 *                                                         //   'cove' | 'lookout' | 'hold' | 'cave' | 'shrine') — a hook for the music (E5)
 *   amb.diag                                              // the live mix: every bed's level and every reverb send (logging / tests)
 *
 * The beds (all built once, on the first update after the first gesture; nothing is created per frame):
 * - **surf** on a *line emitter*: the island's shoreline, found once by marching 256 rays in from the sea until the terrain
 *   breaks the surface, and every frame one PannerNode is moved to the nearest point of that polyline. Swells roll in on
 *   their own timer (a build, the break, the wash draining back), softer at night. Over the water (a pier, the shallows)
 *   a lapping bed joins it.
 * - **breeze** everywhere, rising with height; **high wind** on the lookout (a whistle through the frame, the pennant flapping).
 * - **palm rustle**: leaf flutter whose level follows the palms within 22 m of you (panned toward them) times the wind
 *   (TreeFactory `windUniforms.uWindStrength`, the uniform the sway shares, with the same slow gust the fronds swing on).
 * - **jungle** around the shrine: an insect drone pulsing in two bands, exotic bird calls; at night crickets instead.
 * - **cove**: the waterfall on its own PannerNode at the plunge pool (rumble + body + splash), drips in the sea cave.
 * - **underwater**: a bubble bed; the master low-pass (Audio.setUnderwater) ramps to 500 Hz over 150 ms on this shard.
 * Everything crossfades by position with 300 ms time constants; walls muffle the outdoor beds (hold / cave occlusion).
 *
 * Reverb (S2): ConvolverNodes with generated IRs (gen.ts: hold 0.6 s, cave 1.5 s, shrine 2.5 s), fed from the sfx bus
 * (footsteps, combat, vocals) through a send per room whose level follows how far inside that room you are (300 ms
 * crossfades); the returns go to `audio.world`. A room's convolver is only built the first time you get near it, and an
 * idle send is at gain 0 (the browser stops processing a convolver whose input is silent past its tail).
 */
import type { Camera } from 'three';
import type { Audio } from './Audio';
import { windUniforms } from '../world/TreeFactory';
import { ISLAND, SHRINE, LOOKOUT, HEADLAND } from '../chunks/driftwood-isle';

export type Zone = 'sea' | 'beach' | 'palms' | 'jungle' | 'cove' | 'lookout' | 'hold' | 'cave' | 'shrine';
type Room = 'hold' | 'cave' | 'shrine';
export interface Bounds { x: number; z: number; r: number; yMin: number; yMax: number }

export interface IslandAmbienceOpts {
  sea: number;
  heightAt: (x: number, z: number) => number;
  /** the palms' trunks (Palms.scatterIsland specs) */
  palms?: readonly { x: number; z: number }[];
  /** the wreck: its `holdBounds` when the model has one (the hold reverb), else the hull footprint below the deck */
  wreck?: object | null;
  /** the cove's layout (Cove.forIsland()): the waterfall's foot and the sea-cave mouth */
  cove?: { fall: { foot: [number, number] }; cave: { x: number; z: number; yaw: number; depth: number } } | null;
}

const ss = (a: number, b: number, x: number): number => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const TAU = 0.1;           // setTargetAtTime constant: ~300 ms to 95 %
const ZONE_HZ = 10;
/** wet level per room at full weight (the IR is unit-energy: 0.35 ≈ −9 dB) */
const WET: Record<Room, number> = { hold: 0.45, cave: 0.55, shrine: 0.3 };
const SHORE_RAYS = 256;

/** a Bounds-shaped `holdBounds` / `caveBounds` on a module, if it has one (duck-typed: works before and after the model lands it) */
function boundsOf(o: object | null | undefined, key: string): Bounds | undefined {
  if (!o || !(key in o)) return undefined;
  const v: unknown = Reflect.get(o, key);
  if (typeof v !== 'object' || v === null) return undefined;
  const n = (k: string): number => { const x: unknown = Reflect.get(v, k); return typeof x === 'number' ? x : Number.NaN; };
  const b = { x: n('x'), z: n('z'), r: n('r'), yMin: n('yMin'), yMax: n('yMax') };
  return Number.isFinite(b.x + b.z + b.r + b.yMin + b.yMax) && b.r > 0 ? b : undefined;
}

interface Bed { gain: GainNode; level: number }

export class IslandAmbience {
  /** 0 = day … 1 = night (the clock drives it) */
  night = 0;
  onZone?: (zone: Zone) => void;
  zone: Zone = 'beach';
  /** the live mix, refreshed at 10 Hz (no allocation: the same object) */
  readonly diag = {
    surf: 0, shoreDist: 0, lap: 0, breeze: 0, palms: 0, wind: 0, jungle: 0, night: 0, cove: 0, waterfall: 0, lookout: 0,
    occlusion: 0, hold: 0, cave: 0, shrine: 0, underwater: 0,
  };

  private built = false; private warming = false;
  private poolW: AudioBufferSourceNode[] = []; private poolP: AudioBufferSourceNode[] = []; private poolN = 0;
  private shore = new Float32Array(SHORE_RAYS * 2);
  private surfPan: PannerNode | undefined; private fallPan: PannerNode | undefined;
  private beds = new Map<string, Bed>();
  private occl: BiquadFilterNode | undefined;
  private sendIn: GainNode | undefined;
  private sends = new Map<Room, GainNode>();
  private flutterPan: StereoPannerNode | undefined;
  private tick = 0; private t = 0;
  private underwater = false;
  private timers: number[] = [];
  private px = 0; private py = 0; private pz = 0;
  private fall = { x: 127.5, y: 0, z: 18 };
  private cave = { x: 120, z: 19 };

  constructor(private readonly audio: Audio, private readonly o: IslandAmbienceOpts) {
    const f = o.cove?.fall.foot, c = o.cove?.cave;
    if (f) { this.fall.x = f[0]; this.fall.z = f[1]; }
    this.fall.y = o.heightAt(this.fall.x, this.fall.z) + 1;
    // the cave's interior: `depth / 2` in from the mouth along its facing
    if (c) { this.cave.x = c.x - Math.sin(c.yaw) * c.depth * 0.5; this.cave.z = c.z - Math.cos(c.yaw) * c.depth * 0.5; }
    this.traceShore();
  }

  /** the shoreline: 256 rays from the island centre, each marched in from 330 m until the ground breaks the sea, refined to 0.25 m */
  private traceShore(): void {
    const { heightAt: H, sea } = this.o;
    for (let i = 0; i < SHORE_RAYS; i++) {
      const a = (i / SHORE_RAYS) * Math.PI * 2, cx = Math.cos(a), cz = Math.sin(a);
      let r = 330, hit = -1;
      for (; r > 2; r -= 2) if (H(ISLAND.x + cx * r, ISLAND.z + cz * r) > sea) { hit = r; break; }
      if (hit > 0) { let lo = hit, hi = hit + 2; for (let k = 0; k < 3; k++) { const m = (lo + hi) / 2; if (H(ISLAND.x + cx * m, ISLAND.z + cz * m) > sea) lo = m; else hi = m; } r = lo; }
      else r = ISLAND.r;
      this.shore[i * 2] = ISLAND.x + cx * r; this.shore[i * 2 + 1] = ISLAND.z + cz * r;
    }
  }

  /** the nearest point on the closed shoreline polyline to (x, z) → written into out[0..1]; returns the distance */
  private nearestShore(x: number, z: number, out: Float32Array): number {
    const s = this.shore; let best = Infinity;
    for (let i = 0; i < SHORE_RAYS; i++) {
      const j = (i + 1) % SHORE_RAYS;
      const ax = s[i * 2] ?? 0, az = s[i * 2 + 1] ?? 0, bx = s[j * 2] ?? 0, bz = s[j * 2 + 1] ?? 0;
      const ex = bx - ax, ez = bz - az, l2 = ex * ex + ez * ez;
      const u = l2 > 0 ? Math.max(0, Math.min(1, ((x - ax) * ex + (z - az) * ez) / l2)) : 0;
      const qx = ax + ex * u, qz = az + ez * u, d = (x - qx) ** 2 + (z - qz) ** 2;
      if (d < best) { best = d; out[0] = qx; out[1] = qz; }
    }
    return Math.sqrt(best);
  }
  private readonly _q = new Float32Array(2);

  // ─────────────── build ───────────────
  /** a looping noise source from a small pool (two white, two pink — each fans out to several beds' filters) */
  private src(name: 'noise-white' | 'noise-pink'): AudioBufferSourceNode | undefined {
    const list = name === 'noise-white' ? this.poolW : this.poolP;
    this.poolN++;
    if (list.length >= 2) return list[this.poolN % 2];
    const buf = this.audio.voices.buffer(name); if (!buf) return undefined;
    const c = this.audio.ctx, s = c.createBufferSource(); s.buffer = buf; s.loop = true; s.playbackRate.value = 0.97 + Math.random() * 0.06;
    s.start(c.currentTime, Math.random() * buf.duration);
    list.push(s);
    return s;
  }
  private filter(type: BiquadFilterType, f: number, q = 0.7): BiquadFilterNode {
    const b = this.audio.ctx.createBiquadFilter(); b.type = type; b.frequency.value = f; b.Q.value = q; return b;
  }
  private bed(name: string, out: AudioNode): GainNode {
    const g = this.audio.ctx.createGain(); g.gain.value = 0; g.connect(out);
    this.beds.set(name, { gain: g, level: 0 });
    return g;
  }
  private lfo(rate: number, depth: number, param: AudioParam, type: OscillatorType = 'sine'): OscillatorNode {
    const c = this.audio.ctx, o = c.createOscillator(); o.type = type; o.frequency.value = rate;
    const g = c.createGain(); g.gain.value = depth; o.connect(g).connect(param); o.start();
    return o;
  }
  private panner(ref: number, rolloff: number, max: number): PannerNode {
    const p = this.audio.ctx.createPanner();
    p.panningModel = 'equalpower'; p.distanceModel = 'inverse'; p.refDistance = ref; p.rolloffFactor = rolloff; p.maxDistance = max;
    return p;
  }

  private build(): void {
    this.built = true;
    const a = this.audio, c = a.ctx;
    a.useZonedAmbience();
    a.underwaterCutoff = 500; a.underwaterRamp = 0.15;
    a.voices.prewarm(['bubble-bed', 'ir-shrine', 'ir-cave', 'ir-hold']);
    // outdoor beds → occlusion low-pass (walls of the hold / cave) → the ambient bus
    const occl = this.filter('lowpass', 20000, 0.5); occl.connect(a.ambient); this.occl = occl;
    const W = () => this.src('noise-white'), P = () => this.src('noise-pink');

    // ── surf: one emitter on the shoreline (body + hiss share the panner), swells scheduled on its own timer ──
    const surfPan = this.panner(12, 1, 400); surfPan.connect(occl); this.surfPan = surfPan;
    const surf = this.bed('surf', surfPan);
    const body = this.bed('surfBody', surf), hiss = this.bed('surfHiss', surf);
    body.gain.value = 0.35; hiss.gain.value = 0.12;
    P()?.connect(this.filter('lowpass', 700, 0.6)).connect(body);
    W()?.connect(this.filter('bandpass', 2400, 0.5)).connect(hiss);
    this.scheduleSwell();
    // lapping under a pier / in the shallows: pink through a low band-pass, a slow irregular slosh
    const lap = this.bed('lap', occl), lapAm = c.createGain(); lapAm.gain.value = 0.6; lapAm.connect(lap);
    P()?.connect(this.filter('bandpass', 520, 1.2)).connect(lapAm);
    this.lfo(0.55, 0.35, lapAm.gain); this.lfo(0.83, 0.2, lapAm.gain);

    // ── breeze (everywhere, more with height) ──
    const breeze = this.bed('breeze', occl);
    P()?.connect(this.filter('bandpass', 260, 0.5)).connect(this.filter('lowpass', 900)).connect(breeze);
    // ── palm rustle: bright leaf noise through a flutter (a gain driven by low-passed noise), panned toward the palms ──
    const palms = this.bed('palms', occl), flutter = c.createGain(); flutter.gain.value = 0.55;
    const fp = c.createStereoPanner(); this.flutterPan = fp; flutter.connect(fp).connect(palms);
    W()?.connect(this.filter('highpass', 2200)).connect(this.filter('bandpass', 5200, 0.6)).connect(flutter);
    { const n = W(); if (n) { const d = c.createGain(); d.gain.value = 3.5; n.connect(this.filter('lowpass', 9, 0.7)).connect(d).connect(flutter.gain); } }
    // ── lookout high wind: a hollow roar, a whistle wandering through the frame, the pennant flapping ──
    const high = this.bed('lookout', occl);
    P()?.connect(this.filter('bandpass', 480, 0.7)).connect(this.filter('lowpass', 2000)).connect(high);
    { const wh = this.filter('bandpass', 1150, 14), g = c.createGain(); g.gain.value = 0.5; W()?.connect(wh).connect(g).connect(high); this.lfo(0.13, 220, wh.frequency); this.lfo(0.31, 0.35, g.gain); }
    { const fl = c.createGain(); fl.gain.value = 0.25; W()?.connect(this.filter('bandpass', 900, 1)).connect(fl).connect(high); this.lfo(7.3, 0.25, fl.gain, 'square'); }

    // ── jungle: two pulsing insect bands (day), crickets (night), a humid low bed; birds on a timer ──
    const jungle = this.bed('jungle', occl);
    const day = this.bed('jungleDay', jungle), nite = this.bed('jungleNight', jungle);
    for (const [f, q, am, lvl] of [[4700, 7, 38, 0.5], [6600, 9, 53, 0.3]] as const) {
      const g = c.createGain(); g.gain.value = lvl; W()?.connect(this.filter('bandpass', f, q)).connect(g).connect(day);
      this.lfo(am, lvl * 0.9, g.gain); this.lfo(0.05 + f * 0.00001, lvl * 0.5, g.gain);
    }
    { const g = c.createGain(); g.gain.value = 0.4; P()?.connect(this.filter('lowpass', 320)).connect(g).connect(jungle); }
    // crickets: a 4.4 kHz tone chopped at 32 Hz into chirps, gated in trills at ~1.7 Hz; a second one detuned and slower
    for (const [f, trill, lvl] of [[4400, 1.7, 0.16], [4900, 1.1, 0.1]] as const) {
      const o = c.createOscillator(); o.frequency.value = f; o.start();
      const chop = c.createGain(); chop.gain.value = 0.5; const gate = c.createGain(); gate.gain.value = 0.5;
      const g = c.createGain(); g.gain.value = lvl;
      o.connect(chop).connect(gate).connect(g).connect(nite);
      this.lfo(32, 0.5, chop.gain, 'square'); this.lfo(trill, 0.5, gate.gain, 'square');
    }
    this.scheduleBird();

    // ── cove: the waterfall on its own panner (not occluded: you hear it from inside the cave), drips in the cave ──
    const fallPan = this.panner(6, 1.1, 250); fallPan.positionX.value = this.fall.x; fallPan.positionY.value = this.fall.y; fallPan.positionZ.value = this.fall.z;
    fallPan.connect(a.ambient); this.fallPan = fallPan;
    const fall = this.bed('waterfall', fallPan);
    P()?.connect(this.filter('lowpass', 2400)).connect(this.filter('highpass', 140)).connect(fall);
    { const g = c.createGain(); g.gain.value = 0.9; P()?.connect(this.filter('lowpass', 110, 0.9)).connect(g).connect(fall); }
    { const g = c.createGain(); g.gain.value = 0.35; W()?.connect(this.filter('bandpass', 3200, 0.7)).connect(g).connect(fall); const n = W(); if (n) { const d = c.createGain(); d.gain.value = 0.3; n.connect(this.filter('lowpass', 14)).connect(d).connect(g.gain); } }
    const cove = this.bed('cove', a.ambient);
    { const g = c.createGain(); g.gain.value = 0.5; P()?.connect(this.filter('bandpass', 700, 0.8)).connect(g).connect(cove); this.lfo(0.21, 0.25, g.gain); }
    this.scheduleDrip();

    // ── underwater: the bubble bed ──
    const uw = this.bed('underwater', a.ambient);
    { const b = a.voices.buffer('bubble-bed'); if (b) { const s = c.createBufferSource(); s.buffer = b; s.loop = true; s.start(c.currentTime, Math.random() * b.duration); s.connect(uw); } }

    // ── reverb sends: tap the sfx bus once; a send + convolver per room is built on first approach ──
    const sendIn = c.createGain(); sendIn.gain.value = 1; a.sfx.connect(sendIn); this.sendIn = sendIn;
  }

  /** the room's send (and convolver), built the first time it is needed */
  private send(room: Room): GainNode | undefined {
    const have = this.sends.get(room); if (have) return have;
    const a = this.audio, ir = a.voices.buffer(`ir-${room}`);
    if (!ir || !this.sendIn) return undefined;
    const c = a.ctx, g = c.createGain(); g.gain.value = 0;
    const conv = c.createConvolver(); conv.normalize = false; conv.buffer = ir;
    this.sendIn.connect(g).connect(conv).connect(a.world);
    if (room === 'cave' && this.fallPan) this.fallPan.connect(g); // the waterfall booms in the cave
    this.sends.set(room, g);
    return g;
  }

  // ─────────────── timers (not per frame) ───────────────
  private later(sec: number, fn: () => void): void { this.timers.push(window.setTimeout(fn, sec * 1000)); if (this.timers.length > 16) this.timers.shift(); }
  /** one swell on the surf emitter: a build, the break, the wash (automation only — the sources run continuously) */
  private scheduleSwell(): void {
    this.later(4 + Math.random() * 5 * (1 + this.night * 0.4), () => {
      const body = this.beds.get('surfBody'), hiss = this.beds.get('surfHiss');
      if (body && hiss) {
        const t = this.audio.ctx.currentTime, size = (0.7 + Math.random() * 0.5) * (1 - 0.35 * this.night);
        const build = 1.4 + Math.random() * 0.9, wash = 2.4 + Math.random() * 1.6;
        for (const [g, base, peak] of [[body.gain.gain, 0.35, 1.0], [hiss.gain.gain, 0.12, 0.75]] as const) {
          g.cancelScheduledValues(t); g.setValueAtTime(g.value, t);
          g.linearRampToValueAtTime(base + (peak - base) * size * 0.45, t + build * 0.8);
          g.linearRampToValueAtTime(base + (peak - base) * size, t + build);
          g.setTargetAtTime(base, t + build + 0.3, wash / 3);
        }
      }
      this.scheduleSwell();
    });
  }
  private scheduleBird(): void {
    this.later(2.5 + Math.random() * 6, () => {
      const j = this.beds.get('jungle')?.level ?? 0;
      if (j > 0.05 && this.night < 0.6 && !this.underwater) this.bird(j);
      this.scheduleBird();
    });
  }
  /** an exotic jungle call from a random side: a hollow two-note "toucan" croak, or a falling whistle phrase */
  private bird(level: number): void {
    const a = this.audio, c = a.ctx, t = c.currentTime, jb = this.beds.get('jungle'); if (!jb) return;
    const pan = c.createStereoPanner(); pan.pan.value = Math.random() * 1.6 - 0.8;
    const out = c.createGain(); out.gain.value = 0.35 * (0.5 + Math.random() * 0.5); out.connect(pan).connect(jb.gain);
    const note = (t0: number, f0: number, f1: number, dur: number, type: OscillatorType, g: number, lp: number): void => {
      const o = c.createOscillator(); o.type = type; o.frequency.setValueAtTime(f0, t0); o.frequency.exponentialRampToValueAtTime(f1, t0 + dur);
      const e = c.createGain(); e.gain.setValueAtTime(0.0001, t0); e.gain.exponentialRampToValueAtTime(g, t0 + 0.02); e.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = lp;
      o.connect(f).connect(e).connect(out); o.start(t0); o.stop(t0 + dur + 0.05);
    };
    if (Math.random() < 0.45) { const b = 380 + Math.random() * 120; for (let k = 0; k < 2 + Math.floor(Math.random() * 3); k++) note(t + k * 0.22, b, b * 0.8, 0.14, 'sawtooth', 0.5, 1400); }
    else { let f = 2200 + Math.random() * 900; for (let k = 0; k < 3 + Math.floor(Math.random() * 3); k++) { note(t + k * 0.16, f, f * 0.86, 0.12, 'sine', 0.6, 8000); f *= 0.9; } }
    void level;
  }
  /** a drip in the sea cave: a high plink with a little pitch drop, into the cave reverb */
  private scheduleDrip(): void {
    this.later(0.7 + Math.random() * 2.2, () => {
      const cave = this.diag.cave;
      if (cave > 0.05 && !this.underwater) {
        const c = this.audio.ctx, t = c.currentTime, f = 1300 + Math.random() * 1400;
        const o = c.createOscillator(); o.frequency.setValueAtTime(f, t); o.frequency.exponentialRampToValueAtTime(f * 0.7, t + 0.05);
        const e = c.createGain(); e.gain.setValueAtTime(0.0001, t); e.gain.exponentialRampToValueAtTime(0.12 * cave, t + 0.003); e.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);
        o.connect(e).connect(this.audio.sfx); o.start(t); o.stop(t + 0.12); // on the sfx bus: it rings in the cave reverb
      }
      this.scheduleDrip();
    });
  }

  // ─────────────── per frame ───────────────
  update(dt: number, camera: Camera): void {
    const a = this.audio;
    if (!a.ready) return;
    if (!this.built) {
      // the raw material renders in the background first (a few ms a slice), then the graph is built in one go
      if (!this.warming) { this.warming = true; a.voices.prewarm(['noise-pink', 'noise-white', 'bubble-bed']); }
      if (!a.voices.has('noise-pink') || !a.voices.has('noise-white') || !a.voices.has('bubble-bed')) return;
      this.build();
    }
    this.t += dt;
    const m = camera.matrixWorld.elements;
    const x = m[12], y = m[13], z = m[14];
    this.px = x; this.py = y; this.pz = z;
    const l = a.ctx.listener;
    l.positionX.value = x; l.positionY.value = y; l.positionZ.value = z;
    l.forwardX.value = -m[8]; l.forwardY.value = -m[9]; l.forwardZ.value = -m[10];
    l.upX.value = m[4]; l.upY.value = m[5]; l.upZ.value = m[6];
    a.voices.setListener(x, y, z, Math.atan2(m[8], m[10])); // Player.yaw's convention: forward = (−sin, −cos)
    // the surf emitter: the nearest shore point, at the water line
    const d = this.nearestShore(x, z, this._q);
    if (this.surfPan) { this.surfPan.positionX.value = this._q[0] ?? 0; this.surfPan.positionY.value = this.o.sea; this.surfPan.positionZ.value = this._q[1] ?? 0; }
    this.diag.shoreDist = d;
    this.tick += dt;
    if (this.tick >= 1 / ZONE_HZ) { this.tick = 0; this.mix(); }
  }

  /** the zone weights → every bed's target level and every reverb send (10 Hz, 300 ms crossfades) */
  private mix(): void {
    const a = this.audio, t = a.ctx.currentTime, x = this.px, y = this.py, z = this.pz, D = this.diag, o = this.o;
    const ground = o.heightAt(x, z), above = y - 1.68 - Math.max(ground, o.sea); // feet above the ground / the water
    const uw = this.underwater ? 1 : 0, dry = 1 - uw, night = Math.max(0, Math.min(1, this.night));
    // rooms: the hold (the model's bounds, else the hull below the deck), the sea cave, the shrine court
    const hb = boundsOf(o.wreck, 'holdBounds');
    const hold = hb ? ss(hb.r + 1.5, hb.r - 1, Math.hypot(x - hb.x, z - hb.z)) * (y > hb.yMin && y < hb.yMax + 1.68 ? 1 : 0) : 0; // no enterable hold yet: no hold room
    const cb = boundsOf(o.cove, 'caveBounds');
    const cave = cb ? ss(cb.r + 1.5, cb.r - 1, Math.hypot(x - cb.x, z - cb.z)) : ss(3.2, 1.2, Math.hypot(x - this.cave.x, z - this.cave.z)); // today's cave is a 3.4 m niche
    const shrineD = Math.hypot(x - SHRINE.x, z - SHRINE.z), shrine = ss(16, 8, shrineD);
    const occl = Math.max(hold, cave * 0.85);
    // outdoor zones
    const jungle = ss(62, 26, shrineD), coveW = ss(48, 22, Math.hypot(x - 136, z - 8));
    const lookout = ss(12, 24, y - o.sea) * ss(40, 18, Math.hypot(x - LOOKOUT.x, z - LOOKOUT.z)) + ss(18, 30, y - o.sea) * ss(70, 40, Math.hypot(x - HEADLAND.x, z - HEADLAND.z)) * 0.5;
    // palms within 22 m, weighted by nearness, and which side they are on
    let pd = 0, pdx = 0, pdz = 0;
    if (o.palms) for (const p of o.palms) { const dx = p.x - x, dz = p.z - z, dd = dx * dx + dz * dz; if (dd < 484) { const w = 1 - Math.sqrt(dd) / 22; pd += w; pdx += dx * w; pdz += dz * w; } }
    const palms = Math.min(1, pd / 2.5);
    // the wind the palms sway in: the shared strength × the fronds' slow gust (Palms.ts: sin(1.3 t)·0.6 + sin(2.9 t)·0.25)
    const wt = windUniforms.uTime.value || this.t, gust = 0.65 + 0.35 * Math.abs(Math.sin(wt * 0.13) * 0.7 + Math.sin(wt * 0.29 + 1.3) * 0.3);
    const wind = windUniforms.uWindStrength.value * gust;
    // over the water: a pier deck or the shallows
    const lap = ground < o.sea + 0.1 ? 1 - ss(6, 14, y - o.sea) : 0;
    // surf: louder near the water, softer at night; the panner does the distance (1 / d past 12 m)
    const surf = (0.85 - 0.3 * night) * (1 - 0.6 * occl);
    const breeze = (0.07 + 0.1 * ss(4, 25, above + ground - o.sea)) * wind * (1 - 0.8 * occl);
    const set = (name: string, v: number): void => { const b = this.beds.get(name); if (!b) return; b.level = v; b.gain.gain.setTargetAtTime(v, t, TAU); };
    set('surf', surf * dry); set('lap', 0.22 * lap * dry); set('breeze', breeze * dry);
    set('palms', 0.2 * palms * wind * (1 - 0.5 * night) * dry);
    set('lookout', 0.22 * Math.min(1, lookout) * wind * dry);
    set('jungle', 0.14 * jungle * dry); set('jungleDay', 1 - night); set('jungleNight', 0.25 + 0.75 * night);
    set('waterfall', 0.45 * dry); set('cove', 0.1 * coveW * dry); set('underwater', 0.5 * uw);
    if (this.flutterPan && pd > 0) { const rx = this.rightX(), rz = this.rightZ(); this.flutterPan.pan.setTargetAtTime(Math.max(-0.7, Math.min(0.7, (pdx * rx + pdz * rz) / (Math.hypot(pdx, pdz) + 1e-3) * 0.7)), t, 0.2); }
    this.occl?.frequency.setTargetAtTime(20000 * (1 - occl) + 700 * occl, t, TAU);
    // reverb sends
    for (const [room, w] of [['hold', hold], ['cave', cave], ['shrine', shrine]] as const) {
      const g = w > 0.001 ? this.send(room) : this.sends.get(room);
      g?.gain.setTargetAtTime(WET[room] * w * dry, t, TAU);
    }
    D.surf = surf * dry; D.lap = lap; D.breeze = breeze; D.palms = palms; D.wind = wind; D.jungle = jungle; D.night = night; D.cove = coveW;
    D.waterfall = Math.hypot(x - this.fall.x, z - this.fall.z); D.lookout = Math.min(1, lookout); D.occlusion = occl; D.hold = hold; D.cave = cave; D.shrine = shrine; D.underwater = uw;
    // the dominant zone (a music hook)
    const zone: Zone = uw ? 'sea' : hold > 0.5 ? 'hold' : cave > 0.5 ? 'cave' : shrine > 0.5 ? 'shrine' : lookout > 0.5 ? 'lookout'
      : jungle > 0.5 ? 'jungle' : coveW > 0.5 ? 'cove' : ground < o.sea ? 'sea' : palms > 0.5 ? 'palms' : 'beach';
    if (zone !== this.zone) { this.zone = zone; this.onZone?.(zone); }
  }
  /** the listener's right vector on the ground: (−forward.z, forward.x) */
  private rightX(): number { return -this.audio.ctx.listener.forwardZ.value; }
  private rightZ(): number { return this.audio.ctx.listener.forwardX.value; }

  /** head under / over the surface (next to audio.setUnderwater): the outdoor beds and sends drop, the bubble bed rises */
  setUnderwater(on: boolean): void { this.underwater = on; if (this.built) this.mix(); }

  dispose(): void { for (const id of this.timers) clearTimeout(id); this.timers = []; }
}
