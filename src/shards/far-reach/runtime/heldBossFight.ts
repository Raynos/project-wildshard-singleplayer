import type { Vector3 } from 'three';
import type { AnimalSim } from '@wildshard/engine/entities/AnimalSim';
import * as law from '@wildshard/game/plugin/bossPhase';

/** Historical retained-body row, with exactly the same floor, phase shares and reward/respawn points. */
export type HeldBossFightRow = law.HeldBossRow;
/** The body's native phase and restart state remains its own owner. */
export type HeldBossBrain = law.HeldBossBrain;
/** Exact historical retained-body continuation. */
export type HeldBossFight = law.HeldBossFight;
/** The held-boss name is the retained pattern preset, preserving null body/brain semantics and reset order. */
export function heldBossFight(row: HeldBossFightRow, body: AnimalSim | null, brain: HeldBossBrain | null, onVictory: (at: Vector3) => void): HeldBossFight {
  return law.bossFight({kind:'boss',pattern:'held',fight:row},{body,brain,victory:onVictory});
}
