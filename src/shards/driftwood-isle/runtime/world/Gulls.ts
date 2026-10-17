/**
 * Gulls: Driftwood Isle's herring gulls are the gull flock row (generators/gullsLook.ts GULL_FLOCK, section `custom/gullFlock`)
 * on the ambient-flock host (@wildshard/sdk/looks/ambientFlock), ONE instanced draw of the gull baked offline in its
 * palette (generators/gull.ts) in its graph look (data/gullGraphLook.ts), lent before the world builds.
 */
import { createAmbientFlock, type AmbientFlockDraw } from '@wildshard/sdk/looks/ambientFlock';
import { lentLook } from '@wildshard/sdk/looks/lentLooks';
import { fixedDraw } from '../boot/blobAssets';
import { driftwoodRows } from '../boot/rows';

/** A gull flock on `perches` (a copy of the look per flock: the world's, a Model Explorer card's). */
export function gullFlock(perches: readonly { x: number; y: number; z: number }[], count?: number): AmbientFlockDraw {
  const row = driftwoodRows('custom/gullFlock');
  return createAmbientFlock(count === undefined ? row : { ...row, count, wheeling: null, guide: null, call: null }, { name: driftwoodRows('custom/fixedLayouts').nativeView.GULL_GRAPH_LOOK, geometry: fixedDraw('gull').copy(), material: lentLook(driftwoodRows('custom/fixedLayouts').nativeView.GULL_GRAPH_LOOK).clone(), castShadow: true }, perches);
}
