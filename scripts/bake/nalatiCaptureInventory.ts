import { BufferGeometry, InstancedMesh, Material, type Matrix4, Mesh, Object3D } from 'three';
import type { ModelBuildVisit, ModelPlacementVisitor } from '../../src/engine/models/model';
import { poseOf } from '../../src/engine/models/colliders';
import { NALATI_GRASSLANDS } from '../../src/shards/nalati-grasslands/manifest';
import { captureDressLayerSource, type DressLayerSource } from '../../src/shards/nalati-grasslands/world/dressing/layer';
import { visitAuthoredWorld, type AuthoredWorldOptions } from './worldHost.mjs';

/** An exact owned copy of one decoded attribute, independent of later culling, mutation and host disposal. */
export interface NalatiCapturedAttribute { itemSize: number; values: Float64Array }
/** Inventory geometry only. Original material identities remain for the painterly catalogue owner to resolve. */
export interface NalatiCapturedMesh {
  /** Capture-local identity shared when overlapping drawnInto roots contain the same actual mesh. */
  sourceMesh: number;
  name: string; type: string; visible: boolean; matrix: number[]; materials: { name: string; type: string }[];
  attributes: Record<string, NalatiCapturedAttribute>; indices: Uint32Array;
  instances: { count: number; capacity: number; matrices: Float32Array; colours: Float32Array | null } | null;
  /** Original ordered scatter source, independent of the instance buffer's visible/cull order. */
  scatter: DressLayerSource | null;
}
/** Source copies remain ordered, including those not drawn by the initial cull. */
export interface NalatiCapturedPlacement {
  model: string; draw: string; role: 'static-candidate' | 'hybrid'; copies: {
    x: number; y: number; z: number; matrix: number[]; variant: string | null; colour: number | [number, number, number] | null;
  }[];
  root: number | null;
}
/** A set-owned root may include both static and hybrid models; inventory never silently classifies the whole root. */
export interface NalatiCapturedRoot { name: string; models: string[]; roles: NalatiCapturedPlacement['role'][]; meshes: NalatiCapturedMesh[] }
/** Captured builder output is own-space; poses stay separate. Weld output is inventory-only until its owner maps it. */
export interface NalatiCapturedBuild { model: string; kind: 'model' | 'weld'; level: number; copies: number; meshes: NalatiCapturedMesh[] }
/** No scene, material, geometry, registry or physics object escapes the owned world. */
export interface NalatiAuthoredInventory { placements: NalatiCapturedPlacement[]; roots: NalatiCapturedRoot[]; builds: NalatiCapturedBuild[] }

const hybridModels = new Set(['nalati-grasslands/balbal', 'nalati-grasslands/herd-horse', 'nalati-grasslands/kokpar-rider', 'nalati-grasslands/saddled-horse']);

function meshSnapshot(object: Mesh, geometry: BufferGeometry, sourceMesh: number): NalatiCapturedMesh {
  const attributes: Record<string, NalatiCapturedAttribute> = {};
  for (const name of Object.keys(geometry.attributes).sort()) {
    const channel = geometry.getAttribute(name);
    attributes[name] = { itemSize: channel.itemSize, values: Float64Array.from({ length: channel.count * channel.itemSize }, (_, i) => channel.getComponent(Math.floor(i / channel.itemSize), i % channel.itemSize)) };
  }
  const input: unknown = object.material, values: unknown[] = Array.isArray(input) ? input : [input];
  const materials = values.map(value => { if (!(value instanceof Material)) throw new Error('Nalati capture requires authored materials'); return { name: value.name, type: value.type }; });
  const index = geometry.getIndex(), position = geometry.getAttribute('position');
  if (!geometry.hasAttribute('position')) throw new Error('Nalati capture requires positions');
  return { sourceMesh, name: object.name, type: object.type, visible: object.visible, matrix: [...object.matrixWorld.elements], materials, attributes,
    indices: index === null ? Uint32Array.from({ length: position.count }, (_, i) => i) : Uint32Array.from(index.array),
    scatter: captureDressLayerSource(object) ?? null,
    instances: object instanceof InstancedMesh ? { count: object.count, capacity: object.instanceMatrix.count,
      matrices: Float32Array.from(object.instanceMatrix.array), colours: object.instanceColor === null ? null : Float32Array.from(object.instanceColor.array) } : null };
}

function isGeometry(value: unknown): value is BufferGeometry { return value instanceof BufferGeometry; }
function isMesh(value: Object3D): value is Mesh {
  if (!(value instanceof Mesh)) return false;
  const geometry: unknown = value.geometry;
  return isGeometry(geometry);
}

function rootSnapshot(root: Object3D, identity: (mesh: Mesh) => number, originalTransform?: Matrix4): NalatiCapturedMesh[] {
  root.updateWorldMatrix(true, true); const meshes: NalatiCapturedMesh[] = [];
  const relative = originalTransform?.clone().multiply(root.matrixWorld.clone().invert());
  root.traverse(object => {
    if (!isMesh(object)) { if (object instanceof Mesh) throw new Error('Nalati capture requires decoded geometry'); return; }
    const mesh = meshSnapshot(object, object.geometry, identity(object));
    if (relative !== undefined) mesh.matrix = relative.clone().multiply(object.matrixWorld).elements;
    meshes.push(mesh);
  });
  return meshes;
}

/** Collect the shared host's actual pre-cull callbacks. Never calls a model builder or infers missing geometry.
 * Snapshot drawnInto roots only after the caller awaits their real asynchronous GLB loads. Cloth/smoke and
 * gameplay-owned models remain hybrid; mixed roots are explicit candidates requiring a later per-mesh decision.
 */
export class NalatiCaptureInventory {
  private readonly placements: NalatiCapturedPlacement[] = [];
  private readonly roots: { object: Object3D; models: Set<string>; roles: Set<NalatiCapturedPlacement['role']> }[] = [];
  private readonly builds: NalatiCapturedBuild[] = [];
  private readonly deferred: { build: NalatiCapturedBuild; object: Object3D; transform: Matrix4 }[] = [];
  private sealed = false;
  private readonly meshIds = new WeakMap<Mesh, number>();
  private meshCount = 0;
  private readonly meshIdentity = (mesh: Mesh): number => {
    const known = this.meshIds.get(mesh); if (known !== undefined) return known;
    const id = this.meshCount++; this.meshIds.set(mesh, id); return id;
  };

  readonly visitPlacement: ModelPlacementVisitor = entry => {
    if (this.sealed) throw new Error('Nalati capture already sealed');
    const role = entry.moving || hybridModels.has(entry.model) ? 'hybrid' : 'static-candidate';
    let root: number | null = null;
    if (entry.drawnInto !== undefined) {
      let found = this.roots.findIndex(row => row.object === entry.drawnInto);
      if (found < 0) { found = this.roots.length; this.roots.push({ object: entry.drawnInto, models: new Set(), roles: new Set() }); }
      const row = this.roots.at(found); if (row === undefined) throw new Error('Missing Nalati capture root');
      row.models.add(entry.model); row.roles.add(role); root = found;
    }
    this.placements.push({ model: entry.model, draw: entry.draw, role, root,
      copies: entry.placements.map(copy => ({ x: copy.x, y: copy.y, z: copy.z, matrix: [...poseOf(copy).matrix.elements], variant: copy.variant ?? null,
        colour: copy.color === undefined ? null : typeof copy.color === 'number' ? copy.color : [copy.color.r, copy.color.g, copy.color.b] })) });
    return build => { this.captureBuild(entry.model, build); };
  };

  private captureBuild<P extends object>(model: string, build: ModelBuildVisit<P>): void {
    if (this.sealed) throw new Error('Nalati capture already sealed');
    const meshes = build.kind === 'model' && !(build.built instanceof Object3D) ? build.built.map(part => {
        const object = new Mesh(part.geometry, part.material); object.updateMatrixWorld(true);
        return meshSnapshot(object, part.geometry, this.meshIdentity(object));
      }) : [];
    // Welds have their own surface/host ownership. Count them explicitly; never silently flatten them as static.
    const captured = { model, kind: build.kind, level: build.level, copies: build.placements.length, meshes };
    this.builds.push(captured);
    if (build.kind === 'model' && build.built instanceof Object3D) {
      build.built.updateMatrix();
      this.deferred.push({ build: captured, object: build.built, transform: build.built.matrix.clone() });
    }
  }

  /** Await the real producer loads while the host is alive, then copy roots including initially invisible meshes. */
  async snapshot(settle: () => Promise<void>): Promise<NalatiAuthoredInventory> {
    if (this.sealed) throw new Error('Nalati capture already sealed');
    await settle(); this.sealed = true;
    for (const entry of this.deferred) entry.build.meshes = rootSnapshot(entry.object, this.meshIdentity, entry.transform);
    return { placements: structuredClone(this.placements), builds: structuredClone(this.builds), roots: this.roots.map(row => ({
      name: row.object.name, models: [...row.models].sort(), roles: [...row.roles].sort(), meshes: rootSnapshot(row.object, this.meshIdentity),
    })) };
  }
}

/** Run Nalati's ordinary authored world through the one owned host, then retain only independent inventory data.
 * The shared environment supplies native preconfiguration/real terrain; settleModels awaits actual producer loads.
 */
export async function captureNalatiAuthoredWorld(options: Omit<AuthoredWorldOptions, 'visitPlacement' | 'visit'> & {
  settleModels: () => Promise<void>;
}): Promise<{ inventory: NalatiAuthoredInventory; native: Awaited<ReturnType<typeof visitAuthoredWorld>> }> {
  const { settleModels, ...host } = options, collector = new NalatiCaptureInventory();
  const captured: { inventory?: NalatiAuthoredInventory } = {};
  const native = await visitAuthoredWorld(NALATI_GRASSLANDS, { ...host, visitPlacement: collector.visitPlacement,
    visit: async () => { captured.inventory = await collector.snapshot(settleModels); },
  });
  if (captured.inventory === undefined) throw new Error('Nalati authored world was not captured');
  return { inventory: captured.inventory, native };
}
