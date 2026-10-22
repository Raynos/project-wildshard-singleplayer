import { Box3, BufferAttribute, BufferGeometry, Group, InstancedMesh, type Material, Mesh, MeshBasicMaterial, MeshStandardMaterial, Object3D, PointLight, Sphere, Texture, Vector3 } from 'three';
import { WeldBatch, WeldView, shadowProxyMaterial } from '@wildshard/engine/models/weld';
import { WeldCull } from '@wildshard/engine/models/cull';
import { installWeldCulling } from '@wildshard/engine/models/place';
import { placeSet } from '@wildshard/engine/models/sets';
import { withOwner } from '@wildshard/engine/app/ownership';
import { ownSceneResource } from '@wildshard/engine/app/sceneOwnership';
import type { Scope } from '@wildshard/engine/app/scope';
import type { WorldRegistry } from '@wildshard/engine/world/registry';
import { buildTier, TIER_CONFIG } from '@wildshard/engine/core/tier';
import { parseWorldSceneWeld, type WorldSceneWeld, type WorldSceneWeldNode, type WorldSceneDistanceSchema, type WorldSceneWeldMaterialSchema, type WorldSceneWeldSourceSchema } from '@wildshard/format/worldSceneWeld';
import type { SkyRig } from '@wildshard/engine/world/skyRig';
import type { InferOutput } from 'valibot';
import type { PlumbingData } from '@wildshard/format/plumbing';
import { worldSceneModelGraphs, type WorldSceneModels } from '@wildshard/format/worldSceneModels';
import type { ShardProduct } from './shardProduct';
import { plumbingKnob } from '../shard/declaredPlumbing';
import { createBuildingCloud } from './buildingCloud';
import type { SceneHandles } from './sceneHandles';

type Distance = InferOutput<typeof WorldSceneDistanceSchema>;
type WeldMaterial = Omit<InferOutput<typeof WorldSceneWeldMaterialSchema>, 'id'>;

/** A weld material row (or a world-scenes `mapped` row, the same grammar): a fresh material from native defaults, its
 *  properties, and only the declared maps of its source (borrowed, never owned or disposed with it). */
export function weldSceneMaterial(entry: WeldMaterial, source: (id: string) => Material, sky: () => Pick<SkyRig, 'setupMaterial'>): MeshStandardMaterial | MeshBasicMaterial {
  const made = entry.kind === 'standard' ? new MeshStandardMaterial() : new MeshBasicMaterial();
  const { color, emissive, normalScale, ...properties } = entry.properties;
  Object.assign(made, properties);
  if (color !== undefined) { if (typeof color === 'number') made.color.set(color); else made.color.setRGB(...color); }
  if (emissive !== undefined) { if (!(made instanceof MeshStandardMaterial)) throw new Error('Basic material cannot emit'); if (typeof emissive === 'number') made.emissive.set(emissive); else made.emissive.setRGB(...emissive); }
  if (normalScale !== undefined) { if (!(made instanceof MeshStandardMaterial)) throw new Error('Basic material has no normal scale'); made.normalScale.set(...normalScale); }
  if (entry.source !== undefined) for (const name of entry.source.maps) {
    const texture: unknown = Reflect.get(source(entry.source.material), name);
    if (texture !== null && !(texture instanceof Texture)) throw new Error('Frozen material map differs');
    Object.assign(made, { [name]: texture });
  }
  if (entry.blending !== undefined) made.blending = entry.blending;
  if (entry.fog !== undefined) made.fog = entry.fog;
  if (entry.sky) sky().setupMaterial(made);
  return made;
}
export interface FrozenSceneSources {
  readonly geometry: ReadonlyMap<string, BufferGeometry>;
  readonly materials: ReadonlyMap<string, Material>;
  readonly plumbing?: PlumbingData | null | undefined;
  readonly quality?: { readonly tier: 'phone' | 'desktop'; readonly overrides: Readonly<Partial<Record<`${string}.${string}`, number | boolean>>> };
}
/** Preserve the author's native Float32/Float64 storage, including signed zero. */
const floats = (words: readonly number[]): Float32Array => new Float32Array(Uint32Array.from(words).buffer);
const doubles = (words: readonly number[]): Float64Array => new Float64Array(Uint32Array.from(words).buffer);
const keyOf = (ref: { readonly library: string; readonly model: string }): string => JSON.stringify([ref.library, ref.model]);
const mesh3 = (value: unknown): value is Mesh => value instanceof Mesh;
const distance = (row: Distance, sources: FrozenSceneSources): number => typeof row === 'number' ? row
  : plumbingKnob(sources.plumbing, sources.quality?.tier ?? buildTier(), row.knob, 'number', sources.quality?.overrides ?? TIER_CONFIG) * row.multiply + row.add;
/** All bounded file choices are admitted; only the resolved graph allocates resources. */
export function worldSceneWeldFiles(row: InferOutput<typeof WorldSceneWeldSourceSchema>): string[] {
  const branches = typeof row.file === 'object' && 'knob' in row.file ? [row.file.false, row.file.true] : [row.file];
  return [...new Set(branches.flatMap(file => typeof file === 'string' ? [file] : [file.phone, file.desktop]))];
}
/** Choose geometry independently of the nominal tier when Debug overrides its topology knob. */
export function worldSceneWeldFile(row: InferOutput<typeof WorldSceneWeldSourceSchema>, plumbing?: PlumbingData | null): string {
  const source = typeof row.file === 'object' && 'knob' in row.file
    ? row.file[plumbingKnob(plumbing, buildTier(), row.file.knob, 'boolean', TIER_CONFIG) ? 'true' : 'false'] : row.file;
  return typeof source === 'string' ? source : source[buildTier()];
}
/** Admit bounded specimen blobs separately from the small catalogue, before geometry intake. */
export async function admitWorldSceneModelGraphs(product: Pick<ShardProduct, 'hasFile' | 'file'>, catalogue: WorldSceneModels): Promise<ReadonlyMap<string, WorldSceneWeld>> {
  const result = new Map<string, WorldSceneWeld>(), decoder = new TextDecoder('utf-8', { fatal: true });
  for (const leaf of catalogue.models.flatMap(model => model.choices.flatMap(worldSceneModelGraphs))) {
    if ('file' in leaf && result.has(leaf.file)) continue;
    if ('file' in leaf && !product.hasFile(leaf.file)) throw new Error('Missing frozen specimen blob');
    const row = 'file' in leaf ? parseWorldSceneWeld(JSON.parse(decoder.decode(await product.file(leaf.file)))) : leaf;
    if (row.culls.length > 0 || row.placements.length > 0 || row.sets.length > 0 || row.resources.length > 0) throw new Error('Frozen specimens cannot install world services');
    if ('file' in leaf) result.set(leaf.file, row);
  }
  return result;
}
function bounds(geometry: BufferGeometry, row: { readonly sphere: readonly number[]; readonly box?: readonly number[] }): void {
  const sphere = row.sphere;
  geometry.boundingSphere = new Sphere(new Vector3(sphere[0], sphere[1], sphere[2]), sphere[3]);
  if (row.box !== undefined) geometry.boundingBox = new Box3(new Vector3(row.box[0], row.box[1], row.box[2]), new Vector3(row.box[3], row.box[4], row.box[5]));
}
function viewGeometry(batch: WeldBatch, row: Extract<WorldSceneWeldNode, { kind: 'view' }>): BufferGeometry {
  const geometry = new BufferGeometry();
  for (const [name, source] of Object.entries(batch.geometry.attributes)) {
    if (!(source instanceof BufferAttribute)) throw new Error('Frozen weld views require plain attributes');
    geometry.setAttribute(name, new BufferAttribute(source.array.subarray(row.start * source.itemSize, (row.start + row.count) * source.itemSize), source.itemSize, source.normalized));
  }
  bounds(geometry, row); return geometry;
}

/** Client-only frozen draw hydration. No merge, weld, proxy construction or shard callbacks.
 * The caller lends named roots and materials; this scope owns only the restored graph and buffers. */
export function hydrateWorldSceneWeld(input: unknown, handles: SceneHandles, sources: FrozenSceneSources, owner: Scope,
  registry: WorldRegistry | null = null): Object3D {
  const row = parseWorldSceneWeld(input);
  if (owner.disposed) throw new Error('Frozen scene owner is disposed');
  const root = handles.object(row.root), known = new Set<string>([row.root]);
  const declarations = new Map(row.nodes.map(node => [node.id, node]));
  const materialIds = new Set(row.materials.map(material => material.id)), geometryBounds = new Map<string, string>();
  const material = (id: string): Material => {
    const value = handles.has(id) ? handles.material(id) : sources.materials.get(id);
    if (value === undefined) throw new Error('Missing frozen scene material'); return value;
  };
  for (const entry of row.materials) {
    if (handles.has(entry.id) || declarations.has(entry.id)) throw new Error('Duplicate frozen scene material');
    if (entry.source !== undefined) material(entry.source.material);
  }
  // Refuse the complete graph before publishing or allocating its first node.
  for (const node of row.nodes) {
    if (handles.has(node.id) || !known.has(node.parent) && !handles.has(node.parent)) throw new Error('Frozen scene identity or parent differs');
    if (handles.has(node.parent)) handles.object(node.parent);
    if ('geometry' in node) {
      const key = keyOf(node.geometry), value = JSON.stringify([node.sphere, node.box]);
      if (!sources.geometry.has(key)) throw new Error('Missing frozen scene geometry');
      if (geometryBounds.has(key) && geometryBounds.get(key) !== value) throw new Error('Shared frozen geometry bounds differ');
      geometryBounds.set(key, value);
    }
    if (node.kind === 'batch' && sources.geometry.get(keyOf(node.geometry))?.index !== null) throw new Error('Frozen weld batches require non-indexed geometry');
    if ('material' in node && node.material !== '$shadow' && !materialIds.has(node.material)) material(node.material);
    if (node.kind === 'view') {
      const batch = declarations.get(node.batch);
      if (!known.has(node.batch) || batch?.kind !== 'batch') throw new Error('Frozen scene view needs its earlier batch');
      const geometry = sources.geometry.get(keyOf(batch.geometry)), positions = geometry?.getAttribute('position');
      if (geometry === undefined || geometry.index !== null || positions === undefined || node.start + node.count > positions.count) throw new Error('Frozen scene view range differs');
      for (const source of Object.values(geometry.attributes)) if (!(source instanceof BufferAttribute) || source.count < node.start + node.count) throw new Error('Frozen scene view attribute range differs');
    }
    known.add(node.id);
  }
  for (const cull of row.culls) {
    for (const id of [...cull.roots, ...cull.hosted.flatMap(set => set.meshes)]) if (!known.has(id) && !handles.has(id)) throw new Error('Missing frozen scene cull object');
    if (cull.roots.length * 3 !== cull.origins.length) throw new Error('Frozen scene origins differ');
    for (const set of cull.hosted) for (const id of set.meshes) {
      const node = declarations.get(id);
      if (node?.kind !== 'instances' || set.lists.reduce((sum, run) => sum + run.matrixWords.length / 16, 0) > node.capacity) throw new Error('Frozen scene hosted capacity differs');
    }
  }
  const lifetime = owner.child(`frozen/${row.id}`), geometries = new Map<string, BufferGeometry>();
  try {
    for (const entry of row.materials) {
      const made = weldSceneMaterial(entry, material, () => handles.sky);
      handles.publish(entry.id, made); ownSceneResource(made, lifetime);
      lifetime.onDispose(() => { handles.release(entry.id, made); });
    }
    for (const node of row.nodes) {
      let object: Object3D;
      if (node.kind === 'group') object = new Group();
      else if (node.kind === 'anchor') object = new Object3D();
      else if (node.kind === 'view') {
        const batch = handles.object(node.batch);
        if (!(batch instanceof WeldBatch)) throw new Error('Frozen scene view batch differs');
        const geometry = viewGeometry(batch, node); ownSceneResource(geometry, lifetime);
        const view = new WeldView(geometry, batch.material, batch); batch.views.push(view); object = view;
      } else if (node.kind === 'light') object = new PointLight(node.color, node.intensity, node.distance, node.decay);
      else {
        const surface = node.material === '$shadow' ? shadowProxyMaterial : material(node.material);
        if (node.kind === 'cloud') {
          const seeds = new BufferGeometry().setAttribute('seed', new BufferAttribute(floats(node.seedWords), 4));
          const geometry = handles.lend(seeds), materialId = handles.lend(surface);
          object = createBuildingCloud(handles, { geometry, material: materialId, seeds: true, name: node.name, at: [0, 0, 0],
            center: [node.sphere[0], node.sphere[1], node.sphere[2]], radius: node.sphere[3], order: node.renderOrder, visible: node.visible });
          handles.release(geometry, seeds); seeds.dispose();
          if (mesh3(object)) ownSceneResource(object.geometry, lifetime);
        } else {
          const key = keyOf(node.geometry), source = sources.geometry.get(key); if (source === undefined) throw new Error('Missing frozen scene geometry');
          let geometry = geometries.get(key);
          if (geometry === undefined) { geometry = source.clone(); bounds(geometry, node); geometries.set(key, geometry); ownSceneResource(geometry, lifetime); }
          if (node.kind === 'instances') {
            const mesh = new InstancedMesh(geometry, surface, node.capacity);
            mesh.instanceMatrix.array.set(floats(node.matrixWords)); mesh.count = node.count;
            mesh.boundingSphere = new Sphere(new Vector3(...node.instanceSphere.slice(0, 3)), node.instanceSphere[3]);
            if (node.instanceBox !== undefined) mesh.boundingBox = new Box3(new Vector3(...node.instanceBox.slice(0, 3)), new Vector3(...node.instanceBox.slice(3, 6)));
            object = mesh; ownSceneResource(mesh, lifetime);
          } else object = node.kind === 'batch' ? new WeldBatch(geometry, surface) : new Mesh(geometry, surface);
        }
      }
      object.name = node.name; object.matrixAutoUpdate = node.matrixAutoUpdate;
      if (node.transformBits !== undefined) { const values = doubles(node.transformBits); object.position.fromArray(values); object.quaternion.fromArray(values, 3); object.scale.fromArray(values, 7); }
      if (node.matrixBits !== undefined) object.matrix.fromArray(doubles(node.matrixBits));
      object.matrixWorldNeedsUpdate = true; object.layers.mask = node.layers; object.visible = node.visible; object.frustumCulled = node.frustumCulled;
      object.castShadow = node.castShadow; object.receiveShadow = node.receiveShadow; object.renderOrder = node.renderOrder;
      if (node.until !== undefined) object.userData['until'] = distance(node.until, sources);
      if (node.castFrom !== undefined) object.userData['castFrom'] = distance(node.castFrom, sources);
      handles.publish(node.id, object); handles.object(node.parent).add(object);
      lifetime.onDispose(() => { object.removeFromParent(); handles.release(node.id, object); });
    }
    for (const cull of row.culls) {
      const objects: Object3D[] = [], reach: number[] = [], cast: number[] = [], at: number[] = [];
      cull.roots.forEach((id, origin) => { handles.object(id).traverse(object => {
        for (const [field, caster] of [['until', 0], ['castFrom', 1]] as const) {
          const value: unknown = object.userData[field]; if (typeof value !== 'number') continue;
          objects.push(object); reach.push(value * value); cast.push(caster); at.push(origin);
        }
      }); });
      const value = new WeldCull(objects, Float64Array.from(reach), Uint8Array.from(cast), Uint32Array.from(at), Float64Array.from(cull.origins), Uint32Array.from(cull.units), Float64Array.from(cull.details, entry => distance(entry, sources) ** 2));
      for (const set of cull.hosted) value.host({ meshes: set.meshes.map(id => { const mesh = handles.object(id); if (!(mesh instanceof InstancedMesh)) throw new Error('Frozen scene hosted mesh differs'); return mesh; }),
        lists: set.lists.map(run => ({ unit: run.unit, matrices: floats(run.matrixWords) })) });
      installWeldCulling(registry, lifetime, value);
    }
    return row.result === undefined ? root : handles.object(row.result);
  } catch (error) { lifetime.dispose(); throw error; }
}

/** Deferred resident assembly; the single SceneHandles registry retains the final graph. */
export class WorldSceneWeldAssembly {
  private pending: Promise<Object3D> | undefined;
  private readonly sources: FrozenSceneSources;
  private readonly staging: Map<string, BufferGeometry>;
  constructor(private readonly row: WorldSceneWeld, private readonly handles: SceneHandles, sources: FrozenSceneSources,
    private readonly owner: Scope, private readonly registry: WorldRegistry) {
    this.staging = new Map(sources.geometry);
    this.sources = { ...sources, geometry: this.staging };
  }
  assemble(): Promise<Object3D> {
    if (this.owner.disposed) return Promise.reject(new Error('Frozen scene owner is disposed'));
    this.pending ??= this.build(); return this.pending;
  }
  private async build(): Promise<Object3D> {
    let root: Object3D;
    try { root = hydrateWorldSceneWeld(this.row, this.handles, this.sources, this.owner, this.registry); }
    finally { this.staging.clear(); }
    for (const id of this.row.placements) await this.handles.place(id);
    if (this.owner.disposed) throw new Error('Frozen scene owner is disposed');
    for (const row of this.row.sets) {
      const members = await Promise.all(row.members.map(id => this.handles.place(id)));
      withOwner(this.owner, () => placeSet({ ...row, registry: this.registry, members }));
    }
    return root;
  }
}
