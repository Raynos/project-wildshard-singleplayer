/**
 * The model registry Explore World reads (project/archive/2026-09-23-explore-world.md X10): a shard's setup registers the models it built, and
 * the Model Explorer's catalog + the World Explorer's tap-to-select are whatever is registered — Explore itself knows
 * no shard. Tiny and dependency-free on purpose: it is imported at boot by the shard's setup (Driftwood: main.ts →
 * src/explore/catalog.ts registerDriftwoodModels), the rest of Explore stays a lazy chunk.
 *
 *   registerModel({ id: 'hut', name: 'Hut', category: 'buildings', file: 'src/world/Hut.ts', live: true, object: () => hut.group });
 *   registerModel({ …, live: false, object: () => buildOne(), buildAt: (tier) => … });           // one of a batch, built on view
 *   registerPick({ object: palms.mesh, entry: 'palm', boxAt: (hit) => boxOfThePalmAt(hit) });    // a tap on a batch mesh
 *   registeredModels() / registeredPicks()
 *
 * Creatures are not registered: Explore builds one per species the shard's AnimalManager actually has.
 */
import type * as THREE from 'three';
import type { Tier } from '../core/tier';

export type ModelCategory = 'buildings' | 'nature' | 'creatures';

export interface RegisteredModel {
  id: string;
  name: string;
  category: ModelCategory;
  /** the source module an agent edits for this model */
  file: string;
  /** true: `object()` is already in the scene (the Model Explorer isolates it in place) */
  live: boolean;
  object: () => THREE.Object3D;
  /** a batch member's builder at a given detail tier (DETAIL TIERS); absent → one build for every tier */
  buildAt?: (tier: Tier) => THREE.Object3D;
}

/** a tap target that is not a registered model's own object: a batch mesh (one palm out of all of them) */
export interface RegisteredPick {
  object: THREE.Object3D;
  /** the registered model a hit on it opens */
  entry: string;
  /** the selection box for a hit at `point`; default: the object's box */
  boxAt?: (point: THREE.Vector3) => THREE.Box3;
}

const models: RegisteredModel[] = [];
const picks: RegisteredPick[] = [];

export function registerModel(m: RegisteredModel): void {
  const i = models.findIndex((x) => x.id === m.id);
  if (i !== -1) models[i] = m; else models.push(m);
}
export function registerPick(p: RegisteredPick): void { picks.push(p); }
export function registeredModels(): readonly RegisteredModel[] { return models; }
export function registeredPicks(): readonly RegisteredPick[] { return picks; }
