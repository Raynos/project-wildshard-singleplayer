/**
 * InstancedBatch: the BatchedMesh surface a kit fills (geometries, then copies it moves, tints, shows and hides), drawn
 * instanced: one InstancedMesh per geometry, holding only that geometry's visible copies, packed as they change. Never
 * multi-draw (E271 / E272: it killed the iPhone; a graph look on a multi-draw batch did not even compile on the grid).
 * A culler drives it as a `BatchSink` (models/cull.ts `BatchedCull`). Copies are not frustum-culled one by one: callers
 * that need it cull first and hide what is out of view.
 *
 *   const batch = new InstancedBatch(material, { name: 'interact-lit', castShadow: true });
 *   const id = batch.addInstance(batch.addGeometry(geometry)); batch.setMatrixAt(id, matrix);
 */
import * as THREE from 'three';
import type { BatchSink } from './cull';

/** A node (graph look) material: it never draws on a multi-draw batch (E271 / E272), only instanced. */
export function graphLook(material: THREE.Material): boolean { return Reflect.get(material, 'isNodeMaterial') === true; }

interface Slot { readonly geometry: THREE.BufferGeometry; mesh: THREE.InstancedMesh | null; capacity: number; copies: Int32Array }
export interface InstancedBatchOptions {
  readonly name?: string;
  readonly castShadow?: boolean;
  readonly receiveShadow?: boolean;
  /** dispose the added geometries with the batch (a kit's own shapes); false when another owner holds them */
  readonly ownsGeometry?: boolean;
}

export class InstancedBatch extends THREE.Group implements BatchSink {
  private readonly slots: Slot[] = [];
  /** per copy: its geometry, the slot holding it now (-1: hidden), its index there, its matrix and tint */
  private geometryOf = new Int32Array(16);
  private held = new Int32Array(16);
  private at = new Int32Array(16);
  private matrices = new Float32Array(16 * 16);
  private colors: Float32Array | null = null;
  private copies = 0;
  private readonly scratchMatrix = new THREE.Matrix4();
  private readonly scratchColor = new THREE.Color();

  readonly material: THREE.Material;
  private readonly options: InstancedBatchOptions;

  constructor(material: THREE.Material, options: InstancedBatchOptions = {}) {
    super();
    this.material = material; this.options = options;
    this.name = options.name ?? 'instanced-batch';
  }

  /** A shape its copies can draw; returns its id. */
  addGeometry(geometry: THREE.BufferGeometry): number {
    this.slots.push({ geometry, mesh: null, capacity: 0, copies: new Int32Array(0) });
    return this.slots.length - 1;
  }

  /** Size geometry `geometry`'s mesh for `capacity` copies now (it otherwise grows as copies show). */
  reserve(geometry: number, capacity: number): this {
    const slot = this.slots[geometry];
    if (slot === undefined) throw new Error(`Instanced batch has no geometry ${geometry}`);
    if (capacity > slot.capacity) this.widen(slot, capacity);
    return this;
  }

  /** A new visible copy of geometry `geometry`, at the identity until moved; returns its id. */
  addInstance(geometry: number): number {
    if (this.slots[geometry] === undefined) throw new Error(`Instanced batch has no geometry ${geometry}`);
    const id = this.copies++;
    if (id >= this.held.length) this.grow(this.held.length * 2);
    this.geometryOf[id] = geometry; this.held[id] = -1;
    this.scratchMatrix.identity().toArray(this.matrices, id * 16);
    this.colors?.fill(1, id * 3, id * 3 + 3);
    this.show(id);
    return id;
  }

  get instanceCount(): number { return this.copies; }

  setMatrixAt(id: number, matrix: THREE.Matrix4): this {
    this.check(id); matrix.toArray(this.matrices, id * 16);
    const slot = this.slots[this.held[id] ?? -1];
    if (slot?.mesh) { slot.mesh.setMatrixAt(this.at[id] ?? 0, matrix); slot.mesh.instanceMatrix.needsUpdate = true; }
    return this;
  }

  getMatrixAt(id: number, out: THREE.Matrix4): THREE.Matrix4 { this.check(id); return out.fromArray(this.matrices, id * 16); }

  setColorAt(id: number, color: THREE.Color): this {
    this.check(id);
    if (this.colors === null) { this.colors = new Float32Array(this.held.length * 3).fill(1); for (const slot of this.slots) if (slot.mesh) this.tint(slot); }
    color.toArray(this.colors, id * 3);
    const slot = this.slots[this.held[id] ?? -1];
    if (slot?.mesh) { slot.mesh.setColorAt(this.at[id] ?? 0, color); if (slot.mesh.instanceColor) slot.mesh.instanceColor.needsUpdate = true; }
    return this;
  }

  setVisibleAt(id: number, visible: boolean): this {
    this.check(id);
    if (!visible) this.hide(id); else if ((this.held[id] ?? -1) < 0) this.show(id);
    return this;
  }

  getVisibleAt(id: number): boolean { this.check(id); return (this.held[id] ?? -1) >= 0; }

  setGeometryIdAt(id: number, geometry: number): this {
    this.check(id);
    if (this.slots[geometry] === undefined) throw new Error(`Instanced batch has no geometry ${geometry}`);
    if (this.geometryOf[id] === geometry) return this;
    const shown = (this.held[id] ?? -1) >= 0;
    this.hide(id); this.geometryOf[id] = geometry;
    if (shown) this.show(id);
    return this;
  }

  getGeometryIdAt(id: number): number { this.check(id); return this.geometryOf[id] ?? -1; }

  /** Free the instance buffers (and the geometries when it owns them); the material stays its owner's. */
  override dispose(): void {
    for (const slot of this.slots) {
      slot.mesh?.dispose(); slot.mesh?.removeFromParent(); slot.mesh = null;
      if (this.options.ownsGeometry === true) slot.geometry.dispose();
    }
  }

  private check(id: number): void { if (id < 0 || id >= this.copies) throw new Error(`Instanced batch has no copy ${id}`); }

  private grow(size: number): void {
    const widen = <T extends Int32Array | Float32Array>(from: T, to: T): T => { to.set(from); return to; };
    this.geometryOf = widen(this.geometryOf, new Int32Array(size)); this.held = widen(this.held, new Int32Array(size));
    this.at = widen(this.at, new Int32Array(size)); this.matrices = widen(this.matrices, new Float32Array(size * 16));
    if (this.colors !== null) this.colors = widen(this.colors, new Float32Array(size * 3).fill(1));
  }

  /** Pack copy `id` at the end of its geometry's mesh (a larger mesh replaces a full one). */
  private show(id: number): void {
    const index = this.geometryOf[id] ?? -1, slot = this.slots[index];
    if (slot === undefined) return;
    if (slot.mesh === null || slot.mesh.count >= slot.capacity) this.widen(slot, Math.max(4, slot.capacity * 2));
    const mesh = slot.mesh; if (mesh === null) return;
    const at = mesh.count;
    mesh.setMatrixAt(at, this.scratchMatrix.fromArray(this.matrices, id * 16)); mesh.instanceMatrix.needsUpdate = true;
    if (this.colors !== null) { mesh.setColorAt(at, this.scratchColor.fromArray(this.colors, id * 3)); if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true; }
    slot.copies[at] = id; mesh.count = at + 1; this.held[id] = index; this.at[id] = at;
  }

  /** Unpack copy `id`: the mesh's last copy fills its place. */
  private hide(id: number): void {
    const slot = this.slots[this.held[id] ?? -1], mesh = slot?.mesh;
    if (slot === undefined || mesh === undefined || mesh === null) return;
    const at = this.at[id] ?? 0, last = mesh.count - 1, moved = slot.copies[last] ?? -1;
    if (at !== last && moved >= 0) {
      mesh.setMatrixAt(at, this.scratchMatrix.fromArray(this.matrices, moved * 16));
      if (this.colors !== null) mesh.setColorAt(at, this.scratchColor.fromArray(this.colors, moved * 3));
      slot.copies[at] = moved; this.at[moved] = at;
    }
    mesh.count = last; mesh.instanceMatrix.needsUpdate = true; if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    this.held[id] = -1;
  }

  private widen(slot: Slot, capacity: number): void {
    const old = slot.mesh, mesh = new THREE.InstancedMesh(slot.geometry, this.material, capacity);
    mesh.name = `${this.name}:${this.slots.indexOf(slot)}`; mesh.frustumCulled = false; mesh.count = 0;
    mesh.castShadow = this.options.castShadow ?? false; mesh.receiveShadow = this.options.receiveShadow ?? false;
    const copies = new Int32Array(capacity);
    if (old !== null) {
      for (let i = 0; i < old.count; i++) { old.getMatrixAt(i, this.scratchMatrix); mesh.setMatrixAt(i, this.scratchMatrix); copies[i] = slot.copies[i] ?? -1; }
      mesh.count = old.count; old.dispose(); old.removeFromParent();
    }
    slot.mesh = mesh; slot.capacity = capacity; slot.copies = copies;
    if (this.colors !== null) this.tint(slot);
    this.add(mesh);
  }

  /** Give a slot's mesh its packed copies' tints (the first tint arrives after it was built). */
  private tint(slot: Slot): void {
    const mesh = slot.mesh; if (mesh === null || this.colors === null) return;
    for (let i = 0; i < mesh.count; i++) mesh.setColorAt(i, this.scratchColor.fromArray(this.colors, (slot.copies[i] ?? 0) * 3));
    if (mesh.count === 0) mesh.setColorAt(0, this.scratchColor.setRGB(1, 1, 1));
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }
}
