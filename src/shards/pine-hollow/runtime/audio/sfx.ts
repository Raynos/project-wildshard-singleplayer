import { app } from '@wildshard/engine/app/runtime';
import type { Audio } from '@wildshard/engine/audio/Audio';
import { audioLog } from '@wildshard/engine/audio/audioLog';
import { cachedBytes, decodeBytes } from '@wildshard/engine/audio/preload';
import { CueCatalogue, type SampleClip } from '@wildshard/engine/audio/Cues';
import source from '../../shard.config';
import { getSfxSet } from '@wildshard/engine/ui/Settings';
/**
 * PineHollowSfx — Pine Hollow's own generated sounds (PINE-HOLLOW-REMASTER PH-A2..A4): public/assets/sfx/pine-hollow/sfx.json,
 * the better take per sound of MOSS-SoundEffect v2 and Stable Audio 3 Medium (scripts/music/gen/sfx_merge.py --jobs
 * sfx-ph-jobs.json; the decision rows are in scripts/music/gen/sfx-best.json). The sounds the game already plays through
 * Audio.ts (crossbow, animals, footsteps) went into the one merged set `best/`; this set holds the rest:
 *
 *   beds     the zoned ambience's loops (ForestAmbience plays them): hollow · pond · cabin (+ creek · waterfall · mill · ridge ·
 *            oldgrowth · cave · night · nightfog · rain-canopy · rain-open · dawn, ready for zones / the clock / the weather)
 *   shots    the lever-action (cycle, shot, the ridge echo, the dry click, a round through the gate), the longbow (draw,
 *            loose), a bolt / arrow on rock, the deer's alarm snort, the thralls (call, groan, move), the Antler King (bells,
 *            stomp, roar), cabin doors, lanterns, the zipline; the life's birds (the ravens' caw / pair / take-off flaps, the
 *            owl's hoot, the woodpecker's drum + call) and the skinning knife's two strokes (src/shards/pine-hollow/life/)
 *   barks    the ranger, the miller and the trader (8 short non-verbal / one-word barks each; PH-U23)
 *
 *   const sfx = new PineHollowSfx(audio);          // ForestAmbience makes one: `ambience.sfx`
 *   sfx.setListener(x, y, z, yaw)                  // per frame (ForestAmbience does it)
 *   sfx.shot('king_roar', { at: pos })             // false = not decoded yet (it starts decoding) or not in the build
 *   sfx.bark('ranger', npcPos)                     // a random bark of that NPC, never the one it played last
 *   await sfx.bed('pond')                          // a decoded bed loop (ForestAmbience), or undefined
 *
 * Loaded at Pine Hollow's loading bar (E44 — src/engine/boot/audioFiles.ts `audioFiles('pine-hollow')`, src/engine/boot/extras.ts; the
 * set is not one of Settings' SFX_SETS, so Driftwood's bar never lists it): every file is downloaded there (the service
 * worker keeps each, so an offline launch reads them back), and the one-shots + barks are DECODED there too
 * (`decodePineShots`, held module-wide in `barShots`) so no first shot / bark is ever silent. The one-shots + barks ship as
 * ONE audio sprite (sfx.json `sprite`, scripts/music/gen/sfx_sprite.py): one request, one decode, and each take plays as a
 * slice of that one buffer; a manifest without a sprite still loads one file per take. The beds are decoded from the
 * offline cache when a zone first wants one (~6 MB of PCM each, the mono ones half; ForestAmbience lets them go again).
 * Settings ▸ Sound effects = Synth silences the set. Every play / bark lands in `window.__audioLog` (src/engine/audio/audioLog.ts).
 */

export type PhBed = 'hollow' | 'pond' | 'cabin' | 'creek' | 'waterfall' | 'mill' | 'ridge' | 'oldgrowth' | 'cave' | 'night' | 'nightfog'
  | 'rain-canopy' | 'rain-open' | 'dawn';
export type PhShot = 'boltImpact-rock' | 'deer_snort' | 'leverCycle' | 'leverShot' | 'leverEcho' | 'longbowDraw' | 'longbowLoose'
  | 'thrall_call' | 'thrall_groan' | 'thrall_move' | 'king_bells' | 'king_stomp' | 'king_roar' | 'doorOpen' | 'doorClose'
  | 'lanternLight' | 'lanternCreak' | 'zipline'
  // the sound-gaps round: the lever gun's dry click + a round thumbed through its gate; the life's birds; the skinning strokes
  | 'leverDry' | 'leverRoundIn' | 'raven_caw' | 'raven_pair' | 'raven_flap' | 'owl_hoot' | 'woodpecker_drum' | 'woodpecker_call'
  | 'skinCut-a' | 'skinCut-b';
export type Npc = 'ranger' | 'miller' | 'trader';
export const PH_BEDS: readonly PhBed[] = ['hollow', 'pond', 'cabin', 'creek', 'waterfall', 'mill', 'ridge', 'oldgrowth', 'cave', 'night', 'nightfog', 'rain-canopy', 'rain-open', 'dawn'];
export const NPCS: readonly Npc[] = ['ranger', 'miller', 'trader'];

/** a decoded bed: the buffer, its loop points, its level and the zone it belongs to (sfx.json) */
export interface PhLoop { buffer: AudioBuffer; loopStart: number; loopEnd: number; gain: number; zone: string | undefined; live: boolean }
export interface PhPlay { at?: { x: number; y: number; z: number } | undefined; gain?: number; pan?: number; out?: AudioNode }

const SET = 'pine-hollow';
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const BARK_GAIN = 0.8;
const barShots=new Map<string,SampleClip[]>();
const catalogue=(read:Parameters<typeof decodePineShots>[0]=cachedBytes):CueCatalogue=>new CueCatalogue(SET,read,decodeBytes,{tolerance:0.001,arrayFamilies:true,familyGain:false,loopGain:0.5,available:()=>getSfxSet()!=='synth',shared:barShots});
/** The loading bar's exact sprite or family URLs, without decoding or copying PCM. */
export function pineShotFiles():string[]{return catalogue().shotFiles();}
/** Counted boot decoding retains the shared sprite slices and skipped-take policy. */
export async function decodePineShots(read:(url:string)=>Promise<ArrayBuffer>,onFile?:()=>void):Promise<void>{await catalogue(read).decodeShots(onFile);}

export class PineHollowSfx {
  private readonly manifest: Record<string, unknown> | undefined;
  private readonly catalogue:CueCatalogue;
  private lastBark = new Map<Npc, string>();
  private readonly playback:ReturnType<Audio['voices']['playback']>;

  constructor(audio: Audio) {
    this.catalogue=catalogue();this.manifest=this.catalogue.manifest;const rows=source.audio.playback;if(rows===undefined)throw new Error('Missing forest playback');this.playback=audio.voices.playback(rows,{available:()=>this.available,samples:{clips:id=>this.catalogue.clips(id),load:id=>{this.catalogue.load(id);}}});
  }

  /** the build ships the set and Settings plays generated sound effects */
  get available(): boolean { return this.catalogue.available; }
  /** diagnostics: which families are decoded */
  get decoded(): string[] { return this.catalogue.decoded; }
  private buffers(family:string):SampleClip[]|undefined{return this.catalogue.clips(family);}

  setListener(x: number, y: number, z: number, yaw: number): void {
    this.playback.listener(x,y,z,yaw);
  }

  /** a bed, decoded once (its promise is shared); undefined when the set / bed is not in the build or will not decode */
  bed(name: PhBed): Promise<PhLoop | undefined> {
    return this.catalogue.bed(name);
  }
  dropBed(name:PhBed):void {this.catalogue.dropBed(name);}
  prewarm(families:readonly string[]):void {this.catalogue.prewarm(families);}

  /** a random variant of `family` (±40 cents), placed in the world when `at` is given; false = not decoded (yet) or not shipped */
  shot(family: PhShot, o: PhPlay = {}): boolean { const ok = this.play(family, o); audioLog('sfx', family, ok); return ok; }
  /** any family of the set by name (a PhShot, a bark) — `shot` is the typed door */
  play(family: string, o: PhPlay = {}): boolean {
    return this.playback.play('shot',{family},o);
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
    const f = pool[app.rng.stream('cosmetic').int(0, pool.length - 1)]; // seeded: the harness pins it (E357 F2)
    if (f === undefined) { audioLog('bark', npc, false, 'not decoded'); return false; }
    this.lastBark.set(npc, f);
    const ok = this.play(f, { at, gain: BARK_GAIN });
    audioLog('bark', npc, ok, f);
    return ok;
  }

}
