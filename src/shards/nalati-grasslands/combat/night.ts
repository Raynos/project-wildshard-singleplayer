import { loadFirstPartyProduct } from '@wildshard/game/shardfile/runtimeProduct';
import type { NightRows } from './nightTypes';
import { NALATI_STRIKES, sampleStrike } from './strikes';
import type { TargetHit } from '@wildshard/engine/combat/types';
import type { Game } from '@wildshard/engine/core/Game';
import type { AnimalManager } from '@wildshard/engine/entities/AnimalManager';
import type { Player } from '@wildshard/engine/player/Player';
import type { DayCycleClock } from '@wildshard/engine/world/dayCycle';
import type { Forest } from '@wildshard/engine/world/forest/Forest';
import type { SkyRig as Sky } from '@wildshard/engine/world/skyRig';
import { encounterHit } from './damage';
import type * as THREE from 'three';





import type { Balbals } from '../world/Balbals';


import { wildEnv } from '@wildshard/game/population/pageGroups';
import * as v from 'valibot';
import { GhostRiders } from './ghostRiders';
import { CueDirector } from '@wildshard/game/audio/cueDirector';
import { SlotEncounterView } from '@wildshard/game/boss/presentation';
import { ReturnProgram } from '@wildshard/game/population/returnProgram';
import { BALBAL_SLAM, creatureGuest } from '../species/balbal';

/**
 * The dusk + night enemies (row B11 of project/archive/2026-09-23-nalati.md) as one piece for the shard wiring (src/shards/nalati-grasslands/index.ts):
 * the balbal warriors (night rows on game/boss/presentation SlotEncounterView — they wake at dusk) and the ghost riders (src/shards/nalati-grasslands/combat/ghostRiders.ts —
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
 * Damage to the player goes through `combat.hit` — main.ts's health, flash and sound — for the
 * balbals' slam (the species' `hurt`) and the riders' arrows alike. Dev: `?time=dusk` / `?time=night` (the weather row),
 * Debug ▸ Creatures & NPCs ▸ Balbal warriors / Ghost riders (wake now · never); `window.__balbals`, `window.__ghosts`.
 */

export interface NightEnemiesCtx { game: Game; sky: Sky; player: Player; forest: Forest; balbals: Balbals | null; clock: DayCycleClock }
export interface NightEnemies {
  balbals: SlotEncounterView;
  riders: GhostRiders;
  update: (dt: number, t: number) => void;
  attach: (animals: AnimalManager) => void;
  target: (origin: THREE.Vector3, dir: THREE.Vector3, maxDist: number, hit: TargetHit | null) => TargetHit | null;
}

/** Prepare the shared page/native firing rows before registering the existing night owners. */
export async function wireNightEnemies(ctx: NightEnemiesCtx): Promise<NightEnemies> {
  const product = await loadFirstPartyProduct('nalati-grasslands');
  const weather = await product.json<{ night: Omit<NightRows, 'program'>; reactions: unknown }>('world/weather.json');
  const program = v.parse(v.object({ script: v.unknown(),bytes: v.string() }),weather.reactions);
  const rows: NightRows = { ...weather.night, program };
  if (ctx.game.levelScope.disposed) throw new Error('Nalati night owner was disposed during admission');
  const cues = new CueDirector(ctx.game, rows.cues, ctx.game.levelScope);
  // the slam's wedge: the species' cone and reach, its wind-up and blow over the 2.9 s attack
  const tell = { ...rows.view.tell, cone: BALBAL_SLAM.cone, reach: BALBAL_SLAM.reach / 1.18, wind: BALBAL_SLAM.windup / 2.9, strike: BALBAL_SLAM.strike / 2.9 };
  const balbals = new SlotEncounterView(rows.slots, { ...rows.view, tell }, ReturnProgram.page(rows.program, ctx.game.levelScope),
    { scene: ctx.game.scene, cues, sites: ctx.balbals?.statues ?? null, guest: creatureGuest() });
  const riders = new GhostRiders({ game: ctx.game, sky: ctx.sky, player: ctx.player, forest: ctx.forest, clock: ctx.clock, cues }, rows);
  return {
    balbals, riders,
    update(dt, t) {
      for (const site of balbals.update(dt, { kind: Number(ctx.clock.dayPhase === 'dusk' || ctx.clock.dayPhase === 'night') })) ctx.balbals?.setAwake(site.index, site.awake === 1);
      riders.update(dt, t);
      cues.setLight(Math.max(0.25, wildEnv.light)); cues.update(dt);
    },
    attach(animals) {
      // never let a night enemy stop the shard's boot (the shared tree is everyone's): a failed build logs and switches it off
      try { balbals.attachActors(animals); } catch (e) { console.error('[B11] balbal warriors off:', e); }
      try { riders.attach(animals); } catch (e) { console.error('[B11] ghost riders off:', e); }
      // a ghost arrow hurts like any creature's blow (the pipeline: health, the red flash, the sound)
      riders.hurt = (damage, from) => {
        const a = from ?? riders.riders[0]?.a;
        if (a !== undefined) sampleStrike(NALATI_STRIKES.arrow, a, ctx.player.position, () => { encounterHit(a, damage, 'creature.ghost-rider', ctx.player.position); }, { origin: ctx.player.position });
      };
    },
    target(origin, dir, maxDist, hit) { return riders.riderTarget(origin, dir, maxDist, hit); },
  };
}
