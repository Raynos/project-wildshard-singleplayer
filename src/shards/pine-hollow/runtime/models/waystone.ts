/**
 * Pine Hollow's image-to-3D hero props as rows (E315 M2, G465): the waystone lantern, the beaver dam, the canoe and the
 * lodge's contract board, each a TRELLIS.2 generation (public/assets/models/pine-hollow-hero/<hero>/ + its LOD1). A row
 * names its model, its hero file and `far`: LOD0 (with shadow) until the nearest copy is that far off, LOD1 past it; a
 * copy collides as the hull of ≤ 180 of its LOD1's vertices (../world/hero.ts). Placed by ../world/landmarks.ts.
 */
import { defineModel, type ModelDef } from '@wildshard/engine/models/model';
import { heroFar, heroHull, heroNear } from '../world/hero';
import type { PineHeroId } from '../world/heroFiles';

const ROWS = [
  { id: 'pine-hollow/waystone', name: 'Waystone lantern', category: 'props', surface: 'stone', hero: 'waystone', far: 45 },
  { id: 'pine-hollow/beaver-dam', name: 'Beaver dam', category: 'nature', surface: 'wood', hero: 'beaver-dam', far: 50 },
  { id: 'pine-hollow/canoe', name: 'Canoe', category: 'props', surface: 'wood', hero: 'canoe', far: 40 },
  { id: 'pine-hollow/contract-board', name: 'Contract board', category: 'props', surface: 'wood', hero: 'contract-board', far: 40 },
] as const;
type Model = ModelDef<Record<string, never>>;
const heroes = new Map(ROWS.map((r): [PineHeroId, Model] => [r.hero, defineModel({
  id: r.id, name: r.name, category: r.category, pipeline: 'trellis', file: 'src/shards/pine-hollow/runtime/models/waystone.ts', surface: r.surface, defaults: {},
  build: (ctx) => heroNear(ctx, r.hero), lods: [{ from: r.far, build: (ctx) => heroFar(ctx, r.hero) }],
  colliders: (_p, ctx) => { const h = heroHull(ctx, r.hero); return h ? [{ kind: 'hull', x: 0, y: 0, z: 0, surface: r.surface, points: h }] : []; },
})]));

/** A hero prop's model; throws for one without a row. */
export function heroModel(id: PineHeroId): Model {
  const m = heroes.get(id);
  if (m === undefined) throw new Error(`[pine-hollow] no hero model row for ${id}`);
  return m;
}
