import { loadRigFile } from '@wildshard/engine/anim/rig';
import type { Material } from '@wildshard/engine/physics/surface';
import type { ColliderDesc } from '@wildshard/engine/world/registry';
import { DoubleSide, FrontSide, Group, InstancedMesh, MeshStandardMaterial, type Material as DrawMaterial, type Object3D } from 'three';

/**
 * SHARD-PLATFORM SF72 (SF67 fix 3, "bake the code-built worlds"): the client side of a shard's instanced-kinds bake
 * (`@wildshard/sdk/bake/kinds`). A piece is one static GLB (one instanced node per kind, one draw each, never multi-draw)
 * and its rows (`data/<piece>.json`: the kinds' materials, the collider boxes). The client reads the GLB's geometry and
 * transforms and puts its own materials on them; the colliders never wait on the GLB, so a GLB that fails to load leaves
 * the piece undrawn but solid. Promoted from Signal Dunes' `world/baked.ts`.
 */

/** A baked kind's row, as the bake writes it; a shard's own extra fields ride along (`K` in the calls below). */
export interface BakedKindRow {
  readonly name: string; readonly count: number; readonly color: number; readonly roughness: number; readonly metalness: number; readonly flat: boolean;
  readonly emissive: number; readonly emissiveIntensity: number; readonly vertexColors: boolean; readonly doubleSided: boolean;
}
/** A baked collider row (a box; JSON keeps a yaw or a quaternion `rot`). */
export interface BakedColliderRow {
  readonly kind: string; readonly x: number; readonly y: number; readonly z: number; readonly hx: number; readonly hy: number; readonly hz: number;
  readonly yaw?: number; readonly rot?: { readonly x: number; readonly y: number; readonly z: number; readonly w: number }; readonly surface: string;
}

const instanced = (node: Object3D): node is InstancedMesh => node instanceof InstancedMesh;

/** Load one piece's GLB: its instanced nodes by kind name, in the rows' order; empty (with a warning) if it fails. */
export async function loadBakedKinds(url: string, kinds: readonly BakedKindRow[], label: string): Promise<ReadonlyMap<string, InstancedMesh>> {
  const meshes = new Map<string, InstancedMesh>();
  try {
    const gltf = await loadRigFile(url), nodes: InstancedMesh[] = [];
    gltf.scene.traverse((node) => { if (instanced(node)) nodes.push(node); });
    if (nodes.length !== kinds.length) throw new Error(`${label}: ${String(nodes.length)} baked nodes, ${String(kinds.length)} declared`);
    kinds.forEach((kind, i) => { const node = nodes[i]; if (node !== undefined) meshes.set(kind.name, node); });
  } catch (e: unknown) {
    // an error, not a warning: the boot smoke and the page fault path fail on it (a missing piece is a broken build)
    console.error(`[baked] ${label} did not load; it stands undrawn:`, e);
  }
  return meshes;
}

// every collider material, so a baked row may name any of them (a new one fails to compile here until it is listed)
const SURFACES: Readonly<Record<Material, true>> = { sand: true, wetSand: true, grass: true, rock: true, planks: true, stone: true, water: true, wood: true, metal: true,
  flesh: true, shell: true, ground: true, edge: true, felt: true, earth: true };
const isSurface = (s: string): s is Material => Object.hasOwn(SURFACES, s);
const surface = (s: string): Material => { if (!isSurface(s)) throw new Error(`baked collider: unknown surface ${s}`); return s; };
const box = (c: BakedColliderRow): ColliderDesc => {
  if (c.kind !== 'box') throw new Error('baked collider: a box');
  return { kind: 'box', x: c.x, y: c.y, z: c.z, hx: c.hx, hy: c.hy, hz: c.hz, ...(c.yaw === undefined ? {} : { yaw: c.yaw }), ...(c.rot === undefined ? {} : { rot: { ...c.rot } }), surface: surface(c.surface) };
};

/** Baked collider rows as the registry takes them. */
export const bakedColliders = (rows: readonly BakedColliderRow[]): ColliderDesc[] => rows.map(box);

export interface BakedKindsDraw<K extends BakedKindRow> {
  /** A kind's own material (a shard's shader-drawn surface); otherwise the row's standard material is built. */
  material?: (kind: K) => DrawMaterial | undefined;
  /** Adjust a built standard material (a shard's own lighting patch). */
  decorate?: (material: MeshStandardMaterial, kind: K) => void;
  /** Custom vertex channels to restore, loaded attribute name → geometry channel (`{ _shk: 'shk' }`). */
  attributes?: Readonly<Record<string, string>>;
}

/** A piece's group from its loaded nodes: each kind one `InstancedMesh` in its own material; a kind not loaded is skipped. */
export function bakedKindsGroup<K extends BakedKindRow>(nodes: ReadonlyMap<string, InstancedMesh> | undefined, kinds: readonly K[], draw: BakedKindsDraw<K> = {}): Group {
  const root = new Group();
  for (const kind of kinds) {
    const node = nodes?.get(kind.name); if (node === undefined) continue;
    const own = draw.material?.(kind);
    let material: DrawMaterial;
    if (own === undefined) {
      const standard = new MeshStandardMaterial({ roughness: kind.roughness, metalness: kind.metalness, flatShading: kind.flat, emissive: kind.emissive,
        emissiveIntensity: kind.emissiveIntensity, side: kind.doubleSided ? DoubleSide : FrontSide, vertexColors: kind.vertexColors });
      if (!kind.vertexColors) standard.color.setHex(kind.color);
      draw.decorate?.(standard, kind); material = standard;
    } else material = own;
    // a triangle soup bakes with the identity index glTF requires: it draws unindexed, as built
    const index = node.geometry.getIndex();
    if (index !== null && Array.from(index.array).every((n, i) => n === i)) node.geometry.setIndex(null);
    for (const [from, to] of Object.entries(draw.attributes ?? {})) {
      const a = node.geometry.getAttribute(from);
      if (node.geometry.hasAttribute(from)) { node.geometry.setAttribute(to, a); node.geometry.deleteAttribute(from); }
    }
    const mesh = new InstancedMesh(node.geometry, material, kind.count);
    mesh.instanceMatrix.array.set(node.instanceMatrix.array.subarray(0, kind.count * 16)); mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere(); mesh.castShadow = false; mesh.receiveShadow = false; root.add(mesh);
  }
  return root;
}
