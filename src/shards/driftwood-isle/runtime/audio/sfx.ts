import source from '../../shard.config';
import { ISLAND_FAMILIES } from '../../data/audioPlayback';
import type { Scope } from '@wildshard/engine/app/scope';
import type { Audio } from '@wildshard/engine/audio/Audio';
import { impact, renderPcm } from '@wildshard/engine/audio/gen';
import { panFromYaw } from '@wildshard/engine/audio/util';
import type { VoiceTable } from '@wildshard/engine/audio/Voices';
import { tap } from '@wildshard/engine/core/harnessTap';
import type { Vector3 } from 'three';
import type { Surface } from '../../data/audioSurfaces';
/**
 * Driftwood Isle's voice table (08 §6.3 C.2): the island's footsteps (B9) and combat layers (S3), played from the procedural
 * bank (gen.ts via audio.voices), the gull calls, and the island's synth bed (the warm breeze, the far surf hiss, the swells).
 * Every call is a no-op before the first gesture; every bank play has ±5 % pitch jitter and never repeats the variant it
 * played last. Moved verbatim from `src/engine/audio/IslandSfx.ts` and the S3.5 parking `legacyIsland.ts`: the `tap.sound`
 * ids, the envelopes and the RNG draw order are the engine's.
 *
 *   const sfx = new IslandSfx(audio);
 *   sfx.footstep(surfaces.surfaceAt(x, z, y), speed)      // Player.onStep: speed = horizontal m/s (walk 4.3, sprint 7.2)
 *   sfx.whoosh(speed, { heavy, dir })   // a swing: speed 0…1 → pitch + level; heavy = the charged overhead's longer, lower sweep;
 *                                       //   dir −1 / +1 sweeps the pan right→left / left→right
 *   sfx.impact(material, strength, at?) // a hit: contact transient + material body — 'flesh' | 'shell' | 'wood' | 'stone'
 *   sfx.vocal(enemy, at, intensity?)    // 'boar' grunt · 'crab' clack · 'monkey' screech · 'sailor' moan (aggro / hurt barks)
 *   sfx.windup(enemy, at)               // the telegraph, as the wind-up pose starts: 'boar' hoof scrape · 'crab' claw raise · 'sailor' lantern flare
 *   sfx.plunge(up)                      // crossing the water surface (Player.onSubmerge → false, onSurface → true), over audio.dive()/surface()
 *   sfx.interact(sound, at?, o?)        // the adventure kit (S4): 'chest' · 'locked' · 'lever' · 'plate' (o.release) · 'door' · 'grate'
 *                                       //   · 'chime' · 'glyph' · 'ignite'; o.delay / o.gain
 *   sfx.gullCallAt(position, listenerPos, yaw?)   // Gulls.onCall: a squawk with distance attenuation and a pan from the yaw
 *
 */

export type Material = 'flesh' | 'shell' | 'wood' | 'stone';
export type Enemy = 'boar' | 'crab' | 'monkey' | 'sailor';
export type WindupEnemy = 'boar' | 'crab' | 'sailor';
export type InteractSound = 'chest' | 'locked' | 'lever' | 'plate' | 'door' | 'grate' | 'chime' | 'glyph' | 'ignite';
interface At { x: number; y: number; z: number }


function pcm(id:string):Parameters<typeof renderPcm>[0]{const row=source.audio.pcm?.[id];if(row===undefined)throw new Error(`Missing creature PCM recipe: ${id}`);return row;}
const ENEMIES: readonly Enemy[] = ['boar', 'crab', 'monkey', 'sailor'];
/** the island's own families on the procedural bank (08 §6.3 C.2; the engine's FAMILIES rows until S4.3: same counts, rates, seeds) */
export const ISLAND_VOICES: VoiceTable = {
  'impact-shell': { n: 4, ch: 1, half: false, gen: (sr: number, seed: number) => impact('shell', sr, seed) },
  ...Object.fromEntries(ENEMIES.map((e) => [`vocal-${e}`, { n: 3, ch: 1, half: e === 'sailor' || e === 'boar', gen: (sr: number, seed: number) => renderPcm(pcm(`vocal.${e}`),sr,seed) }])),
  'windup-boar': { n: 2, ch: 1, half: false, gen: (sr: number, seed: number) => renderPcm(pcm('windup.boar'),sr,seed) },
  'windup-crab': { n: 2, ch: 1, half: false, gen: (sr: number, seed: number) => renderPcm(pcm('windup.crab'),sr,seed) },
  'windup-sailor': { n: 2, ch: 1, half: true, gen: (sr: number, seed: number) => renderPcm(pcm('windup.sailor'),sr,seed) },
};

export class IslandSfx {
  private readonly playback:ReturnType<Audio['voices']['playback']>;
  /** diagnostics: the last footstep's surface / gain / rate */
  lastStep: { surface: Surface; gain: number; rate: number } | undefined;

  constructor(private readonly audio: Audio, scope?: Scope) { audio.voices.register(ISLAND_VOICES, scope);const rows=source.audio.playback;if(rows===undefined)throw new Error('Missing island playback');this.playback=audio.voices.playback(rows); }

  /** render the island's one-shots in the background (call once the graph exists: after audio.resume()) */
  prewarm(): void { this.audio.voices.prewarm(ISLAND_FAMILIES); }

  /** one footfall. `speed` (m/s) scales level and pitch: a crouch-creep is soft and low, a sprint loud and bright */
  footstep(surface: Surface, speed: number): void {
    this.playback.play('step',{surface,speed});this.lastStep={surface,gain:this.playback.value('gain'),rate:this.playback.value('rate')};
  }
  whoosh(speed=0.6,o:{heavy?:boolean;dir?:-1|1}={}):void {this.playback.play(o.heavy===true?'heavy':'whoosh',{speed,dir:o.dir??1});}
  impact(material:Material,strength=0.6,at?:At):void {this.playback.play('impact',{material,strength},{at});}
  vocal(enemy:Enemy,at?:At,intensity=1):void {this.playback.play('vocal',{enemy,intensity},{at});}
  windup(enemy:WindupEnemy,at?:At):void {this.playback.play('windup',{enemy},{at});}
  interact(sound:InteractSound,at?:At,o:{gain?:number;delay?:number;release?:boolean}={}):void {
    this.playback.play('interact',{sound,gain:o.gain??1,delay:o.delay??0,release:o.release===true,jitter:sound==='chime'||sound==='glyph'?0.02:0.05},{at});
  }
  plunge(up:boolean):void {this.playback.play('plunge',{direction:up?'up':'down',up});}

  /** a gull's squawk: the set's sampled `gull` take when it decoded, else two (sometimes three) rasping saw notes */
  gullCall(pan = 0, gain = 1): void {
    const a = this.audio;
    tap.sound?.('gullCall');
    if (!a.ready || a.shot('gull', { pan, gain, out: a.ambient })) return;
    const phrase=source.audio.synth?.['gull'];if(phrase===undefined)throw new Error('Missing declared gull phrase');
    a.playPhrase(phrase,a.ambient,{pan,gain});
  }

  /** gullCall positioned like `audio.animal()`: distance attenuation + a stereo pan from the listener yaw */
  gullCallAt(position: Vector3, listenerPos: Vector3, yaw = this.audio.listenerYaw): void {
    tap.sound?.('gullCallAt');
    if (!this.audio.ready) return;
    const dx = position.x - listenerPos.x, dz = position.z - listenerPos.z, dy = position.y - listenerPos.y;
    const dist = Math.sqrt(dx * dx + dz * dz + dy * dy);
    if (dist > 160) return;
    const att = 1 / (1 + dist / 14) ** 1.3;
    const pan = panFromYaw(dx, dz, yaw, 0.8, dist);
    this.gullCall(pan, att);
  }
}

