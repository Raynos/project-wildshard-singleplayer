/**
 * The model registry Explore World reads (project/archive/2026-09-23-explore-world.md X10) — a view onto the one world
 * registry (src/world/registry.ts, ENGINE-FIT E1): a built piece registered with `model` is in the Model Explorer's
 * catalog and the World Explorer's tap-to-select, so a shard's setup registers each thing once (main.ts `addBuilt(…,
 * model)`). Explore itself knows no shard; the rest of Explore stays a lazy chunk.
 *
 *   registerModel({ …, live: false, object: () => buildOne(), buildAt: (tier) => … });   // one of a batch, built on view
 *   registerPick({ object: palms.mesh, entry: 'palm', boxAt: (hit) => boxOfThePalmAt(hit) }); // a tap on a batch mesh
 *   registeredModels() / registeredPicks()
 *
 * Creatures are not registered: Explore builds one per species the shard's AnimalManager actually has.
 */
import { activeRegistry, type RegisteredModel, type RegisteredPick } from '../world/registry';

export type { ModelCategory, RegisteredModel, RegisteredPick } from '../world/registry';

/** a model that is not a built piece of the world (one out of a batch, built alone on view): a model-only piece */
export function registerModel(m: RegisteredModel): void {
  activeRegistry().add({
    id: `model:${m.id}`, name: m.name, category: m.category, file: m.file,
    model: { id: m.id, category: m.category, live: m.live, object: m.object, ...(m.buildAt ? { buildAt: m.buildAt } : {}) },
  });
}
export function registerPick(p: RegisteredPick): void { activeRegistry().addPick(p); }
export function registeredModels(): readonly RegisteredModel[] { return activeRegistry().models(); }
export function registeredPicks(): readonly RegisteredPick[] { return activeRegistry().picks; }
