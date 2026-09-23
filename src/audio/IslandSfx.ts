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
 *
 * Player hurt / death are on Audio itself (both shards): `audio.hurt(intensity)`, `audio.death()`.
 */
import type { Audio } from './Audio';
import type { Surface } from './Surface';
import type { Enemy, Material, WindupEnemy } from './gen';

export type { Enemy, Material, WindupEnemy } from './gen';
export type { Surface } from './Surface';
interface At { x: number; y: number; z: number }

/** each surface's level at a walk (the bank is peak-normalised; these sit the steps where Audio.footstep's synth ones sat) */
const STEP_LEVEL: Record<Surface, number> = { sand: 0.34, wetSand: 0.36, grass: 0.3, rock: 0.34, planks: 0.42, stone: 0.36, water: 0.34 };
const VOCAL_LEVEL: Record<Enemy, number> = { boar: 0.75, crab: 0.6, monkey: 0.5, sailor: 0.85 };
const WINDUP_LEVEL: Record<WindupEnemy, number> = { boar: 0.7, crab: 0.65, sailor: 0.7 };
const SPRINT = 7.2;

/** the families the island plays first — prewarmed right after the first gesture, footsteps before combat */
export const ISLAND_FAMILIES = [
  'step-sand', 'step-planks', 'step-grass', 'step-wetSand', 'step-rock', 'step-water', 'step-stone',
  'whoosh', 'impact-flesh', 'hurt', 'impact-shell', 'impact-wood', 'impact-stone', 'whoosh-heavy',
  'vocal-boar', 'vocal-crab', 'vocal-monkey', 'vocal-sailor', 'windup-boar', 'windup-crab', 'windup-sailor',
  'plunge-down', 'plunge-up', 'death',
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

  plunge(up: boolean): void { this.audio.voices.play(up ? 'plunge-up' : 'plunge-down', { gain: up ? 0.35 : 0.5 }); }
}
