import * as THREE from 'three';

/**
 * Posed instances (SHARD-PLATFORM M3, moved from Pine Hollow's models/wildlife.ts): several small posable models (birds,
 * a hare…) authored into ONE geometry and drawn as ONE instanced mesh — one draw call, one program. Each instance draws only
 * its own model (the shard's material collapses the others' vertices to a point) and moves that model's parts from two
 * per-instance vec4s (`aAnim`, `aAnim2`). The packing, the instance buffers and the per-frame packing of the live instances
 * are here; the parts' motion, what the packed scalars mean and the look are the shard's material graph (its `data/`).
 *
 * Per vertex: position, normal, colour, the part's pivot (`aPivot`) and two packed vec4s, `aInfo` and `aTexV` (WebGL's 16
 * attribute slots: the instance matrix takes four). The mesh casts no shadow and receives them; it is never frustum culled.
 *
 *   const posed = new PosedInstances(24, 'pine-wildlife', material, () => authoredGeometry);
 *   scene.add(posed.mesh);
 *   posed.begin(); posed.add(x, y, z, pitch, yaw, roll, scale, a0, a1, a2, a3, b0, b1, b2, b3); posed.commit();
 */

const ZERO = new THREE.Matrix4().makeScale(0, 0, 0);

/** One instanced mesh of posable packed models (see the module comment). */
export class PosedInstances {
  readonly mesh: THREE.InstancedMesh;
  readonly capacity: number;
  private readonly anim: THREE.InstancedBufferAttribute;
  private readonly anim2: THREE.InstancedBufferAttribute;
  private readonly m = new THREE.Matrix4(); private readonly q = new THREE.Quaternion(); private readonly e = new THREE.Euler();
  private readonly p = new THREE.Vector3(); private readonly s = new THREE.Vector3();
  private n = 0;

  /** `capacity` instances of the packed `src` (authored geometry) drawn in `material` (the shard's posed look) */
  constructor(capacity: number, name: string, material: THREE.Material, src: () => THREE.BufferGeometry) {
    this.capacity = capacity;
    this.anim = new THREE.InstancedBufferAttribute(new Float32Array(capacity * 4), 4); this.anim.setUsage(THREE.DynamicDrawUsage);
    this.anim2 = new THREE.InstancedBufferAttribute(new Float32Array(capacity * 4), 4); this.anim2.setUsage(THREE.DynamicDrawUsage);
    const geo = this.wrap(src(), true);
    this.mesh = new THREE.InstancedMesh(geo, material, capacity);
    this.mesh.name = name;
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    this.mesh.castShadow = false;
    this.mesh.receiveShadow = true;
    // parked at zero scale until the first frame packs the live ones (the boot's precompile sees a drawn instance)
    for (let i = 0; i < capacity; i++) this.mesh.setMatrixAt(i, ZERO);
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  /** `src`'s attributes and index on an instanced geometry carrying this mesh's per-instance pose (`bound`: an
   *  everywhere bounding sphere, as the drawn mesh has) */
  wrap(src: THREE.BufferGeometry, bound: boolean): THREE.InstancedBufferGeometry {
    const geo = new THREE.InstancedBufferGeometry();
    for (const [k, v] of Object.entries(src.attributes)) geo.setAttribute(k, v);
    geo.setIndex(src.getIndex());
    geo.setAttribute('aAnim', this.anim); geo.setAttribute('aAnim2', this.anim2);
    if (bound) geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e5);
    return geo;
  }

  /** vertices in the shared geometry */
  get vertexCount(): number { return this.mesh.geometry.getAttribute('position').count; }

  /** start a frame: no instance drawn until `add`ed */
  begin(): void { this.n = 0; }
  /** draw one instance this frame at (x, y, z), turned by (−pitch, yaw, roll) in YXZ order, scaled; (a0..a3) → `aAnim`,
   *  (b0..b3) → `aAnim2` (the live instances are packed at the front: nothing parked costs a vertex) */
  add(x: number, y: number, z: number, pitch: number, yaw: number, roll: number, scale: number, a0: number, a1: number, a2: number, a3: number, b0: number, b1: number, b2: number, b3: number): void {
    if (this.n >= this.capacity) return;
    const i = this.n++;
    this.e.set(-pitch, yaw, roll, 'YXZ');
    this.q.setFromEuler(this.e);
    this.m.compose(this.p.set(x, y, z), this.q, this.s.setScalar(scale));
    this.mesh.setMatrixAt(i, this.m);
    const a = this.anim.array, b = this.anim2.array, k = i * 4;
    a[k] = a0; a[k + 1] = a1; a[k + 2] = a2; a[k + 3] = a3;
    b[k] = b0; b[k + 1] = b1; b[k + 2] = b2; b[k + 3] = b3;
  }
  /** draw exactly the instances added since `begin` */
  commit(): void { this.mesh.count = this.n; this.mesh.instanceMatrix.needsUpdate = true; this.anim.needsUpdate = true; this.anim2.needsUpdate = true; }
}
