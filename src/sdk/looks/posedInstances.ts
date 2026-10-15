import * as THREE from 'three';

/** One dynamic instance owner for shader-posed crowds. Geometry attributes,
 * material, channel meanings, decisions and clocks belong to the caller.
 * Owns only its wrapper and live matrix/vec4 buffers; source arrays are lent.
 * Pine uses two channels, Nalati's flock uses one `iAnim` channel (G441 W3).
 */

const ZERO = new THREE.Matrix4().makeScale(0, 0, 0);

/** One instanced mesh of posable packed models (see the module comment). */
export class PosedInstances {
  readonly mesh: THREE.InstancedMesh;
  readonly capacity: number;
  private readonly anim: THREE.InstancedBufferAttribute;
  private readonly anim2: THREE.InstancedBufferAttribute | null;
  private readonly m = new THREE.Matrix4(); private readonly q = new THREE.Quaternion(); private readonly e = new THREE.Euler();
  private readonly p = new THREE.Vector3(); private readonly s = new THREE.Vector3();
  private n = 0;

  /** `capacity` instances of the packed `src` (authored geometry) drawn in `material` (the shard's posed look) */
  constructor(capacity: number, name: string, material: THREE.Material, src: () => THREE.BufferGeometry, readonly channels: readonly [string, string?]) {
    if (!Number.isInteger(capacity) || capacity < 1 || capacity > 4096 || channels.some(channel => channel !== undefined && !/^[a-zA-Z_][a-zA-Z0-9_]*$/u.test(channel)) || channels[0] === channels[1]) throw new Error('Invalid posed instance capacity or channels');
    this.capacity = capacity;
    this.anim = new THREE.InstancedBufferAttribute(new Float32Array(capacity * 4), 4); this.anim.setUsage(THREE.DynamicDrawUsage);
    this.anim2 = channels[1] === undefined ? null : new THREE.InstancedBufferAttribute(new Float32Array(capacity * 4), 4); this.anim2?.setUsage(THREE.DynamicDrawUsage);
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
    geo.setAttribute(this.channels[0], this.anim);
    if (this.anim2 !== null && this.channels[1] !== undefined) geo.setAttribute(this.channels[1], this.anim2);
    if (bound) geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e5);
    return geo;
  }

  /** vertices in the shared geometry */
  get vertexCount(): number { return this.mesh.geometry.getAttribute('position').count; }

  /** start a frame: no instance drawn until `add`ed */
  begin(): void { this.n = 0; }
  /** draw one instance this frame at (x, y, z), turned by (−pitch, yaw, roll) in YXZ order, scaled; (a0..a3) → the first channel,
   *  (b0..b3) → the optional second channel (the live instances are packed at the front: nothing parked costs a vertex) */
  add(x: number, y: number, z: number, pitch: number, yaw: number, roll: number, scale: number, a0: number, a1: number, a2: number, a3: number, b0 = 0, b1 = 0, b2 = 0, b3 = 0): void {
    if (this.n >= this.capacity) return;
    const i = this.n++;
    this.e.set(-pitch, yaw, roll, 'YXZ');
    this.q.setFromEuler(this.e);
    this.m.compose(this.p.set(x, y, z), this.q, this.s.setScalar(scale));
    this.mesh.setMatrixAt(i, this.m);
    const a = this.anim.array, b = this.anim2?.array, k = i * 4;
    a[k] = a0; a[k + 1] = a1; a[k + 2] = a2; a[k + 3] = a3;
    if (b !== undefined) { b[k] = b0; b[k + 1] = b1; b[k + 2] = b2; b[k + 3] = b3; }
  }
  /** draw exactly the instances added since `begin` */
  commit(): void { this.mesh.count = this.n; this.mesh.instanceMatrix.needsUpdate = true; this.anim.needsUpdate = true; if (this.anim2 !== null) this.anim2.needsUpdate = true; }
}
