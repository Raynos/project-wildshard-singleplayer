import * as THREE from 'three';
import { PATCH_ORDER, patchShader } from '@wildshard/engine/render/shaderPatches';
import { attachFogUniforms } from '@wildshard/engine/world/Atmosphere';
import type { SkyRig as Sky } from '@wildshard/engine/world/skyRig';
import type { Renderer } from '@wildshard/engine/render/renderer';
import { editShader, type ShaderEditRow } from './shaderEdits';

/**
 * Posed instances (SHARD-PLATFORM M3, moved from Pine Hollow's models/wildlife.ts): several small posable models (birds,
 * a hare…) packed into ONE geometry and drawn as ONE instanced mesh — one draw call, one program. Each instance draws only
 * its own model (the shard's vertex shader collapses the others' vertices to a point) and moves that model's parts from
 * two per-instance vec4s (`aAnim`, `aAnim2`). The packing, the instance buffers, the material and the per-frame packing of
 * the live instances are here; the parts' motion, what the packed scalars mean and the fragment look are the shard's
 * shader edit rows (its `data/`).
 *
 * Per vertex: position, normal, colour, the part's pivot (`aPivot`) and two packed vec4s, `aInfo` and `aTexV` (WebGL's 16
 * attribute slots: the instance matrix takes four). Two uniforms are bound before the first compile: a glow scalar and an
 * atlas sampler (a white texel until `useAtlas`). The mesh casts no shadow and receives them; it is never frustum culled.
 *
 *   const posed = new PosedInstances(sky, 24, LOOK, packer.geometry());
 *   scene.add(posed.mesh);
 *   posed.begin(); posed.add(x, y, z, pitch, yaw, roll, scale, a0, a1, a2, a3, b0, b1, b2, b3); posed.commit();
 */

/** One model's packed blocks: position, normal, colour, pivot (3 a vertex), info, atlas (4 a vertex) and its local triangles. */
export interface PosedBlock {
  readonly pos: ArrayLike<number> & Iterable<number>;
  readonly nor: ArrayLike<number> & Iterable<number>;
  readonly col: ArrayLike<number> & Iterable<number>;
  readonly pivot: ArrayLike<number> & Iterable<number>;
  readonly info: ArrayLike<number> & Iterable<number>;
  readonly tex: ArrayLike<number> & Iterable<number>;
  readonly idx: Iterable<number>;
}

/** The shared geometry's arrays, filled block by block (or vertex by vertex) in draw order. */
export class PosedPacker {
  readonly pos: number[] = []; readonly nor: number[] = []; readonly col: number[] = []; readonly pivot: number[] = [];
  readonly info: number[] = []; readonly tex: number[] = []; readonly idx: number[] = [];
  /** append a model's blocks, its triangles offset past the vertices already packed */
  block(s: PosedBlock): void {
    const base = this.pos.length / 3;
    this.pos.push(...s.pos); this.nor.push(...s.nor); this.col.push(...s.col); this.pivot.push(...s.pivot); this.info.push(...s.info); this.tex.push(...s.tex);
    for (const i of s.idx) this.idx.push(base + i);
  }
  /** one vertex: its place, normal, colour, the part's pivot, its info vec4 and its atlas vec4 */
  vert(p: readonly [number, number, number], n: readonly [number, number, number], c: THREE.Color, pivot: readonly [number, number, number], info: readonly [number, number, number, number], tex: readonly [number, number, number, number]): void {
    this.pos.push(p[0], p[1], p[2]); this.nor.push(n[0], n[1], n[2]); this.col.push(c.r, c.g, c.b); this.pivot.push(pivot[0], pivot[1], pivot[2]);
    this.info.push(...info); this.tex.push(...tex);
  }
  /** the packed geometry (position, normal, color, aPivot, aInfo, aTexV, the index) */
  geometry(): THREE.BufferGeometry {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    g.setAttribute('aPivot', new THREE.Float32BufferAttribute(this.pivot, 3));
    g.setAttribute('aInfo', new THREE.BufferAttribute(new Float32Array(this.info), 4));
    g.setAttribute('aTexV', new THREE.BufferAttribute(new Float32Array(this.tex), 4));
    g.setIndex(this.idx);
    return g;
  }
}

/** A posed-instances look as data: the mesh's name, its shader patch's id and program key, the material and the edits. */
export interface PosedInstancesLook {
  readonly name: string;
  /** the `patchShader` id and program cache key */
  readonly patch: string;
  readonly key: string;
  readonly roughness: number;
  readonly metalness: number;
  readonly doubleSide: boolean;
  /** the uniforms bound for the glow scalar and the atlas sampler */
  readonly glowUniform: string;
  readonly atlasUniform: string;
  /** the shard's GLSL: the part motion and the collapse in the vertex stage, the look in the fragment stage */
  readonly edits: readonly ShaderEditRow[];
}

const ZERO = new THREE.Matrix4().makeScale(0, 0, 0);

/** One instanced mesh of posable packed models (see the module comment). */
export class PosedInstances {
  readonly mesh: THREE.InstancedMesh;
  readonly capacity: number;
  /** the glow scalar's uniform value (e.g. an owl's eye-shine, 0 by day → 1 at night) */
  readonly glow = { value: 0 };
  private readonly anim: THREE.InstancedBufferAttribute;
  private readonly anim2: THREE.InstancedBufferAttribute;
  private readonly atlas: { value: THREE.Texture };
  private readonly m = new THREE.Matrix4(); private readonly q = new THREE.Quaternion(); private readonly e = new THREE.Euler();
  private readonly p = new THREE.Vector3(); private readonly s = new THREE.Vector3();
  private n = 0;

  /** `capacity` instances of the packed `src` (a `PosedPacker` geometry) drawn with `look` */
  constructor(sky: Sky, capacity: number, look: PosedInstancesLook, src: () => THREE.BufferGeometry) {
    this.capacity = capacity;
    this.anim = new THREE.InstancedBufferAttribute(new Float32Array(capacity * 4), 4); this.anim.setUsage(THREE.DynamicDrawUsage);
    this.anim2 = new THREE.InstancedBufferAttribute(new Float32Array(capacity * 4), 4); this.anim2.setUsage(THREE.DynamicDrawUsage);
    const geo = this.wrap(src(), true);
    const white = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1);
    white.colorSpace = THREE.SRGBColorSpace; white.needsUpdate = true;
    this.atlas = { value: white };

    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: look.roughness, metalness: look.metalness, side: look.doubleSide ? THREE.DoubleSide : THREE.FrontSide });
    const glow = this.glow, atlas = this.atlas;
    patchShader(mat, look.patch, PATCH_ORDER.material, (shader) => {
      attachFogUniforms(shader);
      shader.uniforms[look.glowUniform] = glow;
      shader.uniforms[look.atlasUniform] = atlas;
      editShader(shader, look.edits);
    }, { mode: 'replace', key: look.key });
    sky.setupMaterial(mat);
    this.mesh = new THREE.InstancedMesh(geo, mat, capacity);
    this.mesh.name = look.name;
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

  /** draw a new packed geometry (the old one disposed) */
  setGeometry(src: THREE.BufferGeometry): void {
    const old = this.mesh.geometry;
    this.mesh.geometry = this.wrap(src, true);
    old.dispose();
  }

  /** bind `tex` to the atlas sampler that was there from the start (uploaded now, not on the first frame that draws it) */
  useAtlas(tex: THREE.Texture, renderer: Renderer): void {
    this.atlas.value = tex;
    renderer.initTexture(tex);
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
