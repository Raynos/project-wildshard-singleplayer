/**
 * The client-script view adapter (SHARD-PLATFORM SF25, the render side; G66 "frozen, but alive-looking"). sp-x5's
 * `ClientScriptLane` runs presentation-only AssemblyScript and hands back detached frames (`offset`, `rotation`,
 * `scale`, particle requests); this adapter is the only thing that turns them into pixels:
 *
 * - **pose on top of the pose**: each frame, after the views have written their own pose (a creature view's sim sync,
 *   a placed panel), `apply` composes the script's offset (in the target's own frame), rotation and scale on top of it;
 *   `restore` puts the exact base back before the next sim sync, so a live entity's sim pose is never replaced and a
 *   static one never drifts. A frame is eased in over a few render frames (the lane ticks at 60 / divisor Hz).
 * - **particles**: every emitter's requests spawn into one pooled `THREE.Points` draw (the engine's `ParticlePool`),
 *   sized to the declared live limits (never above the lane's global ceiling), so the cost is one draw whatever the count.
 *   Their look (colour, size, velocity, gravity) is the emitter's numeric recipe; lifetimes are the lane's.
 * - **scope-owned**: disposal restores every base pose and frees the pool's geometry and material.
 *
 * The adapter never reads or writes a simulation: it sees the lane's copies and the view objects only.
 */
import { AdditiveBlending, Euler, PerspectiveCamera, Quaternion, ShaderMaterial, Vector3, type Object3D } from 'three';
import type { Scope } from '@wildshard/engine/app/scope';
import { ParticlePool, pointScale } from '@wildshard/engine/fx/ParticlePool';
import { CLIENT_SCRIPT_LIMITS, type ClientScriptFrame } from '@wildshard/engine/script/client';

type Vec3 = readonly [number, number, number];
/** The part of a client lane the adapter reads: detached frames, nothing else. */
export interface ClientScriptFrames { readonly frames: () => readonly ClientScriptFrame[] }
/** One admitted emitter's numeric look (sp-x5's `platform.particles` recipe) and its declared live limit. */
export interface ClientScriptEmitterLook { readonly id: number; readonly live: number; readonly colour: Vec3; readonly size: number; readonly velocity: Vec3; readonly gravity: number }
/** One bound visual: the view object a pose composes onto (null: particles only) and where its particles start. */
export interface ClientScriptViewTarget {
  readonly entity: number;
  readonly object: Object3D | null;
  /** the particle origin in the adapter root's space */
  readonly anchor: (out: Vector3) => Vector3;
  readonly emitters: readonly ClientScriptEmitterLook[];
}
/** The adapter's readout (tests, the debug panel). */
export interface ClientScriptViewState { readonly targets: number; readonly posed: number; readonly particles: number; readonly capacity: number; readonly tick: number }

const VERTEX = /* glsl */ `
attribute vec3 aColour; attribute float aSize; attribute float aAlpha;
uniform float uScale; varying vec3 vColour; varying float vAlpha;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = aSize * uScale / max(0.1, -mv.z);
  vColour = aColour; vAlpha = aAlpha;
}`;
const FRAGMENT = /* glsl */ `
varying vec3 vColour; varying float vAlpha;
void main() {
  vec2 p = gl_PointCoord * 2.0 - 1.0; float d = dot(p, p);
  if (d > 1.0 || vAlpha <= 0.0) discard;
  gl_FragColor = vec4(vColour, vAlpha * (1.0 - d));
}`;
const PARK_Y = -10_000;

interface Posed { readonly target: ClientScriptViewTarget; readonly object: Object3D; readonly base: { p: Vector3; q: Quaternion; s: Vector3 }; saved: boolean;
  /** the eased pose being drawn */ readonly offset: Vector3; readonly rotation: Vector3; readonly scale: Vector3 }

/** a deterministic jitter in [-1, 1] from integers (no clock, no Math.random) */
function jitter(a: number, b: number, c: number): number {
  let h = Math.imul(a ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(b + 0x632be5ab, 0xc2b2ae35) ^ Math.imul(c + 0x27d4eb2f, 0x165667b1);
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d); h ^= h >>> 12;
  return ((h >>> 0) / 0xffffffff) * 2 - 1;
}

/** Applies one client lane's frames to its bound views and particles; disposed with `scope`. */
export class ClientScriptViews {
  private readonly lane: ClientScriptFrames;
  private readonly targets: ReadonlyMap<number, ClientScriptViewTarget>;
  private readonly posed: readonly Posed[];
  private readonly pool: ParticlePool<'aColour' | 'aSize' | 'aAlpha'> | null;
  private readonly lifetimes: Float32Array;
  private readonly gravity: Float32Array;
  private readonly material: ShaderMaterial | null;
  private seen = -1;
  private alive = 0;
  private disposed = false;
  private readonly _v = new Vector3();
  private readonly _q = new Quaternion();
  private readonly _e = new Euler();

  constructor(lane: ClientScriptFrames, targets: readonly ClientScriptViewTarget[], ports: { root: Object3D; scope: Scope }) {
    this.lane = lane;
    this.targets = new Map(targets.map((t) => [t.entity, t]));
    if (this.targets.size !== targets.length) throw new Error('client script views: one view per bound entity');
    this.posed = targets.flatMap((target): Posed[] => target.object === null ? [] : [{ target, object: target.object, saved: false,
      base: { p: new Vector3(), q: new Quaternion(), s: new Vector3(1, 1, 1) }, offset: new Vector3(), rotation: new Vector3(), scale: new Vector3(1, 1, 1) }]);
    const capacity = Math.min(CLIENT_SCRIPT_LIMITS.particlesLive, targets.reduce((n, t) => n + t.emitters.reduce((m, e) => m + e.live, 0), 0));
    this.lifetimes = new Float32Array(capacity); this.gravity = new Float32Array(capacity);
    if (capacity > 0) {
      const material = new ShaderMaterial({ vertexShader: VERTEX, fragmentShader: FRAGMENT, uniforms: { uScale: { value: 600 } }, transparent: true, depthWrite: false, blending: AdditiveBlending });
      const pool = new ParticlePool({ capacity, material, renderOrder: 6, parkY: PARK_Y,
        attributes: { aColour: { itemSize: 3, dynamic: true }, aSize: { itemSize: 1, dynamic: true }, aAlpha: { itemSize: 1, dynamic: true } } });
      pool.points.name = 'client-script-particles';
      const scale = material.uniforms['uScale'];
      pool.points.onBeforeRender = (renderer, _scene, camera) => { if (scale !== undefined && camera instanceof PerspectiveCamera) scale.value = pointScale(renderer, camera); };
      ports.root.add(pool.points);
      this.pool = pool; this.material = material;
    } else { this.pool = null; this.material = null; }
    ports.scope.onDispose(() => { this.dispose(); });
  }

  /** Put every composed view back to the base it had before `apply` (run before the views write their own pose). */
  restore(): void {
    for (const p of this.posed) {
      if (!p.saved) continue;
      p.object.position.copy(p.base.p); p.object.quaternion.copy(p.base.q); p.object.scale.copy(p.base.s); p.saved = false;
    }
  }

  /** Compose the latest frames onto the views and advance the particles by `dt` seconds (run after the views' own pose). */
  apply(dt: number): void {
    if (this.disposed) return;
    this.restore();
    const frames = this.lane.frames(), ease = 1 - Math.exp(-Math.max(0, dt) * 14);
    const byEntity = new Map(frames.map((f) => [f.entity, f]));
    for (const p of this.posed) {
      const frame = byEntity.get(p.target.entity), o = p.object;
      if (frame !== undefined) {
        p.offset.lerp(this._v.fromArray(frame.offset), ease); p.rotation.lerp(this._v.fromArray(frame.rotation), ease); p.scale.lerp(this._v.fromArray(frame.scale), ease);
      }
      p.base.p.copy(o.position); p.base.q.copy(o.quaternion); p.base.s.copy(o.scale); p.saved = true;
      o.position.add(this._v.copy(p.offset).applyQuaternion(p.base.q));
      o.quaternion.multiply(this._q.setFromEuler(this._e.set(p.rotation.x, p.rotation.y, p.rotation.z, 'YXZ')));
      o.scale.multiply(p.scale);
    }
    const tick = frames[0]?.tick ?? -1;
    if (tick > this.seen) { this.seen = tick; for (const frame of frames) this.emit(frame); }
    this.particles(dt);
  }

  private emit(frame: ClientScriptFrame): void {
    const pool = this.pool, target = this.targets.get(frame.entity);
    if (pool === null || target === undefined) return;
    for (const request of frame.particles) {
      const look = target.emitters.find((e) => e.id === request.emitter); if (look === undefined) continue;
      const at = target.anchor(this._v);
      for (let k = 0; k < request.count; k++) {
        const i = pool.claim(), j = (n: number): number => jitter(frame.tick, frame.entity * 31 + k, n);
        if (this.lifetimes[i] === undefined) continue;
        if ((this.lifetimes[i] ?? 0) <= 0) this.alive++;
        pool.place(i, { x: at.x + j(1) * 0.15, y: at.y + j(2) * 0.08, z: at.z + j(3) * 0.15 });
        pool.vel[i * 3] = look.velocity[0] * (1 + j(4) * 0.25) + j(5) * 0.1; pool.vel[i * 3 + 1] = look.velocity[1] * (1 + j(6) * 0.25); pool.vel[i * 3 + 2] = look.velocity[2] * (1 + j(7) * 0.25) + j(8) * 0.1;
        pool.life[i] = request.lifetimeTicks / 60; this.lifetimes[i] = request.lifetimeTicks / 60; this.gravity[i] = look.gravity;
        pool.data.aColour.set(look.colour, i * 3); pool.data.aSize[i] = look.size; pool.data.aAlpha[i] = 1;
      }
    }
  }

  private particles(dt: number): void {
    const pool = this.pool; if (pool === null || this.alive === 0) return;
    const { pos, vel, life } = pool, alpha = pool.data.aAlpha;
    for (let i = 0; i < pool.capacity; i++) {
      const total = this.lifetimes[i] ?? 0; if (total <= 0) continue;
      const left = (life[i] ?? 0) - dt;
      if (left <= 0) { life[i] = 0; this.lifetimes[i] = 0; alpha[i] = 0; pos[i * 3 + 1] = PARK_Y; this.alive--; continue; }
      life[i] = left;
      vel[i * 3 + 1] = (vel[i * 3 + 1] ?? 0) + (this.gravity[i] ?? 0) * dt;
      pos[i * 3] = (pos[i * 3] ?? 0) + (vel[i * 3] ?? 0) * dt; pos[i * 3 + 1] = (pos[i * 3 + 1] ?? 0) + (vel[i * 3 + 1] ?? 0) * dt; pos[i * 3 + 2] = (pos[i * 3 + 2] ?? 0) + (vel[i * 3 + 2] ?? 0) * dt;
      const u = left / total; alpha[i] = Math.min(1, u * 3) * Math.min(1, (1 - u) * 6 + 0.2);
    }
    pool.posAttr.needsUpdate = true; pool.attr.aColour.needsUpdate = true; pool.attr.aSize.needsUpdate = true; pool.attr.aAlpha.needsUpdate = true;
  }

  state(): ClientScriptViewState {
    return { targets: this.targets.size, posed: this.posed.length, particles: this.alive, capacity: this.pool?.capacity ?? 0, tick: this.seen };
  }

  /** Restore every base pose and free the particle draw; further `apply` calls draw nothing. */
  dispose(): void {
    if (this.disposed) return;
    this.restore(); this.disposed = true;
    const pool = this.pool;
    if (pool !== null) { pool.points.removeFromParent(); pool.points.geometry.dispose(); }
    this.material?.dispose();
  }
}

/** Run the adapter in the page's frame: restore at input (before the views' sim sync), compose at late. */
export function driveClientScriptViews(views: ClientScriptViews, ports: { system: (spec: { id: string; phase: 'input' | 'late'; run: (dt: number) => void }) => void; id: string }): void {
  ports.system({ id: `${ports.id}.restore`, phase: 'input', run: () => { views.restore(); } });
  ports.system({ id: `${ports.id}.apply`, phase: 'late', run: (dt) => { views.apply(dt); } });
}
