/**
 * The Kunes bridge (E306 / E315 M3): the timber bridge carrying the N road over the Kunes (map-01 "BRIDGE"). A plank
 * deck on four log stringers, resting on log cribs (square boxes of crossed logs, stone-filled, a raked ice-breaker on
 * the upstream / east side) spaced ~8 m across the braided corridor, with a crib abutment at each bank; wheel-guard
 * logs, post-and-rail handrails with knee braces, bank stones round its ends. Used once (src/shards/nalati-grasslands/world/Bridge.ts).
 *
 * SHARD-PLATFORM M3 (the places bake): the painter runs offline only (../generators/kunesBridge.ts, by
 * ../generators/places.ts); the page draws the bake (../world/placeBake.ts). Here is the model's def.
 *
 * Fitted to the ground under it: placed at the corridor's centre (`at.y` = the level deck's height, the deck runs along
 * z), it finds its ends from the terrain — the deck is level over the corridor and ramps down 1 : 5 at either end until
 * it meets the road, so a terrain tweak never leaves it floating or buried. Painted into its place's mesh
 * (src/shards/nalati-grasslands/world/painted.ts). Collides: the deck as plank slabs (level + the two ramps), the cribs and the rails as
 * boxes; its floor (placement) is the deck.
 */
import { defineModel } from '@wildshard/engine/models/model';
import { bakedPainted } from '../world/placeBake';

export interface KunesBridgeParams {
  /** the deck's width (m) */
  readonly width: number;
  /** the river corridor's span the deck stays level over (m) */
  readonly span: number;
}

export const kunesBridge = defineModel<KunesBridgeParams>(bakedPainted<KunesBridgeParams>({
  id: 'nalati-grasslands/kunes-bridge', name: 'Kunes bridge', category: 'buildings', pipeline: 'code',
  file: 'src/shards/nalati-grasslands/generators/kunesBridge.ts', surface: 'wood',
  defaults: { width: 4.4, span: 30 },
}));
