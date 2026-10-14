import { loadRigFile } from '@wildshard/engine/anim/rig';
import type { Material } from '@wildshard/engine/physics/surface';
import type { ColliderDesc, Piece, PieceCategory } from '@wildshard/engine/world/registry';
import { DoubleSide, FrontSide, Group, InstancedBufferAttribute, InstancedMesh, Mesh, MeshBasicMaterial, MeshStandardMaterial, Object3D, type Material as DrawMaterial } from 'three';

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
/** An exact ordinary-mesh kind; omitted fields keep the original instanced standard-material path. */
export interface BakedMeshKindRow extends BakedKindRow {
  readonly mesh?: boolean;
  readonly unlit?: boolean;
  readonly colorR?: number; readonly colorG?: number; readonly colorB?: number;
  readonly emissiveR?: number; readonly emissiveG?: number; readonly emissiveB?: number;
}

/** A baked collider row (a box; JSON keeps a yaw or a quaternion `rot`). */
export interface BakedColliderRow {
  readonly kind: string; readonly x: number; readonly y: number; readonly z: number; readonly hx: number; readonly hy: number; readonly hz: number;
  readonly yaw?: number; readonly rot?: { readonly x: number; readonly y: number; readonly z: number; readonly w: number }; readonly surface: string;
}

const isMesh = (node: Object3D | undefined): node is Mesh => node instanceof Mesh;
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
/** Authored static collider rows shared by placed props and baked mesh pieces. */
export interface BakedColliderInput {
  readonly kind: string; readonly x: number; readonly y: number; readonly z: number; readonly surface: string;
  readonly hx?: number; readonly hy?: number; readonly hz?: number; readonly yaw?: number;
  readonly rot?: { readonly x: number; readonly y: number; readonly z: number; readonly w: number }; readonly points?: readonly number[];
}
/** Decode owned hull words and box poses before handing them to the registry. */
export const bakedColliders = (rows: readonly BakedColliderInput[]): ColliderDesc[] => rows.map((c): ColliderDesc => {
  const own = surface(c.surface);
  if (c.kind === 'hull' && c.points !== undefined) return { kind:'hull',x:c.x,y:c.y,z:c.z,points:new Float32Array(c.points),surface:own };
  if (c.kind !== 'box' || c.hx === undefined || c.hy === undefined || c.hz === undefined) throw new Error('Invalid baked collider shape');
  return { kind:'box',x:c.x,y:c.y,z:c.z,hx:c.hx,hy:c.hy,hz:c.hz,...(c.yaw===undefined?{}:{yaw:c.yaw}),...(c.rot===undefined?{}:{rot:{...c.rot}}),surface:own };
});

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
    // an exact-instance bake's linear colours (the GLB's _COLOR_0, loaded as the node's instance colours)
    if (node.instanceColor !== null) mesh.instanceColor = new InstancedBufferAttribute(node.instanceColor.array.slice(0, kind.count * 3), 3);
    mesh.computeBoundingSphere(); mesh.castShadow = false; mesh.receiveShadow = false; root.add(mesh);
  }
  return root;
}

/** One piece's rows as the bake writes them: its kinds, its collider boxes and (optionally) per-instance tints by kind. */
export interface BakedPieceRows<K extends BakedKindRow> {
  readonly kinds: readonly K[]; readonly colliders: readonly BakedColliderRow[];
  /** a kind's per-instance colours for a TRS bake (its GLB carries none), three floats an instance */
  readonly tints?: Readonly<Record<string, readonly number[]>>;
}
/** A drawn piece: its group (one `InstancedMesh` per drawn kind, in row order), its colliders and its drawn kinds by name. */
export interface DrawnBakedPiece { readonly root: Group; readonly colliders: ColliderDesc[]; readonly kinds: ReadonlyMap<string, InstancedMesh> }
/** A loaded bake: each piece's instanced nodes by kind name. */
export type LoadedBake<P extends string> = ReadonlyMap<P, ReadonlyMap<string, InstancedMesh>>;
/** Per-call choices: the nodes to draw (default the last load), the kinds to draw and a material hook after the shard's. */
export interface BakedPieceCall<K extends BakedKindRow> {
  readonly nodes?: ReadonlyMap<string, InstancedMesh> | undefined;
  readonly only?: ((kind: K) => boolean) | undefined;
  readonly each?: ((material: MeshStandardMaterial) => void) | undefined;
}
/** A shard's whole bake: load every piece once behind the loading screen, then draw any piece from it. */
export interface BakedWorld<P extends string, K extends BakedKindRow> {
  /** Load every piece (a piece that fails to load is empty, with an error); resolves to the loaded nodes. */
  readonly load: () => Promise<LoadedBake<P>>;
  /** The bake loaded last, or null before the first load. */
  readonly last: () => LoadedBake<P> | null;
  /** A piece from its bake (undrawn if its GLB did not load, solid either way). */
  readonly piece: (piece: P, call?: BakedPieceCall<K>) => DrawnBakedPiece;
}

/**
 * A shard's instanced-kinds bake as rows (SF72): its pieces' rows, their GLB urls, a fault label and the shard's draw hooks.
 * Shared by Signal Dunes and Sky Reach (G345): the loader, the cache and the piece builder were each shard's own.
 */
export function bakedWorld<P extends string, K extends BakedKindRow>(pieces: Readonly<Record<P, BakedPieceRows<K>>>, urls: Readonly<Record<P, string>>, label: string, draw: BakedKindsDraw<K> = {}): BakedWorld<P, K> {
  const names = Object.keys(pieces).filter((name): name is P => Object.hasOwn(pieces, name));
  let loaded: LoadedBake<P> | null = null;
  return {
    load: async () => {
      const meshes = await Promise.all(names.map((name) => loadBakedKinds(urls[name], pieces[name].kinds, `${label} ${name}`)));
      loaded = new Map(names.map((name, i) => [name, meshes[i] ?? new Map<string, InstancedMesh>()]));
      return loaded;
    },
    last: () => loaded,
    piece: (piece, call = {}) => {
      const rows = pieces[piece], nodes = call.nodes ?? loaded?.get(piece), each = call.each;
      const kinds = call.only === undefined ? rows.kinds : rows.kinds.filter(call.only);
      const root = bakedKindsGroup(nodes, kinds, { ...draw, decorate: (material, kind) => { draw.decorate?.(material, kind); each?.(material); } });
      // the drawn kinds by name, in row order (a kind whose GLB did not load is absent), each with its rows' tints
      const drawn = kinds.filter((kind) => nodes?.has(kind.name) === true), byName = new Map<string, InstancedMesh>();
      drawn.forEach((kind, i) => {
        const mesh = root.children[i], tint = rows.tints?.[kind.name]; if (mesh === undefined || !instanced(mesh)) return;
        byName.set(kind.name, mesh);
        if (tint !== undefined) mesh.instanceColor = new InstancedBufferAttribute(new Float32Array(tint), 3);
      });
      return { root, colliders: bakedColliders(rows.colliders), kinds: byName };
    },
  };
}

/** Draw exact ordinary meshes alongside instanced kinds, without changing their shader family or transform precision. */
export function bakedMeshKindsGroup<K extends BakedMeshKindRow>(nodes: ReadonlyMap<string, Mesh> | undefined, kinds: readonly K[], draw: BakedKindsDraw<K> = {}): Group {
  const root = new Group();
  for (const kind of kinds) {
    const node = nodes?.get(kind.name); if (node === undefined) continue;
    if (kind.mesh !== true) {
      if (!instanced(node)) throw new Error(`baked kind ${kind.name}: expected instances`);
      if (kind.unlit === true) throw new Error(`baked kind ${kind.name}: unlit instances are not admitted`);
      root.add(...bakedKindsGroup(new Map([[kind.name, node]]), [kind], draw).children); continue;
    }
    if (instanced(node) || kind.count !== 1) throw new Error(`baked kind ${kind.name}: expected one ordinary mesh`);
    const pose: unknown = node.userData['matrix64'];
    if (!Array.isArray(pose) || pose.length !== 16 || !pose.every((value): value is number => typeof value === 'number' && Number.isFinite(value))) throw new Error(`baked kind ${kind.name}: missing exact transform`);
    const { colorR, colorG, colorB, emissiveR, emissiveG, emissiveB } = kind;
    if (colorR === undefined || colorG === undefined || colorB === undefined || ![colorR, colorG, colorB].every(Number.isFinite)) throw new Error(`baked kind ${kind.name}: missing linear colour`);
    const own = draw.material?.(kind);
    let material: DrawMaterial;
    if (own !== undefined) material = own;
    else if (kind.unlit === true) {
      const basic = new MeshBasicMaterial({ side: kind.doubleSided ? DoubleSide : FrontSide, vertexColors: kind.vertexColors });
      basic.color.setRGB(colorR, colorG, colorB); material = basic;
    } else {
      if (emissiveR === undefined || emissiveG === undefined || emissiveB === undefined || ![emissiveR, emissiveG, emissiveB].every(Number.isFinite)) throw new Error(`baked kind ${kind.name}: missing linear emissive`);
      const standard = new MeshStandardMaterial({ roughness: kind.roughness, metalness: kind.metalness, flatShading: kind.flat,
        emissiveIntensity: kind.emissiveIntensity, side: kind.doubleSided ? DoubleSide : FrontSide, vertexColors: kind.vertexColors });
      standard.color.setRGB(colorR, colorG, colorB); standard.emissive.setRGB(emissiveR, emissiveG, emissiveB);
      draw.decorate?.(standard, kind); material = standard;
    }
    const mesh = new Mesh(node.geometry, material);
    mesh.matrix.fromArray(pose); mesh.matrix.decompose(mesh.position, mesh.quaternion, mesh.scale); mesh.matrixAutoUpdate = false;
    mesh.castShadow = false; mesh.receiveShadow = false; root.add(mesh);
  }
  return root;
}

/** A loaded mixed bake, keyed by piece then kind; ordinary meshes retain their exact local geometry and matrix. */
export type LoadedMeshBake<P extends string> = ReadonlyMap<P, ReadonlyMap<string, Mesh>>;
/** One drawn mixed piece, its unchanged collider rows and meshes in authored order. */
export interface DrawnBakedMeshPiece { readonly root: Group; readonly colliders: ColliderDesc[]; readonly kinds: ReadonlyMap<string, Mesh> }
/** A declared companion bake, loaded with its mesh world and borrowed by its existing native view owner. */
export interface BakedByteResource {
  readonly id: string; readonly url: string; readonly compression: 'deflate';
  readonly fault: { readonly level: 'warn' | 'error'; readonly message: string };
}
/** Load and draw a static bake containing both ordinary and instanced mesh kinds. */
export interface BakedMeshWorld<P extends string, K extends BakedMeshKindRow> {
  readonly load: () => Promise<LoadedMeshBake<P>>;
  readonly last: () => LoadedMeshBake<P> | null;
  /** Loaded companion bytes, or null before loading or after its declared failure. */
  readonly bytes: (id: string) => Uint8Array | null;
  readonly piece: (piece: P, call?: { readonly nodes?: ReadonlyMap<string, Mesh> | undefined; readonly only?: ((kind: K) => boolean) | undefined; readonly each?: ((material: MeshStandardMaterial) => void) | undefined }) => DrawnBakedMeshPiece;
}

/** The ordinary-mesh counterpart of bakedWorld: the same piece rows, collider law and material hooks, with no instancing conversion. */
export function bakedMeshWorld<P extends string, K extends BakedMeshKindRow>(pieces: Readonly<Record<P, BakedPieceRows<K>>>, urls: Readonly<Record<P, string>>, label: string, draw: BakedKindsDraw<K> & { readonly resources?: readonly BakedByteResource[]; readonly readBytes?: (url: string) => Promise<Uint8Array> } = {}): BakedMeshWorld<P, K> {
  const names = Object.keys(pieces).filter((name): name is P => Object.hasOwn(pieces, name));
  let loaded: LoadedMeshBake<P> | null = null;
  const resources = draw.resources ?? [], readBytes = draw.readBytes, bytes = new Map<string, Uint8Array | null>();
  if (resources.length > 0 && typeof readBytes !== 'function') throw new Error('Missing baked byte reader');
  if (resources.length > 32 || new Set(resources.map(row => row.id)).size !== resources.length
    || resources.some(row => !/^[a-zA-Z0-9_.-]{1,96}$/u.test(row.id) || row.url.length === 0 || row.url.length > 2048
      || !['warn','error'].includes(row.fault.level) || row.fault.message.length === 0 || row.fault.message.length > 512)) throw new Error('Invalid baked byte resources');
  for (const row of resources) bytes.set(row.id, null);
  return {
    load: async () => {
      const [meshes] = await Promise.all([Promise.all(names.map(async name => {
        const result = new Map<string, Mesh>();
        try {
          const gltf = await loadRigFile(urls[name]), nodes: Mesh[] = [];
          gltf.scene.traverse(node => { if (isMesh(node)) nodes.push(node); });
          if (nodes.length !== pieces[name].kinds.length) throw new Error(`${label} ${name}: baked node count differs`);
          pieces[name].kinds.forEach((kind, i) => { const node = nodes[i]; if (node !== undefined) result.set(kind.name, node); });
        } catch (error: unknown) { console.error(`[baked] ${label} ${name} did not load; it stands undrawn:`, error); }
        return result;
      })), Promise.all(resources.map(async row => {
        if (readBytes === undefined) throw new Error('Missing baked byte reader');
        try { bytes.set(row.id, await readBytes(row.url)); }
        catch (error: unknown) { bytes.set(row.id, null); console[row.fault.level](row.fault.message, error); }
      }))]);
      loaded = new Map(names.map((name, i) => [name, meshes[i] ?? new Map<string, Mesh>()])); return loaded;
    },
    last: () => loaded,
    bytes: id => { if (!bytes.has(id)) throw new Error(`Unknown baked byte resource ${id}`); return bytes.get(id) ?? null; },
    piece: (piece, call = {}) => {
      const rows = pieces[piece], nodes = call.nodes ?? loaded?.get(piece), kinds = call.only === undefined ? rows.kinds : rows.kinds.filter(call.only);
      const root = bakedMeshKindsGroup(nodes, kinds, { ...draw, decorate: (material, kind) => { draw.decorate?.(material, kind); call.each?.(material); } });
      const byName = new Map<string, Mesh>();
      kinds.filter(kind => nodes?.has(kind.name) === true).forEach((kind, i) => {
        const mesh = root.children[i]; if (!isMesh(mesh)) throw new Error('Baked mesh order differs');
        byName.set(kind.name, mesh);
        const tint = rows.tints?.[kind.name];
        if (tint !== undefined) { if (!instanced(mesh)) throw new Error('Ordinary baked meshes cannot carry instance tints'); mesh.instanceColor = new InstancedBufferAttribute(new Float32Array(tint), 3); }
      });
      return { root, colliders: bakedColliders(rows.colliders), kinds: byName };
    },
  };
}

/**
 * A world piece as a row (G345): the registry's id, name, catalog tab, source file and surface, and optionally where its
 * object stands (`at`, turned `yaw` about Y, named `node`), its player mode, and the bake's piece it is drawn from.
 */
export interface WorldPieceRow<B extends string = string> {
  readonly id: string; readonly name: string; readonly category: PieceCategory; readonly file: string;
  readonly surface?: Material; readonly mode?: Piece['mode']; readonly baked?: B;
  readonly at?: readonly [number, number, number]; readonly yaw?: number; readonly node?: string;
}
/** What a builder hands a row: its object, or a part set with its root and colliders. */
export type BuiltPiece = Object3D | { readonly root: Object3D; readonly colliders?: ColliderDesc[] };
/** A piece drawn from a bake: its root and its baked colliders. */
export interface BakedPart { readonly root: Object3D; readonly colliders: ColliderDesc[] }
/** A shard's world pieces placed from their rows. */
export interface WorldPieces {
  /** Place row `id`'s built object (at its row's pose), add it under the root and register it; `extra` adds fields (colliders, active). */
  readonly add: <T extends BuiltPiece>(id: string, built: T, extra?: Pick<Piece, 'colliders' | 'active'>) => T;
  /** Place a row drawn straight from the bake (`baked`): its kinds and its baked colliders. */
  readonly baked: (id: string) => BakedPart;
  /** The declared static collider rows for an existing piece identity. */
  readonly colliders: (id: string | readonly BakedColliderInput[], expectedSurface?: Material) => ColliderDesc[];
}
/**
 * Place world pieces from rows, shared by Signal Dunes and Sky Reach (G345): each row poses its object, adds it under `root`
 * and registers it with the level's one world registry (`register`, the level's `ctx.piece`), in the order the shard calls.
 */
export function worldPieces<B extends string>(register: (piece: Piece) => void, root: Object3D, rows: readonly WorldPieceRow<B>[], bake?: (piece: B) => BakedPart, colliderRows: readonly { readonly id: string; readonly colliders: readonly BakedColliderInput[] }[] = []): WorldPieces {
  const byId = new Map(rows.map((row) => [row.id, row])), shapes = new Map(colliderRows.map(row => [row.id,row.colliders]));
  if (shapes.size !== colliderRows.length) throw new Error('Duplicate declared collider piece');
  const row = (id: string): WorldPieceRow<B> => { const found = byId.get(id); if (found === undefined) throw new Error(`world piece ${id}: no row`); return found; };
  const add = <T extends BuiltPiece>(id: string, built: T, extra: Pick<Piece, 'colliders' | 'active'> = {}): T => {
    const r = row(id), object = built instanceof Object3D ? built : built.root, colliders = extra.colliders ?? (built instanceof Object3D ? undefined : built.colliders);
    if (r.at !== undefined) object.position.set(r.at[0], r.at[1], r.at[2]);
    if (r.yaw !== undefined) object.rotation.y = r.yaw;
    if (r.node !== undefined) object.name = r.node;
    root.add(object);
    register({ id, name: r.name, category: r.category, file: r.file, object, ...(colliders === undefined ? {} : { colliders }),
      ...(r.surface === undefined ? {} : { surface: r.surface }), ...(r.mode === undefined ? {} : { mode: r.mode }), ...(extra.active === undefined ? {} : { active: extra.active }) });
    return built;
  };
  return { add, colliders: (id, expectedSurface) => {
    const label = typeof id === 'string' ? id : 'inline shapes', declared = typeof id === 'string' ? shapes.get(id) : id; if (declared === undefined) throw new Error(`world piece ${label}: no colliders`);
    const made = bakedColliders(declared);
    if (expectedSurface !== undefined && made.some(shape => shape.surface !== expectedSurface)) throw new Error(`world piece ${label}: collider surface differs`);
    return made;
  }, baked: (id) => {
    const piece = row(id).baked; if (piece === undefined || bake === undefined) throw new Error(`world piece ${id}: not baked`);
    return add(id, bake(piece));
  } };
}

