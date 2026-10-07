import * as v from 'valibot';
import { decodeMeshCollision } from '@wildshard/engine/core/meshCollision';
import { isJsonData } from './json';

const id = v.pipe(v.string(), v.regex(/^[a-z][a-zA-Z0-9.-]*$/u), v.maxLength(128));
const hash = v.pipe(v.string(), v.regex(/^[a-f0-9]{64}$/u));
const address = v.pipe(v.number(), v.integer(), v.minValue(0), v.maxValue(7));
/** Exact cell-local triangle chunks; interactive panels keep independent stable collider identities. */
export const MeshCollisionSchema = v.pipe(v.strictObject({ version: v.literal(1),
  tiles: v.pipe(v.array(v.strictObject({ x: address, z: address, file: hash })), v.maxLength(64)),
  panels: v.pipe(v.array(v.strictObject({ id, panel: id, file: hash, initialActive: v.boolean() })), v.maxLength(64)),
}), v.check(data => new Set(data.tiles.map(row => `${row.x}/${row.z}`)).size === data.tiles.length, 'unique mesh collision tile addresses'),
v.check(data => new Set(data.panels.map(row => row.id)).size === data.panels.length && new Set(data.panels.map(row => row.panel)).size === data.panels.length, 'unique mesh collision panel identities'),
v.check(data => { const refs = [...data.tiles, ...data.panels].map(row => row.file); return new Set(refs).size === refs.length; }, 'independently charged mesh collision chunks'));
/** Admitted metadata references immutable WMC1 bytes, never an authored physics closure. */
export type ShardMeshCollision = v.InferOutput<typeof MeshCollisionSchema>;
/** Parse JSON-only mesh bindings before allocating native geometry. */
export function parseMeshCollision(input: unknown): ShardMeshCollision {
  if (!isJsonData(input)) throw new Error('Mesh collision declarations are JSON data only');
  return v.parse(MeshCollisionSchema, input);
}
interface CollisionSource {
  meshCollision: ShardMeshCollision | null;
  terrain: object | null;
  props: { panels: readonly { id: string }[]; colliders: readonly { id: string }[] } | null;
  files: readonly { hash: string; kind: string; dependencies: readonly string[] }[];
  critical: readonly string[];
}
/** Check critical roots and target identities without reading any asset or creating a collider. */
export function meshCollisionRules(source: CollisionSource): string[] {
  const data = source.meshCollision; if (data === null) return [];
  const errors: string[] = [];
  if (source.terrain !== null) errors.push('mesh collision and terrain are mutually exclusive');
  const files = new Map(source.files.map(row => [row.hash, row]));
  for (const row of [...data.tiles, ...data.panels]) {
    const file = files.get(row.file);
    if (file?.kind !== 'binary' || file.dependencies.length > 0 || !source.critical.includes(row.file)) errors.push('mesh collision chunks are independent critical binary roots');
  }
  const panels = new Set(source.props?.panels.map(row => row.id));
  if (data.panels.some(row => !panels.has(row.panel))) errors.push('mesh collision panels reference declared prop panels');
  const ids = [...source.props?.colliders.map(row => row.id) ?? [], ...data.panels.map(row => row.id), ...data.tiles.map(row => `mesh.tile.${row.x}.${row.z}`)];
  if (new Set(ids).size !== ids.length) errors.push('unique combined mesh and prop collider identities');
  return errors;
}
/** Verify bounded WMC1 bytes and exact tile containment after immutable hashes and costs have been admitted. */
export function validateMeshCollisionAssets(source: CollisionSource, assets: ReadonlyMap<string, Uint8Array>): void {
  const errors = meshCollisionRules(source); if (errors.length > 0) throw new Error(errors.join('; '));
  const data = source.meshCollision; if (data === null) return;
  for (const row of [...data.tiles, ...data.panels]) {
    const bytes = assets.get(row.file); if (bytes === undefined) throw new Error('Missing mesh collision asset');
    const mesh = decodeMeshCollision(bytes);
    if ('x' in row) {
      const minX = -250 + row.x * 62.5, minZ = -250 + row.z * 62.5;
      for (let i = 0; i < mesh.vertices.length; i += 3) {
        const x = mesh.vertices[i], z = mesh.vertices[i + 2];
        if (x === undefined || z === undefined || x < minX || x > minX + 62.5 || z < minZ || z > minZ + 62.5) throw new Error('Mesh collision geometry outside declared tile');
      }
    }
  }
}
