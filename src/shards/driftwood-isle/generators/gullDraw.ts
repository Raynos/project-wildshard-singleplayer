import { gullGeometry } from './gull';
import { GULL_FLOCK } from './gullsLook';
import { GULL_GRAPH_LOOK } from './gullGraphLook';
import { DRIFTWOOD_ASSET_NAMES } from './assets';

/**
 * The herring gull's Explorer card as a posed library (`look/gull-draw.json`, the shared posed draw Pine's wildlife uses):
 * the flock's own baked gull (the fixed-model template `gull`), drawn in the gulls' graph look on its one `aAnim` channel,
 * perched with its wings at rest. Vertex-coloured: no atlas.
 */
const geometry = gullGeometry(); geometry.computeBoundingBox();
const box = geometry.boundingBox, file = DRIFTWOOD_ASSET_NAMES['fixed:gull'];
if (box === null || file === undefined) throw new Error('The gull draw needs its baked template');
const [wings, fold] = GULL_FLOCK.wingbeats.gull.rest;
export const GULL_DRAW = {
  name: GULL_GRAPH_LOOK, attributes: [GULL_FLOCK.attributes[0]], channels: [GULL_FLOCK.channels[0]],
  assets: { name: 'gull', channels: [{ name: 'position', source: 'position', width: 3 }, { name: 'color', source: 'color', width: 3 }, { name: 'aPart', source: '_apart', width: 1 }],
    ranges: [{ kind: 0, start: 0, count: geometry.getAttribute('position').count, box: [...box.min, ...box.max] }] },
  tiers: { phone: { geometry: file }, desktop: { geometry: file } },
  models: [{ id: 'driftwood-isle/gull', name: 'Herring gull', pipeline: 'code', file: 'src/shards/driftwood-isle/generators/gull.ts', kind: 0, copies: 36, box: [0.95, 0.3, 0.9],
    pose: { flap: wings, head: 0, fold, legs: 0, y: GULL_FLOCK.foot * GULL_FLOCK.scale, scale: GULL_FLOCK.scale } }],
};
