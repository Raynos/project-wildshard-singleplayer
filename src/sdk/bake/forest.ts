import { placeForest, type ForestPlacementSource, type PlantSpec } from '@wildshard/engine/world/forest/placement';
import { buildTerrainMetadata } from '@wildshard/engine/world/terrainField';

/** Owned native tree data; no live color, scene or geometry object enters an author result. */
export interface NativeForestTree {
  readonly x: number; readonly y: number; readonly z: number; readonly r: number;
  readonly variant: number; readonly scale: number; readonly rot: number; readonly height: number;
  readonly species?: string;
  readonly tint: readonly [number, number, number];
}

/** A build's ordered trees and the original padded trunk query over those same owned records. */
export interface NativeForestPlacements {
  readonly trees: readonly NativeForestTree[];
  readonly nearby: (x: number, z: number, radius?: number) => readonly NativeForestTree[];
}

/** Bake the existing forest algorithm from trusted explicit policy and native samplers.
 * Return detached numeric records with stable query identity; never select a page or install terrain.
 * The caller owns the result and includes every supplied policy/sampler in its native source cache key. */
export function bakeForestPlacements(source: ForestPlacementSource, variants: readonly PlantSpec[]): NativeForestPlacements {
  const native = placeForest(variants, source), trees: NativeForestTree[] = [];
  const owned = new Map<(typeof native.trees)[number], NativeForestTree>();
  for (const tree of native.trees) {
    const { tint, species, ...data } = tree;
    const row: NativeForestTree = { ...data, ...(species === undefined ? {} : { species }), tint: [tint.r, tint.g, tint.b] };
    trees.push(row); owned.set(tree, row);
  }
  return { trees, nearby: (x, z, radius = 2) => native.grid.nearby(x, z, radius).map(tree => {
    const row = owned.get(tree);
    if (row === undefined) throw new Error('Native forest query lost its owned tree');
    return row;
  }) };
}

/** A native terrain's trail, cabin, pond and water queries from explicit trails, cabin sites and water level: the page's
 *  terrain law over those inputs, for a forest bake's source (`bakeForestPlacements`). No level is selected or installed. */
export function nativeTerrainQueries(seed: number, spec: Parameters<typeof buildTerrainMetadata>[1],
  waterLevel: Parameters<typeof buildTerrainMetadata>[2]): ReturnType<typeof buildTerrainMetadata> {
  return buildTerrainMetadata(seed, spec, waterLevel);
}
