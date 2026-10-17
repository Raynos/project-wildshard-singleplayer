import { BufferGeometry, Material, MeshBasicMaterial, MeshStandardMaterial, Object3D, PointLight } from 'three';
import type { SkyRig } from '@wildshard/engine/world/skyRig';

type Resource = BufferGeometry | Material | Object3D;

/** Platform-owned native scene resources, addressed by exact ids. Publishing a resource
 * lends its identity, never a shard method or a path into an owner. The construction
 * scope owns disposal; consumers must not dispose borrowed resources. Z2 can publish
 * the same ids directly when its data assembler replaces native construction. */
export class SceneResources {
  private readonly values = new Map<string, Resource>();
  constructor(readonly sky: Pick<SkyRig, 'setupMaterial'>) {}

  /** Publish an engine resource and return its stable id. Repeated identical loans
   * are idempotent; replacing a live id with another resource always refuses. */
  publish(id: string, resource: Resource): string {
    if (id.length === 0 || id.length > 256) throw new Error('Invalid scene resource id');
    const prior = this.values.get(id);
    if (prior !== undefined && prior !== resource) throw new Error(`Duplicate scene resource: ${id}`);
    this.values.set(id, resource);
    return id;
  }
  /** Native migration adapters can publish anonymous resources by identity. */
  lend(resource: Resource): string { return this.publish(resource.uuid, resource); }
  private get(id: string): Resource {
    const value = this.values.get(id);
    if (value === undefined) throw new Error(`Missing scene resource: ${id}`);
    return value;
  }
  geometry(id: string): BufferGeometry { const value = this.get(id); if (!(value instanceof BufferGeometry)) throw new Error(`Expected scene geometry: ${id}`); return value; }
  material(id: string): Material { const value = this.get(id); if (!(value instanceof Material)) throw new Error(`Expected scene material: ${id}`); return value; }
  standard(id: string): MeshStandardMaterial { const value = this.material(id); if (!(value instanceof MeshStandardMaterial)) throw new Error(`Expected standard material: ${id}`); return value; }
  basic(id: string): MeshBasicMaterial { const value = this.material(id); if (!(value instanceof MeshBasicMaterial)) throw new Error(`Expected basic material: ${id}`); return value; }
  object(id: string): Object3D { const value = this.get(id); if (!(value instanceof Object3D)) throw new Error(`Expected scene object: ${id}`); return value; }
  light(id: string): PointLight { const value = this.object(id); if (!(value instanceof PointLight)) throw new Error(`Expected point light: ${id}`); return value; }
}
