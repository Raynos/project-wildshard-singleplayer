import * as v from 'valibot';
import { WorldSceneDistanceSchema, type WorldSceneDistanceRows } from './worldSceneWeld';

/** A static draw key, expressed in the original frozen anchor's local frame. */
export interface WorldSceneSlabKey {
  id: string; node: string; material: string; castShadow: boolean; receiveShadow: boolean;
  castFrom?: WorldSceneDistanceRows; until?: WorldSceneDistanceRows;
  renderOrder: number; layers: number; frustumCulled: boolean; visible: boolean; sources: string[];
}
/** One GPU upload and draw; bounds include every original triangle, including tall triangles crossing a band. */
export interface WorldSceneSlabChunk {
  key: string; bytes: number; geometricError: number;
  box: [number, number, number, number, number, number]; sphere: [number, number, number, number];
}
/** A bounded file group within a uniquely owned L0 tile, in decode/draw order. */
export interface WorldSceneSlabFile { file: string; chunks: WorldSceneSlabChunk[] }
/** Prejoined fine geometry; the original whole library remains the cold reconstruction source. */
export interface WorldSceneSlabLibrary {
  id: string; kind: 'slabs'; of: string; keys: WorldSceneSlabKey[];
  tiles: { tile: number; files: WorldSceneSlabFile[] }[];
}
const id = v.pipe(v.string(), v.minLength(1), v.maxLength(256));
const finite = v.pipe(v.number(), v.finite(), v.minValue(-1e6), v.maxValue(1e6));
const nonnegative = v.pipe(finite, v.minValue(0));
const integer = v.pipe(v.number(), v.integer(), v.minValue(0));
const bounded = <T extends v.BaseSchema<unknown, unknown, v.BaseIssue<unknown>>>(schema: T, max: number) => v.pipe(v.array(schema), v.minLength(1), v.maxLength(max));
const key = v.strictObject({ id, node: id, material: id, castShadow: v.boolean(), receiveShadow: v.boolean(),
  castFrom: v.exactOptional(WorldSceneDistanceSchema), until: v.exactOptional(WorldSceneDistanceSchema), renderOrder: finite,
  layers: v.pipe(v.number(), v.integer(), v.minValue(-0x80000000), v.maxValue(0xffffffff)), frustumCulled: v.boolean(), visible: v.boolean(), sources: bounded(id, 256) });
const chunk = v.strictObject({ key: id, bytes: v.pipe(integer, v.minValue(1), v.maxValue(4_000_000)), geometricError: nonnegative,
  box: v.pipe(v.tuple([finite, finite, finite, finite, finite, finite]), v.check(row => row[0] <= row[3] && row[1] <= row[4] && row[2] <= row[5])),
  sphere: v.tuple([finite, finite, finite, nonnegative]) });
/** No duplicate tile/key identity, dangling key, unbounded upload or repeated file is admitted. */
export const WorldSceneSlabsSchema: v.GenericSchema<unknown, WorldSceneSlabLibrary> = v.pipe(v.strictObject({ id, kind: v.literal('slabs'), of: id,
  keys: bounded(key, 64), tiles: bounded(v.strictObject({ tile: v.pipe(integer, v.maxValue(63)), files: bounded(v.strictObject({ file: id, chunks: bounded(chunk, 64) }), 16) }), 64) }),
  v.check(row => row.id !== row.of && new Set(row.keys.map(entry => entry.id)).size === row.keys.length
    && row.keys.every(entry => new Set(entry.sources).size === entry.sources.length)
    && new Set(row.tiles.map(tile => tile.tile)).size === row.tiles.length
    && new Set(row.tiles.flatMap(tile => tile.files.map(file => file.file))).size === row.tiles.reduce((sum, tile) => sum + tile.files.length, 0)
    && row.tiles.every(tile => tile.files.reduce((sum, file) => sum + file.chunks.length, 0) <= 64
      && tile.files.every(file => file.chunks.every(part => row.keys.some(entry => entry.id === part.key))))
    && row.keys.every(entry => row.tiles.some(tile => tile.files.some(file => file.chunks.some(part => part.key === entry.id)))), 'Unique bounded slab keys, tiles, files and covered chunks'));
