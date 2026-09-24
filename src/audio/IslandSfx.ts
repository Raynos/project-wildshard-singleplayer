/**
 * IslandSfx — Driftwood Isle's footsteps (B9) and combat layers (S3), played from the procedural bank (gen.ts via
 * audio.voices). Every call is a no-op before the first gesture; every play has ±5 % pitch jitter and never repeats the
 * variant it played last.
 *
 *   const sfx = new IslandSfx(audio);
 *   sfx.footstep(surfaces.surfaceAt(x, z, y), speed)      // Player.onStep: speed = horizontal m/s (walk 4.3, sprint 7.2)
 *
 *   // combat (the feel-agent's calls — src/player/Sword.ts, src/entities/*)
 *   sfx.whoosh(speed, { heavy, dir })   // a swing: speed 0…1 (the blade's angular speed, normalised) → pitch + level; heavy = the
 *                                       //   charged overhead's longer, lower sweep; dir −1 / +1 sweeps the pan right→left / left→right
 *   sfx.impact(material, strength, at?) // a hit: contact transient + material body — 'flesh' | 'shell' | 'wood' | 'stone';
 *                                       //   strength 0…1 (light combo … finisher) → level + pitch; `at` places it in the world
 *   sfx.vocal(enemy, at, intensity?)    // 'boar' grunt · 'crab' clack · 'monkey' screech · 'sailor' moan (aggro / hurt barks)
 *   sfx.windup(enemy, at)               // the telegraph, as the wind-up pose starts: 'boar' hoof scrape · 'crab' claw raise · 'sailor' lantern flare
 *   sfx.plunge(up)                      // crossing the water surface (Player.onSubmerge → false, onSurface → true), over audio.dive()/surface()
 *   sfx.interact(sound, at?, o?)        // the adventure kit (S4): 'chest' open · 'locked' rattle · 'lever' clunk · 'plate' grind
 *                                       //   (o.release: lighter, quicker) · 'door' creak · 'grate' iron grind · 'chime' pickup
 *                                       //   (sea glass, keys) · 'glyph' shard (brighter) · 'ignite' the beacon; o.delay / o.gain
 *   sfx.animal(name, at)                // AnimalManager.onSound on the island: the enemies' calls from the bank (boar grunt, crab
 *                                       //   clack, monkey shriek, sailor moan); false = not covered, play audio.animal()
 *
 * Player hurt / death are on Audio itself (both shards): `audio.hurt(intensity)`, `audio.death()`.
 */
import type { Audio } from './Audio';
import type { Surface } from './Surface';
import type { Enemy, InteractSound, Material, WindupEnemy } from './gen';

export type { Enemy, InteractSound, Material, WindupEnemy } from './gen';
export type { Surface } from './Surface';
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

export class IslandSfx {
  private side = 1;
  private armed = false;
  /** diagnostics: the last footstep's surface / gain / rate */
  lastStep: { surface: Surface; gain: number; rate: number } | undefined;

  constructor(private readonly audio: Audio) {}

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

  /** an interactable's sound (the adventure kit, src/world/interact/*), placed at the object */
  interact(sound: InteractSound, at?: At, o: { gain?: number; delay?: number; release?: boolean } = {}): void {
    const base = INTERACT_LEVEL[sound] * (o.gain ?? 1) * (o.release === true ? 0.6 : 1);
    this.audio.voices.play(`ui-${sound}`, { gain: base, rate: o.release === true ? 1.18 : 1, at, delay: o.delay ?? 0, jitter: sound === 'chime' || sound === 'glyph' ? 0.02 : 0.05 });
  }

  /** the island's creature calls (AnimalManager.onSound names) from the bank; returns false for a name it does not cover */
  animal(name: string, at: At): boolean {
    const e: Enemy | undefined = name === 'boar_grunt' ? 'boar' : name === 'crab_click' ? 'crab' : name === 'monkey_shriek' ? 'monkey' : name === 'sailor_groan' ? 'sailor' : undefined;
    if (e === undefined) return false;
    this.vocal(e, at);
    return true;
  }

  plunge(up: boolean): void { this.audio.voices.play(up ? 'plunge-up' : 'plunge-down', { gain: up ? 0.35 : 0.5 }); }
}
