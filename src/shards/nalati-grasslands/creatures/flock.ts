import { GroupBrain } from '@wildshard/engine/ai/GroupBrain';
import { app } from '@wildshard/engine/app/runtime';
import { TIER } from '@wildshard/engine/core/tier';
import type { Animal } from '@wildshard/engine/entities/AnimalView';
import { PATCH_ORDER, patchShader } from '@wildshard/engine/render/shaderPatches';
import { attachFogUniforms } from '@wildshard/engine/world/Atmosphere';
import type { SkyRig as Sky } from '@wildshard/engine/world/skyRig';
import * as THREE from 'three';
import type { PackPrey } from '../runtime/groupRegistry';
import { productRiggedHulls, type RiggedHullAsset } from '@wildshard/sdk/looks/riggedHulls';

import { painterlyAnimalMaterial } from '../look/creatureMaterial';
import type { ReturnProgram } from '@wildshard/game/population/returnProgram';
import { setDogFlock } from '../species/sheepdog';


/**
 * Flock — the camp's sheep (docs/design/nalati/wolves-horses-taming.md "Sheep"): 20–60 fat-tailed sheep as ONE
 * InstancedMesh (one draw, one shadow draw) whose legs, head and death roll are animated in the vertex shader from a
 * per-instance `iAnim` (gait phase, ground speed, graze, dead). The declared FlockBrain owns flock decisions and motion; this class only presents its live poses.
 *
 *   const flock = new Flock(sky, { x, z, count: 36, seed }, body, policy).build();  scene.add(flock.mesh)
 *   flock.project(t)          wolves: the living wolves (Animal[]) near it
 *   flock.dog = sheepdog                                                 the collie that herds it (species/sheepdog.ts)
 *   flock.raycast(origin, dir, maxDist) → index | -1 ;  flock.kill(i)    arrows: a sheep drops (the camp's property —
 *                                                                        the design's penalty is the caller's)
 *   flock.onSound = (name, x, z) => …                                   'sheep_bleat' (ambient, panicked), 'dog_bark'
 *   flock.positions(i, out)                                              world position of sheep i
 *   flock.prey(i) / flock.nearest(x, z)                                  B1: sheep i as a wolf pack's prey (Pack.raid —
 *                                                                        src/shards/nalati-grasslands/creatures/sheepRaid.ts); the living sheep nearest (x, z)
 *
 * Behaviour: grazing head-down with the odd shuffle; the flock drifts across its pasture (a new spot every 60–90 s,
 * within `range` m of home); a sheep > 12 m out is a straggler (the dog fetches it); a wolf within 30 m or the player
 * sprinting within 10 m / walking within 4 m panics them — they bunch and run (4.5 m/s), bleating; sheep step out of
 * the dog's way toward the flock.
 */

export interface FlockBody { readonly geometry: THREE.BufferGeometry; readonly pivots: readonly (readonly [number, number, number])[]; readonly parts: readonly string[] }

export interface FlockOpts { x: number; z: number; count: number; seed: number; /** m the flock may wander from home (default 45) */ range?: number }

/** Native renderer inputs; the declared owner supplies all decisions and randomness. */
export interface SheepPose {
  x: number; y: number; z: number; yaw: number; speed: number; phase: number; graze: number;
  dead: boolean; deathTime: number; scale: number; wool: number;
}
/** G51 structural view/prey port; no engine policy subclass or second scheduler executes when installed. */
export interface FlockController {
  readonly n: number; readonly alive: number; readonly cx: number; readonly cz: number; readonly panicking: boolean;
  readPose: (index: number, out: SheepPose) => SheepPose;
  kill: (index: number) => void; scare: (x: number, z: number, seconds: number) => void;
  straggler: (minimum?: number) => number; nearest: (x: number, z: number) => number;
}
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _p = new THREE.Vector3(), _y = new THREE.Vector3(0, 1, 0);
const flockOfDog = new WeakMap<Animal, Flock>();
const smooth = (t: number): number => t * t * (3 - 2 * t);
/** the wolves the sheepdog watches for (Wildlife keeps it current) */
export const dogWolves: Animal[] = [];

/** B1: one sheep as a wolf pack's prey (Pack.raid): its position and heading read live off the flock, a bite kills it */
export class SheepPrey implements PackPrey {
  private readonly p = new THREE.Vector3();
  constructor(readonly flock: Flock, readonly index: number) {}
  get position(): THREE.Vector3 { return this.flock.positions(this.index, this.p); }
  get yaw(): number { return this.flock.headingOf(this.index); }
  get alive(): boolean { return this.flock.isAlive(this.index); }
  readonly applyDamage = (): boolean => { this.flock.kill(this.index); return true; };
}
export class Flock extends GroupBrain<SheepPrey> {
  mesh!: THREE.InstancedMesh;
  readonly n: number;
  dog: Animal | null = null;
  onSound?: ((name: string, x: number, z: number) => void) | undefined;
  cx: number; cz: number;
  private readonly homeX: number; private readonly homeZ: number;
  private px: Float32Array; private pz: Float32Array; private py: Float32Array;
  private yaw: Float32Array; private spd: Float32Array;
  private phase: Float32Array; private graze: Float32Array; private dead: Uint8Array; private deadT: Float32Array;
  private scale: Float32Array;
  private anim!: THREE.InstancedBufferAttribute;
  private uTime = { value: 0 };
  /** living sheep */
  alive: number;

  constructor(private readonly sky: Sky, opts: FlockOpts, private readonly body: FlockBody, private readonly controller: FlockController) {
    super([]);
    if (controller.n !== opts.count) throw new Error('Flock view roster mismatch');
    this.n = opts.count; this.alive = opts.count;
    this.cx = opts.x; this.cz = opts.z;
    this.homeX = opts.x; this.homeZ = opts.z;
    const n = this.n;
    for (let i = 0; i < n; i++) this.members.push(new SheepPrey(this, i));
    this.px = new Float32Array(n); this.pz = new Float32Array(n); this.py = new Float32Array(n);
    this.yaw = new Float32Array(n); this.spd = new Float32Array(n);
    this.phase = new Float32Array(n); this.graze = new Float32Array(n); this.dead = new Uint8Array(n); this.deadT = new Float32Array(n);
    this.scale = new Float32Array(n);
  }

  static ofDog(dog: Animal): Flock | null { return flockOfDog.get(dog) ?? null; }
  /** make `dog` this flock's sheepdog */
  setDog(dog: Animal, author: ReturnProgram): void {
    this.dog = dog; flockOfDog.set(dog, this);
    // the dog's brain (species/sheepdog.ts, the host's too) reads this flock, the living wolves and the app's 'ai' stream
    setDogFlock(dog, { flock: this, wolves: dogWolves, rng: app.rng.stream('ai'), bark: (x, z) => { this.onSound?.('dog_bark', x, z); } }, author);
  }

  build(): this {
    const geo = this.body.geometry.clone();
    // the shared painterly material + the flock's vertex animation: a sibling program ('…|nalati-sheep'), the one
    // exception to painterly's "no onBeforeCompile" rule — 40 GPU-animated sheep for one draw are worth one program
    const mat = painterlyAnimalMaterial(this.sky);
    patchSheep(mat, this.uTime, false, this.body.pivots);
    const mesh = new THREE.InstancedMesh(geo, mat, this.n);
    const depth = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking });
    patchSheep(depth, this.uTime, true, this.body.pivots);
    mesh.customDepthMaterial = depth;
    // the phone's shadow map skips the flock (40 sheep ≈ 0.1 M tris a frame into it); desktop casts
    mesh.castShadow = TIER !== 'phone'; mesh.receiveShadow = true;
    mesh.name = 'sheep-flock';
    this.anim = new THREE.InstancedBufferAttribute(new Float32Array(this.n * 4), 4);
    this.anim.setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('iAnim', this.anim);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    // wool colours: mostly cream, some fawn, brown and a few near-black (sheep-1 mockup)
    const wool = [new THREE.Color(1, 1, 1), new THREE.Color(0.86, 0.74, 0.58), new THREE.Color(0.52, 0.36, 0.26), new THREE.Color(0.30, 0.22, 0.18)];
    this.project();
    for (let i = 0; i < this.n; i++) {
      const pose = this.controller.readPose(i, this.pose);
      mesh.setColorAt(i, wool[pose.wool] ?? new THREE.Color(1, 1, 1));
    }
    if (mesh.instanceColor !== null) mesh.instanceColor.needsUpdate = true;
    mesh.frustumCulled = true;
    mesh.boundingSphere = new THREE.Sphere(new THREE.Vector3(this.homeX, this.py[0] ?? 0, this.homeZ), 30);
    this.mesh = mesh;
    this.writeInstances();
    // Debug ▸ Creatures = Models (the default): the generated sheep, baked onto the flock's parts (scripts/nalati-rig-bake.mjs), swapped in when
    // it loads — the procedural flock stands in until then
    productRiggedHulls('nalati-grasslands').load('sheep').then((rig) => { this.useRig(rig, mat); return null; }).catch((cause: unknown) => { throw new Error('Nalati sheep rig failed', { cause }); });
    return this;
  }

  /** the flock's geometry from a baked rig: its skin folded into aRig (the two strongest parts), the atlas as the map */
  private useRig(rig: RiggedHullAsset, mat: THREE.MeshLambertMaterial): void {
    if (rig.joints.length !== this.body.parts.length || rig.joints.some((j, i) => j.name !== this.body.parts[i])) { console.warn('[nalati] sheep rig: not the flock parts'); return; }
    const src = rig.geometry, si = src.getAttribute('skinIndex'), sw = src.getAttribute('skinWeight'), n = si.count;
    const aRig = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      let a = 0, wa = -1, b = 0, wb = -1;
      for (let c = 0; c < 4; c++) {
        const w = sw.getComponent(i, c), k = si.getComponent(i, c);
        if (w > wa) { b = a; wb = wa; a = k; wa = w; } else if (w > wb) { b = k; wb = w; }
      }
      const t = wa + Math.max(0, wb);
      aRig[i * 3] = a; aRig[i * 3 + 1] = wb > 0 ? b : a; aRig[i * 3 + 2] = t > 0 && wb > 0 ? wb / t : 0;
    }
    const g = new THREE.BufferGeometry();
    for (const k of ['position', 'normal', 'uv', 'color'] as const) g.setAttribute(k, src.getAttribute(k));
    g.setAttribute('aRig', new THREE.BufferAttribute(aRig, 3));
    g.setAttribute('iAnim', this.anim);
    const index = src.getIndex();
    if (index) g.setIndex(index);
    g.computeBoundingSphere();
    const old = this.mesh.geometry;
    this.mesh.geometry = g;
    old.dispose();
    mat.map = rig.map; mat.needsUpdate = true;
  }

  positions(i: number, out: THREE.Vector3): THREE.Vector3 { return out.set(this.px[i] ?? 0, (this.py[i] ?? 0) + 0.6, this.pz[i] ?? 0); }
  /** sheep i's heading (animal yaw) and whether it lives */
  headingOf(i: number): number { return this.yaw[i] ?? 0; }
  isAlive(i: number): boolean { return i >= 0 && i < this.n && this.dead[i] === 0; }
  /** B1: sheep i as a wolf pack's prey (Pack.raid): live position / heading, a bite kills it */
  prey(i: number): SheepPrey { return new SheepPrey(this, i); }
  /** the living sheep nearest (x, z) — the one a raid from that side reaches first — or -1 */
  nearest(x: number, z: number): number { return this.controller.nearest(x, z); }

  /** the sheep index a ray hits (a 0.42 m body sphere + a 0.14 m head sphere per sheep), or -1 */
  raycast(o: THREE.Vector3, d: THREE.Vector3, maxDist: number): number {
    let best = maxDist, bi = -1;
    for (let i = 0; i < this.n; i++) {
      if (this.dead[i] === 1) continue;
      const s = this.scale[i] ?? 1, yw = this.yaw[i] ?? 0;
      for (const [off, up, r] of [[0, 0.6, 0.36], [0.62, 0.66, 0.14]] as const) {
        _p.set((this.px[i] ?? 0) + Math.sin(yw) * off * s, (this.py[i] ?? 0) + up * s, (this.pz[i] ?? 0) + Math.cos(yw) * off * s);
        const t = raySphere(o, d, _p, r * s);
        if (t >= 0 && t < best) { best = t; bi = i; }
      }
    }
    return bi;
  }

  /** The declared flock owns deaths, panic and straggler decisions. */
  kill(i: number): void { this.controller.kill(i); this.project(); }
  scare(x: number, z: number, secs: number): void { this.controller.scare(x, z, secs); }
  straggler(minD = 12): number { return this.controller.straggler(minD); }
  get panicking(): boolean { return this.controller.panicking; }

  private readonly pose: SheepPose = { x: 0, y: 0, z: 0, yaw: 0, speed: 0, phase: 0, graze: 0, dead: false, deathTime: 0, scale: 1, wool: 0 };
  /** Copy pose inputs into the existing material/rig recipe; paused bodies preserve shader time and upload state. */
  project(time?: number): void {
    const controller = this.controller;
    this.cx = controller.cx; this.cz = controller.cz; this.alive = controller.alive;
    for (let i = 0; i < this.n; i++) {
      const pose = controller.readPose(i, this.pose);
      this.px[i] = pose.x; this.py[i] = pose.y; this.pz[i] = pose.z; this.yaw[i] = pose.yaw;
      this.spd[i] = pose.speed; this.phase[i] = pose.phase; this.graze[i] = pose.graze;
      this.dead[i] = pose.dead ? 1 : 0; this.deadT[i] = pose.deathTime; this.scale[i] = pose.scale;
    }
    if (time !== undefined) { this.uTime.value = time; this.writeInstances(); }
  }

  private writeInstances(): void {
    const a = this.anim.array as Float32Array;
    for (let i = 0; i < this.n; i++) {
      const s = this.scale[i] ?? 1;
      _q.setFromAxisAngle(_y, this.yaw[i] ?? 0);
      _p.set(this.px[i] ?? 0, (this.py[i] ?? 0) - 0.02, this.pz[i] ?? 0);
      _s.set(s, s, s);
      this.mesh.setMatrixAt(i, _m.compose(_p, _q, _s));
      a[i * 4] = this.phase[i] ?? 0;
      a[i * 4 + 1] = this.spd[i] ?? 0;
      a[i * 4 + 2] = this.graze[i] ?? 0;
      a[i * 4 + 3] = this.dead[i] === 1 ? smooth(this.deadT[i] ?? 0) : 0;
    }
    this.mesh.instanceMatrix.needsUpdate = true;
    this.anim.needsUpdate = true;
  }
}

function raySphere(o: THREE.Vector3, d: THREE.Vector3, c: THREE.Vector3, r: number): number {
  const ox = o.x - c.x, oy = o.y - c.y, oz = o.z - c.z;
  const b = ox * d.x + oy * d.y + oz * d.z, cc = ox * ox + oy * oy + oz * oz - r * r;
  const disc = b * b - cc;
  if (disc < 0) return -1;
  const t = -b - Math.sqrt(disc);
  return t >= 0 ? t : cc < 0 ? 0 : -1;
}

/**
 * The flock's vertex animation, patched into the (painterly) material and the shadow depth material: each vertex
 * swings about its part's pivot (aRig: part a, part b, weight of b) by an angle from the instance's iAnim.
 */
function patchSheep(mat: THREE.Material, uTime: { value: number }, depthOnly: boolean, pivots: FlockBody['pivots']): void {
  const piv = pivots.map((p) => `vec3(${p[0].toFixed(3)}, ${p[1].toFixed(3)}, ${p[2].toFixed(3)})`).join(', ');
  patchShader(mat, depthOnly ? 'nalati.sheep-depth' : 'nalati.sheep', PATCH_ORDER.decorate, (shader) => {
    attachFogUniforms(shader);
    shader.uniforms['uSheepTime'] = uTime;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>
        attribute vec3 aRig;
        attribute vec4 iAnim;
        uniform float uSheepTime;
        const vec3 SHEEP_PIV[7] = vec3[7](${piv});
        float sheepAngle(float b, vec4 an, float seed) {
          float walk = min(an.y * 0.34, 0.62);
          if (b < 0.5) return 0.0;
          if (b < 1.5) return an.z * (1.35 + 0.07 * sin(uSheepTime * 5.0 + seed * 3.7)) - walk * 0.12 * sin(an.x * 12.566);
          if (b < 5.5) {
            float off = b < 2.5 ? 0.25 : (b < 3.5 ? 0.75 : (b < 4.5 ? 0.0 : 0.5));
            return sin((an.x + off) * 6.2832) * walk * (b < 3.5 ? 1.0 : 0.85);
          }
          return 0.08 * sin(an.x * 12.566) * walk;
        }
        vec3 sheepRot(vec3 q, float ang) { float c = cos(ang), s = sin(ang); return vec3(q.x, q.y * c - q.z * s, q.y * s + q.z * c); }
        vec3 sheepPos(vec3 p) {
          float seed = float(gl_InstanceID);
          float b0 = aRig.x, b1 = aRig.y;
          vec3 p0 = SHEEP_PIV[int(b0)] + sheepRot(p - SHEEP_PIV[int(b0)], sheepAngle(b0, iAnim, seed));
          vec3 p1 = SHEEP_PIV[int(b1)] + sheepRot(p - SHEEP_PIV[int(b1)], sheepAngle(b1, iAnim, seed));
          vec3 r = mix(p0, p1, aRig.z);
          r.y += iAnim.y > 0.1 ? 0.018 * min(iAnim.y, 3.0) * abs(sin(iAnim.x * 6.2832)) : 0.004 * sin(uSheepTime * 1.4 + seed);
          // dead: roll onto the left side about a pivot at the flank
          float d = -iAnim.w * 1.5;
          vec3 q = r - vec3(0.3, 0.0, 0.0);
          r = vec3(0.3, 0.0, 0.0) + vec3(q.x * cos(d) - q.y * sin(d), q.x * sin(d) + q.y * cos(d), q.z);
          return r;
        }
        vec3 sheepNrm(vec3 n) {
          float seed = float(gl_InstanceID);
          vec3 n0 = sheepRot(n, sheepAngle(aRig.x, iAnim, seed)), n1 = sheepRot(n, sheepAngle(aRig.y, iAnim, seed));
          vec3 r = normalize(mix(n0, n1, aRig.z));
          float d = -iAnim.w * 1.5;
          return vec3(r.x * cos(d) - r.y * sin(d), r.x * sin(d) + r.y * cos(d), r.z);
        }`)
      .replace('#include <begin_vertex>', 'vec3 transformed = sheepPos( vec3( position ) );');
    if (!depthOnly) shader.vertexShader = shader.vertexShader.replace('#include <beginnormal_vertex>', 'vec3 objectNormal = sheepNrm( vec3( normal ) );');
    // the wool colour (the instance colour) tints only the fleece: with the generated sheep's atlas the dark face and
    // legs stay dark instead of every sheep's face taking the wool (a near-black ewe's face was pitch)
    if (!depthOnly) shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', `#if defined( USE_COLOR ) || defined( USE_INSTANCING_COLOR )
      { float woolL = dot( diffuseColor.rgb, vec3( 0.2126, 0.7152, 0.0722 ) ); diffuseColor.rgb *= mix( vec3( 1.0 ), vColor.rgb, smoothstep( 0.05, 0.18, woolL ) ); }
      #endif`);
  }, { key: (k) => `${k}|nalati-sheep${depthOnly ? '-depth' : ''}` });
}
