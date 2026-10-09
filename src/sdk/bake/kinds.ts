import { BoxGeometry, BufferGeometry, DoubleSide, InstancedMesh, Matrix4, Mesh, MeshStandardMaterial, type Object3D } from 'three';
import type { ColliderDesc } from '@wildshard/engine/world/registry';
import { staticGlb, type GlbPrimitive } from './glb';

/**
 * Build-time only (SHARD-PLATFORM SF72): a code-built world piece baked as instanced kinds. Each non-empty kind is one GLB
 * node (its geometry and EXT_mesh_gpu_instancing transforms, one draw each, never multi-draw); its row says how the client
 * draws it (`@wildshard/game/shardfile/bakedKinds`). The colliders are the builder's own, as JSON keeps them (a `-0` yaw is
 * `0`, as the rows' JSON holds it). Promoted from Signal Dunes' baker; any shard's generators use it.
 */

/** A kind row's extra fields: plain JSON a shard's client reads back (a lit-by-fire flag, a named client material). */
export type KindExtra = Readonly<Record<string, string | number | boolean>>;
/** One baked instanced kind: the GLB node's name, its instance count and the material the client draws it in. */
export interface BakedKind {
  name: string; count: number; color: number; roughness: number; metalness: number; flat: boolean; emissive: number; emissiveIntensity: number;
  vertexColors: boolean; doubleSided: boolean;
  readonly [extra: string]: string | number | boolean;
}
/** A piece's bake: the GLB bytes and its rows (`data/<piece>.json`, with the GLB's content hash). */
export interface PieceBake { glb: Uint8Array; kinds: BakedKind[]; colliders: ColliderDesc[] }

export interface KindBakeOptions {
  /** The extra row fields a kind's material carries (a shard's own flags); equal extras are part of a kind's look. */
  extra?: (material: MeshStandardMaterial) => KindExtra;
  /** Custom vertex channels to keep, glTF semantic → geometry channel (`{ _SHK: 'shk' }`); a kind without the channel skips it. */
  attributes?: Readonly<Record<string, string>>;
}

/** Colliders as the JSON rows keep them (a `-0` yaw is `0`). */
export const colliderRows = (colliders: readonly ColliderDesc[]): ColliderDesc[] => colliders.map((c) => 'yaw' in c && c.yaw === 0 ? { ...c, yaw: 0 } : c);

const custom = (geometry: BufferGeometry, attributes: Readonly<Record<string, string>> | undefined): Record<string, string> | undefined => {
  const kept = Object.entries(attributes ?? {}).filter(([, channel]) => geometry.hasAttribute(channel));
  return kept.length === 0 ? undefined : Object.fromEntries(kept);
};

/** Bake named instanced meshes into one GLB (`name` is its scene name, e.g. `sunscar.rocks`) and their kind rows. */
export function bakeKinds(name: string, meshes: readonly (readonly [string, InstancedMesh])[], colliders: readonly ColliderDesc[], options: KindBakeOptions = {}): PieceBake {
  const kinds: BakedKind[] = [], primitives: GlbPrimitive[] = [];
  for (const [kind, mesh] of meshes) {
    if (mesh.count === 0) continue;
    // the GLB carries no per-instance colour: a tinted kind needs it baked before it has instances
    if (mesh.instanceColor !== null) throw new Error(`${name}.${kind}: per-instance colours are not baked`);
    const instances = Array.from({ length: mesh.count }, (_, i) => { const m = new Matrix4(); mesh.getMatrixAt(i, m); return m; });
    const material = Array.isArray(mesh.material) ? undefined : mesh.material;
    if (!(material instanceof MeshStandardMaterial)) throw new Error(`${name}.${kind}: one standard material per kind`);
    const customAttributes = custom(mesh.geometry, options.attributes);
    primitives.push({ geometry: mesh.geometry, material, instances, castShadow: false, ...(customAttributes === undefined ? {} : { customAttributes }) });
    kinds.push({ name: kind, count: mesh.count, color: material.color.getHex(), roughness: material.roughness, metalness: material.metalness, flat: material.flatShading,
      emissive: material.emissive.getHex(), emissiveIntensity: material.emissiveIntensity, vertexColors: material.vertexColors, doubleSided: material.side === DoubleSide,
      ...options.extra?.(material) });
  }
  return { glb: staticGlb(primitives, name), kinds, colliders: colliderRows(colliders) };
}

/** A material's look as the kind rows keep it: meshes in equal-looking materials share a kind. */
const look = (m: MeshStandardMaterial, extra: KindBakeOptions['extra']): string => JSON.stringify([m.color.getHex(), m.roughness, m.metalness, m.flatShading, m.emissive.getHex(),
  m.emissiveIntensity, m.vertexColors, m.side, extra?.(m) ?? {}]);
/** A geometry's shape: a box is the unit box (its size goes in the instance's scale); a parametric one by its parameters. */
const shape = (g: BufferGeometry): string => g instanceof BoxGeometry ? 'box' : 'parameters' in g ? `${g.type}${JSON.stringify(g.parameters)}` : g.uuid;

const isGeometry = (g: unknown): g is BufferGeometry => g instanceof BufferGeometry;

/**
 * A built group's meshes folded into instanced kinds, in first-seen order: every box of one look becomes an instance of
 * one unit box (its size in the instance's scale, the same vertices); any other geometry is one kind per shape and look.
 * Every instance keeps its mesh's world transform. Kinds are named `<n>-<geometry type>`.
 */
export function foldKinds(root: Object3D, options: Pick<KindBakeOptions, 'extra'> = {}): (readonly [string, InstancedMesh])[] {
  root.updateMatrixWorld(true);
  const unit = new BoxGeometry(1, 1, 1), groups = new Map<string, { geometry: BufferGeometry; material: MeshStandardMaterial; matrices: Matrix4[] }>();
  root.traverse((node) => {
    if (!(node instanceof Mesh)) return;
    const material: unknown = node.material, geometry: unknown = node.geometry;
    if (!(material instanceof MeshStandardMaterial) || !isGeometry(geometry)) throw new Error('fold: one standard material per mesh');
    const key = `${shape(geometry)}|${look(material, options.extra)}`, matrix = node.matrixWorld.clone();
    if (geometry instanceof BoxGeometry) matrix.multiply(new Matrix4().makeScale(geometry.parameters.width, geometry.parameters.height, geometry.parameters.depth));
    const group = groups.get(key) ?? { geometry: geometry instanceof BoxGeometry ? unit : geometry, material, matrices: [] };
    group.matrices.push(matrix); groups.set(key, group);
  });
  return [...groups.values()].map((group, n) => {
    const mesh = new InstancedMesh(group.geometry, group.material, group.matrices.length);
    group.matrices.forEach((m, i) => { mesh.setMatrixAt(i, m); });
    return [`${String(n)}-${group.geometry.type}`, mesh] as const;
  });
}
