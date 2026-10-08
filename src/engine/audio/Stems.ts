import { musicManifests, publicBytes } from '../boot/tables';
import { resourceScope } from '../app/resources';
import { withOwner } from '../app/ownership';
import { ownAudioSource } from './ownership';
import { tap } from '../core/harnessTap';
// src/engine/audio/Stems.ts — the MiniMax-Music3 stem player behind src/engine/audio/Music.ts (project/archive/2026-09-23-music.md v3, row 7).
//
//   public/assets/music/<genre>/music.json   { genre, model, credit, slots: { <slot>: { calm, tension, bpm, beatsPerBar,
//                                            loopStart, loopEnd, duration }, title: { full, … } }, stings: { pickup, death, chunk } }
//
// A *deck* is one slot playing: the calm stem (melody / harmony + soft bass) always, the tension stem (drums + bass, the same
// recording split by demucs, so sample-aligned) under its own gain, both AudioBufferSourceNodes started at the same context
// time and looping loopStart → loopEnd. The loop is a whole number of bars, so the bar grid is continuous in context time:
// bar k starts at t0 + loopStart + k · bar. Every gain move (tension, crossfades) lands on that grid.
//
// Nothing here fetches: the manifests are compiled into the bundle (src/game/boot/audio.generated.ts) and the files are read by the
// caller — the boot's counted fetch at the loading bar, or Cache Storage for a genre switch (project/archive/2026-09-23-preload-offline.md).
// `decodeStyle` decodes one genre's slots + stings; a slot whose file is missing or will not decode is left out, and Music
// keeps the synth for it.
//
// A level's own set (`stems.py --set <set>`): public/assets/music/<set>-<genre>/music.json — the same manifest; a boss slot
// carries `layers` (bass, drums) and `phases` (each boss phase's layer gains). `decodeStyle(genre, slots, …, set)` reads it.
// A deck of the boss plays its layers at the current phase's gains (Deck.setPhase), moved on the bar like the tension stem.
import type { MusicStyle as MusicGenre } from '../ui/Settings';

/** the build's file table (vite.config.ts writes it from public/assets): a file the build does not have is never fetched —
 *  no 404 in the console, no request at all while the generated music has not landed */
export const shipped = (path: string): boolean => path in publicBytes();

/** Score-source slot names are content data, including sets registered by a level. */
export type SlotName = string;
export type StemSting = 'pickup' | 'death' | 'chunk' | 'dawn';
/** a music set: 'base' = the genre's own folder (`<genre>/`), any other id = a level's set folder (`<set>-<genre>/`) */
export type MusicSet = string;
export type BossPhase = 1 | 2 | 3;
export interface SlotSpec {
  /** the calm stem (a theme slot), the full mix (title) or the base (boss) — file names relative to the manifest */
  calm: string; tension: string | undefined;
  /** the boss's extra layers (bass, drums), each gained per phase by `phases` */
  layers: string[];
  phases: Partial<Record<BossPhase, number[]>>;
  bpm: number; beatsPerBar: number; loopStart: number; loopEnd: number; duration: number;
}
export interface MusicManifest { genre: string; credit: string; slots: Partial<Record<string, SlotSpec>>; stings: Partial<Record<StemSting, string>> }

const STINGS: StemSting[] = ['pickup', 'death', 'chunk', 'dawn'];
const PHASES: BossPhase[] = [1, 2, 3];
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const num = (v: unknown): number | undefined => (typeof v === 'number' && Number.isFinite(v) ? v : undefined);
const str = (v: unknown): string | undefined => (typeof v === 'string' && v.length > 0 && !v.includes('..') ? v : undefined);

function parseSlot(v: unknown): SlotSpec | undefined {
  if (!isObj(v)) return undefined;
  const calm = str(v['calm']) ?? str(v['full']), bpm = num(v['bpm']), loopStart = num(v['loopStart']) ?? 0, loopEnd = num(v['loopEnd']);
  if (calm === undefined || bpm === undefined || bpm < 30 || bpm > 260 || loopEnd === undefined || loopEnd <= loopStart + 0.5) return undefined;
  const lv = v['layers'], layers = Array.isArray(lv) ? lv.map(str).filter((f): f is string => f !== undefined) : [];
  const phases: Partial<Record<BossPhase, number[]>> = {}, pv = v['phases'];
  if (isObj(pv)) for (const k of PHASES) { const g = pv[String(k)]; if (Array.isArray(g) && g.length === layers.length) phases[k] = g.map((x) => Math.min(1.5, Math.max(0, num(x) ?? 0))); }
  return { calm, tension: str(v['tension']), layers, phases, bpm, beatsPerBar: num(v['beatsPerBar']) ?? 4, loopStart, loopEnd, duration: num(v['duration']) ?? loopEnd };
}
/** the manifest, validated field by field — anything malformed is dropped (a slot without its files is a slot the synth keeps) */
export function parseManifest(raw: unknown): MusicManifest | undefined {
  if (!isObj(raw) || !isObj(raw['slots'])) return undefined;
  const slots: Partial<Record<SlotName, SlotSpec>> = {}, stings: Partial<Record<StemSting, string>> = {};
  for (const [k, value] of Object.entries(raw['slots'])) { const s = parseSlot(value); if (s && str(k) !== undefined) slots[k] = s; }
  const st = raw['stings'];
  if (isObj(st)) for (const k of STINGS) { const f = str(st[k]); if (f !== undefined) stings[k] = f; }
  return { genre: str(raw['style']) ?? '', credit: str(raw['credit']) ?? 'Music: MiniMax-Music3', slots, stings };
}

/** a decoded slot: its spec and the stems (tension absent for the title cut; layers only on the boss) */
export interface SlotAudio { genre: MusicGenre; slot: SlotName; spec: SlotSpec; calm: AudioBuffer; tension: AudioBuffer | undefined; layers: AudioBuffer[] }

/** one genre, decoded: the slots this shard can play and the stings, plus what each file cost */
export type StyleBank = GenreBank;
export interface GenreBank {
  genre: MusicGenre;
  set: MusicSet;
  slots: Map<SlotName, SlotAudio>;
  stings: Map<StemSting, AudioBuffer>;
  /** diagnostics: read → decoded wall time per file, and its bytes */
  log: { file: string; bytes: number; ms: number }[];
}

/** the folder a set of `genre` lives in: public/assets/music/<genre>/ or public/assets/music/<set>-<genre>/ */
export const musicSetDir = (genre: MusicGenre, set: MusicSet = 'base'): string => (set === 'base' ? genre : `${set}-${genre}`);
/** this build's manifest for `genre` (compiled in from public/assets/music/<dir>/music.json), or undefined */
export function musicManifest(genre: MusicGenre, set: MusicSet = 'base'): MusicManifest | undefined { return parseManifest(musicManifests()[musicSetDir(genre, set)]); }
/** every file of a set (URLs) — a level fetches its own set into the offline cache while the player is in */
export function setFiles(genre: MusicGenre, set: MusicSet): string[] {
  const m = musicManifest(genre, set);
  if (!m) return [];
  const files: string[] = [];
  for (const sp of Object.values(m.slots)) if (sp) files.push(sp.calm, ...(sp.tension === undefined ? [] : [sp.tension]), ...sp.layers);
  for (const f of Object.values(m.stings)) files.push(f);
  return [...new Set(files.map((f) => `/assets/music/${musicSetDir(genre, set)}/${f}`))].filter(shipped);
}

/** the files `decodeStyle(genre, slots)` reads (URLs), so the loading bar can tell them from the files it only downloads */
export function styleFiles(genre: MusicGenre, slots: readonly SlotName[]): string[] {
  const m = musicManifest(genre);
  if (!m) return [];
  const files: string[] = [];
  for (const k of slots) { const sp = m.slots[k]; if (sp) files.push(sp.calm, ...(sp.tension === undefined ? [] : [sp.tension])); }
  for (const k of STINGS) { const f = m.stings[k]; if (f !== undefined) files.push(f); }
  return [...new Set(files.map((f) => `/assets/music/${genre}/${f}`))].filter(shipped);
}

/**
 * Decode `slots` + every sting of `genre`. `read` hands over a file's bytes (by URL), `decode` turns them into an AudioBuffer
 * (an OfflineAudioContext's — no live context needed). Rejects only when the build has no manifest for the genre.
 */
export async function decodeStyle(genre: MusicGenre, slots: readonly SlotName[], read: (url: string) => Promise<ArrayBuffer>, decode: (bytes: ArrayBuffer) => Promise<AudioBuffer>, onFile?: () => void, set: MusicSet = 'base', stings: readonly StemSting[] = STINGS): Promise<StyleBank> {
  const m = musicManifest(genre, set);
  if (!m) throw new Error(`no music.json for '${musicSetDir(genre, set)}' in this build`);
  const base = `/assets/music/${musicSetDir(genre, set)}/`;
  const bank: StyleBank = { genre, set, slots: new Map(), stings: new Map(), log: [] };
  const one = async (file: string): Promise<AudioBuffer> => {
    const t = performance.now(), url = `${base}${file}`;
    try {
      if (!shipped(url)) throw new Error(`${url} is not in this build`);
      const bytes = await read(url), size = bytes.byteLength; // decodeAudioData detaches the buffer
      const buf = await decode(bytes);
      bank.log.push({ file, bytes: size, ms: Math.round(performance.now() - t) });
      return buf;
    } finally { onFile?.(); }
  };
  await Promise.all([
    ...slots.map(async (slot) => {
      const spec = m.slots[slot];
      if (!spec) return;
      try {
        const [calm, tension, ...layers] = await Promise.all([one(spec.calm), spec.tension === undefined ? Promise.resolve(undefined) : one(spec.tension), ...spec.layers.map(one)]);
        // the loop must fit the file (a bad loopEnd would loop into silence)
        if (spec.loopEnd > calm.duration + 0.05) throw new Error(`${slot}: loopEnd ${spec.loopEnd} past the file (${calm.duration.toFixed(2)} s)`);
        // stems of one recording: a stem of another length would drift off the calm one — drop it rather than play it wrong
        const aligned = (b: AudioBuffer | undefined): b is AudioBuffer => b !== undefined && Math.abs(b.duration - calm.duration) < 0.05;
        if (!layers.every(aligned)) throw new Error(`${slot}: a layer's length differs from the base`);
        bank.slots.set(slot, { genre, slot, spec, calm, tension: aligned(tension) ? tension : undefined, layers });
      } catch (err: unknown) { console.info(`[music] ${genre}/${slot}: ${err instanceof Error ? err.message : String(err)} — the synth plays it`); }
    }),
    ...stings.map(async (k) => {
      const f = m.stings[k];
      if (f === undefined) return;
      try { bank.stings.set(k, await one(f)); } catch { /* that sting stays synth */ }
    }),
  ]);
  return bank;
}

/** one slot playing: calm + tension sources (+ the boss's layers) through their gains into `out` (the deck's fade) */
export class Deck {
  private readonly scope = resourceScope().child('Deck');
  readonly out: GainNode;
  readonly tensionGain: GainNode | undefined;
  /** the boss's layer gains (bass, drums), set per phase */
  readonly layerGains: GainNode[] = [];
  readonly bar: number;
  private srcs: AudioBufferSourceNode[] = [];
  private tension = 0;
  private _phase: BossPhase = 1;
  stopAt = Infinity;

  private heldAudio: SlotAudio | undefined;
  private readonly spec: SlotSpec;
  readonly slot: SlotName;
  readonly genre: MusicGenre;
  readonly t0: number;
  private readonly ctx: BaseAudioContext;
  constructor(ctx: BaseAudioContext, audio: SlotAudio, dest: AudioNode, t0: number, fadeIn: number, tension = 0, phase: BossPhase = 1) {
    this.ctx = ctx;
    this.heldAudio = audio;
    this.spec = audio.spec;
    this.slot = audio.slot;
    this.genre = audio.genre;
    this.t0 = t0;
    tap.sound?.(`stems.bed:${audio.slot}`);
    const { spec } = audio;
    this.bar = (60 / spec.bpm) * spec.beatsPerBar;
    this.out = ctx.createGain();
    this.out.gain.setValueAtTime(fadeIn > 0 ? 0 : 1, 0);
    if (fadeIn > 0) { this.out.gain.setValueAtTime(0, t0); this.out.gain.linearRampToValueAtTime(1, t0 + fadeIn); }
    this.out.connect(dest);
    // Registered first: source handles/listeners retire before their PCM references.
    this.scope.onDispose(() => {
      for (const source of this.srcs) source.buffer = null;
      this.srcs = [];
      this.heldAudio = undefined;
      this.out.disconnect();
      this.tensionGain?.disconnect();
      for (const gain of this.layerGains) gain.disconnect();
      this.layerGains.length = 0;
    });
    this.scope.listen(ctx, 'statechange', () => {
      if (this.stopAt !== Infinity && this.ctx.state !== 'running') this.dispose();
    });
    const mk = (buf: AudioBuffer, to: AudioNode) => {
      const s = withOwner(this.scope, () => ownAudioSource(ctx.createBufferSource())); s.buffer = buf; s.loop = true; s.loopStart = spec.loopStart; s.loopEnd = spec.loopEnd;
      s.connect(to); s.start(t0, 0); this.srcs.push(s);
    };
    mk(audio.calm, this.out);
    if (audio.tension) {
      this.tension = tension;
      this.tensionGain = ctx.createGain(); this.tensionGain.gain.value = tension; this.tensionGain.connect(this.out);
      mk(audio.tension, this.tensionGain);
    }
    this._phase = phase;
    const pg = spec.phases[phase] ?? [];
    audio.layers.forEach((buf, i) => {
      const g = ctx.createGain(); g.gain.value = pg[i] ?? 0; g.connect(this.out); this.layerGains.push(g);
      mk(buf, g);
    });
  }
  /** Live decoded stems; retirement releases them, while slot/bar metadata remains readable. */
  get audio(): SlotAudio {
    if (!this.heldAudio) throw new Error('Deck has retired');
    return this.heldAudio;
  }
  /** Stop and release this deck once, including when its context cannot deliver ended. */
  dispose(): void { this.scope.dispose(); }
  get phase(): BossPhase { return this._phase; }

  /** the boss's phase: its layers move to that phase's gains on the next bar (in over a beat, out over two bars) */
  setPhase(phase: BossPhase, now: number): void {
    if (this.scope.disposed) return;
    const want = this.spec.phases[phase];
    if (phase === this._phase || !want || this.layerGains.length === 0) return;
    const tb = this.nextBar(now + 0.02), beat = this.bar / this.spec.beatsPerBar, up = phase > this._phase;
    const before = this.spec.phases[this._phase] ?? [];
    this.layerGains.forEach((g, i) => {
      const cp: { cancelAndHoldAtTime?: (t: number) => void } = g.gain;
      if (cp.cancelAndHoldAtTime) cp.cancelAndHoldAtTime(tb); else { g.gain.cancelScheduledValues(tb); g.gain.setValueAtTime(before[i] ?? 0, tb); }
      g.gain.linearRampToValueAtTime(want[i] ?? 0, tb + (up ? beat : this.bar * 2));
    });
    this._phase = phase;
  }
  get level(): number { return this.tension; }

  /** the first bar line at or after `t` — bars run from loopStart in file time, and the loop is whole bars, so the grid never breaks */
  nextBar(t: number): number {
    const a = this.t0 + this.spec.loopStart;
    return Math.max(this.t0, a + Math.ceil((t - a) / this.bar - 1e-6) * this.bar);
  }

  /** move the tension layer to `level` on the next bar: in over one beat (it lands on the downbeat), out over two bars */
  setTension(level: number, now: number): void {
    if (this.scope.disposed) return;
    const g = this.tensionGain;
    if (!g || Math.abs(level - this.tension) < 1e-3) return;
    const tb = this.nextBar(now + 0.02), beat = this.bar / this.spec.beatsPerBar;
    const cp: { cancelAndHoldAtTime?: (t: number) => void } = g.gain;
    if (cp.cancelAndHoldAtTime) cp.cancelAndHoldAtTime(tb); else { g.gain.cancelScheduledValues(tb); g.gain.setValueAtTime(this.tension, tb); }
    g.gain.linearRampToValueAtTime(level, tb + (level > this.tension ? beat : this.bar * 2));
    this.tension = level;
  }

  /** fade out over `secs` from `t` and stop the sources after it */
  fadeOut(t: number, secs: number): void {
    if (this.scope.disposed) return;
    const firstFade = this.stopAt === Infinity;
    this.stopAt = t + secs;
    // A paused clock cannot reach the scheduled stop. Retiring it is inaudible.
    if (this.ctx.state !== 'running') { this.dispose(); return; }
    const g = this.out.gain;
    const cp: { cancelAndHoldAtTime?: (t: number) => void } = g;
    if (cp.cancelAndHoldAtTime) cp.cancelAndHoldAtTime(t); else { g.cancelScheduledValues(t); g.setValueAtTime(g.value, t); }
    g.linearRampToValueAtTime(0, t + secs);
    for (const s of this.srcs) { try { s.stop(t + secs + 0.05); } catch { /* already stopped */ } }
    const last = this.srcs[0];
    if (last) { if (firstFade) this.scope.listen(last, 'ended', () => this.dispose(), { once: true }); }
    else this.dispose();
  }
}
