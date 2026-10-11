import type { AnimalSim } from '@wildshard/engine/entities/AnimalSim';
import * as law from '@wildshard/game/plugin/bossPhase';

/** Historical fresh-body row; the canonical boss profile now defines its native law. */
export type MarkedBossFightRow = law.SpawnedBossRow;
/** Actual native body factory, with retirement before the next checkpoint spawn. */
export type MarkedBossBody<A extends AnimalSim> = law.SpawnedBossPorts<A>['body'];
/** Native host ports retained for the existing page and headless adapters. */
export type MarkedBossFightPorts<A extends AnimalSim> = law.SpawnedBossPorts<A>;
/** Exact historical weather and shield continuation. */
export type MarkedBossFightState = law.SpawnedBossState;
/** Historical fresh-body result; restore adopts the roster body without a spawn. */
export type MarkedBossFight<A extends AnimalSim> = law.SpawnedBossFight<A>;
/** The marked-boss name is the spawned pattern preset; both hosts use the same canonical boss law. */
export function markedBossFight<A extends AnimalSim>(row: MarkedBossFightRow, ports: MarkedBossFightPorts<A>): MarkedBossFight<A> {
  return law.bossFight({kind:'boss',pattern:'spawned',fight:row},ports);
}
