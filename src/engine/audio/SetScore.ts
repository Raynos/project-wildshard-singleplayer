import { musicManifests } from '../boot/tables';
import { parseManifest, shipped, type MusicManifest, type SlotAudio, type StemSting, type BossPhase } from './Stems';
import type { MusicState } from './Music';

/** reads a stem file's bytes (fetch by default; a test hands its own) */
export type AudioRead = (url: string) => Promise<ArrayBuffer>;
/** decodes a stem's bytes into an AudioBuffer (the audio context by default; a test hands its own) */
export type AudioDecode = (bytes: ArrayBuffer) => Promise<AudioBuffer>;
/** a set's decoded score: every slot's stems and the stings, ready for SetScore to play */
export interface ScoreBank { slots: Map<string, SlotAudio>; stings: Map<StemSting, AudioBuffer> }
export interface ScoreSource {
  readonly slots: readonly string[];
  /** The base-style slot used by this source before its scene-specific recordings. */
  readonly base?: string;
  readonly synthLead?: 'pluck' | 'marimba';
  readonly minFade?: number;
  readonly phase?: BossPhase;
  readonly sceneName?: string;
  readonly failures?: Iterable<string>;
  sting?: (name: StemSting) => AudioBuffer | undefined | Promise<AudioBuffer | undefined>;
  onDeck?: (slot: string) => void;
  target: (state: MusicState) => string | undefined;
  want: (playing: string | undefined) => SlotAudio | undefined;
  readonly pending: boolean;
  useBank: (bank: ScoreBank) => void;
  readonly stings: Map<StemSting, AudioBuffer>;
}
export interface ScoreSet { dir: string; manifestKey: string }
const STINGS: readonly StemSting[] = ['pickup', 'death', 'chunk'];
/** the music manifest of a score set (its slots, stems and stings), or undefined when the build has none */
export function scoreManifest(set: ScoreSet): MusicManifest | undefined { return parseManifest(musicManifests()[set.manifestKey]); }
/** the files a score set plays: the given slots' stems (every slot by default) and its stings */
export function scoreFiles(set: ScoreSet, slots?: readonly string[], withStings = true): string[] {
  const m = scoreManifest(set);
  if (!m) return [];
  const stems = (slots ?? Object.keys(m.slots)).flatMap((key) => {
    const s = m.slots[key];
    return s ? [s.calm].concat(s.tension === undefined ? [] : [s.tension], s.layers) : [];
  });
  const files = [...stems, ...(withStings ? STINGS.flatMap((key) => m.stings[key] ?? []) : [])];
  return [...new Set(files.map((file) => `${set.dir}${file}`))].filter(shipped);
}
/** Decode the requested stems only; absent or invalid files keep the next fallback or synth. */
export async function decodeScore(set: ScoreSet, slots: readonly string[], read: AudioRead, decode: AudioDecode,
  withStings: boolean, onFile?: () => void): Promise<ScoreBank> {
  const bank: ScoreBank = { slots: new Map(), stings: new Map() }, m = scoreManifest(set);
  if (!m) return bank;
  const one = async (file: string): Promise<AudioBuffer> => {
    try {
      const url = `${set.dir}${file}`;
      if (!shipped(url)) throw new Error(`${url} is not in this build`);
      return await decode(await read(url));
    } finally { onFile?.(); }
  };
  await Promise.all([
    ...slots.map(async (slot) => {
      const spec = m.slots[slot];
      if (!spec) return;
      try {
        const [calm, tension, ...layers] = await Promise.all([one(spec.calm), spec.tension === undefined ? Promise.resolve(undefined) : one(spec.tension), ...spec.layers.map(one)]);
        if (spec.loopEnd > calm.duration + 0.05) throw new Error(`${slot}: loopEnd ${spec.loopEnd} past the file (${calm.duration.toFixed(2)} s)`);
        const aligned = (b: AudioBuffer | undefined): b is AudioBuffer => b !== undefined && Math.abs(b.duration - calm.duration) < 0.05;
        if (!layers.every(aligned)) throw new Error(`${slot}: a layer's length differs from the base`);
        bank.slots.set(slot, { genre: 'folk', slot, spec, calm, tension: aligned(tension) ? tension : undefined, layers });
      } catch (error) { console.info(`[music] ${set.manifestKey}/${slot}: ${error instanceof Error ? error.message : String(error)} — the synth or another slot plays`); }
    }),
    ...(withStings ? STINGS : []).map(async (key) => {
      const file = m.stings[key];
      if (file !== undefined) try { bank.stings.set(key, await one(file)); } catch { /* Keep the existing sting. */ }
    }),
  ]);
  return bank;
}
export interface SetScoreOptions<Scene> extends ScoreSet {
  scene: Scene;
  pick: (scene: Scene, state: MusicState | undefined) => readonly string[];
  read: AudioRead; decode: AudioDecode; onReady: () => void;
  waitForBank?: boolean;
  /** Admitted minimum crossfade and fallback synth lead; omission keeps Music's existing defaults. */
  minFade?: number; synthLead?: 'pluck' | 'marimba';
}
/** One score set; only the playing and wanted slots retain PCM across scene changes. */
export class SetScore<Scene> implements ScoreSource {
  readonly scene: Scene;
  readonly minFade?: number;
  readonly synthLead?: 'pluck' | 'marimba';
  readonly slots: readonly string[];
  stings = new Map<StemSting, AudioBuffer>();
  private readonly residentSlots = new Map<string, SlotAudio>();
  private readonly failed = new Set<string>();
  private decoding: string | undefined;
  private state: MusicState | undefined;
  private disposed = false;
  private waitingBoot: boolean;
  private readonly options: SetScoreOptions<Scene>;
  readonly log: { slot: string; ms: number }[] = [];
  constructor(options: SetScoreOptions<Scene>) {
    this.options = options;
    if (options.minFade !== undefined) this.minFade = options.minFade;
    if (options.synthLead !== undefined) this.synthLead = options.synthLead;
    this.waitingBoot = options.waitForBank ?? false;
    this.scene = options.scene;
    this.slots = Object.keys(scoreManifest(options)?.slots ?? {});
  }
  get available(): boolean { return this.slots.length > 0; }
  get resident(): string[] { return [...this.residentSlots.keys()]; }
  get pending(): boolean { return this.waitingBoot || this.decoding !== undefined; }
  /** Music has installed the new deck; only its fading predecessor still needs the outgoing PCM. */
  onDeck(slot: string): void {
    const wanted = this.target();
    for (const key of this.residentSlots.keys()) if (key !== slot && key !== wanted) this.residentSlots.delete(key);
  }
  useBank(bank: ScoreBank): void {
    if (this.disposed) return;
    this.waitingBoot = false;
    for (const [key, value] of bank.slots) this.residentSlots.set(key, value);
    if (bank.stings.size > 0) this.stings = bank.stings;
    this.options.onReady();
  }
  target(state = this.state): string | undefined {
    this.state = state;
    if (this.disposed) return undefined;
    return this.options.pick(this.scene, state).find((key) => this.slots.includes(key) && !this.failed.has(key));
  }
  want(playing: string | undefined): SlotAudio | undefined {
    if (this.waitingBoot) return undefined;
    const slot = this.target();
    if (slot === undefined) return undefined;
    for (const key of this.residentSlots.keys()) if (key !== slot && key !== playing) this.residentSlots.delete(key);
    const got = this.residentSlots.get(slot);
    if (got) return got;
    if (this.decoding === undefined) {
      this.decoding = slot;
      const start = performance.now();
      void decodeScore(this.options, [slot], this.options.read, this.options.decode, this.stings.size === 0).then((bank) => {
        this.decoding = undefined;
        if (this.disposed) return undefined;
        const audio = bank.slots.get(slot);
        if (audio) { this.residentSlots.set(slot, audio); this.log.push({ slot, ms: Math.round(performance.now() - start) }); }
        else this.failed.add(slot);
        if (bank.stings.size > 0) this.stings = bank.stings;
        this.options.onReady();
        return undefined;
      });
    }
    return undefined;
  }
  sting(name: StemSting): AudioBuffer | undefined { return this.stings.get(name); }
  dispose(): void { this.disposed = true; this.residentSlots.clear(); this.stings.clear(); }
}
