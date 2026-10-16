/**
 * Pine Hollow's image-to-3D hero props as rows (E315 M2, G465): the waystone lantern, the beaver dam, the canoe, the
 * lodge's contract board and the King's standing stones, each a TRELLIS.2 generation
 * (public/assets/models/pine-hollow-hero/<hero>/ + its LOD1). A row names its model, its hero files (more than one: one
 * variant each, a carved granite menhir in three shapes) and `far`: LOD0 (with shadow) until the nearest copy is that far
 * off, LOD1 past it; a copy collides as the hull of ≤ 180 of its LOD1's vertices (../world/hero.ts). Placed by
 * ../world/landmarks.ts (each stone shape as its own set round the King's arena).
 */
import { defineModel, type ModelDef } from '@wildshard/engine/models/model';
import { heroFar, heroHull, heroNear } from '../world/hero';
import type { PineHeroId } from '../world/heroFiles';

const ROWS = [
  { id: 'pine-hollow/waystone', name: 'Waystone lantern', category: 'props', surface: 'stone', heroes: ['waystone'], far: 45 },
  { id: 'pine-hollow/beaver-dam', name: 'Beaver dam', category: 'nature', surface: 'wood', heroes: ['beaver-dam'], far: 50 },
  { id: 'pine-hollow/canoe', name: 'Canoe', category: 'props', surface: 'wood', heroes: ['canoe'], far: 40 },
  { id: 'pine-hollow/contract-board', name: 'Contract board', category: 'props', surface: 'wood', heroes: ['contract-board'], far: 40 },
  { id: 'pine-hollow/standing-stone', name: 'Standing stone', category: 'nature', surface: 'stone', heroes: ['stone-a', 'stone-b', 'stone-c'], far: 60 },
] as const;
interface HeroParams { readonly kind: PineHeroId }
type Model = ModelDef<HeroParams>;
const heroes = new Map(ROWS.flatMap((r): [PineHeroId, Model][] => {
  const kinds: readonly PineHeroId[] = r.heroes, model = defineModel<HeroParams>({
    id: r.id, name: r.name, category: r.category, pipeline: 'trellis', file: 'src/shards/pine-hollow/runtime/models/waystone.ts', surface: r.surface, defaults: { kind: r.heroes[0] },
    ...(kinds.length > 1 ? { variants: kinds.map((kind) => ({ id: kind, label: `Stone ${kind.slice(-1).toUpperCase()}`, params: { kind } })) } : {}),
    build: (ctx, p) => heroNear(ctx, p.kind), lods: [{ from: r.far, build: (ctx, p) => heroFar(ctx, p.kind) }],
    colliders: (p, ctx) => { const h = heroHull(ctx, p.kind); return h ? [{ kind: 'hull', x: 0, y: 0, z: 0, surface: r.surface, points: h }] : []; },
  });
  return kinds.map((kind) => [kind, model]);
}));

/** A hero prop's model (a standing stone's by its shape); throws for one without a row. */
export function heroModel(id: PineHeroId): Model {
  const m = heroes.get(id);
  if (m === undefined) throw new Error(`[pine-hollow] no hero model row for ${id}`);
  return m;
}
