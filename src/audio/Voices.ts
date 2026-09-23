/**
 * Voices — the procedural sound bank (src/audio/gen.ts) as AudioBuffers, and a one-node-chain player for them.
 *
 *   audio.voices.prewarm(['step-sand', 'hurt', …])   // after the first gesture: one variant rendered per idle slice
 *   audio.voices.play('impact-shell', { at: pos, gain: 0.8, rate: 1.1 })   // a random variant, ±5 % pitch, placed in the world
 *   audio.voices.setListener(x, y, z, yaw)           // per frame (IslandAmbience does it) — for `at` plays
 *   audio.voices.buffer('ir-cave')                   // a stereo buffer (the ConvolverNodes take these)
 *
 * A family is rendered the first time it is asked for if prewarm has not reached it yet (a few ms on desktop). A play is
 * AudioBufferSourceNode → gain (→ distance low-pass → stereo panner when placed) → the sfx bus (or `out`). Nothing here
 * runs per frame; setListener only stores four numbers.
 */
import type { Vector3 } from 'three';
import { footstep, whoosh, impact, vocal, windup, hurt, death, plunge, bubbleBed, noiseLoop, impulseChannel, interact, STEP_KINDS, MATERIALS, ENEMIES, INTERACT_SOUNDS, type Room } from './gen';

interface Host { readonly ctx: AudioContext; readonly sfx: GainNode; readonly ready: boolean }
type Gen = (sr: number, seed: number) => Float32Array;
/** `half`: rendered at half the context rate (sounds with nothing above ~6 kHz — the long vocals, the bubble bed): half the
 *  render time and memory, and the source resamples on play (IRs must stay at the context rate: ConvolverNode requires it) */
interface Family { n: number; ch: 1 | 2; half?: boolean; gen: Gen | ((sr: number, seed: number, ch: number) => Float32Array) }

const fam = (n: number, gen: Gen, half = false): Family => ({ n, ch: 1, half, gen });
const room = (r: Room): Family => ({ n: 1, ch: 2, gen: (sr: number, seed: number, ch: number) => impulseChannel(r, sr, seed, ch) });

/** every family: the name the callers use → variant count + generator */
export const FAMILIES: Record<string, Family> = {
  ...Object.fromEntries(STEP_KINDS.map((k) => [`step-${k}`, fam(5, (sr, s) => footstep(k, sr, s))])),
  whoosh: fam(4, (sr, s) => whoosh(sr, s)),
  'whoosh-heavy': fam(3, (sr, s) => whoosh(sr, s, true)),
  ...Object.fromEntries(MATERIALS.map((m) => [`impact-${m}`, fam(4, (sr, s) => impact(m, sr, s))])),
  ...Object.fromEntries(ENEMIES.map((e) => [`vocal-${e}`, fam(3, (sr, s) => vocal(e, sr, s), e === 'sailor' || e === 'boar')])),
  'windup-boar': fam(2, (sr, s) => windup('boar', sr, s)),
  'windup-crab': fam(2, (sr, s) => windup('crab', sr, s)),
  'windup-sailor': fam(2, (sr, s) => windup('sailor', sr, s), true),
  hurt: fam(3, (sr, s) => hurt(sr, s), true),
  death: fam(2, (sr, s) => death(sr, s), true),
  'plunge-down': fam(2, (sr, s) => plunge(sr, s, false)),
  'plunge-up': fam(2, (sr, s) => plunge(sr, s, true)),
  'bubble-bed': fam(1, (sr, s) => bubbleBed(sr, s), true),
  'noise-white': fam(1, (sr, s) => noiseLoop(sr, s, false)),
  'noise-pink': fam(1, (sr, s) => noiseLoop(sr, s, true)),
  ...Object.fromEntries(INTERACT_SOUNDS.map((k) => [`ui-${k}`, fam(k === 'glyph' ? 1 : 2, (sr, s) => interact(k, sr, s))])),
  'ir-hold': room('hold'), 'ir-cave': room('cave'), 'ir-shrine': room('shrine'),
};
export type FamilyName = keyof typeof FAMILIES;

export interface PlayOpts {
  /** linear gain (default 1) */
  gain?: number;
  /** playback rate before the ±5 % jitter (default 1) — pitch and length together */
  rate?: number;
  /** stereo pan −1…1 for an unplaced play */
  pan?: number;
  /** sweep the pan from `pan` to this over the sound (a swing crossing the view) */
  panTo?: number;
  /** a world position: distance attenuation + low-pass + pan from the listener (setListener) */
  at?: Vector3 | { x: number; y: number; z: number } | undefined;
  /** where it goes (default the sfx bus) */
  out?: AudioNode;
  /** seconds from now */
  delay?: number;
  /** the pitch jitter (default 0.05 = ±5 %) */
  jitter?: number;
}

export class Voices {
  private bufs = new Map<string, (AudioBuffer | undefined)[]>();
  private warm: [string, number][] = [];
  private warming = false;
  private lx = 0; private ly = 0; private lz = 0; private yaw = 0;
  private last = new Map<string, number>();
  private done = new Set<string>();

  constructor(private readonly host: Host) {}

  setListener(x: number, y: number, z: number, yaw: number): void { this.lx = x; this.ly = y; this.lz = z; this.yaw = yaw; }

  /** render these families' variants in the background, one per idle slice, in the order given */
  prewarm(names: readonly string[]): void {
    if (!this.host.ready) return;
    for (const n of names) { const f = FAMILIES[n]; if (f) for (let v = 0; v < f.n; v++) for (let c = 0; c < f.ch; c++) this.warm.push([n, v * 2 + c]); }
    if (!this.warming) { this.warming = true; this.slice(); }
  }
  private slice(): void {
    const job = this.warm.shift();
    if (!job) { this.warming = false; return; }
    const [name, vc] = job;
    this.variant(name, vc >> 1, vc & 1);
    const w: { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number } = window;
    if (w.requestIdleCallback) w.requestIdleCallback(() => this.slice(), { timeout: 400 }); else window.setTimeout(() => this.slice(), 16);
  }
  /** one variant rendered into its AudioBuffer — every channel, or only `ch` (prewarm renders a stereo IR a channel per slice) */
  private variant(name: string, v: number, ch = -1): AudioBuffer | undefined {
    const f = FAMILIES[name]; if (!f) return undefined;
    const list = this.bufs.get(name) ?? []; this.bufs.set(name, list);
    const ctx = this.host.ctx, sr = f.half === true ? ctx.sampleRate / 2 : ctx.sampleRate;
    for (let c = 0; c < f.ch; c++) {
      const key = `${name}/${v}/${c}`;
      if ((ch >= 0 && c !== ch) || this.done.has(key)) continue;
      const data = f.gen(sr, v + 1, c);
      const b = list[v] ?? ctx.createBuffer(f.ch, data.length, sr); list[v] = b;
      b.getChannelData(c).set(data);
      this.done.add(key);
    }
    return list[v];
  }

  /** every channel of every variant of `name` is rendered (a caller can build on it without a synchronous render) */
  has(name: FamilyName): boolean { const f = FAMILIES[name]; if (!f) return false; for (let v = 0; v < f.n; v++) for (let c = 0; c < f.ch; c++) if (!this.done.has(`${name}/${v}/${c}`)) return false; return true; }

  /** a family's first variant (the IRs, the bubble bed), rendered now if it is not yet */
  buffer(name: FamilyName): AudioBuffer | undefined { return this.host.ready ? this.variant(name, 0) : undefined; }

  /** play a random variant (never the same one twice in a row); returns the source, or undefined before the first gesture */
  play(name: FamilyName, o: PlayOpts = {}): AudioBufferSourceNode | undefined {
    const f = FAMILIES[name];
    if (!f || !this.host.ready) return undefined;
    let dist = 0;
    if (o.at) { const dx = o.at.x - this.lx, dy = o.at.y - this.ly, dz = o.at.z - this.lz; dist = Math.sqrt(dx * dx + dy * dy + dz * dz); if (dist > 150) return undefined; }
    const prev = this.last.get(name) ?? -1;
    let v = Math.floor(Math.random() * f.n); if (f.n > 1 && v === prev) v = (v + 1) % f.n;
    this.last.set(name, v);
    const buf = this.variant(name, v);
    if (!buf) return undefined;
    const c = this.host.ctx, t = c.currentTime + (o.delay ?? 0);
    const src = c.createBufferSource(); src.buffer = buf;
    src.playbackRate.value = (o.rate ?? 1) * (1 + (Math.random() * 2 - 1) * (o.jitter ?? 0.05));
    const g = c.createGain(); g.gain.value = o.gain ?? 1;
    src.connect(g);
    let node: AudioNode = g, pan = o.pan ?? 0;
    if (o.at) {
      const dx = o.at.x - this.lx, dz = o.at.z - this.lz;
      g.gain.value *= 1 / (1 + dist / 9) ** 1.4;
      const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 12000 / (1 + dist / 22);
      node.connect(lp); node = lp;
      const rx = Math.cos(this.yaw), rz = -Math.sin(this.yaw);
      pan = dist > 0.5 ? Math.max(-1, Math.min(1, (dx * rx + dz * rz) / dist)) * 0.8 : 0;
    }
    if ((pan !== 0 || (o.panTo !== undefined && !o.at)) && 'createStereoPanner' in c) {
      const p = c.createStereoPanner(), clampP = (x: number) => Math.max(-1, Math.min(1, x));
      p.pan.setValueAtTime(clampP(pan), t);
      if (o.panTo !== undefined && !o.at) p.pan.linearRampToValueAtTime(clampP(o.panTo), t + buf.duration / src.playbackRate.value);
      node.connect(p); node = p;
    }
    node.connect(o.out ?? this.host.sfx);
    src.start(t);
    return src;
  }

  /** diagnostics: variants rendered per family */
  get rendered(): Record<string, number> { const o: Record<string, number> = {}; for (const [k, list] of this.bufs) o[k] = list.filter((b) => b !== undefined).length; return o; }
}
