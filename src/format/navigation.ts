import * as v from 'valibot';
import { decodeNavigation, type NavigationLayerData } from '@wildshard/format/navigationBytes';

const finite = v.pipe(v.number(), v.finite(), v.minValue(-16384), v.maxValue(16384));
const positive = v.pipe(v.number(), v.finite(), v.minValue(Number.MIN_VALUE), v.maxValue(16384));
const coordinate = v.pipe(v.number(), v.integer(), v.minValue(-1024), v.maxValue(1024));
const point = v.tuple([finite, finite, finite]);
/** Exact immutable WSNM layout, global bounds and per-agent voxel/tile grids. */
export const NavigationSchema = v.strictObject({ version: v.literal(1), layout: v.literal('wsnm-v1-le-quantized'),
  file: v.pipe(v.string(), v.regex(/^[a-f0-9]{64}$/u)), bounds: v.tuple([finite, finite, finite, finite, finite, finite]),
  layers: v.pipe(v.array(v.strictObject({ radius: positive, height: positive, climb: v.pipe(finite, v.minValue(0)), cellSize: positive, cellHeight: positive,
    origin: point, tileSize: positive, tiles: v.pipe(v.array(v.tuple([coordinate, coordinate])), v.maxLength(4096)) })), v.minLength(1), v.maxLength(16)) });
/** An admitted immutable navigation declaration, with exact WSNM bounds and ordered agent tile grids. */
export type Navigation = v.InferOutput<typeof NavigationSchema>;
/** Trusted level transport: admitted product bytes or the manifest's declared immutable URL. */
export type NavigationContent = { row: unknown; bytes: Uint8Array } | { row: unknown; url: string };
/** Validate a declaration supplied by a trusted manifest or author boundary before any transport read. */
export function parseNavigation(input: unknown): Navigation { return v.parse(NavigationSchema, input); }
/** Build the declaration from original bytes without resampling, re-encoding or sorting tiles/layers. */
export function describeNavigation(file: string, bytes: Uint8Array): Navigation {
  const layers = decodeNavigation(bytes), bounds: [number, number, number, number, number, number] = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity];
  for (const layer of layers) for (const tile of layer.tiles) for (let axis = 0; axis < 3; axis++) {
    bounds[axis] = Math.min(bounds[axis] ?? Infinity, tile.bounds[axis] ?? Infinity);
    bounds[axis + 3] = Math.max(bounds[axis + 3] ?? -Infinity, tile.bounds[axis + 3] ?? -Infinity);
  }
  return v.parse(NavigationSchema, { version: 1, layout: 'wsnm-v1-le-quantized', file, bounds,
    layers: layers.map(({ radius, height, climb, cellSize, cellHeight, origin, tileSize, tiles }) => ({ radius, height, climb, cellSize, cellHeight, origin, tileSize, tiles: tiles.map(tile => [tile.tileX, tile.tileY]) })) });
}
/** Admission compares every declared bound and grid value with the bounded original stream. */
export function readNavigation(row: Navigation, bytes: Uint8Array): NavigationLayerData[] {
  const declared = v.parse(NavigationSchema, row), actual = describeNavigation(declared.file, bytes);
  if (JSON.stringify(declared) !== JSON.stringify(actual)) throw new Error('Navigation declaration differs from immutable bytes');
  return decodeNavigation(bytes);
}
/** Navigation is an independent critical binary root, charged before creature pathing starts. */
export function navigationRules(source: { navigation: Navigation | null; files: readonly { hash: string; kind: string; dependencies: readonly string[] }[]; critical: readonly string[] }): string[] {
  const row = source.navigation; if (row === null) return [];
  const file = source.files.find(entry => entry.hash === row.file);
  return file?.kind === 'binary' && file.dependencies.length === 0 && source.critical.includes(row.file) ? [] : ['navigation requires an independent critical binary root'];
}
/** Validate already hash-admitted navigation; no runtime or query allocation occurs here. */
export function validateNavigationAssets(source: { navigation: Navigation | null }, assets: ReadonlyMap<string, Uint8Array>): void {
  if (source.navigation === null) return;
  const bytes = assets.get(source.navigation.file); if (bytes === undefined) throw new Error('Missing navigation bytes');
  readNavigation(source.navigation, bytes);
}
