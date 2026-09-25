/**
 * PineHollowSfx — Pine Hollow's own generated sounds (PINE-HOLLOW-REMASTER PH-A2..A4): public/assets/sfx/pine-hollow/sfx.json,
 * the better take per sound of MOSS-SoundEffect v2 and Stable Audio 3 Medium (scripts/music/gen/sfx_merge.py --jobs
 * sfx-ph-jobs.json; the decision rows are in scripts/music/gen/sfx-best.json). The sounds the game already plays through
 * Audio.ts (crossbow, animals, footsteps) went into the one merged set `best/`; this set holds the rest:
 *
 *   beds     the zoned ambience's loops (ForestAmbience plays them): hollow · pond · cabin (+ creek · waterfall · mill · ridge ·
 *            oldgrowth · cave · night · nightfog · rain-canopy · rain-open · dawn, ready for zones / the clock / the weather)
 *   shots    ready for events that do not exist yet: the lever-action (cycle, shot, the ridge echo), the longbow, a bolt on rock,
 *            the deer's alarm snort, the thralls (call, groan, move), the Antler King (bells, stomp, roar), cabin doors, lanterns,
 *            the zipline
 *   barks    the ranger, the miller and the trader (8 short non-verbal / one-word barks each; PH-U23)
 *
 *   const sfx = new PineHollowSfx(audio);          // ForestAmbience makes one: `ambience.sfx`
 *   sfx.setListener(x, y, z, yaw)                  // per frame (ForestAmbience does it)
 *   sfx.shot('king_roar', { at: pos })             // false = not decoded yet (it starts decoding) or not in the build
 *   sfx.bark('ranger', npcPos)                     // a random bark of that NPC, never the one it played last
 *   await sfx.bed('pond')                          // a decoded bed loop (ForestAmbience), or undefined
 *
 * Loaded at Pine Hollow's loading bar (E44 — src/boot/audioFiles.ts `audioFiles('pine-hollow')`, src/boot/extras.ts; the
 * set is not one of Settings' SFX_SETS, so Driftwood's bar never lists it): every file is downloaded there (the service
 * worker keeps each, so an offline launch reads them back), and the one-shots + barks are DECODED there too
 * (`decodePineShots`, held module-wide in `barShots`) so no first shot / bark is ever silent. The one-shots + barks ship as
 * ONE audio sprite (sfx.json `sprite`, scripts/music/gen/sfx_sprite.py): one request, one decode, and each take plays as a
 * slice of that one buffer; a manifest without a sprite still loads one file per take. The beds are decoded from the
 * offline cache when a zone first wants one (~6 MB of PCM each, the mono ones half; ForestAmbience lets them go again).
 * Settings ▸ Sound effects = Synth silences the set. Every play / bark lands in `window.__audioLog` (src/audio/audioLog.ts).
 */
import { SFX_MANIFESTS } from '../boot/audio.generated';
import { PUBLIC_BYTES } from '../boot/bytes.generated';
import { getSfxSet } from '../ui/Settings';
import type { Audio } from './Audio';
import { cachedBytes, decodeBytes } from './preload';
import { audioLog } from './audioLog';

export type PhBed = 'hollow' | 'pond' | 'cabin' | 'creek' | 'waterfall' | 'mill' | 'ridge' | 'oldgrowth' | 'cave' | 'night' | 'nightfog'
  | 'rain-canopy' | 'rain-open' | 'dawn';
export type PhShot = 'boltImpact-rock' | 'deer_snort' | 'leverCycle' | 'leverShot' | 'leverEcho' | 'longbowDraw' | 'longbowLoose'
  | 'thrall_call' | 'thrall_groan' | 'thrall_move' | 'king_bells' | 'king_stomp' | 'king_roar' | 'doorOpen' | 'doorClose'
  | 'lanternLight' | 'lanternCreak' | 'zipline';
export type Npc = 'ranger' | 'miller' | 'trader';
export const PH_BEDS: readonly PhBed[] = ['hollow', 'pond', 'cabin', 'creek', 'waterfall', 'mill', 'ridge', 'oldgrowth', 'cave', 'night', 'nightfog', 'rain-canopy', 'rain-open', 'dawn'];
export const NPCS: readonly Npc[] = ['ranger', 'miller', 'trader'];

/** a decoded bed: the buffer, its loop points, its level and the zone it belongs to (sfx.json) */
export interface PhLoop { buffer: AudioBuffer; loopStart: number; loopEnd: number; gain: number; zone: string | undefined; live: boolean }
export interface PhPlay { at?: { x: number; y: number; z: number } | undefined; gain?: number; pan?: number; out?: AudioNode }

const SET = 'pine-hollow';
const DIR = `/assets/sfx/${SET}/`;
const TABLE: Readonly<Record<string, number>> = PUBLIC_BYTES;
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const num = (v: unknown, d: number): number => (typeof v === 'number' && Number.isFinite(v) ? v : d);
const file = (v: unknown): string | undefined => (typeof v === 'string' && !v.includes('..') && !v.includes('/') && `${DIR}${v}` in TABLE ? `${DIR}${v}` : undefined);
/** each bark's level against the one-shots (-18 LUFS): a voice sits a little under a gunshot */
const BARK_GAIN = 0.8;

/** one take of a family: a slice of a decoded buffer — the sprite's (no copy: `start(when, offset, duration)`), or a whole file's */
interface Clip { buffer: AudioBuffer; offset: number; duration: number }
const whole = (buffer: AudioBuffer): Clip => ({ buffer, offset: 0, duration: buffer.duration });

/** the one-shots + barks decoded at the loading bar (`decodePineShots`), shared by every PineHollowSfx */
const barShots = new Map<string, Clip[]>();
const manifestOf = (): Record<string, unknown> | undefined => { const m = SFX_MANIFESTS[SET]; return isObj(m) ? m : undefined; };
/** the file names one-shot `family` lists in `manifest` (its takes; packed into the sprite or files of their own) */
function familyNames(manifest: Record<string, unknown> | undefined, family: string): string[] {
  const o = manifest?.['oneshots'], v = isObj(o) ? o[family] : undefined;
  const list: unknown[] = Array.isArray(v) ? v : isObj(v) && Array.isArray(v['files']) ? v['files'] : [];
  return list.filter((f): f is string => typeof f === 'string');
}
/** the files of one-shot `family` in `manifest` (URLs) — a set without a sprite */
const familyFiles = (manifest: Record<string, unknown> | undefined, family: string): string[] =>
  familyNames(manifest, family).map(file).filter((u): u is string => u !== undefined);

/**
 * The audio sprite (scripts/music/gen/sfx_sprite.py): every one-shot + bark packed into ONE file, so the loading bar fetches
 * and decodes one file, not 63. sfx.json `sprite: {file, clips: {<take's file name>: [startSec, durSec]}}`; the families
 * still list their takes by name. undefined = a set without one (an older build, a regeneration not yet packed): one file
 * per take, as before.
 */
interface Sprite { url: string; clips: ReadonlyMap<string, Readonly<{ offset: number; duration: number }>> }
function spriteOf(manifest: Record<string, unknown> | undefined): Sprite | undefined {
  const s = manifest?.['sprite'], url = isObj(s) ? file(s['file']) : undefined, c = isObj(s) ? s['clips'] : undefined;
  if (url === undefined || !isObj(c)) return undefined;
  const clips = new Map<string, { offset: number; duration: number }>();
  for (const [name, v] of Object.entries(c)) {
    const pair: unknown[] = Array.isArray(v) ? v : [], offset = pair[0], duration = pair[1];
    if (typeof offset === 'number' && typeof duration === 'number' && offset >= 0 && duration > 0) clips.set(name, { offset, duration });
  }
  return { url, clips };
}
/** every family of `manifest` cut from the decoded sprite `buffer` into `into` (a take past the buffer's end is left out) */
function cutSprite(manifest: Record<string, unknown> | undefined, sprite: Sprite, buffer: AudioBuffer, into: Map<string, Clip[]>): void {
  const o = manifest?.['oneshots'];
  if (!isObj(o)) return;
  for (const family of Object.keys(o)) {
    const clips: Clip[] = [];
    for (const name of familyNames(manifest, family)) {
      const c = sprite.clips.get(name);
      if (c && c.offset + c.duration <= buffer.duration + 0.001) clips.push({ buffer, offset: c.offset, duration: c.duration });
    }
    if (clips.length > 0) into.set(family, clips);
  }
}
const why = (e: unknown): string => (e instanceof Error ? e.message : String(e));

/** every one-shot + bark file of the set (URLs) — what the loading bar decodes (`decodePineShots`): the sprite, or one per take */
export function pineShotFiles(): string[] {
  const m = manifestOf(), sprite = spriteOf(m);
  if (sprite) return [sprite.url];
  const o = m?.['oneshots'];
  return isObj(o) ? [...new Set(Object.keys(o).flatMap((f) => familyFiles(m, f)))] : [];
}
/**
 * Decode every one-shot + bark of the set at the loading bar (src/boot/extras.ts) from `read` (the bar's counted fetch):
 * `onFile` ticks per file of `pineShotFiles()` (the sprite: once). A file that fails is skipped (its family plays its other
 * takes, or nothing — the sprite: every family decodes lazily on its first play instead); never rejects.
 */
export async function decodePineShots(read: (url: string) => Promise<ArrayBuffer>, onFile?: () => void): Promise<void> {
  const m = manifestOf(), o = m?.['oneshots'];
  if (!isObj(o)) return;
  const sprite = spriteOf(m);
  if (sprite) {
    try { cutSprite(m, sprite, await decodeBytes(await read(sprite.url)), barShots); } catch (e) { console.info(`[sfx] ${sprite.url}: ${why(e)} — the one-shots decode on first play`); }
    onFile?.();
    return;
  }
  await Promise.all(Object.keys(o).map(async (family) => {
    const clips: Clip[] = [];
    for (const u of familyFiles(m, family)) {
      try { clips.push(whole(await decodeBytes(await read(u)))); } catch (e) { console.info(`[sfx] ${u}: ${why(e)} — that take is skipped`); }
      onFile?.();
    }
    if (clips.length > 0) barShots.set(family, clips);
  }));
}

export class PineHollowSfx {
  private readonly manifest: Record<string, unknown> | undefined;
  private beds = new Map<string, Promise<PhLoop | undefined>>();
  private shots = new Map<string, Clip[]>();
  private loading = new Set<string>();
  /** the sprite's lazy decode (the bar did not decode it): once, shared by every family; cleared if it fails */
  private spriteLoad: Promise<void> | undefined;
  private lastBark = new Map<Npc, string>();
  private lx = 0; private ly = 0; private lz = 0; private yaw = 0;
  private prefetched = false;

  constructor(private readonly audio: Audio) {
    this.manifest = manifestOf();
  }

  /** the build ships the set and Settings plays generated sound effects */
  get available(): boolean { return this.manifest !== undefined && getSfxSet() !== 'synth'; }
  /** diagnostics: which families are decoded */
  get decoded(): string[] { return [...new Set([...barShots.keys(), ...this.shots.keys()])]; }
  private buffers(family: string): Clip[] | undefined { return this.shots.get(family) ?? barShots.get(family); }

  setListener(x: number, y: number, z: number, yaw: number): void { this.lx = x; this.ly = y; this.lz = z; this.yaw = yaw; }

  /** the beds sfx.json lists, with their zone and whether that zone is in the world today */
  bedsListed(): { name: string; zone: string | undefined; live: boolean }[] {
    const b = this.manifest?.['beds'];
    if (!isObj(b)) return [];
    return Object.entries(b).map(([name, v]) => ({ name, zone: isObj(v) && typeof v['zone'] === 'string' ? v['zone'] : undefined, live: isObj(v) && v['live'] === true }));
  }

  /** a bed, decoded once (its promise is shared); undefined when the set / bed is not in the build or will not decode */
  bed(name: PhBed): Promise<PhLoop | undefined> {
    const have = this.beds.get(name);
    if (have) return have;
    const p = (async (): Promise<PhLoop | undefined> => {
      if (!this.available) return undefined;
      const b = this.manifest?.['beds'], v = isObj(b) ? b[name] : undefined;
      if (!isObj(v)) return undefined;
      const url = file(v['file']);
      if (url === undefined) return undefined;
      try {
        const buffer = await decodeBytes(await cachedBytes(url));
        const loopEnd = Math.min(buffer.duration, num(v['loopEnd'], buffer.duration)), loopStart = Math.max(0, Math.min(loopEnd - 0.05, num(v['loopStart'], 0)));
        return { buffer, loopStart, loopEnd, gain: num(v['gain'], 0.5), zone: typeof v['zone'] === 'string' ? v['zone'] : undefined, live: v['live'] === true };
      } catch (e) { console.info(`[sfx] ${url}: ${e instanceof Error ? e.message : String(e)} — that bed stays silent`); return undefined; }
    })();
    this.beds.set(name, p);
    return p;
  }
  /** let a bed's buffer go (a zone left far behind); the next `bed()` decodes it again */
  dropBed(name: PhBed): void { this.beds.delete(name); }

  /** the files of one-shot `family` in the manifest (URLs) */
  private files(family: string): string[] { return familyFiles(this.manifest, family); }
  /** decode these one-shot families in the background (the first play of an undecoded family is otherwise silent) */
  prewarm(families: readonly string[]): void { for (const f of families) this.load(f); }
  private load(family: string): void {
    if (!this.available || this.buffers(family) || this.loading.has(family)) return;
    const sprite = spriteOf(this.manifest);
    if (sprite) { // one decode of the one file cuts every family
      this.spriteLoad ??= (async () => {
        try { cutSprite(this.manifest, sprite, await decodeBytes(await cachedBytes(sprite.url)), this.shots); } catch (e) {
          console.info(`[sfx] ${sprite.url}: ${why(e)} — the one-shots stay silent for now`);
          this.spriteLoad = undefined; // the next play tries again
        }
      })();
      return;
    }
    const urls = this.files(family);
    if (urls.length === 0) return;
    this.loading.add(family);
    void (async () => {
      const clips: Clip[] = [];
      for (const u of urls) { try { clips.push(whole(await decodeBytes(await cachedBytes(u)))); } catch { /* that variant is skipped */ } }
      this.loading.delete(family);
      if (clips.length > 0) this.shots.set(family, clips);
    })();
  }

  /** a random variant of `family` (±40 cents), placed in the world when `at` is given; false = not decoded (yet) or not shipped */
  shot(family: PhShot, o: PhPlay = {}): boolean { const ok = this.play(family, o); audioLog('sfx', family, ok); return ok; }
  /** any family of the set by name (a PhShot, a bark) — `shot` is the typed door */
  play(family: string, o: PhPlay = {}): boolean {
    if (!this.audio.ready || !this.available) return false;
    const clips = this.buffers(family);
    if (!clips) { this.load(family); return false; }
    const clip = clips[Math.floor(Math.random() * clips.length)];
    if (!clip) return false;
    const c = this.audio.ctx, t = c.currentTime + 0.01;
    let gain = o.gain ?? 1, pan = o.pan ?? 0, cutoff = 20000;
    if (o.at) {
      const dx = o.at.x - this.lx, dy = o.at.y - this.ly, dz = o.at.z - this.lz, d = Math.hypot(dx, dy, dz);
      if (d > 220) return true;
      gain *= 1 / (1 + d / 10) ** 1.3;
      const rx = Math.cos(this.yaw), rz = -Math.sin(this.yaw); // the listener's right vector (Player.yaw's convention)
      pan = d > 0.5 ? Math.max(-1, Math.min(1, (dx * rx + dz * rz) / d)) * 0.8 : 0;
      cutoff = 12000 / (1 + d / 30);
    }
    const s = c.createBufferSource(); s.buffer = clip.buffer; s.playbackRate.value = 2 ** ((Math.random() * 80 - 40) / 1200);
    const g = c.createGain(); g.gain.value = gain;
    let node: AudioNode = s.connect(g);
    if (cutoff < 19000) { const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = cutoff; node = node.connect(lp); }
    if (pan !== 0 && 'createStereoPanner' in c) { const p = c.createStereoPanner(); p.pan.value = pan; node = node.connect(p); }
    node.connect(o.out ?? this.audio.sfx);
    s.start(t, clip.offset, clip.duration); // `duration` is buffer time: the ±40 cents do not change which samples play
    return true;
  }

  /** the barks this build ships for `npc` (family names) */
  barks(npc: Npc): string[] {
    const o = this.manifest?.['oneshots'];
    return isObj(o) ? Object.keys(o).filter((k) => k.startsWith(`bark-${npc}-`)).sort() : [];
  }
  /** one of `npc`'s barks, at random, never the one it played last; false = none decoded yet (they start decoding) */
  bark(npc: Npc, at?: { x: number; y: number; z: number }): boolean {
    const all = this.barks(npc);
    if (all.length === 0) { audioLog('bark', npc, false, 'none shipped'); return false; }
    const ready = all.filter((f) => this.buffers(f) !== undefined);
    if (ready.length < all.length) this.prewarm(all);
    const pool = ready.length > 1 ? ready.filter((f) => f !== this.lastBark.get(npc)) : ready;
    const f = pool[Math.floor(Math.random() * pool.length)];
    if (f === undefined) { audioLog('bark', npc, false, 'not decoded'); return false; }
    this.lastBark.set(npc, f);
    const ok = this.play(f, { at, gain: BARK_GAIN });
    audioLog('bark', npc, ok, f);
    return ok;
  }

  /** every file of the set (URLs) */
  allFiles(): string[] {
    const out: string[] = [];
    const walk = (v: unknown): void => {
      if (typeof v === 'string') { const u = file(v); if (u !== undefined && /\.(m4a|mp3|ogg|opus)$/.test(u)) out.push(u); }
      else if (Array.isArray(v)) for (const x of v) walk(x);
      else if (isObj(v)) for (const [k, x] of Object.entries(v)) if (k !== 'provenance') walk(x);
    };
    walk(this.manifest);
    return [...new Set(out)];
  }
  /** pull the whole set into the offline cache when the browser is idle (once): later decodes never wait on the network */
  prefetch(): void {
    if (this.prefetched || !this.available) return;
    this.prefetched = true;
    const files = this.allFiles();
    const idle = (window as unknown as { requestIdleCallback?: (fn: () => void) => void }).requestIdleCallback;
    const go = (): void => { void (async () => { for (const f of files) { try { await cachedBytes(f); } catch { /* offline: decoded later, or silent */ } } })(); };
    if (idle) idle(go); else window.setTimeout(go, 3000);
  }
}
