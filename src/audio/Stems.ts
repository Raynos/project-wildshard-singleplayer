// src/audio/Stems.ts — the MiniMax-Music3 stem player behind src/audio/Music.ts (project/archive/2026-09-23-music.md v3, row 7).
//
//   public/assets/music/<style>/music.json   { style, model, credit, slots: { pine | island: { calm, tension, bpm, beatsPerBar,
//                                            loopStart, loopEnd, duration }, title: { full, … } }, stings: { pickup, death, chunk } }
//
// A *deck* is one slot playing: the calm stem (melody / harmony + soft bass) always, the tension stem (drums + bass, the same
// recording split by demucs, so sample-aligned) under its own gain, both AudioBufferSourceNodes started at the same context
// time and looping loopStart → loopEnd. The loop is a whole number of bars, so the bar grid is continuous in context time:
// bar k starts at t0 + loopStart + k · bar. Every gain move (tension, crossfades) lands on that grid.
//
// Nothing here fetches: the manifests are compiled into the bundle (src/boot/audio.generated.ts) and the files are read by the
// caller — the boot's counted fetch at the loading bar, or Cache Storage for a style switch (project/archive/2026-09-23-preload-offline.md).
// `decodeStyle` decodes one style's slots + stings; a slot whose file is missing or will not decode is left out, and Music
// keeps the synth for it.
import type { MusicStyle } from '../ui/Settings';
import { PUBLIC_BYTES } from '../boot/bytes.generated';
import { MUSIC_MANIFESTS } from '../boot/audio.generated';

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

/** one style, decoded: the slots this shard can play and the stings, plus what each file cost */
export interface StyleBank {
  style: MusicStyle;
  slots: Map<SlotName, SlotAudio>;
  stings: Map<StemSting, AudioBuffer>;
  /** diagnostics: read → decoded wall time per file, and its bytes */
  log: { file: string; bytes: number; ms: number }[];
}

/** this build's manifest for `style` (compiled in from public/assets/music/<style>/music.json), or undefined */
export function musicManifest(style: MusicStyle): MusicManifest | undefined { return parseManifest(MUSIC_MANIFESTS[style]); }

/** the files `decodeStyle(style, slots)` reads (URLs), so the loading bar can tell them from the files it only downloads */
export function styleFiles(style: MusicStyle, slots: readonly SlotName[]): string[] {
  const m = musicManifest(style);
  if (!m) return [];
  const files: string[] = [];
  for (const k of slots) { const sp = m.slots[k]; if (sp) files.push(sp.calm, ...(sp.tension === undefined ? [] : [sp.tension])); }
  for (const k of STINGS) { const f = m.stings[k]; if (f !== undefined) files.push(f); }
  return [...new Set(files.map((f) => `/assets/music/${style}/${f}`))].filter(shipped);
}

/**
 * Decode `slots` + every sting of `style`. `read` hands over a file's bytes (by URL), `decode` turns them into an AudioBuffer
 * (an OfflineAudioContext's — no live context needed). Rejects only when the build has no manifest for the style.
 */
export async function decodeStyle(style: MusicStyle, slots: readonly SlotName[], read: (url: string) => Promise<ArrayBuffer>, decode: (bytes: ArrayBuffer) => Promise<AudioBuffer>, onFile?: () => void): Promise<StyleBank> {
  const m = musicManifest(style);
  if (!m) throw new Error(`no music.json for '${style}' in this build`);
  const base = `/assets/music/${style}/`;
  const bank: StyleBank = { style, slots: new Map(), stings: new Map(), log: [] };
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
        const [calm, tension] = await Promise.all([one(spec.calm), spec.tension === undefined ? Promise.resolve(undefined) : one(spec.tension)]);
        // the loop must fit the file (a bad loopEnd would loop into silence)
        if (spec.loopEnd > calm.duration + 0.05) throw new Error(`${slot}: loopEnd ${spec.loopEnd} past the file (${calm.duration.toFixed(2)} s)`);
        // stems of one recording: a tension stem of another length would drift off the calm one — drop it rather than play it wrong
        const t = tension !== undefined && Math.abs(tension.duration - calm.duration) < 0.05 ? tension : undefined;
        bank.slots.set(slot, { style, slot, spec, calm, tension: t });
      } catch (err: unknown) { console.info(`[music] ${style}/${slot}: ${err instanceof Error ? err.message : String(err)} — the synth plays it`); }
    }),
    ...STINGS.map(async (k) => {
      const f = m.stings[k];
      if (f === undefined) return;
      try { bank.stings.set(k, await one(f)); } catch { /* that sting stays synth */ }
    }),
  ]);
  return bank;
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
