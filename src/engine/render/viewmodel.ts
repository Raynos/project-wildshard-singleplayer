import { BoxGeometry, Group, Mesh, MeshBasicMaterial, type Material, type Object3D } from 'three';

const viewMesh = (part: Object3D): part is Mesh => part instanceof Mesh;

/** One camera-space transparent pass, shared by every equipped weapon. */
export class ViewmodelRoot extends Group {
  private readonly transparentCopies = new WeakMap<Material, Material>();
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
    return super.add(...objects);
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
  private prepare(object: Object3D): void {
    object.traverse((part) => {
      if (!viewMesh(part)) return;
      part.renderOrder = Math.max(1000, part.renderOrder); part.frustumCulled = false; part.castShadow = false;
      if (Array.isArray(part.material)) {
        if (part.material.some((material) => !material.transparent)) part.material = part.material.map((material) => this.transparent(material));
      } else part.material = this.transparent(part.material);
    });
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
      model.traverseVisible((part) => { if (part instanceof Mesh) drawn = true; });
    }
    this.clearer.visible = drawn;
  }
}
