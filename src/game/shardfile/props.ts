import * as v from 'valibot';
import { CELL_ABOVE, CELL_BELOW } from '@wildshard/engine/core/config';
import type { ColliderDesc } from '@wildshard/engine/world/registry';
import { isJsonData } from './json';
import { PropMaterialsSchema, validatePropMaterials } from './propMaterials';
import { glbPoint, glbTransform } from './glbTriangles';

const ref = v.pipe(v.string(), v.regex(/^[a-f0-9]{64}$/u));
const id = v.pipe(v.string(), v.regex(/^[a-z][a-z0-9.-]*$/u), v.maxLength(128));
const address = v.pipe(v.number(), v.integer(), v.minValue(0), v.maxValue(7));
const named = v.strictObject({ id, file: ref });
const coord = v.pipe(v.number(), v.finite(), v.minValue(-250), v.maxValue(250));
const height = v.pipe(v.number(), v.finite(), v.minValue(-CELL_BELOW), v.maxValue(CELL_ABOVE));
const finite = v.pipe(v.number(), v.finite());
const extent = v.pipe(finite, v.minValue(0.005), v.maxValue(250));
const point = v.strictObject({ x: coord, y: height, z: coord });
const surface = v.optional(v.picklist(['wood', 'stone', 'grass', 'sand', 'rock', 'metal', 'earth', 'felt']));
const rotation = v.pipe(v.strictObject({ x: finite, y: finite, z: finite, w: finite }), v.check((q) => Math.abs(q.x ** 2 + q.y ** 2 + q.z ** 2 + q.w ** 2 - 1) < 1e-5, 'unit collider rotation'));
const boxData = v.strictObject({ kind: v.literal('box'), x: coord, y: height, z: coord, hx: extent, hy: extent, hz: extent, yaw: v.optional(finite), rot: v.optional(rotation), surface });
function boxWithinCell(b: v.InferOutput<typeof boxData>): boolean {
  const q = b.rot ?? { x: 0, y: Math.sin((b.yaw ?? 0) / 2), z: 0, w: Math.cos((b.yaw ?? 0) / 2) };
  const transform = glbTransform({ translation: [b.x, b.y, b.z], rotation: [q.x, q.y, q.z, q.w] });
  return Array.from({ length: 8 }, (_unused, index) => glbPoint(transform, {
    x: (index & 1) === 0 ? -b.hx : b.hx, y: (index & 2) === 0 ? -b.hy : b.hy, z: (index & 4) === 0 ? -b.hz : b.hz,
  })).every(vertex => Math.abs(vertex.x) <= 250 && Math.abs(vertex.z) <= 250 && vertex.y >= -CELL_BELOW && vertex.y <= CELL_ABOVE);
}
const box = v.pipe(boxData, v.check(boxWithinCell, 'collider within cell'));
const treads = v.pipe(v.strictObject({ kind: v.literal('treads'), from: point, to: point, width: extent, count: v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(256)), surface }), v.check((t) => Math.hypot(t.to.x - t.from.x, t.to.z - t.from.z) > 0 && t.to.y >= t.from.y && [t.from, t.to].every((p) => Math.abs(p.x) + t.width / 2 <= 250 && Math.abs(p.z) + t.width / 2 <= 250), 'bounded nondegenerate stair'));
const collider = v.strictObject({ id, panel: v.nullable(id), initialActive: v.boolean(), shapes: v.pipe(v.array(v.variant('kind', [box, treads])), v.minLength(1), v.maxLength(256)) });
/** Declared self-contained GLBs: merged tile meshes, EXT_mesh_gpu_instancing lists, far proxy and script-addressable panels. */
export const PropsSchema = v.pipe(v.unknown(), v.check(isJsonData, 'JSON-only props'), v.strictObject({ version: v.literal(1), family: id,
  materials: v.exactOptional(PropMaterialsSchema),
  tiles: v.pipe(v.array(v.strictObject({ lod: v.picklist([0, 1]), x: address, z: address, file: ref })), v.maxLength(80)),
  panels: v.pipe(v.array(v.strictObject({ id, file: ref, visible: v.optional(v.boolean(), true) })), v.maxLength(64)), models: v.pipe(v.array(named), v.maxLength(64)), far: v.nullable(ref),
  colliders: v.optional(v.pipe(v.array(collider), v.maxLength(1024)), []),
  textures: v.pipe(v.array(v.strictObject({ model: ref, colour: ref })), v.maxLength(256)),
}), v.check((s) => new Set(s.tiles.map((t) => `${t.lod}/${t.x}/${t.z}`)).size === s.tiles.length && s.tiles.every((t) => t.x < (t.lod === 0 ? 8 : 4) && t.z < (t.lod === 0 ? 8 : 4)) && new Set([...s.panels, ...s.models].map((p) => p.id)).size === s.panels.length + s.models.length && new Set(s.textures.map((t) => t.model)).size === s.textures.length && new Set(s.colliders.map((c) => c.id)).size === s.colliders.length && s.colliders.reduce((n, c) => n + c.shapes.reduce((m, shape) => m + (shape.kind === 'treads' ? shape.count : 1), 0), 0) <= 2048 && s.colliders.every((c) => c.panel === null || s.panels.some((p) => p.id === c.panel)), 'unique props addresses and ids'));
/** Validated data for the props renderer; no callbacks, URLs or generator code enter this section. */
export type ShardProps = v.InferOutput<typeof PropsSchema>;
/** Check every render binding against ordinary admitted file, tile and library rows before allocating content. */
export function validatePropsReferences(props: ShardProps, content: { files: readonly { hash: string; kind: string; dependencies: readonly string[] }[]; tiles: readonly { lod: number; x: number; z: number; files: readonly string[] }[]; library: readonly string[]; far: { files: readonly string[] } | null; look?: { materials: Parameters<typeof validatePropMaterials>[1]['look'] } }): void {
  const files = new Map(content.files.map((f) => [f.hash, f]));
  const model = (hash: string) => { if (files.get(hash)?.kind !== 'glb') throw new Error('Prop model must reference an admitted GLB'); };
  for (const tile of props.tiles) { model(tile.file); if (!content.tiles.find((t) => t.lod === tile.lod && t.x === tile.x && t.z === tile.z)?.files.includes(tile.file)) throw new Error('Props tile disagrees with tile files'); }
  for (const entry of [...props.panels, ...props.models]) { model(entry.file); if (!content.library.includes(entry.file)) throw new Error('Prop panel/model must belong to the library'); }
  if (props.far !== null) { model(props.far); if (!content.far?.files.includes(props.far)) throw new Error('Props far proxy disagrees with far files'); }
  const refs = new Set([...props.tiles.map((t) => t.file), ...props.panels.map((p) => p.file), ...props.models.map((p) => p.file), ...(props.far === null ? [] : [props.far])]);
  for (const texture of props.textures) if (!refs.has(texture.model) || files.get(texture.colour)?.kind !== 'ktx2' || !files.get(texture.model)?.dependencies.includes(texture.colour)) throw new Error('Prop texture must be a declared KTX2 dependency');
  if (props.materials !== undefined) validatePropMaterials(props.materials, { look: content.look?.materials ?? {}, models: [...refs], textures: props.textures, files: content.files });
}

/** Remove absent optional fields before handing admitted shapes to the engine's exact collider descriptor port. */
export function propColliderDescriptors(props: ShardProps): { id: string; initialActive: boolean; shapes: ColliderDesc[] }[] {
  return props.colliders.map((row) => ({ id: row.id, initialActive: row.initialActive, shapes: row.shapes.map((shape): ColliderDesc => {
    const material = shape.surface === undefined ? {} : { surface: shape.surface };
    if (shape.kind === 'treads') return { kind: 'treads', from: { ...shape.from }, to: { ...shape.to }, width: shape.width, count: shape.count, ...material };
    return { kind: 'box', x: shape.x, y: shape.y, z: shape.z, hx: shape.hx, hy: shape.hy, hz: shape.hz, ...(shape.yaw === undefined ? {} : { yaw: shape.yaw }), ...(shape.rot === undefined ? {} : { rot: { ...shape.rot } }), ...material };
  }) }));
}
