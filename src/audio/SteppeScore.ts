// src/audio/SteppeScore.ts — Nalati's own score behind src/audio/Music.ts (NALATI-MERGE A2 / A3).
//
//   public/assets/music/nalati/music.json   { style: 'nalati', credit, slots: { steppe-grass | steppe-sky | steppe-snow |
//                                           steppe-night | steppe-storm | steppe-king: { calm, tension, bpm, … } }, stings }
//
// ONE Kazakh-folk score whatever the music-style setting (the user, wave 5) — piano / orchestral / folk all play it on the
// steppe; 'synth' keeps the synth theme. The slots are Stems.ts decks like every other shard's (calm + tension, the tension
// stem up for alert / combat on the bar grid); Music picks the slot from the state `music.setSteppe(...)` sets:
//   the Golden King's fight → steppe-king · a storm (Jel Ata's cue) → steppe-storm · night → steppe-night (the throat drone
//   lives only there and in the boss cues, wave 6) · else the zone's theme: steppe-grass (Nalati Grasslands) / steppe-sky (Sky
//   Grassland) / steppe-snow (Snow Lotus Valley), crossfaded at the zone lines (SteppeAmbience.onZone holds a zone 3 s first).
// A slot the build lacks falls back along the chain (king / storm / night → the zone's theme → steppe-grass → the synth).
//
// Memory: a decoded slot is ~35 MB of PCM (a 60 s stereo calm stem + a mono tension stem), so only the slot playing and the
// one wanted are resident; the loading bar decodes the first slot (the camp is in the valley: steppe-grass) + the stings,
// every other slot decodes from the offline cache (the bar downloaded all of them, on the steppe only) when it is first wanted
// while the old one plays on, then crossfades in.
import type { MusicStyle } from '../ui/Settings';
import { MUSIC_MANIFESTS } from '../boot/audio.generated';
import { STEPPE_SLOTS, parseManifest, shipped, type MusicManifest, type SlotAudio, type SteppeSlot, type StemSting } from './Stems';

export type SteppeZone = 'grass' | 'sky' | 'snow';
/** what the score follows on the steppe (sound.ts drives it) */
export interface SteppeScene { zone: SteppeZone; night: boolean; storm: boolean; boss: 'king' | null }

export const STEPPE_DIR = '/assets/music/nalati/';
const ZONE_SLOT: Record<SteppeZone, SteppeSlot> = { grass: 'steppe-grass', sky: 'steppe-sky', snow: 'steppe-snow' };
const STINGS: readonly StemSting[] = ['pickup', 'death', 'chunk'];

/** the build's Nalati manifest, or undefined (no score shipped yet: the steppe plays the synth theme) */
export function steppeManifest(): MusicManifest | undefined { return parseManifest(MUSIC_MANIFESTS['nalati']); }

/** every file of the score (URLs the build ships) — the loading bar downloads them on the steppe only */
export function steppeFiles(): string[] {
  const m = steppeManifest();
  if (!m) return [];
  const files: string[] = [];
  for (const sp of Object.values(m.slots)) files.push(sp.calm, ...(sp.tension === undefined ? [] : [sp.tension]));
  for (const f of Object.values(m.stings)) files.push(f);
  return [...new Set(files.map((f) => `${STEPPE_DIR}${f}`))].filter(shipped);
}

/** the files the bar decodes: the first slot + the stings */
export function steppeBootFiles(first: SteppeSlot = 'steppe-grass'): string[] {
  const m = steppeManifest(), sp = m?.slots[first];
  if (!m) return [];
  const files = [...(sp ? [sp.calm, ...(sp.tension === undefined ? [] : [sp.tension])] : []), ...STINGS.flatMap((k) => { const f = m.stings[k]; return f === undefined ? [] : [f]; })];
  return files.map((f) => `${STEPPE_DIR}${f}`).filter(shipped);
}

/** decoded slots + stings of the score */
export interface SteppeBank { slots: Map<SteppeSlot, SlotAudio>; stings: Map<StemSting, AudioBuffer> }

type Read = (url: string) => Promise<ArrayBuffer>;
type Decode = (bytes: ArrayBuffer) => Promise<AudioBuffer>;

/** decode `slots` (+ the stings when asked) of the score; a slot whose files fail is left out, never rejects */
export async function decodeSteppe(slots: readonly SteppeSlot[], read: Read, decode: Decode, withStings: boolean, onFile?: () => void): Promise<SteppeBank> {
  const bank: SteppeBank = { slots: new Map(), stings: new Map() };
  const m = steppeManifest();
  if (!m) return bank;
  const one = async (file: string): Promise<AudioBuffer> => {
    try {
      const url = `${STEPPE_DIR}${file}`;
      if (!shipped(url)) throw new Error(`${url} is not in this build`);
      return await decode(await read(url));
    } finally { onFile?.(); }
  };
  await Promise.all([
    ...slots.map(async (slot) => {
      const spec = m.slots[slot];
      if (!spec) return;
      try {
        const [calm, tension] = await Promise.all([one(spec.calm), spec.tension === undefined ? Promise.resolve(undefined) : one(spec.tension)]);
        if (spec.loopEnd > calm.duration + 0.05) throw new Error(`${slot}: loopEnd ${spec.loopEnd} past the file (${calm.duration.toFixed(2)} s)`);
        const t = tension !== undefined && Math.abs(tension.duration - calm.duration) < 0.05 ? tension : undefined;
        // `style` is only a label here (the score is the same for every style); Music compares steppe decks by slot
        bank.slots.set(slot, { style: 'folk', slot, spec, calm, tension: t, layers: [] }); // no boss layers (Pine Hollow's, Stems.ts)
      } catch (err: unknown) { console.info(`[music] nalati/${slot}: ${err instanceof Error ? err.message : String(err)} — the synth or another slot plays`); }
    }),
    ...(withStings ? STINGS : []).map(async (k) => {
      const f = m.stings[k];
      if (f === undefined) return;
      try { bank.stings.set(k, await one(f)); } catch { /* that sting stays the style's / the synth's */ }
    }),
  ]);
  return bank;
}

export class SteppeScore {
  scene: SteppeScene = { zone: 'grass', night: false, storm: false, boss: null };
  private readonly slots = new Map<SteppeSlot, SlotAudio>();
  private stings = new Map<StemSting, AudioBuffer>();
  private decoding: SteppeSlot | undefined;
  private readonly failed = new Set<SteppeSlot>();
  private readonly have: ReadonlySet<SteppeSlot>;
  /** diagnostics: every slot decode (ms) */
  readonly log: { slot: SteppeSlot; ms: number }[] = [];

  constructor(private readonly read: Read, private readonly decode: Decode, private readonly onReady: () => void) {
    const m = steppeManifest();
    this.have = new Set(STEPPE_SLOTS.filter((s) => m?.slots[s] !== undefined));
  }

  /** the score ships at least one slot */
  get available(): boolean { return this.have.size > 0; }
  get resident(): SteppeSlot[] { return [...this.slots.keys()]; }

  /** the bar's decode (the first slot + the stings) */
  useBank(bank: SteppeBank): void {
    for (const [k, v] of bank.slots) this.slots.set(k, v);
    if (bank.stings.size > 0) this.stings = bank.stings;
    this.onReady();
  }

  /** the slot the scene asks for, down the fallback chain to one the build has (undefined: none — the synth) */
  target(): SteppeSlot | undefined {
    const s = this.scene, zone = ZONE_SLOT[s.zone];
    const chain: SteppeSlot[] = [...(s.boss === 'king' ? ['steppe-king' as const] : []), ...(s.storm ? ['steppe-storm' as const] : []),
      ...(s.night ? ['steppe-night' as const] : []), zone, 'steppe-grass'];
    return chain.find((k) => this.have.has(k) && !this.failed.has(k));
  }

  /**
   * The decoded slot to play now for the scene, or undefined while it decodes (the caller keeps what plays). `playing` is the
   * deck on the air: it and the wanted slot stay resident, every other slot's buffers go (a fading deck keeps its own).
   */
  want(playing: SteppeSlot | undefined): SlotAudio | undefined {
    const slot = this.target();
    if (slot === undefined) return undefined;
    for (const k of this.slots.keys()) if (k !== slot && k !== playing) this.slots.delete(k);
    const a = this.slots.get(slot);
    if (a) return a;
    if (this.decoding === undefined) {
      this.decoding = slot;
      const t = performance.now();
      void (async () => {
        const bank = await decodeSteppe([slot], this.read, this.decode, this.stings.size === 0);
        this.decoding = undefined;
        const got = bank.slots.get(slot);
        if (got) { this.slots.set(slot, got); this.log.push({ slot, ms: Math.round(performance.now() - t) }); } else this.failed.add(slot);
        if (bank.stings.size > 0) this.stings = bank.stings;
        this.onReady();
      })();
    }
    return undefined;
  }

  /** a decoding slot is pending (Music keeps the deck on the air meanwhile instead of falling to the synth) */
  get pending(): boolean { return this.decoding !== undefined; }
  sting(name: StemSting): AudioBuffer | undefined { return this.stings.get(name); }
  /** styles are irrelevant to the score: every style but synth plays it */
  static plays(style: MusicStyle): boolean { return style !== 'synth'; }
}
