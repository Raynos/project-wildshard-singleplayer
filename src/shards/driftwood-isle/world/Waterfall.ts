/**
 * Waterfall v3 (E150) — Driftwood's toon cascade, a stepped faceted curtain in the Wind Waker / Sea of Thieves manner.
 * It replaced the soft, blurred v2 curtain (DRIFTWOOD-REMASTER W5), which went in E162. SHARD-PLATFORM M3: the geometry
 * and the three draws are runtime/looks/cascade.ts; Driftwood's programs are material graphs as data (data/waterfallLook.ts,
 * W2 C2): three toon bands down each drop, a crisp white line at every brink, a scalloped foam band
 * where each step lands, bright streak dashes scrolling down; faceted foam rings on the pool; foam puffs toon-lit in two bands.
 *
 *   const fall = waterfallFor({ lip, foot, width: 2.2, ground: heightAt, poolRadius: 2.3 }).build();
 *   scene.add(fall.group);
 */
import type { Material } from 'three';
import { Cascade, type CascadeLike, type CascadeMaterials, type CascadeSpec } from '../runtime/looks/cascade';
import { CASCADE_LOOKS } from '../data/waterfallLook';

/** where the cascade pours, how wide, and its terraces (the cascade's spec without its materials) */
export type WaterfallSpec = Omit<CascadeSpec, 'materials'>;
/** what Cove keeps of the cascade */
export type WaterfallLike = CascadeLike;

let looks: CascadeMaterials | null = null;
/** hand the cascade its compiled graphs (look.materials, data/waterfallLook.ts) before the world builds */
export function setWaterfallLooks(materials: ReadonlyMap<string, Material>): void {
  const curtain = materials.get(CASCADE_LOOKS.curtain), pool = materials.get(CASCADE_LOOKS.pool), puffs = materials.get(CASCADE_LOOKS.puffs);
  if (curtain === undefined || pool === undefined || puffs === undefined) throw new Error('Driftwood: look.materials lacks the cascade graphs');
  looks = { curtain, pool, puffs };
}

/** the toon cascade (E150) */
export function waterfallFor(spec: WaterfallSpec): WaterfallLike {
  if (looks === null) throw new Error('Driftwood: the cascade graphs were not compiled before the world build');
  return new Cascade({ ...spec, materials: looks });
}
