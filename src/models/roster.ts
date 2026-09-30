/**
 * Every shard's live models in its Model Explorer (E306 / E315 M5), listed once at boot (main.ts): the shared training
 * dummy, then the shard's roster (`ChunkDef.roster`: its creatures — the species list, alive now or not — its people and
 * the gear its player holds; a lazy loader, so the def stays node-safe). None of it is placed: the AnimalManager, the
 * quests and the weapons keep drawing the copies (./live.ts).
 */
import type * as THREE from 'three';
import type { AnimalStyle } from '../entities/AnimalFactory';
import type { Sky } from '../world/Sky';
import type { WorldRegistry } from '../world/registry';
import { creatureContext } from './creature';
import { listRoster, live, type RosterEntry } from './live';
import { trainingDummy } from './trainingDummy';

/** the practice arena's lineup: its three dummies (src/practice/TrainingArena.ts LINEUP) */
const ARENA_DUMMIES = 3;

export interface ShardModelsOptions {
  /** the shard's roster (ChunkDef.roster) */
  readonly roster: (() => Promise<readonly RosterEntry[]>) | undefined;
  /** its creature style (ChunkDef.style): the factory its creatures' specimens are built with */
  readonly style: AnimalStyle;
  readonly sky: Sky;
  readonly renderer: THREE.WebGLRenderer;
  /** the live animals (a creature's copies) */
  readonly animals: () => readonly { readonly kind: string }[];
  readonly registry: WorldRegistry;
}

/** List the shard's live models (the dummy at once, the roster once its module is in). */
export async function listShardModels(o: ShardModelsOptions): Promise<void> {
  const ctx = creatureContext(o.sky, o.style, o.renderer);
  listRoster([live(trainingDummy, { copies: ARENA_DUMMIES, drawnAs: 'skinned' })], ctx, o.animals, o.registry);
  try {
    const roster = await o.roster?.();
    if (roster) listRoster(roster, ctx, o.animals, o.registry);
  } catch (error) {
    console.warn('[models] the shard roster did not load; its creatures show from the live animals only', error);
  }
}
