import type * as THREE from 'three';
import type { Game } from '../core/Game';
import type { Sky } from '../world/Sky';
import type { Player } from '../player/Player';
import type { Forest } from '../world/Forest';
import type { DayClock } from '../world/DayNight';
import type { Balbals } from '../world/nalati/Balbals';
import type { AnimalManager } from '../entities/AnimalManager';
import type { TargetHit } from '../player/Crossbow';
import type { NalatiKit } from '../player/nalatiKit';
import { wildEnv } from '../entities/wildEnv';
import { BalbalWarriors } from './balbalWarriors';
import { GhostRiders } from './ghostRiders';

/**
 * The dusk + night enemies (row B11 of docs/plans/NALATI.md) as one piece for the shard wiring (src/nalati/index.ts):
 * the balbal warriors (src/nalati/balbalWarriors.ts — they wake at dusk) and the ghost riders (src/nalati/ghostRiders.ts —
 * they ride at night). Both run off the weather row's clock (`weather.clock`); both are ordinary AnimalManager animals, so
 * the health bars, the damage numbers, the kill feed, the minimap, the aim assist and the achievements (Stonebreaker:
 * `progress.recordKill('balbal', …)`) all come for free.
 *
 *   const night = wireNightEnemies({ game, sky, player, forest, balbals: pois.balbals, clock: weather.clock });
 *   updates.push((dt, t) => night.update(dt, t));
 *   night.attach(animals)                       // in attachAnimals (their models are built now, not at dusk)
 *   night.bindKit(play.kit)                     // in bindPlay (the sabre / spear in hand feeds the balbals' damage model)
 *   hit = night.target(origin, dir, max, hit)   // in the Targets chain (sheepTarget): the ghost riders' torso + hood
 *
 * Damage to the player goes through `animals.onCharge(animal, damage)` — main.ts's health, flash and sound — for the
 * balbals' slam (the species' `hurt`) and the riders' arrows alike. Dev: `?time=dusk` / `?time=night` (the weather row),
 * `?balbals=wake|off`, `?balbalCount=n`, `?ghosts=line|off`; `window.__balbals`, `window.__ghosts`.
 */

export interface NightEnemiesCtx { game: Game; sky: Sky; player: Player; forest: Forest; balbals: Balbals | null; clock: DayClock }
export interface NightEnemies {
  balbals: BalbalWarriors;
  riders: GhostRiders;
  update: (dt: number, t: number) => void;
  attach: (animals: AnimalManager) => void;
  bindKit: (kit: NalatiKit | null) => void;
  target: (origin: THREE.Vector3, dir: THREE.Vector3, maxDist: number, hit: TargetHit | null) => TargetHit | null;
}

export function wireNightEnemies(ctx: NightEnemiesCtx): NightEnemies {
  const balbals = new BalbalWarriors({ scene: ctx.game.scene, balbals: ctx.balbals, clock: ctx.clock });
  const riders = new GhostRiders({ game: ctx.game, sky: ctx.sky, player: ctx.player, forest: ctx.forest, clock: ctx.clock });
  return {
    balbals, riders,
    update(dt, t) {
      balbals.update(dt, t, ctx.game.camera, ctx.game.renderer, wildEnv.light);
      riders.update(dt, t);
    },
    attach(animals) {
      // never let a night enemy stop the shard's boot (the shared tree is everyone's): a failed build logs and switches it off
      try { balbals.attach(animals); } catch (e) { console.error('[B11] balbal warriors off:', e); }
      try { riders.attach(animals); } catch (e) { console.error('[B11] ghost riders off:', e); }
      // a ghost arrow hurts like any creature's blow (main.ts's onCharge: health, the red flash, the sound)
      riders.hurt = (damage, from) => {
        const a = from ?? riders.riders[0]?.a;
        if (a !== undefined) animals.onCharge?.(a, damage);
      };
    },
    bindKit(kit) { balbals.bindKit(kit); },
    target(origin, dir, maxDist, hit) { return riders.riderTarget(origin, dir, maxDist, hit); },
  };
}
