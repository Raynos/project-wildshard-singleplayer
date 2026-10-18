import { BufferGeometry, Group, Material, Mesh, MeshBasicMaterial, MeshStandardMaterial, Object3D, PointLight, Vector3 } from 'three';
import type { SkyRig } from '@wildshard/engine/world/skyRig';
import type { Placed } from '@wildshard/engine/models/place';
import type { ColliderDesc } from '@wildshard/engine/world/registry';
import { ScenePointRefSchema, type ScenePointRef } from '@wildshard/format/sceneRefs';
import * as v from 'valibot';
import { WorldScenePlacement } from './worldScenePlacement';
import { WorldSceneBatch } from './worldSceneBatch';

type NativePart = BufferGeometry | Material | Object3D;
type Handle = NativePart | Vector3 | number | WorldScenePlacement | WorldSceneBatch | readonly ColliderDesc[];

/** Client-only resident names for scene, building and native migration parts.
 * Resources are borrowed: the construction scope retains disposal ownership. */
export class SceneHandles {
  private readonly values = new Map<string, Handle>();
  constructor(private readonly lighting?: Pick<SkyRig, 'setupMaterial'>) {}
  get sky(): Pick<SkyRig, 'setupMaterial'> {
    if (this.lighting === undefined) throw new Error('Scene handles need world sky');
    return this.lighting;
  }
  has(id: string): boolean { return this.values.has(id); }
  /** Host publication refuses every duplicate, including a cross-kind collision. */
  publish(id: string, value: unknown): void {
    if (id.length === 0 || id.length > 256) throw new Error('Invalid world scene handle');
    if (this.has(id)) throw new Error(`Duplicate world scene handle: ${id}`);
    if (!nativeHandle(value)) throw new Error(`Unsupported world scene handle: ${id}`);
    this.values.set(id, value);
  }
  publishColliders(id: string, value: readonly ColliderDesc[]): void { this.publish(id, value); }
  /** Native migration publication is idempotent by resource identity only. */
  lend(resource: NativePart): string {
    if (!this.has(resource.uuid)) this.publish(resource.uuid, resource);
    else if (this.value(resource.uuid) !== resource) throw new Error(`Duplicate world scene handle: ${resource.uuid}`);
    return resource.uuid;
  }
  /** Retire one native publication only while it still names that resource.
   * Evicting an older figure cannot remove its successor or dispose a loan. */
  release(id: string, resource: NativePart | Vector3): boolean {
    if (this.values.get(id) !== resource) return false;
    return this.values.delete(id);
  }
  async place(id: string): Promise<Placed> {
    const value = this.value(id);
    if (!(value instanceof WorldScenePlacement)) throw new Error(`Expected scene placement: ${id}`);
    const placed = await value.load();
    if (!this.has(`${id}.root`)) { this.publish(`${id}.root`, placed.object); this.publishColliders(`${id}.colliders`, placed.colliders); }
    return placed;
  }
  /** Named placement floors use the admitted contact profile before or after drawing. */
  floorAt(id: string, x: number, z: number): number | undefined {
    const value = this.value(id);
    if (!(value instanceof WorldScenePlacement)) throw new Error(`Expected scene placement: ${id}`);
    return value.floorAt(x, z);
  }
  private value(id: string): Handle {
    const value = this.values.get(id);
    if (value === undefined) throw new Error(`Missing world scene handle: ${id}`);
    return value;
  }
  geometry(id: string): BufferGeometry { const value = this.value(id); if (!(value instanceof BufferGeometry)) throw new Error(`Expected scene geometry: ${id}`); return value; }
  material(id: string): Material { const value = this.value(id); if (!(value instanceof Material)) throw new Error(`Expected scene material: ${id}`); return value; }
  standard(id: string): MeshStandardMaterial { const value = this.material(id); if (!(value instanceof MeshStandardMaterial)) throw new Error(`Expected standard material: ${id}`); return value; }
  basic(id: string): MeshBasicMaterial { const value = this.material(id); if (!(value instanceof MeshBasicMaterial)) throw new Error(`Expected basic material: ${id}`); return value; }
  object(id: string): Object3D { const source = this.value(id), value = source instanceof WorldSceneBatch ? source.finish() : source; if (!(value instanceof Object3D)) throw new Error(`Expected scene object: ${id}`); return value; }
  group(id: string): Group { const value = this.value(id); if (!group3(value)) throw new Error(`Expected scene group: ${id}`); return value; }
  mesh(id: string): Mesh { const source = this.value(id), value = source instanceof WorldSceneBatch ? source.finish() : source; if (!mesh3(value)) throw new Error(`Expected scene mesh: ${id}`); return value; }
  vector(id: string): Vector3 { const value = this.value(id); if (!(value instanceof Vector3)) throw new Error(`Expected scene vector: ${id}`); return value; }
  number(id: string): number { const value = this.value(id); if (typeof value !== 'number') throw new Error(`Expected scene number: ${id}`); return value; }
  light(id: string): PointLight { const value = this.value(id); if (!(value instanceof PointLight)) throw new Error(`Expected scene light: ${id}`); return value; }
  colliders(id: string): readonly ColliderDesc[] { const value = this.value(id); if (!colliderRows(value)) throw new Error(`Expected scene colliders: ${id}`); return value; }
  /** A point is a published vector or an object's world origin; offsets are world-space. */
  point(input: ScenePointRef, out: Vector3): Vector3 {
    const ref = v.parse(ScenePointRefSchema, input);
    const id = 'part' in ref ? ref.part : ref.point, source = this.value(id), value = source instanceof WorldSceneBatch ? source.finish() : source;
    if (value instanceof Vector3) out.copy(value);
    else if (value instanceof Object3D) value.getWorldPosition(out);
    else throw new Error(`Expected scene point: ${id}`);
    if ('offset' in ref) out.add(new Vector3(...ref.offset));
    return out;
  }
}

function group3(value: unknown): value is Group { return value instanceof Group; }
function mesh3(value: unknown): value is Mesh { return value instanceof Mesh; }
function colliderRows(value: Handle): value is readonly ColliderDesc[] { return Array.isArray(value); }
function nativeHandle(value: unknown): value is Handle { return value instanceof BufferGeometry || value instanceof Material || value instanceof Object3D || value instanceof Vector3 || value instanceof WorldScenePlacement || value instanceof WorldSceneBatch || typeof value === 'number' || Array.isArray(value); }
