import source from '../../shard.config';
import type { Scope } from '@wildshard/engine/app/scope';
import type { Audio } from '@wildshard/engine/audio/Audio';
import { impact, renderPcm } from '@wildshard/engine/audio/gen';
import { panFromYaw, WindGustBed } from '@wildshard/engine/audio/util';
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
 *   const bed = new IslandBed(audio);   // the ambience profile installs it: audio.installSynthBed(ISLAND_BED, bed, scope)
 *   bed.zone()                          // the zoned ambience took over the island's beds: the synth bed stops / never starts
 */

export type Material = 'flesh' | 'shell' | 'wood' | 'stone';
export type Enemy = 'boar' | 'crab' | 'monkey' | 'sailor';
export type WindupEnemy = 'boar' | 'crab' | 'sailor';
export type InteractSound = 'chest' | 'locked' | 'lever' | 'plate' | 'door' | 'grate' | 'chime' | 'glyph' | 'ignite';
interface At { x: number; y: number; z: number }


/** each surface's level at a walk (the bank is peak-normalised; these sit the steps where Audio.footstep's synth ones sat) */
const STEP_LEVEL: Record<Surface, number> = { sand: 0.34, wetSand: 0.36, grass: 0.3, rock: 0.34, planks: 0.42, stone: 0.36, water: 0.34 };
const VOCAL_LEVEL: Record<Enemy, number> = { boar: 0.75, crab: 0.6, monkey: 0.5, sailor: 0.85 };
const WINDUP_LEVEL: Record<WindupEnemy, number> = { boar: 0.7, crab: 0.65, sailor: 0.7 };
const SPRINT = 7.2;
const INTERACT_LEVEL: Record<InteractSound, number> = { chest: 0.7, locked: 0.6, lever: 0.7, plate: 0.65, door: 0.7, grate: 0.6, chime: 0.45, glyph: 0.6, ignite: 0.8 };

/** the families the island plays first — prewarmed right after the first gesture, footsteps before combat */
export const ISLAND_FAMILIES = [
  'step-sand', 'step-planks', 'step-grass', 'step-wetSand', 'step-rock', 'step-water', 'step-stone',
  'whoosh', 'impact-flesh', 'hurt', 'impact-shell', 'impact-wood', 'impact-stone', 'whoosh-heavy',
  'vocal-boar', 'vocal-crab', 'vocal-monkey', 'vocal-sailor', 'windup-boar', 'windup-crab', 'windup-sailor',
  'plunge-down', 'plunge-up', 'death',
  'ui-chime', 'ui-chest', 'ui-locked', 'ui-lever', 'ui-plate', 'ui-door', 'ui-grate', 'ui-glyph', 'ui-ignite',
] as const;

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
  private side = 1;
  private armed = false;
  /** diagnostics: the last footstep's surface / gain / rate */
  lastStep: { surface: Surface; gain: number; rate: number } | undefined;

  constructor(private readonly audio: Audio, scope?: Scope) { audio.voices.register(ISLAND_VOICES, scope); }

  /** render the island's one-shots in the background (call once the graph exists: after audio.resume()) */
  prewarm(): void { this.audio.voices.prewarm(ISLAND_FAMILIES); }

  /** one footfall. `speed` (m/s) scales level and pitch: a crouch-creep is soft and low, a sprint loud and bright */
  footstep(surface: Surface, speed: number): void {
    if (!this.armed && this.audio.ready) { this.armed = true; this.prewarm(); } // the first step after the gesture starts the background render
    const k = Math.max(0.2, Math.min(1.15, speed / SPRINT));
    this.side = -this.side;
    const gain = STEP_LEVEL[surface] * (0.35 + 0.65 * k), rate = 0.9 + 0.14 * k;
    this.lastStep = { surface, gain, rate };
    this.audio.voices.play(`step-${surface}`, { gain, rate, pan: this.side * 0.12 });
  }

  whoosh(speed = 0.6, o: { heavy?: boolean; dir?: -1 | 1 } = {}): void {
    const s = Math.max(0, Math.min(1, speed)), dir = o.dir ?? 1;
    if (o.heavy === true) this.audio.voices.play('whoosh-heavy', { gain: 0.45 + 0.2 * s, rate: 0.9 + 0.15 * s, pan: -0.35 * dir, panTo: 0.35 * dir });
    else this.audio.voices.play('whoosh', { gain: 0.22 + 0.3 * s, rate: 0.82 + 0.38 * s, pan: -0.4 * dir, panTo: 0.4 * dir });
  }

  impact(material: Material, strength = 0.6, at?: At): void {
    const s = Math.max(0, Math.min(1, strength));
    this.audio.voices.play(`impact-${material}`, { gain: 0.4 + 0.45 * s, rate: 1.04 - 0.1 * s, at });
  }

  vocal(enemy: Enemy, at?: At, intensity = 1): void {
    this.audio.voices.play(`vocal-${enemy}`, { gain: VOCAL_LEVEL[enemy] * Math.max(0.2, Math.min(1.3, intensity)), at });
  }

  windup(enemy: WindupEnemy, at?: At): void {
    this.audio.voices.play(`windup-${enemy}`, { gain: WINDUP_LEVEL[enemy], at });
  }

  /** an interactable's sound (the adventure kit), placed at the object */
  interact(sound: InteractSound, at?: At, o: { gain?: number; delay?: number; release?: boolean } = {}): void {
    const base = INTERACT_LEVEL[sound] * (o.gain ?? 1) * (o.release === true ? 0.6 : 1);
    this.audio.voices.play(`ui-${sound}`, { gain: base, rate: o.release === true ? 1.18 : 1, at, delay: o.delay ?? 0, jitter: sound === 'chime' || sound === 'glyph' ? 0.02 : 0.05 });
  }

  plunge(up: boolean): void { this.audio.voices.play(up ? 'plunge-up' : 'plunge-down', { gain: up ? 0.35 : 0.5 }); }

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

/** the bed id the island's synth bed answers to (the mixer's `setAmbient` id; the set's sampled `island` bed wins over it) */
export const ISLAND_BED = 'island';

/**
 * The island's synth bed (the mixer starts it when `island` is the bed and no sampled island bed decoded): a lighter,
 * warmer breeze than the pines (two wind bands with gentle gusts), the constant far surf hiss, and a swell rolling up the
 * beach every 6–9 s. Its gust and swell schedulers run on the bed's own Scope, disposed when the bed stops.
 */
export class IslandBed extends WindGustBed {
  private zoned = false;
  constructor(audio:Audio,preset=source.audio.ambience) { if(preset===null)throw new Error('Missing declared island wind'); super(audio,preset); }
  override start():void { if (!this.zoned) { super.start(); } }
  /** a zoned ambience replaces the synth bed: it is stopped / never started (a sampled bed still plays) */
  zone(): void {
    if (this.zoned) return;
    this.zoned = true;
    this.audio.restartSynthBed(ISLAND_BED);
  }

}
