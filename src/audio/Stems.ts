// src/audio/Stems.ts — the MiniMax-Music3 stem player behind src/audio/Music.ts (docs/plans/MUSIC.md v3, row 7).
//
//   public/assets/music/<style>/music.json   { style, model, credit, slots: { pine | island: { calm, tension, bpm, beatsPerBar,
//                                            loopStart, loopEnd, duration }, title: { full, … } }, stings: { pickup, death, chunk } }
//
// A *deck* is one slot playing: the calm stem (melody / harmony + soft bass) always, the tension stem (drums + bass, the same
// recording split by demucs, so sample-aligned) under its own gain, both AudioBufferSourceNodes started at the same context
// time and looping loopStart → loopEnd. The loop is a whole number of bars, so the bar grid is continuous in context time:
// bar k starts at t0 + loopStart + k · bar. Every gain move (tension, crossfades) lands on that grid.
//
// Nothing here fetches on its own: Music.ts asks for a slot after the player is in the world. `fetch` + `decodeAudioData`
// (off the main thread); a file the build does not ship, a failed fetch or a decode error rejects and Music keeps the synth.
import type { MusicStyle } from '../ui/Settings';
import { PUBLIC_BYTES } from '../boot/bytes.generated';

/** the build's file table (vite.config.ts writes it from public/assets): a file the build does not have is never fetched —
 *  no 404 in the console, no request at all while the generated music has not landed */
export const shipped = (path: string): boolean => path in PUBLIC_BYTES;

export type SlotName = 'pine' | 'island' | 'title';
export type StemSting = 'pickup' | 'death' | 'chunk';
export interface SlotSpec {
  /** the calm stem (pine / island) or the full mix (title) — file names relative to the manifest */
  calm: string; tension: string | undefined;
  bpm: number; beatsPerBar: number; loopStart: number; loopEnd: number; duration: number;
}
export interface MusicManifest { style: string; credit: string; slots: Partial<Record<SlotName, SlotSpec>>; stings: Partial<Record<StemSting, string>> }

const SLOTS: SlotName[] = ['pine', 'island', 'title'];
const STINGS: StemSting[] = ['pickup', 'death', 'chunk'];
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const num = (v: unknown): number | undefined => (typeof v === 'number' && Number.isFinite(v) ? v : undefined);
const str = (v: unknown): string | undefined => (typeof v === 'string' && v.length > 0 && !v.includes('..') ? v : undefined);

function parseSlot(v: unknown): SlotSpec | undefined {
  if (!isObj(v)) return undefined;
  const calm = str(v['calm']) ?? str(v['full']), bpm = num(v['bpm']), loopStart = num(v['loopStart']) ?? 0, loopEnd = num(v['loopEnd']);
  if (calm === undefined || bpm === undefined || bpm < 30 || bpm > 260 || loopEnd === undefined || loopEnd <= loopStart + 0.5) return undefined;
  return { calm, tension: str(v['tension']), bpm, beatsPerBar: num(v['beatsPerBar']) ?? 4, loopStart, loopEnd, duration: num(v['duration']) ?? loopEnd };
}
/** the manifest, validated field by field — anything malformed is dropped (a slot without its files is a slot the synth keeps) */
export function parseManifest(raw: unknown): MusicManifest | undefined {
  if (!isObj(raw) || !isObj(raw['slots'])) return undefined;
  const slots: Partial<Record<SlotName, SlotSpec>> = {}, stings: Partial<Record<StemSting, string>> = {};
  for (const k of SLOTS) { const s = parseSlot(raw['slots'][k]); if (s) slots[k] = s; }
  const st = raw['stings'];
  if (isObj(st)) for (const k of STINGS) { const f = str(st[k]); if (f !== undefined) stings[k] = f; }
  return { style: str(raw['style']) ?? '', credit: str(raw['credit']) ?? 'Music: MiniMax-Music3', slots, stings };
}

/** a decoded slot: its spec and the stems (tension absent for the title cut) */
export interface SlotAudio { style: MusicStyle; slot: SlotName; spec: SlotSpec; calm: AudioBuffer; tension: AudioBuffer | undefined }

/** fetch + decode the files of one style, with in-flight de-duplication; `release()` forgets every buffer */
export class StemLoader {
  private manifest: Promise<MusicManifest> | undefined;
  private slots = new Map<SlotName, Promise<SlotAudio>>();
  private stingBufs = new Map<StemSting, AudioBuffer>();
  private stingLoad: Promise<void> | undefined;
  /** diagnostics: fetch → decoded wall time per file, and the bytes on the wire */
  readonly log: { file: string; bytes: number; ms: number }[] = [];

  constructor(private readonly ctx: BaseAudioContext, readonly style: MusicStyle, private readonly base = `/assets/music/${style}/`) {}

  getManifest(): Promise<MusicManifest> {
    const url = `${this.base}music.json`;
    if (!shipped(url)) return Promise.reject(new Error(`${url} is not in this build`));
    this.manifest ??= fetch(url).then(async (r) => {
      if (!r.ok) throw new Error(`music.json ${r.status}`);
      const m = parseManifest(await r.json());
      if (!m) throw new Error('music.json malformed');
      return m;
    });
    return this.manifest;
  }

  private async decode(file: string): Promise<AudioBuffer> {
    const t = performance.now(), url = `${this.base}${file}`;
    if (!shipped(url)) throw new Error(`${url} is not in this build`);
    const r = await fetch(url);
    if (!r.ok) throw new Error(`${file} ${r.status}`);
    const bytes = await r.arrayBuffer(), size = bytes.byteLength; // decodeAudioData detaches the buffer
    const buf = await this.ctx.decodeAudioData(bytes);
    this.log.push({ file, bytes: size, ms: Math.round(performance.now() - t) });
    return buf;
  }

  /** one slot's stems, decoded; rejects when the manifest or a file is missing (or the tension stem does not line up) */
  slot(slot: SlotName): Promise<SlotAudio> {
    let p = this.slots.get(slot);
    if (!p) {
      p = this.getManifest().then(async (m) => {
        const spec = m.slots[slot];
        if (!spec) throw new Error(`music.json has no '${slot}' slot`);
        const [calm, tension] = await Promise.all([this.decode(spec.calm), spec.tension === undefined ? Promise.resolve(undefined) : this.decode(spec.tension)]);
        // the loop must fit the file (a bad loopEnd would loop into silence)
        if (spec.loopEnd > calm.duration + 0.05) throw new Error(`${slot}: loopEnd ${spec.loopEnd} past the file (${calm.duration.toFixed(2)} s)`);
        // stems of one recording: a tension stem of another length would drift off the calm one — drop it rather than play it wrong
        const t = tension !== undefined && Math.abs(tension.duration - calm.duration) < 0.05 ? tension : undefined;
        return { style: this.style, slot, spec, calm, tension: t };
      });
      p.catch(() => { this.slots.delete(slot); }); // a failure may be retried later (online again)
      this.slots.set(slot, p);
    }
    return p;
  }

  /** the stings, best effort (a missing one falls back to the synth sting) */
  loadStings(): Promise<void> {
    this.stingLoad ??= (async () => {
      const m = await this.getManifest();
      await Promise.all(STINGS.map(async (k) => {
        const f = m.stings[k];
        if (f === undefined) return;
        try { this.stingBufs.set(k, await this.decode(f)); } catch { /* that sting stays synth */ }
      }));
    })().catch(() => undefined);
    return this.stingLoad;
  }
  sting(name: StemSting): AudioBuffer | undefined { return this.stingBufs.get(name); }

  /** drop one slot's buffers (the title after the menu closes, the other shard after a shard change) */
  forget(slot: SlotName): void { this.slots.delete(slot); }
  /** drop every buffer of this style — the next style becomes the only one resident */
  release(): void { this.slots.clear(); this.stingBufs.clear(); this.manifest = undefined; this.stingLoad = undefined; }
}

/** one slot playing: calm + tension sources through their gains into `out` (the deck's fade) */
export class Deck {
  readonly out: GainNode;
  readonly tensionGain: GainNode | undefined;
  readonly bar: number;
  private srcs: AudioBufferSourceNode[] = [];
  private tension = 0;
  stopAt = Infinity;

  constructor(ctx: BaseAudioContext, readonly audio: SlotAudio, dest: AudioNode, readonly t0: number, fadeIn: number, tension = 0) {
    const { spec } = audio;
    this.bar = (60 / spec.bpm) * spec.beatsPerBar;
    this.out = ctx.createGain();
    this.out.gain.setValueAtTime(fadeIn > 0 ? 0 : 1, 0);
    if (fadeIn > 0) { this.out.gain.setValueAtTime(0, t0); this.out.gain.linearRampToValueAtTime(1, t0 + fadeIn); }
    this.out.connect(dest);
    const mk = (buf: AudioBuffer, to: AudioNode) => {
      const s = ctx.createBufferSource(); s.buffer = buf; s.loop = true; s.loopStart = spec.loopStart; s.loopEnd = spec.loopEnd;
      s.connect(to); s.start(t0, 0); this.srcs.push(s);
    };
    mk(audio.calm, this.out);
    if (audio.tension) {
      this.tension = tension;
      this.tensionGain = ctx.createGain(); this.tensionGain.gain.value = tension; this.tensionGain.connect(this.out);
      mk(audio.tension, this.tensionGain);
    }
  }
  get slot(): SlotName { return this.audio.slot; }
  get style(): MusicStyle { return this.audio.style; }
  get level(): number { return this.tension; }

  /** the first bar line at or after `t` — bars run from loopStart in file time, and the loop is whole bars, so the grid never breaks */
  nextBar(t: number): number {
    const a = this.t0 + this.audio.spec.loopStart;
    return Math.max(this.t0, a + Math.ceil((t - a) / this.bar - 1e-6) * this.bar);
  }

  /** move the tension layer to `level` on the next bar: in over one beat (it lands on the downbeat), out over two bars */
  setTension(level: number, now: number): void {
    const g = this.tensionGain;
    if (!g || Math.abs(level - this.tension) < 1e-3) return;
    const tb = this.nextBar(now + 0.02), beat = this.bar / this.audio.spec.beatsPerBar;
    const cp: { cancelAndHoldAtTime?: (t: number) => void } = g.gain;
    if (cp.cancelAndHoldAtTime) cp.cancelAndHoldAtTime(tb); else { g.gain.cancelScheduledValues(tb); g.gain.setValueAtTime(this.tension, tb); }
    g.gain.linearRampToValueAtTime(level, tb + (level > this.tension ? beat : this.bar * 2));
    this.tension = level;
  }

  /** fade out over `secs` from `t` and stop the sources after it */
  fadeOut(t: number, secs: number): void {
    const g = this.out.gain;
    const cp: { cancelAndHoldAtTime?: (t: number) => void } = g;
    if (cp.cancelAndHoldAtTime) cp.cancelAndHoldAtTime(t); else { g.cancelScheduledValues(t); g.setValueAtTime(g.value, t); }
    g.linearRampToValueAtTime(0, t + secs);
    this.stopAt = t + secs;
    for (const s of this.srcs) { try { s.stop(t + secs + 0.05); } catch { /* already stopped */ } }
    const done = () => { try { this.out.disconnect(); } catch { /* gone */ } this.srcs = []; };
    const last = this.srcs[0];
    if (last) last.addEventListener('ended', done, { once: true }); else done();
  }
}
