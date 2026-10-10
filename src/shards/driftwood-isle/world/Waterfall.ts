/**
 * Waterfall v3 (E150) — Driftwood's toon cascade, a stepped faceted curtain in the Wind Waker / Sea of Thieves manner.
 * It replaced the soft, blurred v2 curtain (DRIFTWOOD-REMASTER W5), which went in E162. SHARD-PLATFORM M3: the geometry,
 * the three draws and their material setup are the SDK cascade (@wildshard/sdk/looks/cascade); Driftwood's programs are
 * data (data/waterfallGlsl.ts): three toon bands down each drop, a crisp white line at every brink, a scalloped foam band
 * where each step lands, bright streak dashes scrolling down; faceted foam rings on the pool; foam puffs toon-lit in two bands.
 *
 *   const fall = waterfallFor({ lip, foot, width: 2.2, ground: heightAt, poolRadius: 2.3 }).build();
 *   scene.add(fall.group);
 *   game.onUpdate((dt) => fall.update(dt));
 */
import { Cascade, type CascadeLike, type CascadeSpec } from '@wildshard/sdk/looks/cascade';
import { WATERFALL_GLSL } from '../data/waterfallGlsl';

/** where the cascade pours, how wide, and its terraces (the SDK cascade's spec without the shard's GLSL) */
export type WaterfallSpec = Omit<CascadeSpec, 'glsl' | 'patchId'>;
/** what Cove keeps of the cascade */
export type WaterfallLike = CascadeLike;

/** the toon cascade (E150) */
export function waterfallFor(spec: WaterfallSpec): WaterfallLike {
  return new Cascade({ ...spec, glsl: WATERFALL_GLSL, patchId: 'driftwood.waterfall-fog' });
}
