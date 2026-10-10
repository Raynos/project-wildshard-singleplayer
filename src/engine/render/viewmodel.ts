import { BoxGeometry, Group, Mesh, MeshBasicMaterial, type Material, type Object3D } from 'three';

import { constructionOwner, currentOwner, enteredOwner } from '../app/ownership';
import type { Scope } from '../app/scope';

const viewMesh = (part: Object3D): part is Mesh => part instanceof Mesh;

/** One camera-space transparent pass, shared by every equipped weapon. */
export class ViewmodelRoot extends Group {
  private readonly preparations = new Map<Scope, Group>();
  private readonly transparentCopies = new WeakMap<Material, Material>();
  /** Staged models that keep their own pass (`mountOwnPass`): never prepared, never counted for the shared clear. */
  private readonly ownPass = new WeakSet<Object3D>();
  private readonly clearer = new Mesh(new BoxGeometry(0.001, 0.001, 0.001), new MeshBasicMaterial({
    colorWrite: false, depthWrite: false, transparent: true, fog: false,
  }));
  constructor() {
    super();
    this.clearer.renderOrder = 999; this.clearer.frustumCulled = false;
    this.clearer.onBeforeRender = (renderer) => { renderer.clearDepth(); };
    super.add(this.clearer);
  }
  override add(...objects: Object3D[]): this {
    for (const object of objects) this.prepare(object);
    const preparation = this.preparation();
    if (preparation === undefined) return super.add(...objects);
    preparation.add(...objects); return this;
  }
  /**
   * Mount a camera-space model that draws its own depth clear (a javelin spear, a lever firearm): while its owner is
   * preparing, it waits hidden in that owner's group like `add`; otherwise it is a plain child of `camera`, as before.
   * Its materials, render order and clear stay its own (op-hitch41: Nalati's spear went straight to the camera
   * mid-afterKit and linked its two programs, 22 ms blocking, on the Simulator).
   */
  mountOwnPass(object: Object3D, camera: Object3D): void {
    const preparation = this.preparation();
    if (preparation === undefined) { camera.add(object); return; }
    this.ownPass.add(object); preparation.add(object);
  }
  /** The preparing group of the owner constructing now, if any. */
  private preparation(): Group | undefined {
    // op-hitch37: a sliced build's later weapons are made in an `await` continuation, where the ambient owner is the
    // page's: the construction it belongs to still holds them back. An explicit owner section keeps its own owner.
    const owner = this.preparations.size === 0 ? null : enteredOwner() ?? constructionOwner() ?? currentOwner();
    return [...this.preparations].find(([scope]) => owner?.belongsTo(scope) === true)?.[1];
  }
  /** Keep this owner's newly constructed models hidden until their ordinary shader preparation finishes.
   * The group stays under the same camera pass with identity transform; other owners mount normally. Geometry,
   * materials and authored visibility stay unchanged. The owner removes the group without disposing borrowed models. */
  stage(owner: Scope): Group {
    if (owner.disposed) throw new Error('Viewmodel preparation requires a live owner');
    if (this.preparations.has(owner)) throw new Error('Viewmodel owner is already preparing');
    const group = new Group(); group.visible = false;
    this.preparations.set(owner, group); super.add(group);
    owner.onDispose(() => { this.preparations.delete(owner); group.removeFromParent(); });
    return group;
  }
  private transparent(material: Material): Material {
    // Kit families already configure these exact materials for the transparent queue; retain their identity.
    if (material.transparent) return material;
    let copy = this.transparentCopies.get(material);
    if (copy === undefined) {
      copy = material.clone(); copy.transparent = true;
      const cloned = copy;
      copy.onBeforeCompile = (shader, renderer) => { material.onBeforeCompile.call(cloned, shader, renderer); };
      copy.customProgramCacheKey = () => material.customProgramCacheKey();
      this.transparentCopies.set(material, copy);
    }
    return copy;
  }
  private prepare(part: Object3D): void {
    if (this.ownPass.has(part)) return;
    if (viewMesh(part)) {
      part.renderOrder = Math.max(1000, part.renderOrder); part.frustumCulled = false; part.castShadow = false;
      if (Array.isArray(part.material)) {
        if (part.material.some((material) => !material.transparent)) part.material = part.material.map((material) => this.transparent(material));
      } else part.material = this.transparent(part.material);
    }
    for (const child of part.children) this.prepare(child);
  }
  private drawsMesh(part: Object3D): boolean {
    if (!part.visible || this.ownPass.has(part)) return false;
    return part instanceof Mesh || part.children.some((child) => this.drawsMesh(child));
  }
  override updateMatrixWorld(force?: boolean): void {
    this.syncClearer();
    super.updateMatrixWorld(force);
  }
  /**
   * The depth clear draws only while a weapon part does. Every scene render runs it (through `updateMatrixWorld`); a render
   * that skips the matrix walk and changes what is visible calls it itself (n8ao's pre-pass, aoTransparency.ts cut 4).
   */
  syncClearer(): void {
    let drawn = false;
    for (const model of this.children) {
      if (model === this.clearer) continue;
      this.prepare(model);
      if (!drawn && this.drawsMesh(model)) drawn = true;
    }
    this.clearer.visible = drawn;
  }
}
