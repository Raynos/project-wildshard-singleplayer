import { loadRigFile } from "@wildshard/engine/anim/rig";
import { cacheUntilDisposed, retainCachedResources } from "@wildshard/engine/app/cachedAssets";
import { Bone, FileLoader, SkinnedMesh, type AnimationClip, type Texture, Box3, BufferGeometry, Float32BufferAttribute, Group, Mesh, MeshStandardMaterial, Uint16BufferAttribute, Vector3, BufferAttribute, type Object3D, CanvasTexture, LinearMipmapLinearFilter, SRGBColorSpace, Float16BufferAttribute, InterleavedBufferAttribute, BoxGeometry, CylinderGeometry, ConeGeometry, SphereGeometry, TorusGeometry, IcosahedronGeometry, CapsuleGeometry, Shape, ExtrudeGeometry, Color, type MeshStandardMaterialParameters, type Material } from "three";
import { applySurfaceLooks, type SurfaceInputs } from "../systems/looks/surfaceLooks";
import type { SurfaceLook } from "@wildshard/format/surfaceLooks";
import { Rng } from "@wildshard/engine/core/rng";
import type { AnimalSpecies } from "@wildshard/engine/entities/species/registry";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { NpcMotion, NpcRow } from "./quests";

/**
 * A model library (SHARD-PLATFORM M3; ex a dune shard's generated models): the GLBs a level loads once behind its loading
 * screen and then copies synchronously while it builds, each list driven by rows. Nothing here knows a shard.
 *
 * - facet models: every mesh of the file flattened into one non-indexed geometry in world space: position, the facet
 *   colour (rgb × the baked AO in COLOR_0's alpha, kept down to the row's `aoFloor`) and flat normals;
 * - hero models: the scene as loaded (its own maps on its own UVs), matte and smooth, each material then dressed by the
 *   model's `HdLookRow` (tint, roughness, fog, user flags, surface-look rows);
 * - baked rigs: one skinned geometry whose bone indices and weights ride in `_JOINTS` / `_WEIGHTS`.
 *
 * A file that fails to load is a page fault (`console.error`; the boot smoke and the tests fail on it), never a silent
 * stand-in: the caller's copy is null and the thing it would draw stands undrawn. The helpers below (`fitGeometry`,
 * `withoutTriangles`, `bindRigid`, `smoothColors`, `undrawnRig`, `facetMaterial`) shape the copies.
 *
 * Creature bodies (`creatureBodies`, over `skinnedModel`): standard skinned GLBs a generator baked (bones with their bind
 * positions, parts, clips and the shard's extras), copied per spawn, each with its stand-in skeleton when it did not load.
 */





/** How a hero model's materials are dressed after the matte base: each field optional, applied in this order. */
export interface HdLookRow {
  /** the material colour, linear RGB */
  readonly color?: readonly [number, number, number];
  readonly roughness?: number;
  readonly fog?: boolean;
  /** flags the caller's own passes read off the material's userData */
  readonly userData?: Readonly<Record<string, boolean>>;
  /** surface-look rows installed over the library's surface inputs */
  readonly surface?: readonly SurfaceLook[];
}

/** A model library's files and looks, as data. */
export interface ModelLibraryRows<M extends string, H extends string, R extends string> {
  /** the facet models preloaded, and every facet model's file */
  readonly meshes: readonly M[];
  readonly meshUrls: Readonly<Record<M, string>>;
  /** the hero models preloaded, and every hero model's file */
  readonly hd: readonly H[];
  readonly hdUrls: Readonly<Record<H, string>>;
  /** the baked rigs preloaded, and every rig's file */
  readonly rigs: readonly R[];
  readonly rigUrls: Readonly<Record<R, string>>;
  /** a facet in full occlusion keeps this share of its colour */
  readonly aoFloor: number;
  /** the hero models' dressing, by name */
  readonly hdLooks: Readonly<Partial<Record<H, HdLookRow>>>;
}

/** How a copy is framed: turned `yaw` about +Y, centred on x / z, its lowest point at `floor`, `size` metres by span or height. */
/** How `fitGeometry` frames a model; `centre: 'base'` centres x / z on its footing (the lowest tenth), not its whole box. */
export interface ModelFit { readonly size: number; readonly by: 'span' | 'height'; readonly floor?: number; readonly yaw?: number; readonly centre?: 'base' }

/** A loaded model library: preload once, then take copies. */
export interface ModelLibrary<M extends string, H extends string, R extends string> {
  /** Load every listed model and rig once (a failed one is skipped and faulted). */
  preload: () => Promise<void>;
  /** A copy of a loaded facet model's geometry, or null (not loaded: the caller's code model stands in). */
  mesh: (name: M) => BufferGeometry | null;
  /** A copy of a baked rig with its flat normals recomputed, or null (not loaded: its load was faulted). */
  rig: (name: R) => BufferGeometry | null;
  /** A hero model fitted as `fit`, as a group sharing the loaded geometry and maps; null when it did not load. */
  hd: (name: H, fit: ModelFit) => Group | null;
}

const isMesh = (o: Object3D): o is Mesh => o instanceof Mesh;

/** One mesh's triangles in world space, de-indexed, as plain float32 (meshopt quantizes the attributes). */
function flatten(mesh: Mesh, aoFloor: number): { pos: number[]; col: number[] } {
  const g = mesh.geometry, p = g.getAttribute('position'), c = g.hasAttribute('color') ? g.getAttribute('color') : null;
  const index = g.getIndex(), n = index ? index.count : p.count, pos: number[] = [], col: number[] = [], v = new Vector3();
  for (let k = 0; k < n; k++) {
    const i = index ? index.getX(k) : k;
    v.fromBufferAttribute(p, i).applyMatrix4(mesh.matrixWorld); pos.push(v.x, v.y, v.z);
    const ao = c?.itemSize === 4 ? aoFloor + (1 - aoFloor) * c.getW(i) : 1;
    col.push((c ? c.getX(i) : 1) * ao, (c ? c.getY(i) : 1) * ao, (c ? c.getZ(i) : 1) * ao);
  }
  return { pos, col };
}

/** A hero material's matte base, then its look row. */
function dressHd(m: MeshStandardMaterial, look: HdLookRow | undefined, inputs: SurfaceInputs): void {
  m.metalness = 0; m.roughness = 0.85; m.flatShading = false;
  if (look !== undefined) {
    if (look.color !== undefined) m.color.setRGB(look.color[0], look.color[1], look.color[2]);
    if (look.roughness !== undefined) m.roughness = look.roughness;
    if (look.fog !== undefined) m.fog = look.fog;
    if (look.userData !== undefined) for (const [key, value] of Object.entries(look.userData)) m.userData[key] = value;
    if (look.surface !== undefined) applySurfaceLooks(m, look.surface, inputs);
  }
  m.needsUpdate = true;
}

/**
 * A model library over `rows`. `fault` opens every page fault a failed file logs (e.g. the shard's name in brackets);
 * `surfaceInputs` are the live uniforms the hero models' surface rows read.
 */
export function createModelLibrary<M extends string, H extends string, R extends string>(rows: ModelLibraryRows<M, H, R>, fault: string, surfaceInputs: SurfaceInputs = {}): ModelLibrary<M, H, R> {
  const ready = new Map<M, BufferGeometry>(), rigs = new Map<R, BufferGeometry>(), hd = new Map<H, Object3D>();
  let loading: Promise<void> | null = null;

  async function load(name: M): Promise<void> {
    try {
      const gltf = await loadRigFile(rows.meshUrls[name]);
      gltf.scene.updateMatrixWorld(true);
      const pos: number[] = [], col: number[] = [];
      gltf.scene.traverse((o) => { if (isMesh(o)) { const f = flatten(o, rows.aoFloor); pos.push(...f.pos); col.push(...f.col); } });
      if (pos.length === 0) throw new Error(`${name}: no mesh`);
      const g = new BufferGeometry();
      g.setAttribute('position', new Float32BufferAttribute(pos, 3)); g.setAttribute('color', new Float32BufferAttribute(col, 3));
      g.computeVertexNormals(); g.computeBoundingBox(); retainCachedResources(g); ready.set(name, g);
      cacheUntilDisposed(g, () => { if (ready.get(name) === g) { ready.delete(name); loading = null; } });
    } catch (e: unknown) { console.error(`${fault} the generated model ${name} did not load:`, e); }
  }

  async function loadRig(name: R): Promise<void> {
    try {
      const gltf = await loadRigFile(rows.rigUrls[name]), meshes: Mesh[] = [];
      gltf.scene.traverse((o) => { if (isMesh(o)) meshes.push(o); });
      const loaded = meshes[0]?.geometry;
      if (meshes.length !== 1 || loaded === undefined) throw new Error(`${name}: ${String(meshes.length)} meshes, one baked`);
      const source = loaded.index === null ? loaded : loaded.toNonIndexed();
      for (const key of ['position', 'color', '_joints', '_weights']) if (!source.hasAttribute(key)) throw new Error(`${name}: no ${key}`);
      const p = source.getAttribute('position'), c = source.getAttribute('color'), j = source.getAttribute('_joints'), w = source.getAttribute('_weights');
      const g = new BufferGeometry();
      g.setAttribute('position', new Float32BufferAttribute(p.array, 3)); g.setAttribute('color', new Float32BufferAttribute(c.array, 3));
      g.setAttribute('skinIndex', new Uint16BufferAttribute(Uint16Array.from(j.array), 4)); g.setAttribute('skinWeight', new Float32BufferAttribute(w.array, 4));
      retainCachedResources(g); rigs.set(name, g); source.dispose(); loaded.dispose();
      cacheUntilDisposed(g, () => { if (rigs.get(name) === g) { rigs.delete(name); loading = null; } });
    } catch (e: unknown) { console.error(`${fault} the baked rig ${name} did not load:`, e); }
  }

  async function loadHd(name: H): Promise<void> {
    try {
      const gltf = await loadRigFile(rows.hdUrls[name]), look = rows.hdLooks[name];
      gltf.scene.traverse((o) => {
        if (!isMesh(o)) return;
        for (const m of Array.isArray(o.material) ? o.material : [o.material]) if (m instanceof MeshStandardMaterial) dressHd(m, look, surfaceInputs);
      });
      retainCachedResources(gltf.scene); hd.set(name, gltf.scene);
      cacheUntilDisposed(gltf.scene, () => { if (hd.get(name) === gltf.scene) { hd.delete(name); loading = null; } });
    } catch (e: unknown) { console.error(`${fault} the generated model ${name} did not load:`, e); }
  }

  return {
    preload: () => {
      loading ??= Promise.all([...rows.meshes.filter(name => !ready.has(name)).map(load), ...rows.hd.filter(name => !hd.has(name)).map(loadHd),
        ...rows.rigs.filter(name => !rigs.has(name)).map(loadRig)]).then(() => undefined);
      return loading;
    },
    mesh: name => ready.get(name)?.clone() ?? null,
    rig: (name) => { const g = rigs.get(name)?.clone() ?? null; g?.computeVertexNormals(); return g; },
    hd: (name, o) => {
      const src = hd.get(name); if (!src) return null;
      const inner = src.clone(true), holder = new Group(), turn = new Group();
      turn.rotation.y = o.yaw ?? 0; turn.add(inner); holder.add(turn); holder.updateMatrixWorld(true);
      const b = new Box3().setFromObject(holder);
      const span = o.by === 'height' ? b.max.y - b.min.y : Math.max(b.max.x - b.min.x, b.max.z - b.min.z), k = o.size / Math.max(1e-6, span);
      turn.position.set(-(b.min.x + b.max.x) / 2, -b.min.y, -(b.min.z + b.max.z) / 2);
      const out = new Group(); out.add(holder); holder.scale.setScalar(k); holder.position.y = o.floor ?? 0;
      return out;
    },
  };
}

/** A creature that did not load stands undrawn: one zero-area triangle on bone 0 (a species needs a geometry part). */
export function undrawnRig(): BufferGeometry {
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(new Float32Array(9), 3)); g.setAttribute('color', new Float32BufferAttribute(new Float32Array(9), 3));
  g.setAttribute('normal', new Float32BufferAttribute(new Float32Array(9), 3));
  g.setAttribute('skinIndex', new Uint16BufferAttribute(new Uint16Array(12), 4)); g.setAttribute('skinWeight', new Float32BufferAttribute([1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0], 4));
  return g;
}

/** The facet models' material: the facet colours, matte (one per model: the caller's scope owns and disposes it). */
export const facetMaterial = (): MeshStandardMaterial => new MeshStandardMaterial({ vertexColors: true, roughness: 0.9, metalness: 0, flatShading: true });

/** A baked joint: its name, its parent's name (null for a root) and its exact bind position (BoneDef's shape). */
export interface SkinnedJoint { readonly name: string; readonly parent: string | null; readonly pos: [number, number, number] }
/** One skinned part: an independent geometry copy (skinIndex / skinWeight over `bones`) and its shared base-colour map. */
export interface SkinnedAssetPart { readonly name: string; readonly geometry: BufferGeometry; readonly map: Texture | null }
export interface SkinnedAsset {
  readonly bones: readonly SkinnedJoint[];
  readonly parts: readonly SkinnedAssetPart[];
  /** The baked animations (shared, never mutated). */
  readonly clips: readonly AnimationClip[];
  /** The shard's own JSON the generator wrote beside the model. */
  readonly extras: unknown;
}
/**
 * An offline skinned model (`@wildshard/sdk/bake/skinned` writes it): load once behind the loading screen, then take
 * copies. Each `copy()` hands out independent geometry (safe to merge, scale or dispose) bit-exact to what the generator
 * baked: every channel as written, the weights never renormalized, an authored triangle soup restored, the joints' exact
 * bind positions. The maps, clips and extras are shared. No services are installed on import.
 */
export interface SkinnedModel {
  /** Load the GLB through three's loading manager (the engine's tier / KTX2 / version URL policy applies, as to any
   * three loader); explicit bytes let a Node baker or test use the identical intake. */
  load: (bytes?: Uint8Array) => Promise<void>;
  loaded: () => boolean;
  copy: () => SkinnedAsset;
  /** The shared maps every copy draws with (for the owner's cache and upload policy). */
  textures: () => readonly Texture[];
}

const isSkinnedMesh = (node: Object3D): node is SkinnedMesh => node instanceof SkinnedMesh;
const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const numbers = (value: unknown): number[] | null => Array.isArray(value) && value.every((n: unknown) => typeof n === 'number') ? value : null;

/** Read the GLB's JSON chunk and each primitive's raw WEIGHTS_0 floats (three's loader renormalizes them in place). */
function rawWeights(bytes: Uint8Array): Map<string, Float32Array> {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength), length = view.getUint32(12, true);
  const doc: unknown = JSON.parse(new TextDecoder().decode(bytes.subarray(20, 20 + length)));
  const out = new Map<string, Float32Array>();
  if (!isRecord(doc) || !Array.isArray(doc['meshes']) || !Array.isArray(doc['accessors']) || !Array.isArray(doc['bufferViews'])) return out;
  const accessors: unknown[] = doc['accessors'], views: unknown[] = doc['bufferViews'], bin = 28 + length;
  doc['meshes'].forEach((mesh: unknown, m) => {
    if (!isRecord(mesh) || !Array.isArray(mesh['primitives'])) return;
    mesh['primitives'].forEach((row: unknown, p) => {
      const attributes = isRecord(row) && isRecord(row['attributes']) ? row['attributes'] : {}, id = attributes['WEIGHTS_0'];
      const accessor = typeof id === 'number' ? accessors[id] : undefined, bufferView = isRecord(accessor) && typeof accessor['bufferView'] === 'number' ? views[accessor['bufferView']] : undefined;
      if (!isRecord(accessor) || !isRecord(bufferView) || accessor['componentType'] !== 5126 || typeof accessor['count'] !== 'number') return;
      const start = bin + (typeof bufferView['byteOffset'] === 'number' ? bufferView['byteOffset'] : 0) + (typeof accessor['byteOffset'] === 'number' ? accessor['byteOffset'] : 0);
      const weights = new Float32Array(accessor['count'] * 4);
      for (let i = 0; i < weights.length; i++) weights[i] = view.getFloat32(start + i * 4, true);
      out.set(`${String(m)}/${String(p)}`, weights);
    });
  });
  return out;
}

/** A skinned model over one baked GLB (`url`); nothing loads until `load()`. */
export function skinnedModel(url: string): SkinnedModel {
  let template: SkinnedAsset | undefined, pending: Promise<void> | undefined;
  const load = async (bytes?: Uint8Array): Promise<void> => {
    const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader.js');
    let input = bytes;
    if (input === undefined) {
      const response: unknown = await new FileLoader().setResponseType('arraybuffer').loadAsync(url);
      if (!(response instanceof ArrayBuffer)) throw new Error(`Skinned model load failed: ${url}`);
      input = new Uint8Array(response);
    }
    const weights = rawWeights(input);
    const gltf = await new GLTFLoader().parseAsync(Uint8Array.from(input).buffer, '');
    const meshes: SkinnedMesh[] = [];
    gltf.scene.traverse((node: Object3D) => { if (isSkinnedMesh(node)) meshes.push(node); });
    const first = meshes[0];
    if (first === undefined) throw new Error(`Skinned model has no skinned mesh: ${url}`);
    const joints = first.skeleton.bones;
    const bones: SkinnedJoint[] = joints.map((bone) => {
      const extras: unknown = bone.userData['wildshard'], bind = isRecord(extras) ? numbers(extras['bind']) : null;
      if (bind?.length !== 3) throw new Error(`Skinned joint ${bone.name} has no bind position: ${url}`);
      return { name: bone.name, parent: bone.parent instanceof Bone ? bone.parent.name : null, pos: [bind[0] ?? 0, bind[1] ?? 0, bind[2] ?? 0] };
    });
    const parts = meshes.map((mesh) => {
      if (mesh.skeleton.bones.length !== joints.length || mesh.skeleton.bones.some((bone, i) => bone.name !== joints[i]?.name)) throw new Error(`Skinned parts must share one skeleton: ${url}`);
      const association = gltf.parser.associations.get(mesh), exact = weights.get(`${String(association?.meshes ?? -1)}/${String(association?.primitives ?? 0)}`);
      let geometry = mesh.geometry.clone();
      const extras: unknown = geometry.userData['wildshard'];
      geometry.userData = {};
      if (exact === undefined || exact.length !== geometry.getAttribute('skinWeight').count * 4) throw new Error(`Skinned part has no float weights: ${url}`);
      geometry.setAttribute('skinWeight', new Float32BufferAttribute(exact, 4));
      if (isRecord(extras) && isRecord(extras['attributes'])) for (const [from, to] of Object.entries(extras['attributes'])) {
        const channel = from.toLowerCase();
        if (typeof to !== 'string' || !geometry.hasAttribute(channel)) throw new Error(`Skinned part is missing ${from}: ${url}`);
        geometry.setAttribute(to, geometry.getAttribute(channel)); geometry.deleteAttribute(channel);
      }
      if (isRecord(extras) && extras['soup'] === true) { const soup = geometry.toNonIndexed(); geometry.dispose(); geometry = soup; }
      geometry.computeBoundingBox(); geometry.computeBoundingSphere();
      const material = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material, map = material !== undefined && 'map' in material && material.map !== null && typeof material.map === 'object' ? material.map as Texture : null;
      return { name: mesh.name, geometry, map };
    });
    for (const mesh of meshes) {
      mesh.geometry.dispose();
      for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) material.dispose();
    }
    const extras: unknown = isRecord(gltf.asset.extras) ? gltf.asset.extras['wildshard'] : null;
    template = { bones, parts, clips: gltf.animations, extras };
  };
  const start = async (bytes?: Uint8Array): Promise<void> => {
    try { await load(bytes); } catch (error: unknown) { pending = undefined; throw error; }
  };
  return {
    load: (bytes) => { pending ??= start(bytes); return pending; },
    loaded: () => template !== undefined,
    textures: () => template === undefined ? [] : [...new Set(template.parts.flatMap((part) => part.map === null ? [] : [part.map]))],
    copy: () => {
      if (template === undefined) throw new Error(`Skinned model was not loaded: ${url}`);
      return { clips: template.clips, extras: template.extras, bones: template.bones.map((bone) => ({ name: bone.name, parent: bone.parent, pos: [bone.pos[0], bone.pos[1], bone.pos[2]] })),
        parts: template.parts.map((part) => ({ name: part.name, map: part.map, geometry: part.geometry.clone() })) };
    },
  };
}

/** A creature body's size (AnimalDims without its feet), as a baked body's extras and a stand-in row carry it. */
export interface CreatureDims { readonly bodyY: number; readonly bodyHalfLen: number; readonly bodyRadius: number; readonly headRadius: number; readonly legLen: number; readonly halfWidth: number }
/** What a creature stands as when its baked body did not load: its authored skeleton and size, drawn as `undrawnRig`. */
export interface CreatureStandIn { readonly bones: readonly { readonly name: string; readonly parent: string | null; readonly pos: readonly [number, number, number] }[]; readonly dims: CreatureDims }
/** A shard's baked creature bodies, as data: which load, from where, and each one's stand-in. */
export interface CreatureBodyRows<C extends string> {
  readonly creatures: readonly C[];
  readonly urls: Readonly<Record<C, string>>;
  readonly standIns: Readonly<Record<C, CreatureStandIn>>;
  /** opens every page fault (e.g. the shard's name in brackets) */
  readonly fault: string;
  /** the owner's upload policy for each shared map, once loaded (before it is retained) */
  readonly onMap?: (map: Texture) => void;
}
/** A shard's loaded creature bodies: preload once, then each spawn takes a copy. */
export interface CreatureBodies<C extends string> {
  /** Load every body once (a failed one is a page fault). */
  preload: () => Promise<void>;
  /** A copy of a baked body, as a species look's `build()` returns it, or null (not loaded). */
  body: (creature: C) => AnimalSpecies | null;
  /** The baked copy, else its undrawn stand-in on its authored skeleton. */
  bodyOrStandIn: (creature: C) => AnimalSpecies;
}

const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
/** A baked body's extras as its look numbers (`dims`, optional `facetJitter` / `selfLight`), or null. */
function bodyExtras(value: unknown): { dims: CreatureDims; facetJitter?: number; selfLight?: number } | null {
  if (!isRecord(value) || !isRecord(value['dims'])) return null;
  const d = value['dims'], jitter = value['facetJitter'], light = value['selfLight'];
  const { bodyY, bodyHalfLen, bodyRadius, headRadius, legLen, halfWidth } = d;
  if (!finite(bodyY) || !finite(bodyHalfLen) || !finite(bodyRadius) || !finite(headRadius) || !finite(legLen) || !finite(halfWidth)) return null;
  return { dims: { bodyY, bodyHalfLen, bodyRadius, headRadius, legLen, halfWidth }, ...(finite(jitter) ? { facetJitter: jitter } : {}), ...(finite(light) ? { selfLight: light } : {}) };
}

/**
 * A shard's creature bodies baked offline as skinned GLBs (`skinnedModel`), each loaded once behind the loading screen;
 * every spawn takes a copy: its bones, skin, dims and painted map exactly as the generator baked them. A body that fails
 * to load is a `console.error` page fault and its species stands undrawn on its stand-in skeleton.
 */
export function creatureBodies<C extends string>(rows: CreatureBodyRows<C>): CreatureBodies<C> {
  const models = new Map<C, SkinnedModel>();
  let loading: Promise<void> | null = null;
  async function load(creature: C): Promise<void> {
    const model = skinnedModel(rows.urls[creature]);
    try {
      await model.load();
      for (const map of model.textures()) {
        rows.onMap?.(map);
        retainCachedResources(map);
        cacheUntilDisposed(map, () => { if (models.get(creature) === model) { models.delete(creature); loading = null; } });
      }
      models.set(creature, model);
    } catch (e: unknown) { console.error(`${rows.fault} the baked creature ${creature} did not load:`, e); }
  }
  const body = (creature: C): AnimalSpecies | null => {
    const model = models.get(creature);
    if (model === undefined) return null;
    const asset = model.copy(), extras = bodyExtras(asset.extras), map = asset.parts[0]?.map ?? null;
    if (extras === null) throw new Error(`${rows.fault} the baked creature ${creature} has no dims`);
    return { bones: asset.bones.map((bone) => ({ name: bone.name, parent: bone.parent, pos: bone.pos })), furParts: [], eyeParts: [], hardParts: asset.parts.map((part) => part.geometry),
      dims: { ...extras.dims, feet: [] }, ...(map === null ? {} : { map }), ...(extras.facetJitter === undefined ? {} : { facetJitter: extras.facetJitter }),
      ...(extras.selfLight === undefined ? {} : { selfLight: extras.selfLight }) };
  };
  return {
    preload: () => { loading ??= Promise.all(rows.creatures.filter((creature) => !models.has(creature)).map(load)).then(() => undefined); return loading; },
    body,
    bodyOrStandIn: (creature) => {
      const stand = rows.standIns[creature];
      return body(creature) ?? { bones: stand.bones.map((bone) => ({ name: bone.name, parent: bone.parent, pos: [bone.pos[0], bone.pos[1], bone.pos[2]] })), furParts: [], eyeParts: [],
        hardParts: [undrawnRig()], dims: { ...stand.dims, feet: [] } };
    },
  };
}

/** Fit a geometry into a frame (turned `yaw` radians about +Y first): centred on x / z, its lowest point at `floor`, scaled to `size`. */
export function fitGeometry(g: BufferGeometry, o: ModelFit): BufferGeometry {
  if (o.yaw !== undefined) g.rotateY(o.yaw);
  const p = g.getAttribute('position'), b = new Box3().setFromBufferAttribute(p as BufferAttribute);
  if (o.centre === 'base') {
    let x = 0, z = 0, n = 0; const top = b.min.y + (b.max.y - b.min.y) * 0.1;
    for (let i = 0; i < p.count; i++) if (p.getY(i) <= top) { x += p.getX(i); z += p.getZ(i); n++; }
    if (n > 0) { const cx = x / n, cz = z / n, hx = Math.max(b.max.x - cx, cx - b.min.x), hz = Math.max(b.max.z - cz, cz - b.min.z); b.min.x = cx - hx; b.max.x = cx + hx; b.min.z = cz - hz; b.max.z = cz + hz; }
  }
  const span = o.by === 'height' ? b.max.y - b.min.y : Math.max(b.max.x - b.min.x, b.max.z - b.min.z), k = o.size / Math.max(1e-6, span);
  g.translate(-(b.min.x + b.max.x) / 2, -b.min.y, -(b.min.z + b.max.z) / 2);
  g.scale(k, k, k); g.translate(0, o.floor ?? 0, 0); g.computeBoundingBox(); g.computeBoundingSphere();
  return g;
}

/** Drop the triangles whose centroid `cut` says to remove (a part the code model animates instead); disposes the input. */
export function withoutTriangles(g: BufferGeometry, cut: (x: number, y: number, z: number) => boolean): BufferGeometry {
  const p = g.getAttribute('position'), c = g.getAttribute('color'), pos: number[] = [], col: number[] = [];
  for (let t = 0; t + 2 < p.count; t += 3) {
    if (cut((p.getX(t) + p.getX(t + 1) + p.getX(t + 2)) / 3, (p.getY(t) + p.getY(t + 1) + p.getY(t + 2)) / 3, (p.getZ(t) + p.getZ(t + 1) + p.getZ(t + 2)) / 3)) continue;
    for (let v = t; v < t + 3; v++) { pos.push(p.getX(v), p.getY(v), p.getZ(v)); col.push(c.getX(v), c.getY(v), c.getZ(v)); }
  }
  const r = new BufferGeometry(); r.setAttribute('position', new Float32BufferAttribute(pos, 3)); r.setAttribute('color', new Float32BufferAttribute(col, 3));
  r.computeVertexNormals(); r.computeBoundingBox(); r.computeBoundingSphere(); g.dispose(); return r;
}

/** Bind every triangle rigidly to the bone `boneOf` names for its centroid (bone indices in the caller's skeleton order). */
export function bindRigid(g: BufferGeometry, boneOf: (x: number, y: number, z: number) => number): BufferGeometry {
  const p = g.getAttribute('position'), n = p.count, index = new Uint16Array(n * 4), weight = new Float32Array(n * 4);
  for (let t = 0; t + 2 < n; t += 3) {
    const bone = boneOf((p.getX(t) + p.getX(t + 1) + p.getX(t + 2)) / 3, (p.getY(t) + p.getY(t + 1) + p.getY(t + 2)) / 3, (p.getZ(t) + p.getZ(t + 1) + p.getZ(t + 2)) / 3);
    for (let v = t; v < t + 3; v++) { index[v * 4] = bone; weight[v * 4] = 1; }
  }
  g.setAttribute('skinIndex', new Uint16BufferAttribute(index, 4)); g.setAttribute('skinWeight', new Float32BufferAttribute(weight, 4));
  return g;
}

/**
 * Averages a facet model's painted colour per vertex position, by `amount` (0 keeps each facet's own shade, 1 the
 * average): facet-painted triangles read as patches; averaged, the paint reads continuous.
 */
export function smoothColors(g: BufferGeometry, amount = 1): void {
  if (!g.hasAttribute('color')) return;
  const p = g.getAttribute('position'), c = g.getAttribute('color'), sum = new Map<string, [number, number, number, number]>();
  const key = (i: number): string => `${p.getX(i).toFixed(4)},${p.getY(i).toFixed(4)},${p.getZ(i).toFixed(4)}`;
  for (let i = 0; i < p.count; i++) { const k = key(i), v = sum.get(k) ?? [0, 0, 0, 0]; v[0] += c.getX(i); v[1] += c.getY(i); v[2] += c.getZ(i); v[3]++; sum.set(k, v); }
  for (let i = 0; i < p.count; i++) {
    const v = sum.get(key(i)); if (!v) continue;
    c.setXYZ(i, c.getX(i) + (v[0] / v[3] - c.getX(i)) * amount, c.getY(i) + (v[1] / v[3] - c.getY(i)) * amount, c.getZ(i) + (v[2] / v[3] - c.getZ(i)) * amount);
  }
  c.needsUpdate = true;
}

// The canvas atlas (SHARD-PLATFORM M3): a 2D-canvas texture painted from draw steps that are data. A shard lists its
// decals (an engraved strip, a paper talisman, a label sheet) as rows; `paintCanvasAtlas` replays them on one canvas, in
// order, and returns it as a mipmapped sRGB texture. Each step is one canvas call or a small deterministic loop:
//  - `set`: any of fill / stroke style, line width / cap / join, font, text align / baseline, global alpha;
//  - `fillRect` / `strokeRect`; `save` / `restore` / `translate` / `scale` / `rotate` (angles in half turns, × π);
//  - `path`: one beginPath, its segments (M / L / A: arcs with angles × π) and a stroke or fill; with a scale `s` every
//    coordinate and radius is `s × value`, offset by `at` when given;
//  - `text`: fillText at a point;
//  - `radial`: a radial gradient (its stops) filling a rectangle;
//  - `speckle`: n seeded random marks (a Park–Miller sequence) in two styles over a rectangle (paper fibre);
//  - `grain`: n marks on a fixed stride pattern over a rectangle (a quieter fibre).
// Drawn at `scale` (the canvas `scale` times the authored size, every coordinate kept): a phone tier halves an atlas.
//
// Procedural painters (a fern frond, a pebble scatter, an end-grain disc) are the same rows with expressions: a value is
// a number or an expression string (`'128 + sin(t * 2.2) * 6'`), evaluated with JavaScript's operators, precedence and
// left-to-right order, so every double is the one the hand-written painter computed. A style string holding `{expr}`
// parts is a template (`'rgb({52 + hue * 6},{82 + hue * 8},34)'`, each part as JavaScript's `${}` prints it).
//  - `rng`: the painter's random stream, the engine's `Rng` from a seed (`next()` and `range(a, b)` in expressions);
//  - `let` / `assign` / `fn` / `list` / `push`: block-scoped values, expression functions and lists of tuples;
//  - `loop` (n times) / `for` (from, while, next) / `each` (over numbers or a list) / `if`: control, each body a scope (`if` runs `yes` or `no`);
//  - `call`: one path or rect call with expression arguments; `gradient`: a linear or radial gradient as the fill or
//    stroke style; `valueNoise`: an octave value-noise ImageData from the stream (grey, opaque) put at the origin.
// Expression built-ins: PI, sin, cos, tan, atan2, sqrt, abs, floor, ceil, round, min, max, next, range, and the vars
// the caller passes (a level's seed).



/** one path segment: move, line, or arc (centre, radius, start and end angle in half turns, and when given whether it
 *  runs counter-clockwise) */
export type CanvasSegment = readonly ['M', number, number] | readonly ['L', number, number] | readonly ['A', number, number, number, number, number] | readonly ['A', number, number, number, number, number, boolean];

/** a number, or an expression string evaluated in the painter's scope */
export type CanvasExpr = number | string;

/** the canvas calls a `call` step makes, its arguments expressions */
export type CanvasCall = 'beginPath' | 'closePath' | 'fill' | 'stroke' | 'moveTo' | 'lineTo' | 'arc' | 'ellipse' | 'quadraticCurveTo' | 'bezierCurveTo' | 'fillRect' | 'strokeRect' | 'translate' | 'scale' | 'rotate' | 'save' | 'restore';

/** a draw step as data */
export type CanvasStep =
  | { readonly op: 'set'; readonly fill?: string; readonly stroke?: string; readonly width?: CanvasExpr; readonly cap?: CanvasLineCap; readonly join?: CanvasLineJoin; readonly font?: string; readonly align?: CanvasTextAlign; readonly baseline?: CanvasTextBaseline; readonly alpha?: CanvasExpr }
  | { readonly op: 'fillRect' | 'strokeRect'; readonly x: number; readonly y: number; readonly w: number; readonly h: number }
  | { readonly op: 'save' | 'restore' }
  | { readonly op: 'translate' | 'scale'; readonly x: number; readonly y: number }
  | { readonly op: 'rotate'; readonly turns: number }
  | { readonly op: 'path'; readonly segs: readonly CanvasSegment[]; readonly s?: number; readonly at?: readonly [number, number]; readonly fill?: boolean }
  | { readonly op: 'text'; readonly text: string; readonly x: number; readonly y: number }
  | { readonly op: 'radial'; readonly from: readonly [number, number, number]; readonly to: readonly [number, number, number]; readonly stops: readonly (readonly [number, string])[]; readonly x: number; readonly y: number; readonly w: number; readonly h: number }
  | { readonly op: 'speckle'; readonly n: number; readonly seed: number; readonly split: number; readonly styles: readonly [string, string]; readonly x: number; readonly y: number; readonly w: number; readonly h: number; readonly mark: readonly [number, number, number, number] }
  | { readonly op: 'grain'; readonly n: number; readonly stride: readonly [number, number]; readonly mark: readonly [number, number, number, number]; readonly x: number; readonly y: number; readonly w: number; readonly h: number }
  | { readonly op: 'rng'; readonly seed: CanvasExpr }
  | { readonly op: 'let' | 'assign'; readonly vars: readonly (readonly [string, CanvasExpr])[] }
  | { readonly op: 'fn'; readonly name: string; readonly params: readonly string[]; readonly body: string }
  | { readonly op: 'list'; readonly name: string }
  | { readonly op: 'push'; readonly list: string; readonly vals: readonly CanvasExpr[] }
  | { readonly op: 'loop'; readonly v: string; readonly n: CanvasExpr; readonly body: readonly CanvasStep[] }
  | { readonly op: 'for'; readonly v: string; readonly from: CanvasExpr; readonly while: string; readonly next: string; readonly body: readonly CanvasStep[] }
  | { readonly op: 'each'; readonly v: string | readonly string[]; readonly of: string | readonly number[]; readonly body: readonly CanvasStep[] }
  | { readonly op: 'if'; readonly cond: string; readonly yes: readonly CanvasStep[]; readonly no?: readonly CanvasStep[] }
  | { readonly op: 'call'; readonly fn: CanvasCall; readonly args?: readonly CanvasExpr[] }
  | { readonly op: 'gradient'; readonly kind: 'linear' | 'radial'; readonly args: readonly CanvasExpr[]; readonly stops: readonly (readonly [CanvasExpr, string])[]; readonly to?: 'fill' | 'stroke' }
  | { readonly op: 'valueNoise'; readonly size: number; readonly octaves: readonly number[]; readonly amp: number; readonly gain: number };

/** an atlas as data: its authored size, the draw scale (undefined: no scale call) and its steps */
export interface CanvasAtlasRow { readonly w: number; readonly h: number; readonly steps: readonly CanvasStep[] }

// ───────────────────────────── expressions ─────────────────────────────

type Value = number | string | boolean;
type Compiled = (s: Scope) => Value;
interface PaintState { readonly g: CanvasRenderingContext2D; rng: Rng | null }
interface ExprFn { readonly params: readonly string[]; readonly body: Compiled; readonly scope: Scope }

class Scope {
  readonly vars = new Map<string, Value>();
  readonly lists = new Map<string, Value[][]>();
  readonly fns = new Map<string, ExprFn>();
  readonly parent: Scope | null;
  readonly paint: PaintState;
  constructor(parent: Scope | null, paint: PaintState) { this.parent = parent; this.paint = paint; }
  child(): Scope { return new Scope(this, this.paint); }
  owner<K>(pick: (s: Scope) => Map<string, K>, name: string): Map<string, K> {
    if (pick(this).has(name)) return pick(this);
    if (this.parent === null) throw new Error(`canvas painter: unknown name ${name}`);
    return this.parent.owner(pick, name);
  }
  get(name: string): Value { const v = this.owner((s) => s.vars, name).get(name); if (v === undefined) throw new Error(name); return v; }
  list(name: string): Value[][] { const l = this.owner((s) => s.lists, name).get(name); if (l === undefined) throw new Error(name); return l; }
  fn(name: string): ExprFn | undefined { return this.fns.get(name) ?? this.parent?.fn(name); }
}

const truthy = (v: Value): boolean => (typeof v === 'number' ? v !== 0 && !Number.isNaN(v) : typeof v === 'string' ? v !== '' : v);
function num(v: Value): number {
  if (typeof v !== 'number') throw new Error(`canvas painter: ${String(v)} is not a number`);
  return v;
}
function stream(s: Scope): Rng {
  const r = s.paint.rng;
  if (r === null) throw new Error('canvas painter: no rng step before next() / range()');
  return r;
}
const MATH: Readonly<Record<string, (a: readonly number[]) => number>> = {
  sin: (a) => Math.sin(canvasArgument(a, 0)), cos: (a) => Math.cos(canvasArgument(a, 0)), tan: (a) => Math.tan(canvasArgument(a, 0)), atan2: (a) => Math.atan2(canvasArgument(a, 0), canvasArgument(a, 1)),
  sqrt: (a) => Math.sqrt(canvasArgument(a, 0)), abs: (a) => Math.abs(canvasArgument(a, 0)), floor: (a) => Math.floor(canvasArgument(a, 0)), ceil: (a) => Math.ceil(canvasArgument(a, 0)),
  round: (a) => Math.round(canvasArgument(a, 0)), min: (a) => Math.min(...a), max: (a) => Math.max(...a),
};
function canvasArgument(a: readonly number[], i: number): number {
  const v = a[i];
  if (v === undefined) throw new Error('canvas painter: missing argument');
  return v;
}

const TOKEN = /\s*(?:(\d+(?:\.\d*)?(?:[eE][-+]?\d+)?|\.\d+(?:[eE][-+]?\d+)?)|([A-Za-z_]\w*)|'([^']*)'|(\*\*|===|!==|<=|>=|&&|\|\||[-+*/%<>()?:,!]))/yu;
const BINARY: Readonly<Record<string, (a: number, b: number) => Value>> = {
  '+': (a, b) => a + b, '-': (a, b) => a - b, '*': (a, b) => a * b, '/': (a, b) => a / b, '%': (a, b) => a % b, '**': (a, b) => a ** b,
  '<': (a, b) => a < b, '<=': (a, b) => a <= b, '>': (a, b) => a > b, '>=': (a, b) => a >= b,
};
const LEVELS: readonly (readonly string[])[] = [['===', '!=='], ['<', '<=', '>', '>='], ['+', '-'], ['*', '/', '%']];

interface Token { readonly k: 'n' | 'id' | 's' | 'op'; readonly t: string }
function tokens(src: string): Token[] {
  const toks: Token[] = [];
  TOKEN.lastIndex = 0;
  while (TOKEN.lastIndex < src.length) {
    if (/^\s*$/u.test(src.slice(TOKEN.lastIndex))) break;
    const m = TOKEN.exec(src);
    if (m === null) throw new Error(`canvas painter: cannot read "${src}" at ${TOKEN.lastIndex}`);
    if (m[1] !== undefined) toks.push({ k: 'n', t: m[1] });
    else if (m[2] !== undefined) toks.push({ k: 'id', t: m[2] });
    else if (m[3] !== undefined) toks.push({ k: 's', t: m[3] });
    else toks.push({ k: 'op', t: m[4] ?? '' });
  }
  return toks;
}

/** a recursive-descent parse of one expression into a closure (JavaScript's precedence, associativity and order) */
class Parser {
  private p = 0;
  private readonly toks: readonly Token[];
  private readonly src: string;
  constructor(src: string) { this.src = src; this.toks = tokens(src); }
  parse(): Compiled {
    const out = this.ternary();
    if (this.p !== this.toks.length) throw new Error(`canvas painter: trailing input in "${this.src}"`);
    return out;
  }
  private peek(t: string): boolean { const k = this.toks[this.p]; return k?.k === 'op' && k.t === t; }
  private eat(t: string): void { if (!this.peek(t)) throw new Error(`canvas painter: expected ${t} in "${this.src}"`); this.p++; }
  private ternary(): Compiled {
    const c = this.or();
    if (!this.peek('?')) return c;
    this.p++;
    const a = this.ternary(); this.eat(':'); const b = this.ternary();
    return (s) => (truthy(c(s)) ? a(s) : b(s));
  }
  private or(): Compiled {
    let l = this.and();
    while (this.peek('||')) { this.p++; const a = l, b = this.and(); l = (s) => { const v = a(s); return truthy(v) ? v : b(s); }; }
    return l;
  }
  private and(): Compiled {
    let l = this.level(0);
    while (this.peek('&&')) { this.p++; const a = l, b = this.level(0); l = (s) => { const v = a(s); return truthy(v) ? b(s) : v; }; }
    return l;
  }
  private level(i: number): Compiled {
    const ops = LEVELS[i];
    if (ops === undefined) return this.unary();
    let l = this.level(i + 1);
    for (let t = this.toks[this.p]; t?.k === 'op' && ops.includes(t.t); t = this.toks[this.p]) {
      this.p++;
      const a = l, b = this.level(i + 1), op = t.t;
      if (op === '===') l = (s) => a(s) === b(s);
      else if (op === '!==') l = (s) => a(s) !== b(s);
      else { const f = BINARY[op]; if (f === undefined) throw new Error(op); l = (s) => f(num(a(s)), num(b(s))); }
    }
    return l;
  }
  private unary(): Compiled {
    if (this.peek('-')) { this.p++; const a = this.unary(); return (s) => -num(a(s)); }
    if (this.peek('!')) { this.p++; const a = this.unary(); return (s) => !truthy(a(s)); }
    const base = this.primary();
    if (!this.peek('**')) return base;
    this.p++;
    const e = this.unary();
    return (s) => num(base(s)) ** num(e(s));
  }
  private primary(): Compiled {
    const t = this.toks[this.p++];
    if (t === undefined) throw new Error(`canvas painter: "${this.src}" ends early`);
    if (t.k === 'n') { const v = Number(t.t); return () => v; }
    if (t.k === 's') { const v = t.t; return () => v; }
    if (t.k === 'op') { if (t.t !== '(') throw new Error(`canvas painter: unexpected ${t.t} in "${this.src}"`); const e = this.ternary(); this.eat(')'); return e; }
    const name = t.t;
    if (!this.peek('(')) return name === 'PI' ? () => Math.PI : (s) => s.get(name);
    this.p++;
    const args: Compiled[] = [];
    while (!this.peek(')')) { args.push(this.ternary()); if (!this.peek(')')) this.eat(','); }
    this.p++;
    return callOf(name, args);
  }
}

function callOf(name: string, args: readonly Compiled[]): Compiled {
  if (name === 'next') return (s) => stream(s).next();
  if (name === 'range') return (s) => { const a = num(argOf(args, 0)(s)), b = num(argOf(args, 1)(s)); return stream(s).range(a, b); };
  const m = MATH[name];
  if (m !== undefined) return (s) => m(args.map((a) => num(a(s))));
  return (s) => {
    const f = s.fn(name);
    if (f === undefined) throw new Error(`canvas painter: unknown function ${name}`);
    const vals = args.map((a) => a(s)), inner = f.scope.child();
    for (const [i, n] of f.params.entries()) inner.vars.set(n, vals[i] ?? 0);
    return f.body(inner);
  };
}
function argOf(args: readonly Compiled[], i: number): Compiled {
  const a = args[i];
  if (a === undefined) throw new Error('canvas painter: missing argument');
  return a;
}

const compiled = new Map<string, Compiled>();
function compile(src: string): Compiled {
  let c = compiled.get(src);
  if (c === undefined) { c = new Parser(src).parse(); compiled.set(src, c); }
  return c;
}
const value = (e: CanvasExpr, s: Scope): Value => (typeof e === 'number' ? e : compile(e)(s));
const number = (e: CanvasExpr, s: Scope): number => (typeof e === 'number' ? e : num(compile(e)(s)));

const templates = new Map<string, readonly (string | Compiled)[]>();
/** a style string: literal, or a template whose `{expr}` parts print as JavaScript's `${}` does */
function style(t: string, s: Scope): string {
  if (!t.includes('{')) return t;
  let parts = templates.get(t);
  if (parts === undefined) {
    const out: (string | Compiled)[] = [];
    for (const piece of t.split(/(\{[^}]*\})/u)) if (piece !== '') out.push(piece.startsWith('{') ? compile(piece.slice(1, -1)) : piece);
    parts = out;
    templates.set(t, parts);
  }
  let r = '';
  for (const part of parts) r += typeof part === 'string' ? part : String(part(s));
  return r;
}

// ───────────────────────────── steps ─────────────────────────────

function set(g: CanvasRenderingContext2D, st: Extract<CanvasStep, { op: 'set' }>, s: Scope): void {
  if (st.fill !== undefined) g.fillStyle = style(st.fill, s);
  if (st.stroke !== undefined) g.strokeStyle = style(st.stroke, s);
  if (st.width !== undefined) g.lineWidth = number(st.width, s);
  if (st.cap !== undefined) g.lineCap = st.cap;
  if (st.join !== undefined) g.lineJoin = st.join;
  if (st.font !== undefined) g.font = st.font;
  if (st.align !== undefined) g.textAlign = st.align;
  if (st.baseline !== undefined) g.textBaseline = st.baseline;
  if (st.alpha !== undefined) g.globalAlpha = number(st.alpha, s);
}

function path(g: CanvasRenderingContext2D, p: Extract<CanvasStep, { op: 'path' }>): void {
  const k = p.s, at0 = p.at;
  // a coordinate: the scaled value, offset by `at` (the same arithmetic an authored `x + s * k` performs)
  const cx = (v: number): number => (k === undefined ? v : at0 === undefined ? k * v : at0[0] + k * v);
  const cy = (v: number): number => (k === undefined ? v : at0 === undefined ? k * v : at0[1] + k * v);
  const r = (v: number): number => (k === undefined ? v : k * v);
  g.beginPath();
  for (const seg of p.segs) {
    if (seg[0] === 'M') g.moveTo(cx(seg[1]), cy(seg[2]));
    else if (seg[0] === 'L') g.lineTo(cx(seg[1]), cy(seg[2]));
    else if (seg.length === 7) g.arc(cx(seg[1]), cy(seg[2]), r(seg[3]), Math.PI * seg[4], Math.PI * seg[5], seg[6]);
    else g.arc(cx(seg[1]), cy(seg[2]), r(seg[3]), Math.PI * seg[4], Math.PI * seg[5]);
  }
  if (p.fill === true) g.fill(); else g.stroke();
}

function call(g: CanvasRenderingContext2D, fn: CanvasCall, a: readonly number[]): void {
  switch (fn) {
    case 'beginPath': g.beginPath(); break;
    case 'closePath': g.closePath(); break;
    case 'fill': g.fill(); break;
    case 'stroke': g.stroke(); break;
    case 'save': g.save(); break;
    case 'restore': g.restore(); break;
    case 'moveTo': g.moveTo(canvasArgument(a, 0), canvasArgument(a, 1)); break;
    case 'lineTo': g.lineTo(canvasArgument(a, 0), canvasArgument(a, 1)); break;
    case 'translate': g.translate(canvasArgument(a, 0), canvasArgument(a, 1)); break;
    case 'scale': g.scale(canvasArgument(a, 0), canvasArgument(a, 1)); break;
    case 'rotate': g.rotate(canvasArgument(a, 0)); break;
    case 'arc': g.arc(canvasArgument(a, 0), canvasArgument(a, 1), canvasArgument(a, 2), canvasArgument(a, 3), canvasArgument(a, 4)); break;
    case 'ellipse': g.ellipse(canvasArgument(a, 0), canvasArgument(a, 1), canvasArgument(a, 2), canvasArgument(a, 3), canvasArgument(a, 4), canvasArgument(a, 5), canvasArgument(a, 6)); break;
    case 'quadraticCurveTo': g.quadraticCurveTo(canvasArgument(a, 0), canvasArgument(a, 1), canvasArgument(a, 2), canvasArgument(a, 3)); break;
    case 'bezierCurveTo': g.bezierCurveTo(canvasArgument(a, 0), canvasArgument(a, 1), canvasArgument(a, 2), canvasArgument(a, 3), canvasArgument(a, 4), canvasArgument(a, 5)); break;
    case 'fillRect': g.fillRect(canvasArgument(a, 0), canvasArgument(a, 1), canvasArgument(a, 2), canvasArgument(a, 3)); break;
    case 'strokeRect': g.strokeRect(canvasArgument(a, 0), canvasArgument(a, 1), canvasArgument(a, 2), canvasArgument(a, 3)); break;
    default: { const unknown: never = fn; throw new Error(`unknown canvas call ${String(unknown)}`); }
  }
}

/** octave value noise from the stream: one n × n lattice of `next()` per octave, smoothstep-blended, amplitudes from
 *  `amp` falling by `gain`, written grey and opaque to a size × size ImageData put at the origin */
function valueNoise(g: CanvasRenderingContext2D, st: Extract<CanvasStep, { op: 'valueNoise' }>, rng: Rng): void {
  const sz = st.size, img = g.createImageData(sz, sz);
  const oct = st.octaves.map((n) => { const a = new Float32Array(n * n); for (let i = 0; i < a.length; i++) a[i] = rng.next(); return { n, a }; });
  const sm = (t: number): number => t * t * (3 - 2 * t);
  for (let y = 0; y < sz; y++) for (let x = 0; x < sz; x++) {
    let v = 0, amp = st.amp, sum = 0;
    for (const { n, a } of oct) {
      const fx = (x / sz) * n, fy = (y / sz) * n, x0 = Math.floor(fx), y0 = Math.floor(fy), tx = sm(fx - x0), ty = sm(fy - y0);
      const q = (i: number, j: number): number => a[((j + n) % n) * n + ((i + n) % n)] ?? 0;
      const vv = (q(x0, y0) * (1 - tx) + q(x0 + 1, y0) * tx) * (1 - ty) + (q(x0, y0 + 1) * (1 - tx) + q(x0 + 1, y0 + 1) * tx) * ty;
      v += vv * amp; sum += amp; amp *= st.gain;
    }
    const b = Math.floor((v / sum) * 255), i = (y * sz + x) * 4;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = b; img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
}

function run(g: CanvasRenderingContext2D, steps: readonly CanvasStep[], sc: Scope): void {
  for (const s of steps) {
    switch (s.op) {
      case 'set': set(g, s, sc); break;
      case 'fillRect': g.fillRect(s.x, s.y, s.w, s.h); break;
      case 'strokeRect': g.strokeRect(s.x, s.y, s.w, s.h); break;
      case 'save': g.save(); break;
      case 'restore': g.restore(); break;
      case 'translate': g.translate(s.x, s.y); break;
      case 'scale': g.scale(s.x, s.y); break;
      case 'rotate': g.rotate(Math.PI * s.turns); break;
      case 'path': path(g, s); break;
      case 'text': g.fillText(s.text, s.x, s.y); break;
      case 'radial': {
        const grd = g.createRadialGradient(s.from[0], s.from[1], s.from[2], s.to[0], s.to[1], s.to[2]);
        for (const [stop, colour] of s.stops) grd.addColorStop(stop, colour);
        g.fillStyle = grd;
        g.fillRect(s.x, s.y, s.w, s.h);
        break;
      }
      case 'speckle': {
        let q = s.seed;
        const rnd = (): number => { q = (q * 16807) % 2147483647; return q / 2147483647; };
        const [w0, w1, h0, h1] = s.mark;
        for (let i = 0; i < s.n; i++) {
          g.fillStyle = rnd() < s.split ? s.styles[0] : s.styles[1];
          g.fillRect(s.x + rnd() * s.w, s.y + rnd() * s.h, w0 + rnd() * w1, h0 + rnd() * h1);
        }
        break;
      }
      case 'grain': {
        const [w0, wm, h0, hm] = s.mark;
        for (let i = 0; i < s.n; i++) g.fillRect(s.x + ((i * s.stride[0]) % s.w), s.y + ((i * s.stride[1]) % s.h), w0 + (i % wm), h0 + (i % hm));
        break;
      }
      case 'rng': sc.paint.rng = new Rng(number(s.seed, sc)); break;
      case 'let': for (const [n, e] of s.vars) sc.vars.set(n, value(e, sc)); break;
      case 'assign': for (const [n, e] of s.vars) { const v = value(e, sc); sc.owner((x) => x.vars, n).set(n, v); } break;
      case 'fn': sc.fns.set(s.name, { params: s.params, body: compile(s.body), scope: sc }); break;
      case 'list': sc.lists.set(s.name, []); break;
      case 'push': { const l = sc.list(s.list); l.push(s.vals.map((e) => value(e, sc))); break; }
      case 'loop': { const n = number(s.n, sc); for (let i = 0; i < n; i++) { const it = sc.child(); it.vars.set(s.v, i); run(g, s.body, it); } break; }
      case 'for': {
        for (let cur = number(s.from, sc); ;) {
          const it = sc.child(); it.vars.set(s.v, cur);
          if (!truthy(compile(s.while)(it))) break;
          run(g, s.body, it);
          cur = num(compile(s.next)(it));
        }
        break;
      }
      case 'each': {
        if (typeof s.of === 'string') {
          const names = typeof s.v === 'string' ? [s.v] : s.v;
          for (const row of sc.list(s.of)) { const it = sc.child(); for (const [i, n] of names.entries()) it.vars.set(n, row[i] ?? 0); run(g, s.body, it); }
        } else for (const v of s.of) { const it = sc.child(); it.vars.set(typeof s.v === 'string' ? s.v : (s.v[0] ?? ''), v); run(g, s.body, it); }
        break;
      }
      case 'if': {
        if (truthy(compile(s.cond)(sc))) run(g, s.yes, sc.child());
        else if (s.no !== undefined) run(g, s.no, sc.child());
        break;
      }
      case 'call': call(g, s.fn, (s.args ?? []).map((e) => number(e, sc))); break;
      case 'gradient': {
        const a = s.args.map((e) => number(e, sc));
        const grd = s.kind === 'linear' ? g.createLinearGradient(canvasArgument(a, 0), canvasArgument(a, 1), canvasArgument(a, 2), canvasArgument(a, 3)) : g.createRadialGradient(canvasArgument(a, 0), canvasArgument(a, 1), canvasArgument(a, 2), canvasArgument(a, 3), canvasArgument(a, 4), canvasArgument(a, 5));
        for (const [stop, colour] of s.stops) grd.addColorStop(number(stop, sc), style(colour, sc));
        if (s.to === 'stroke') g.strokeStyle = grd; else g.fillStyle = grd;
        break;
      }
      case 'valueNoise': valueNoise(g, s, stream(sc)); break;
      default: {
        const unknown: never = s;
        throw new Error(`unknown canvas step ${JSON.stringify(unknown)}`);
      }
    }
  }
}

/** replay an atlas's steps on a 2D context (already sized and scaled); `vars` seeds the expressions' scope (a level seed) */
export function paintSteps(g: CanvasRenderingContext2D, steps: readonly CanvasStep[], vars: Readonly<Record<string, number>> = {}): void {
  const root = new Scope(null, { g, rng: null });
  for (const [k, v] of Object.entries(vars)) root.vars.set(k, v);
  run(g, steps, root);
}

/** paint a row on a new canvas of its size (no scale call: a step scales when the painter did) and return the canvas */
export function paintCanvas(row: CanvasAtlasRow, vars: Readonly<Record<string, number>> = {}): HTMLCanvasElement {
  const cv = document.createElement('canvas');
  cv.width = row.w;
  cv.height = row.h;
  const g = cv.getContext('2d');
  if (g === null) throw new Error('2d canvas unavailable');
  paintSteps(g, row.steps, vars);
  return cv;
}

/** paint an atlas row on a new canvas at `scale` (undefined: no scale call) and return it as a mipmapped sRGB texture */
export function paintCanvasAtlas(row: CanvasAtlasRow, scale?: number): CanvasTexture {
  const cv = document.createElement('canvas');
  cv.width = row.w * (scale ?? 1);
  cv.height = row.h * (scale ?? 1);
  const g = cv.getContext('2d');
  if (g === null) throw new Error('2d canvas unavailable');
  if (scale !== undefined) g.scale(scale, scale); // preserve all authored UVs and drawing coordinates at any resolution
  paintSteps(g, row.steps);
  const tex = new CanvasTexture(cv);
  tex.colorSpace = SRGBColorSpace;
  tex.minFilter = LinearMipmapLinearFilter;
  tex.anisotropy = 8;
  return tex;
}

/**
 * A pack of float32 geometries as an offline bake stores them (SHARD-PLATFORM M3, the kit system): each geometry's unique
 * vertices as one block per attribute, then its index (16 or 32 bit, 4-byte aligned), described by a row each. A geometry
 * the builder left indexed (`own`) comes back with its own copies of the blocks and its index; one the builder left
 * non-indexed (`own: null`) is expanded back through the index to `count` vertices, exactly as the builder had it.
 */

/** One draw group of a packed geometry: its index range and material slot, as three keeps it. */
export interface PackedGroup { readonly start: number; readonly count: number; readonly materialIndex: number }

/** One packed geometry: its attributes [name, item size], its vertex count, its unique vertices, its index. */
export interface PackedGeometryRow {
  readonly attrs: readonly (readonly [string, number])[];
  readonly count: number;
  readonly unique: number;
  /** the index the builder kept ('u16' / 'u32'), or null: expand it away */
  readonly own: 'u16' | 'u32' | null;
  readonly indexCount: number;
  /** the builder's draw groups (a primitive's side and caps, say), when it had any */
  readonly groups?: readonly PackedGroup[];
}

/** A pack's rows: its byte size and its geometries in byte order. */
export interface PackedGeometryRows {
  readonly bytes: number;
  readonly geometries: readonly PackedGeometryRow[];
}

/** A pack's rows as JSON holds them (each attribute pair an array, the index kind a string). */
export interface PackedGeometryJson {
  readonly bytes: number;
  readonly geometries: readonly { readonly attrs: readonly (readonly (string | number)[])[]; readonly count: number; readonly unique: number; readonly own: string | null; readonly indexCount: number; readonly groups?: readonly PackedGroup[] }[];
}

/** JSON rows checked into a pack's rows: every attribute pair is [name, item size], every index 'u16', 'u32' or null. */
export function packedRows(json: PackedGeometryJson): PackedGeometryRows {
  return { bytes: json.bytes, geometries: json.geometries.map((g) => {
    const attrs = g.attrs.map(([name, size]) => {
      if (typeof name !== 'string' || typeof size !== 'number') throw new Error('geometry pack: an attribute row is [name, size]');
      return [name, size] as const;
    });
    if (g.own !== null && g.own !== 'u16' && g.own !== 'u32') throw new Error(`geometry pack: index kind ${g.own}`);
    return { attrs, count: g.count, unique: g.unique, own: g.own, indexCount: g.indexCount, ...(g.groups === undefined ? {} : { groups: g.groups }) };
  }) };
}

/** The decoded binary: each geometry's blocks, read fresh for every geometry built from it (nothing is shared). */
export class GeometryPack {
  private readonly at: number[] = [];
  private readonly buffer: ArrayBuffer;
  private readonly rows: PackedGeometryRows;
  private readonly label: string;

  /** `bytes` the inflated binary, `rows` its description, `label` the error messages' name. */
  constructor(bytes: Uint8Array, rows: PackedGeometryRows, label: string) {
    this.rows = rows; this.label = label;
    if (bytes.length !== rows.bytes) throw new Error(`[${label}] the bake holds ${String(bytes.length)} bytes, its rows ${String(rows.bytes)}`);
    this.buffer = new ArrayBuffer(bytes.length); new Uint8Array(this.buffer).set(bytes);
    let offset = 0;
    const pad = (n: number): number => Math.ceil(n / 4) * 4;
    for (const g of rows.geometries) {
      this.at.push(offset);
      for (const [, size] of g.attrs) offset += pad(g.unique * size * 4);
      offset += pad(g.indexCount * (g.own === 'u32' || (g.own === null && g.unique >= 65536) ? 4 : 2));
    }
    if (offset !== bytes.length) throw new Error(`[${label}] the bake does not match its rows`);
  }

  /** geometry `i` as the builder made it: a copy its caller owns */
  geometry(i: number): BufferGeometry {
    const row = this.rows.geometries[i], start = this.at[i];
    if (row === undefined || start === undefined) throw new Error(`[${this.label}] no baked geometry ${String(i)}`);
    let offset = start;
    const blocks = row.attrs.map(([, size]) => { const a = new Float32Array(this.buffer, offset, row.unique * size); offset += Math.ceil(a.byteLength / 4) * 4; return a; });
    const wide = row.own === 'u32' || (row.own === null && row.unique >= 65536);
    const index = wide ? new Uint32Array(this.buffer, offset, row.indexCount) : new Uint16Array(this.buffer, offset, row.indexCount);
    const g = new BufferGeometry();
    row.attrs.forEach(([name, size], k) => {
      const block = blocks[k];
      if (block === undefined) return;
      if (row.own !== null) { g.setAttribute(name, new BufferAttribute(block.slice(), size)); return; }
      const out = new Float32Array(row.count * size);
      for (let j = 0; j < row.count; j++) { const src = (index[j] ?? 0) * size; for (let c = 0; c < size; c++) out[j * size + c] = block[src + c] ?? 0; }
      g.setAttribute(name, new BufferAttribute(out, size));
    });
    if (row.own !== null) g.setIndex(new BufferAttribute(index.slice(), 1));
    for (const group of row.groups ?? []) g.addGroup(group.start, group.count, group.materialIndex);
    return g;
  }

  /** float block `i` (`GeometryPackWriter.addFloats`): a copy of its floats, exactly as written (a `-0` stays `-0`) */
  floats(i: number): Float32Array {
    const a = this.geometry(i).getAttribute('values');
    if (!(a instanceof BufferAttribute) || !(a.array instanceof Float32Array)) throw new Error(`[${this.label}] ${String(i)} is not a float block`);
    return a.array;
  }
}

/**
 * The writer of a pack (build-time): geometries added in order, each attribute's floats then an index, every block padded
 * to 4 bytes. A geometry built without an index stores its distinct vertices once (bit-equal floats in every attribute)
 * and the index that expands them back, in order; one built with an index keeps its own (16 or 32 bit, as built).
 * `GeometryPack` reads the bytes back to the builder's exact arrays.
 */
export class GeometryPackWriter {
  private readonly packed: PackedGeometryRow[] = [];
  private readonly chunks: Uint8Array[] = [];
  private size = 0;
  private readonly label: string;

  /** `label` the error messages' name. */
  constructor(label: string) { this.label = label; }

  /** Append geometry `g` (plain float32 attributes only); returns its index in the pack. */
  add(g: BufferGeometry): number {
    const names = Object.keys(g.attributes), attrs = names.map((name): [string, number] => [name, g.getAttribute(name).itemSize]);
    const count = g.getAttribute(names[0] ?? 'position').count, own = g.getIndex();
    const groups = g.groups.length === 0 ? {} : { groups: g.groups.map((group) => ({ start: group.start, count: group.count, materialIndex: group.materialIndex ?? 0 })) };
    const floats = (name: string): Float32Array => {
      const a = g.getAttribute(name);
      if (a instanceof InterleavedBufferAttribute || !(a.array instanceof Float32Array) || a.normalized) throw new Error(`[${this.label}] ${name}: plain float32 only`);
      return a.array.subarray(0, a.count * a.itemSize);
    };
    if (own !== null) {
      for (const name of names) this.push(new Uint8Array(floats(name).slice().buffer));
      const u32 = own.array instanceof Uint32Array;
      this.push(new Uint8Array((u32 ? Uint32Array.from(own.array) : Uint16Array.from(own.array)).buffer));
      this.packed.push({ attrs, count, unique: count, own: u32 ? 'u32' : 'u16', indexCount: own.count, ...groups });
      return this.packed.length - 1;
    }
    const arrays = names.map(floats), keys = new Map<string, number>(), index = new Uint32Array(count), firsts: number[] = [];
    const bits = new Uint32Array(1), view = new Float32Array(bits.buffer);
    for (let i = 0; i < count; i++) {
      let key = '';
      arrays.forEach((a, k) => { const w = attrs[k]?.[1] ?? 0; for (let c = 0; c < w; c++) { view[0] = a[i * w + c] ?? 0; key += `${String(bits[0])},`; } });
      let at = keys.get(key);
      if (at === undefined) { at = firsts.length; keys.set(key, at); firsts.push(i); }
      index[i] = at;
    }
    arrays.forEach((a, k) => {
      const w = attrs[k]?.[1] ?? 0, out = new Float32Array(firsts.length * w);
      firsts.forEach((i, j) => { for (let c = 0; c < w; c++) out[j * w + c] = a[i * w + c] ?? 0; });
      this.push(new Uint8Array(out.buffer));
    });
    this.push(new Uint8Array((firsts.length < 65536 ? Uint16Array.from(index) : index).buffer));
    this.packed.push({ attrs, count, unique: firsts.length, own: null, indexCount: count, ...groups });
    return this.packed.length - 1;
  }

  /**
   * Append a block of floats (instance matrices, say: anything a page reads back bit for bit, which JSON cannot carry: it
   * drops a `-0`'s sign), `size` floats to an item; returns its index (`GeometryPack.floats`).
   */
  addFloats(values: Float32Array, size: number): number {
    const g = new BufferGeometry(); g.setAttribute('values', new BufferAttribute(values, size));
    return this.add(g);
  }

  /** The pack's rows so far (its byte size and every geometry's row). */
  rows(): PackedGeometryRows { return { bytes: this.size, geometries: this.packed.map((row) => ({ ...row, attrs: row.attrs.map(([name, w]) => [name, w] as const) })) }; }

  /** The pack's bytes so far (uncompressed). */
  bytes(): Uint8Array {
    const out = new Uint8Array(this.size);
    let at = 0;
    for (const c of this.chunks) { out.set(c, at); at += c.length; }
    return out;
  }

  private push(bytes: Uint8Array): void {
    const padded = new Uint8Array(Math.ceil(bytes.length / 4) * 4); padded.set(bytes);
    this.chunks.push(padded); this.size += padded.length;
  }
}

/** Fetch a zlib-deflated bake and inflate it (a failed fetch throws). */
export async function fetchDeflated(url: string): Promise<Uint8Array> {
  const response = await fetch(url);
  if (!response.ok || response.body === null) throw new Error(`${String(response.status)} ${url}`);
  return new Uint8Array(await new Response(response.body.pipeThrough(new DecompressionStream('deflate'))).arrayBuffer());
}

// Built geometry as an offline bake stores it (SHARD-PLATFORM M3, the kit system): each attribute's typed array exactly
// as the builder made it (float, half, normalized bytes), so a baked kit draws the same bytes the page's own build would
// have; and `appendGeometry`, which puts what the page adds to a baked builder after its bake.


/** an attribute's element type in the bake ('f16' is a half float held in a Uint16Array, Float16BufferAttribute) */
export type BakedType = 'f32' | 'f16' | 'u16' | 'i8' | 'u8';
/** one baked geometry: its attributes [name, type, item size, normalized], vertex count, index (stored as deltas) */
export interface BakedGeometryRow {
  readonly attrs: readonly (readonly [string, BakedType, number, boolean])[];
  readonly count: number;
  readonly index: 'u16' | 'u32' | null;
  readonly indexCount: number;
  /** whether the builder computed its bounding box (every one computes its sphere) */
  readonly box: boolean;
}

/** bytes per element of each baked type */
export const BAKED_BYTES: Readonly<Record<BakedType, number>> = { f32: 4, f16: 2, u16: 2, i8: 1, u8: 1 };

/** a block's length padded to 4 bytes */
export const pad4 = (n: number): number => Math.ceil(n / 4) * 4;

/** the bytes a row's blocks take in the bake (each attribute, then the index as int32 deltas, 4-byte aligned) */
export function bakedGeometryBytes(row: BakedGeometryRow): number {
  let n = 0;
  for (const [, type, size] of row.attrs) n += pad4(row.count * size * BAKED_BYTES[type]);
  return n + (row.index === null ? 0 : row.indexCount * 4);
}

/** read geometry `row` from `bytes` at `offset` (the arrays are copies the geometry owns) */
export function readBakedGeometry(bytes: Uint8Array, offset: number, row: BakedGeometryRow): BufferGeometry {
  const g = new BufferGeometry();
  let at = offset;
  const copy = (length: number): ArrayBuffer => { const b = bytes.slice(at, at + length).buffer; at += pad4(length); return b; };
  for (const [name, type, size, normalized] of row.attrs) {
    const buffer = copy(row.count * size * BAKED_BYTES[type]);
    if (type === 'f32') g.setAttribute(name, new BufferAttribute(new Float32Array(buffer), size, normalized));
    else if (type === 'f16') g.setAttribute(name, new Float16BufferAttribute(new Uint16Array(buffer), size, normalized));
    else if (type === 'u16') g.setAttribute(name, new BufferAttribute(new Uint16Array(buffer), size, normalized));
    else if (type === 'i8') g.setAttribute(name, new BufferAttribute(new Int8Array(buffer), size, normalized));
    else g.setAttribute(name, new BufferAttribute(new Uint8Array(buffer), size, normalized));
  }
  if (row.index !== null) {
    const deltas = new Int32Array(copy(row.indexCount * 4));
    const index = row.index === 'u16' ? new Uint16Array(row.indexCount) : new Uint32Array(row.indexCount);
    let last = 0;
    for (let i = 0; i < deltas.length; i++) { last += deltas[i] ?? 0; index[i] = last; }
    g.setIndex(new BufferAttribute(index, 1));
  }
  g.computeBoundingSphere();
  if (row.box) g.computeBoundingBox();
  return g;
}

/** a typed array of `a`'s kind holding `a` then `b` */
function joined(a: BufferAttribute['array'], b: BufferAttribute['array']): BufferAttribute['array'] {
  if (a instanceof Float32Array && b instanceof Float32Array) { const o = new Float32Array(a.length + b.length); o.set(a); o.set(b, a.length); return o; }
  if (a instanceof Uint16Array && b instanceof Uint16Array) { const o = new Uint16Array(a.length + b.length); o.set(a); o.set(b, a.length); return o; }
  if (a instanceof Uint32Array && b instanceof Uint32Array) { const o = new Uint32Array(a.length + b.length); o.set(a); o.set(b, a.length); return o; }
  if (a instanceof Int8Array && b instanceof Int8Array) { const o = new Int8Array(a.length + b.length); o.set(a); o.set(b, a.length); return o; }
  if (a instanceof Uint8Array && b instanceof Uint8Array) { const o = new Uint8Array(a.length + b.length); o.set(a); o.set(b, a.length); return o; }
  throw new Error('kit: a baked geometry and its additions differ in an attribute type');
}

/**
 * `a` (a baked builder's geometry) with `b` (what the page added to that builder since, built by it) after it: the same
 * attributes in the same types, `b`'s indices already counting `a`'s vertices (the builder numbers on from the bake).
 * The index widens to 32 bits once the whole passes 65 535 vertices, as the builder's own choice would.
 */
export function appendGeometry(a: BufferGeometry, b: BufferGeometry): BufferGeometry {
  const g = new BufferGeometry();
  for (const [name, attr] of Object.entries(a.attributes)) {
    const tail = b.getAttribute(name);
    if (!(attr instanceof BufferAttribute) || !(tail instanceof BufferAttribute) || tail.itemSize !== attr.itemSize) throw new Error(`kit: '${name}' does not append to its bake`);
    const array = joined(attr.array, tail.array);
    g.setAttribute(name, attr instanceof Float16BufferAttribute ? new Float16BufferAttribute(array, attr.itemSize, attr.normalized) : new BufferAttribute(array, attr.itemSize, attr.normalized));
  }
  const ia = a.index, ib = b.index;
  if (ia !== null && ib !== null) {
    const count = a.getAttribute('position').count + b.getAttribute('position').count;
    const index = ia.array instanceof Uint16Array && count < 65536 ? new Uint16Array(ia.count + ib.count) : new Uint32Array(ia.count + ib.count);
    for (let i = 0; i < ia.count; i++) index[i] = ia.getX(i);
    for (let i = 0; i < ib.count; i++) index[ia.count + i] = ib.getX(i);
    g.setIndex(new BufferAttribute(index, 1));
  }
  g.computeBoundingSphere();
  return g;
}

/**
 * Primitives as rows (SHARD-PLATFORM M3): a three.js primitive, the transforms applied to it in order (translate,
 * rotate about an axis, scale: the geometry's own methods, so every vertex is the one hand-written code computed), and
 * whether it is made non-indexed; a list of them merged in order into one geometry that keeps every part's attributes
 * (position, normal, uv). A lantern's iron frame, a ribcage's hoops or a skull plate is data; `standardMaterial` makes a
 * MeshStandardMaterial from a row (hex or working-space colours). Unlike `primitiveParts` (one colour per part, normals
 * recomputed) the parts keep their own normals and uvs.
 *
 *   const frame = mergePrimitives(rows);           // every row non-indexed, merged
 *   const glass = buildPrimitive(row);             // one part as it stands
 */

/** A primitive's kind; `args` are its three.js constructor's, in order (a cylinder's sixth, open-ended, is 1 for true); an
 *  `extrude` is its row's `shape` extruded by its `extrude` options. */
export type PrimitiveKind = 'box' | 'cylinder' | 'cone' | 'sphere' | 'torus' | 'icosahedron' | 'capsule' | 'extrude';

/** One transform, applied by the geometry's own method (`rotateX` … angles in radians). */
export type PrimitiveOp = readonly ['translate' | 'scale', number, number, number] | readonly ['rotateX' | 'rotateY' | 'rotateZ', number];

/** One step of a 2D outline (three's Shape path methods, in order). */
export type ShapeStep = readonly ['moveTo' | 'lineTo', number, number] | readonly ['quadraticCurveTo', number, number, number, number];
/** An outline's extrusion (three's ExtrudeGeometry options). */
export interface ExtrudeRow {
  readonly depth: number; readonly bevelEnabled: boolean; readonly bevelThickness: number; readonly bevelSize: number;
  readonly bevelSegments: number; readonly curveSegments: number;
}
/** One primitive as data. */
export interface PrimitiveRow {
  readonly kind: PrimitiveKind;
  readonly args: readonly number[];
  /** an `extrude`'s outline and options */
  readonly shape?: readonly ShapeStep[];
  readonly extrude?: ExtrudeRow;
  /** applied in order */
  readonly ops?: readonly PrimitiveOp[];
}
/** A primitive painted one colour (a CSS colour string) into a `color` vertex attribute. */
export interface PaintedPrimitiveRow extends PrimitiveRow {
  readonly paint: string;
}

/** A MeshStandardMaterial as data: colours a hex number or working-space (r, g, b). */
export interface StandardMaterialRow {
  readonly color: number | readonly [number, number, number];
  readonly emissive?: number | readonly [number, number, number];
  readonly emissiveIntensity?: number;
  readonly roughness: number;
  readonly metalness: number;
  readonly fog?: boolean;
}

const arg = (a: readonly number[], i: number): number | undefined => a[i];

function primitive(p: PrimitiveRow): BufferGeometry {
  const a = p.args;
  switch (p.kind) {
    case 'box': return new BoxGeometry(arg(a, 0), arg(a, 1), arg(a, 2));
    case 'cylinder': return new CylinderGeometry(arg(a, 0), arg(a, 1), arg(a, 2), arg(a, 3), arg(a, 4), arg(a, 5) === 1);
    case 'cone': return new ConeGeometry(arg(a, 0), arg(a, 1), arg(a, 2));
    case 'sphere': return new SphereGeometry(arg(a, 0), arg(a, 1), arg(a, 2));
    case 'torus': return new TorusGeometry(arg(a, 0), arg(a, 1), arg(a, 2), arg(a, 3), arg(a, 4));
    case 'icosahedron': return new IcosahedronGeometry(arg(a, 0), arg(a, 1));
    case 'capsule': return new CapsuleGeometry(arg(a, 0), arg(a, 1), arg(a, 2), arg(a, 3));
    case 'extrude': return extruded(p);
    default: {
      const unknown: never = p.kind;
      throw new Error(`unknown primitive ${String(unknown)}`);
    }
  }
}

/** an `extrude` row's outline, extruded */
function extruded(p: PrimitiveRow): BufferGeometry {
  if (p.shape === undefined || p.extrude === undefined) throw new Error('an extrude primitive needs a shape and its options');
  const s = new Shape();
  for (const step of p.shape) {
    if (step[0] === 'quadraticCurveTo') s.quadraticCurveTo(step[1], step[2], step[3], step[4]);
    else if (step[0] === 'moveTo') s.moveTo(step[1], step[2]);
    else s.lineTo(step[1], step[2]);
  }
  const e = p.extrude;
  return new ExtrudeGeometry(s, { depth: e.depth, bevelEnabled: e.bevelEnabled, bevelThickness: e.bevelThickness, bevelSize: e.bevelSize, bevelSegments: e.bevelSegments, curveSegments: e.curveSegments });
}
/** One primitive with its transforms applied in order (indexed as three.js builds it). */
export function buildPrimitive(row: PrimitiveRow): BufferGeometry {
  const g = primitive(row);
  for (const op of row.ops ?? []) {
    if (op[0] === 'translate') g.translate(op[1], op[2], op[3]);
    else if (op[0] === 'scale') g.scale(op[1], op[2], op[3]);
    else if (op[0] === 'rotateX') g.rotateX(op[1]);
    else if (op[0] === 'rotateY') g.rotateY(op[1]);
    else g.rotateZ(op[1]);
  }
  return g;
}

const merged = (parts: BufferGeometry[]): BufferGeometry => mergeGeometries(parts, false);
/** The rows built (`buildPrimitive`), each made non-indexed, merged in order into one geometry (no groups). */
export function mergePrimitives(rows: readonly PrimitiveRow[]): BufferGeometry {
  return merged(rows.map((r) => buildPrimitive(r).toNonIndexed()));
}
/**
 * The rows built (`buildPrimitive`), each non-indexed (an indexed one copied so), painted its colour into a `color`
 * attribute and stripped to position, normal, uv and color, merged in order into one geometry (no groups): a
 * vertex-coloured stand-in in one draw.
 */
export function paintedPrimitives(rows: readonly PaintedPrimitiveRow[]): BufferGeometry {
  return merged(rows.map((r) => {
    const g = buildPrimitive(r), out = g.index ? g.toNonIndexed() : g;
    const c = new Color(r.paint), n = out.getAttribute('position').count, col = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b; }
    out.setAttribute('color', new BufferAttribute(col, 3));
    for (const k of Object.keys(out.attributes)) if (k !== 'position' && k !== 'normal' && k !== 'uv' && k !== 'color') out.deleteAttribute(k);
    return out;
  }));
}

const colour = (c: number | readonly [number, number, number]): Color => (typeof c === 'number' ? new Color(c) : new Color(c[0], c[1], c[2]));

/** A MeshStandardMaterial from its row (fog left at three's default unless the row says). */
export function standardMaterial(row: StandardMaterialRow): MeshStandardMaterial {
  const p: MeshStandardMaterialParameters = { color: colour(row.color), roughness: row.roughness, metalness: row.metalness };
  if (row.emissive !== undefined) p.emissive = colour(row.emissive);
  if (row.emissiveIntensity !== undefined) p.emissiveIntensity = row.emissiveIntensity;
  if (row.fog !== undefined) p.fog = row.fog;
  return new MeshStandardMaterial(p);
}

/** Split a geometry by triangle centroid into `parts` (de-indexed, every attribute kept; flat normals recomputed when `flat`); disposes the input. */
function partition(source: BufferGeometry, parts: number, of: (x: number, y: number, z: number) => number, flat: boolean): BufferGeometry[] {
  const g = source.index === null ? source : source.toNonIndexed(), p = g.getAttribute('position'), side: number[] = [];
  for (let t = 0; t + 2 < p.count; t += 3) side.push(of((p.getX(t) + p.getX(t + 1) + p.getX(t + 2)) / 3, (p.getY(t) + p.getY(t + 1) + p.getY(t + 2)) / 3, (p.getZ(t) + p.getZ(t + 1) + p.getZ(t + 2)) / 3));
  const out = Array.from({ length: parts }, (_, part) => {
    const r = new BufferGeometry();
    for (const [name, a] of Object.entries(g.attributes)) {
      const values: number[] = [];
      side.forEach((s, t) => { if (s === part) for (let v = t * 3; v < t * 3 + 3; v++) for (let c = 0; c < a.itemSize; c++) values.push(a.getComponent(v, c)); });
      r.setAttribute(name, new Float32BufferAttribute(values, a.itemSize));
    }
    if (flat) r.computeVertexNormals();
    r.computeBoundingBox(); r.computeBoundingSphere(); return r;
  });
  if (g !== source) g.dispose();
  source.dispose(); return out;
}

/** A pivot NPC's figure on its pivots: the body under `root`, the head at the neck, the arm at the shoulder and its forearm at the elbow. */
export interface PivotNpcParts { readonly root: Group; readonly head: Group; readonly arm: Group; readonly elbow: Group }
/**
 * A pivot NPC's figure (SF27): the row's model (`source`) fitted to its height and cut onto pivots by its figure row
 * (`NpcRowSchema`): the body, the head at the neck, the arm at the shoulder and its forearm at the elbow, in `material`
 * (else one vertex-coloured standard material). Feet on y 0, facing +Z, at its own origin (the Model Explorer shows it so).
 */
export function pivotNpcParts(row: NpcRow, source: BufferGeometry, material?: Material): PivotNpcParts {
  const fig = row.figure, neck = fig.neck, [sx, sy, sz] = fig.shoulder, top = fig.armTopY ?? (neck === undefined ? Infinity : neck[1] + 0.02);
  const slope = fig.armSlope ?? 0, cut = fig.elbow, [ex, ey, ez] = cut?.at ?? fig.shoulder;
  const whole = fitGeometry(source, { size: fig.height, by: 'height', ...(fig.centre === undefined ? {} : { centre: fig.centre }) });
  const [body, head, arm, fore] = partition(whole, 4, (x, y) => neck !== undefined && y >= neck[1] ? 1
    : x < fig.armBelowX + slope * y && y > fig.armAboveY && y < top ? (cut !== undefined && (x - ex) * cut.axis[0] + (y - ey) * cut.axis[1] > 0 ? 3 : 2) : 0, fig.flat);
  const paint = material ?? new MeshStandardMaterial({ vertexColors: true, roughness: fig.roughness, metalness: 0, flatShading: fig.flat });
  const root = new Group(), headPivot = new Group(), armPivot = new Group(), elbow = new Group();
  if (neck !== undefined) { headPivot.position.set(neck[0], neck[1], neck[2]); head?.translate(-neck[0], -neck[1], -neck[2]); }
  armPivot.position.set(sx, sy, sz); elbow.position.set(ex - sx, ey - sy, ez - sz);
  for (const [g, pivot] of [[body, root], [head, headPivot], [arm?.translate(-sx, -sy, -sz), armPivot], [fore?.translate(-ex, -ey, -ez), elbow]] as const) {
    if (g === undefined) continue;
    if (g.getAttribute('position').count > 0) pivot.add(new Mesh(g, paint)); else g.dispose();
  }
  armPivot.add(elbow); root.add(headPivot, armPivot);
  return { root, head: headPivot, arm: armPivot, elbow };
}

/** The SF27 quest-giver's motion: it faces you, waves overhead until met, gestures at the chest as it talks and breathes. */
export const PIVOT_NPC_MOTION: NpcMotion = { turns: true, waveUntilMet: true, ease: 8, breathe: { yaw: [0, 0], scale: [0.008, 1.3] },
  rest: { lift: [0, 0, 0], forward: [0, 0, 0], bend: [0, 0, 0] },
  wave: { lift: [-2.5, 0.3, 7], forward: [0, 0, 0], bend: [0, 0, 0] },
  talk: { lift: [-0.9, 0.2, 2.3], forward: [-0.5, -0.3, 1.7, 'half'], bend: [0, 0, 0] } };
/** A pivot NPC in the world: its group, its head (the talk prompt's anchor), its speaker and its per-frame motion. */
export interface PivotNpc { readonly group: Group; readonly head: Vector3; readonly speaker: { talking: boolean }; update: (dt: number, t: number, player: Vector3, met: boolean) => void }

const wrapAngle = (a: number): number => Math.atan2(Math.sin(a), Math.cos(a));
const swingAt = (s: NpcMotion['rest']['lift'], t: number): number => s[0] + s[1] * (s.length === 4 ? Math.max(0, Math.sin(t * s[2])) : Math.sin(t * s[2]));
/**
 * The row's NPC standing on the ground, moving by its motion row (`NpcMotionSchema`, else `PIVOT_NPC_MOTION`): it turns
 * to face the player within `faceRange` or while it talks (else back to `faceHome`), its head follows within ±0.7 rad,
 * its arm takes the talk pose while it talks, the wave pose within `waveRange` (until met, when the row says so), else
 * the rest pose, and it breathes. No source (its model did not load): no figure, the talk anchor and speaker still stand.
 */
export function pivotNpc(row: NpcRow, source: BufferGeometry | null, groundAt: (x: number, z: number) => number, material?: Material): PivotNpc {
  const { x: ax, z: az } = row.at, y = groundAt(ax, az), m = row.motion ?? PIVOT_NPC_MOTION, group = new Group(), speaker = { talking: false };
  const head = new Vector3(ax, y + row.talkHeight, az), home = Math.atan2(row.faceHome.x - ax, row.faceHome.z - az);
  group.position.set(ax, y, az); group.rotation.y = home;
  if (source === null) return { group, head, speaker, update: () => undefined };
  const parts = pivotNpcParts(row, source, material); group.add(parts.root);
  let facing = home;
  return { group, head, speaker, update: (dt, t, player, met) => {
    const dx = player.x - ax, dz = player.z - az, d = Math.hypot(dx, dz), toYou = Math.atan2(dx, dz), k = 1 - Math.exp(-3 * dt);
    if (m.turns) facing += wrapAngle((d < row.faceRange || speaker.talking ? toYou : home) - facing) * k;
    group.rotation.y = facing + m.breathe.yaw[0] * Math.sin(t * m.breathe.yaw[1]);
    parts.head.rotation.y += (Math.max(-0.7, Math.min(0.7, wrapAngle(toYou - group.rotation.y))) * (d < row.faceRange ? 1 : 0) - parts.head.rotation.y) * k;
    parts.head.rotation.x = speaker.talking ? Math.sin(t * 5.2) * 0.05 : Math.sin(t * 0.7) * 0.02;
    const pose = speaker.talking ? m.talk : d < row.waveRange && !(m.waveUntilMet && met) ? m.wave : m.rest, e = Math.min(1, dt * m.ease);
    parts.arm.rotation.z += (swingAt(pose.lift, t) - parts.arm.rotation.z) * e; parts.arm.rotation.x += (swingAt(pose.forward, t) - parts.arm.rotation.x) * e;
    parts.elbow.rotation.z += (swingAt(pose.bend, t) - parts.elbow.rotation.z) * e;
    parts.root.scale.y = 1 + m.breathe.scale[0] * Math.sin(t * m.breathe.scale[1]);
  } };
}

/** What `installPivotNpc` is lent: the model (null: not loaded), its material, the ground, the player, its met flag's reader, the piece's source file and the shard's dressing of the figure. */
export interface PivotNpcPorts {
  readonly source: BufferGeometry | null;
  /** the figure's material (a textured model's own); else one vertex-coloured standard material */
  readonly material?: Material;
  readonly groundAt: (x: number, z: number) => number;
  readonly player: Vector3;
  readonly met: () => boolean;
  /** the authored file the piece names (the Model Explorer and the physics bake list it) */
  readonly file: string;
  /** the shard's look on the figure (its light rim, resource ownership) */
  readonly dress?: (group: Group) => void;
}
type NpcSurface = NonNullable<NpcRow['collider']>['surface'];
/** The level a pivot NPC is installed in (a LevelContext fits): its root, its piece registry and its systems. */
export interface PivotNpcLevel {
  readonly root: Group;
  piece: (piece: { id: string; name: string; category: 'props'; file: string; object: Group; surface: NpcSurface;
    colliders: { kind: 'box'; x: number; y: number; z: number; hx: number; hy: number; hz: number; yaw: number; surface: NpcSurface }[] }) => void;
  system: (spec: { id: string; phase: 'update'; run: (dt: number, t: number) => void }) => void;
}
/**
 * Installs the row's NPC in a level: the figure under the level root, a solid column piece round it when the row has a
 * collider (it turns in place, so the box stays square), and its motion each frame.
 */
export function installPivotNpc(ctx: PivotNpcLevel, row: NpcRow, ports: PivotNpcPorts): PivotNpc {
  const npc = pivotNpc(row, ports.source, ports.groundAt, ports.material), c = row.collider, y = npc.group.position.y;
  ctx.root.add(npc.group); ports.dress?.(npc.group);
  if (c !== undefined) ctx.piece({ id: row.id, name: row.name, category: 'props', file: ports.file, object: npc.group,
    colliders: [{ kind: 'box', x: row.at.x, y: y + (c.above - c.below) / 2, z: row.at.z, hx: c.half, hy: Math.max(0.005, (c.above + c.below) / 2), hz: c.half, yaw: -0, surface: c.surface }], surface: c.surface });
  if (ports.source !== null) ctx.system({ id: row.id, phase: 'update', run: (dt, t) => { npc.update(dt, t, ports.player, ports.met()); } });
  return npc;
}
