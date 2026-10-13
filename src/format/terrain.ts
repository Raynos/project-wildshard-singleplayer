import * as v from 'valibot';
import { CELL_ABOVE, CELL_BELOW } from './contentBounds';

const ref = v.pipe(v.string(), v.regex(/^[a-f0-9]{64}$/u));
const address = v.pipe(v.number(), v.integer(), v.minValue(0), v.maxValue(7));
/**
 * The terrain tiles' shadow flags: `cast` lets an L0 tile inside the client's shadow disc cast, `receive` lets every tile
 * receive. Absent: both on (the default every shard drew with before the row).
 */
const shadow = v.strictObject({ cast: v.boolean(), receive: v.boolean() });
/** How far (m) the viewer moves before the client's tile residency re-centres; absent: 5 m (the data client's `FOLLOW`). */
const follow = v.pipe(v.number(), v.finite(), v.minValue(1), v.maxValue(62.5));
/** A separate original lattice used only for native placement queries; it never installs collision. */
const sampling = v.strictObject({ law: v.literal('bilinear'), file: ref,
  normalEpsilon: v.pipe(v.number(), v.finite(), v.minValue(0.001), v.maxValue(4)),
  datum: v.pipe(v.number(), v.finite(), v.minValue(-CELL_BELOW), v.maxValue(CELL_ABOVE)) });
/**
 * The tiles' draw order among the opaque surfaces (three's renderOrder): a lower order draws first, so it decides which
 * surface wins where two lie at the same depth (a ground drawn before a far horizon ring). Absent: 0.
 */
const order = v.pipe(v.number(), v.integer(), v.minValue(-100), v.maxValue(100));
/** The terrain's render files address the ordinary tile grid; the collider file is a separate critical sim root. */
export const TerrainSchema = v.pipe(v.strictObject({ version: v.literal(1), family: v.pipe(v.string(), v.regex(/^[a-z][a-z0-9.-]*$/u)), collider: ref,
  tiles: v.pipe(v.array(v.strictObject({ lod: v.picklist([0, 1]), x: address, z: address, file: ref })), v.length(80)),
  shadow: v.exactOptional(shadow), follow: v.exactOptional(follow), sampling: v.exactOptional(sampling), order: v.exactOptional(order) }),
v.check((terrain) => new Set(terrain.tiles.map((tile) => `${tile.lod}/${tile.x}/${tile.z}`)).size === 80 && terrain.tiles.every((tile) => tile.x < (tile.lod === 0 ? 8 : 4) && tile.z < (tile.lod === 0 ? 8 : 4)), 'complete terrain tile grids'));
/** A validated terrain section, containing no landscape closures. */
export type ShardTerrain = v.InferOutput<typeof TerrainSchema>;
