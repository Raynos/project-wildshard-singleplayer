import * as v from 'valibot';

const ref = v.pipe(v.string(), v.regex(/^[a-f0-9]{64}$/u));
const address = v.pipe(v.number(), v.integer(), v.minValue(0), v.maxValue(7));
/** The terrain's render files address the ordinary tile grid; the collider file is a separate critical sim root. */
export const TerrainSchema = v.pipe(v.strictObject({ version: v.literal(1), family: v.pipe(v.string(), v.regex(/^[a-z][a-z0-9.-]*$/u)), collider: ref,
  tiles: v.pipe(v.array(v.strictObject({ lod: v.picklist([0, 1]), x: address, z: address, file: ref })), v.length(80)) }),
v.check((terrain) => new Set(terrain.tiles.map((tile) => `${tile.lod}/${tile.x}/${tile.z}`)).size === 80 && terrain.tiles.every((tile) => tile.x < (tile.lod === 0 ? 8 : 4) && tile.z < (tile.lod === 0 ? 8 : 4)), 'complete terrain tile grids'));
/** A validated terrain section, containing no landscape closures. */
export type ShardTerrain = v.InferOutput<typeof TerrainSchema>;
