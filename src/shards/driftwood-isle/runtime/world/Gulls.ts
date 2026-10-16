/**
 * Gulls: Driftwood Isle's herring gulls are the gull flock row (data/gullsLook.ts GULL_FLOCK, section `custom/gullFlock`)
 * on the ambient-flock host (@wildshard/sdk/looks/ambientFlock), ONE instanced draw of the gull baked offline in its
 * palette (generators/gull.ts) in its graph look (data/gullGraphLook.ts), lent before the world builds.
 */
import type * as THREE from 'three';
import { createAmbientFlock, type AmbientFlockDraw } from '@wildshard/sdk/looks/ambientFlock';
import { GULL_GRAPH_LOOK } from '../const';
import { GULL_GEOMETRY } from '../boot/fixedGeometry';
import { driftwoodRows } from '../boot/rows';

let lent: THREE.Material | null = null;
/** Lend the gulls their compiled graph material (look.materials `driftwood-gulls`), before the world builds. */
export function setGullLook(materials: ReadonlyMap<string, THREE.Material>): void {
  const material = materials.get(GULL_GRAPH_LOOK);
  if (material === undefined) throw new Error('Gulls: look.materials lacks the gull graph');
  lent = material;
}
/** A gull flock on `perches` (a copy of the look per flock: the world's, a Model Explorer card's). */
export function gullFlock(perches: readonly { x: number; y: number; z: number }[], count?: number): AmbientFlockDraw {
  if (lent === null) throw new Error('Gulls: no graph material lent (the runtime compiles it before the world builds)');
  const row = driftwoodRows('custom/gullFlock');
  return createAmbientFlock(count === undefined ? row : { ...row, count, wheeling: null, guide: null, call: null }, { name: GULL_GRAPH_LOOK, geometry: GULL_GEOMETRY.copy(), material: lent.clone(), castShadow: true }, perches);
}
