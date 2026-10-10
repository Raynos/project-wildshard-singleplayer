import type { Vector3 } from 'three';
import type { BossDefinition } from '@wildshard/engine/ai/BossBrain';
import type { AnimalSim } from '@wildshard/engine/entities/AnimalSim';
import { heldBossFight, type HeldBossFight } from '@wildshard/game/shardfile/heldBossFight';
import { ROC_DEFINITION, ROC_FIGHT } from '../data/rocFight';
import type { StormRocBrain } from './stormRocBrain';

/** The encounter's card, phases and retry title (data/rocFight.ts); the browser's StormRocBoss and the headless runtime build the same one. */
export function rocBossDefinition(): BossDefinition { return ROC_DEFINITION; }

/**
 * The Storm Roc's fight, view-free (SF72): a platform held boss fight (@wildshard/game/shardfile/heldBossFight) on its row
 * (data/rocFight.ts ROC_FIGHT): the engine's BossBrain owns the intro, the HP-threshold phases, checkpoint and retry, and
 * victory; the script binds them to the Roc's body (phase 1 stoops from the storm, phase 2 sweeps gale walls across the
 * crown, phase 3 lands on the dais) and to the crown arena. The browser (combat/stormRoc.ts) and the headless runtime
 * (runtime/roc.ts) run this one script; presentation, input, respawn and persistence stay their own ports.
 */
export function rocEncounter<A extends AnimalSim>(roc: A | null, body: StormRocBrain<A> | null, onVictory: (at: Vector3) => void): HeldBossFight {
  return heldBossFight(ROC_FIGHT, roc, body, onVictory);
}
