// fpArmsRig — a baked first-person arm rig played on two channels with its living parts (SHARD-PLATFORM M3, ex Nine
// Dragon's vm/fpArms.ts). Nothing here knows a shard: the rig's sockets, attach points, cloth colliders, holds and lag are
// a data row (`FpArmsRow`), the meshes' materials and the parts the GLB can't hold (a knot, a halo) are the caller's hooks.
//
// ONE skinned GLB holds both arms (shoulder → upper arm → forearm → hand), the weapon as a rigid child of the weapon
// socket, the off-hand gadget with its claw, any hull proxies and every clip (the shared ARM_CLIPS aliases). The rig plays
// two channels (right: the weapon arm, left: the gadget arm), each a base loop (idle ↔ walk by speed) under one-shot moves
// that CROSSFADE — a move never restarts from a snap — plus the living parts: pendant cloth (stepped against capsules that
// ride the hand) and the brush trail sampled along the blade through a move's windup … slashEnd window.
//
//   const rig = new FpArmsRig(scene, clips, ROW, contract, bake, { mesh, dress });   // a shard wraps it in its own class
//   rig.play('light', 0.1, seed);  rig.playLeft('grapple_aim');
//   every frame: rig.update(dt, { speed, walkPhase?, lookVel, gravity });
import {
  type AnimationAction, type AnimationClip, BufferAttribute, type BufferGeometry, Group, LinearMipmapLinearFilter,
  Matrix4, Mesh, NoColorSpace, type Object3D, type PerspectiveCamera, Quaternion, type ShaderMaterial, SkinnedMesh, type Texture, TextureLoader,
  Vector2, Vector3,
} from 'three';
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone as cloneSkeleton } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { ARM_CLIPS, armClipNames } from './armClips';
import { type JointAngles, LEFT_HAND, RIGHT_HAND, measure } from './armRig';
import { BrushTrail, type BrushTrailLook } from './brushTrail';
import type { ClothCapsule } from '../looks/strandCloth';
import type { ClipChannel as Channel } from '@wildshard/engine/anim/channel';
import { AnimMachine } from '@wildshard/engine/anim/machine';
import { loadRigFile, bindRig, type RigContract, type RigBake } from '@wildshard/engine/anim/rig';
import { app } from '@wildshard/engine/app/runtime';
import { phoneUrl } from '@wildshard/engine/boot/bytes';
import { ktx2Texture } from '@wildshard/engine/core/ktx2';

type Vec3 = readonly [number, number, number];

/** A capsule end: a point in a socket's space (`at`), or the socket's own origin (no `at`). */
export interface FpCapsuleEnd { readonly bone: string; readonly at?: Vec3 }
/** A capsule the pendants may not enter, as data: its two ends and radius. */
export interface FpCapsuleRow { readonly a: FpCapsuleEnd; readonly b: FpCapsuleEnd; readonly r: number }

/** A first-person arm rig as data. */
export interface FpArmsRow {
  /** the weapon socket (the blade runs along its +y) and the gadget socket (the muzzle; `<claw>*` meshes are its claw) */
  readonly weapon: string;
  readonly claw: string;
  /** the attach points when the GLB's extras give none: pendant pivots and the muzzle (socket space), the blade's span */
  readonly pendants: Readonly<Record<string, Vec3>>;
  readonly muzzle: Vec3;
  readonly bladeBase: number;
  readonly bladeTip: number;
  /** GLTFExporter writes custom attributes as `_NAME`; the loader reads them back lower case: their real names */
  readonly rename: Readonly<Record<string, string>>;
  /** the pendants' colliders (root space each frame) */
  readonly colliders: readonly FpCapsuleRow[];
  /** the moves each channel holds on their last pose until the next play */
  readonly holdRight: readonly string[];
  readonly holdLeft: readonly string[];
  /** layout(): the rest points' weights (guard, tip, hub) */
  readonly restWeights: readonly [number, number, number];
  /** the look lag (rad per rad/s, pitch and yaw) and its clamp; the walk weight's rate (1/s) */
  readonly lag: { readonly pitch: number; readonly yaw: number; readonly max: number };
  readonly walkRate: number;
  /** a move's trail: its life as a share of the move's total (default total when untimed), the blade share it starts from */
  readonly trail: { readonly life: number; readonly total: number; readonly from: number };
}

export interface Timing { windup: number; slashEnd: number; total: number; sweep: number }
export interface MoveInfo { duration: number; timing: Timing | null; trailFrom: number | null; loop: boolean; side: 'R' | 'L' }

export interface FpArmsState {
  /** 0 standing … 1 full walk */
  speed: number;
  /** the step phase in radians (the engine's player.bobTime), to sync the walk loop; omitted = free-running */
  walkPhase?: number;
  /** look velocity (rad/s, x yaw, y pitch) for the lag */
  lookVel: Vector2;
  /** gravity in the root's space (camera space: (0, −cos pitch, −sin pitch) · 9.8) */
  gravity: Vector3;
}

/** A pendant (a tassel, a talisman): stepped each frame at its pivot (root space) against the colliders. */
export interface FpPendant {
  readonly step: (dt: number, pivot: Vector3, q: Quaternion, gravity: Vector3, breeze: number, caps: readonly ClothCapsule[]) => void;
}

/** A GLB mesh's extras. */
export interface FpMeshData { hull?: boolean; hullK?: number; maps?: string; assetRot?: number[] }

/** What the caller builds: each GLB mesh's material (returning which tally it joins), then the living parts it adds. */
export interface FpArmsHooks {
  readonly mesh: (o: Mesh, data: FpMeshData, rig: FpArmsRig) => 'hull' | 'body';
  readonly dress: (rig: FpArmsRig) => void;
}

/** An arm rig's contract over the shared ARM_CLIPS aliases. */
export function armRigContract(skeleton: string, sockets: readonly string[]): RigContract {
  return { skeleton, clips: armClipNames(ARM_CLIPS), sockets };
}
/** An arm rig's bake over the shared ARM_CLIPS aliases: each side's joints (`<side>_<joint>`, in skin order). */
export function armRigBake(skeleton: string, sides: readonly string[], joints: readonly string[]): RigBake {
  return { skeleton, clips: ARM_CLIPS, joints: sides.map((side) => joints.map((name) => `${side}_${name}`)) };
}

/** Renames the exporter's custom attributes and fills the attributes the rig's programs read but the GLB may lack. */
export function prepRigGeometry(g: BufferGeometry, rename: Readonly<Record<string, string>>): void {
  for (const [from, to] of Object.entries(rename)) {
    const a = g.getAttribute(from) as BufferAttribute | undefined;
    if (a !== undefined) { g.setAttribute(to, a); g.deleteAttribute(from); }
  }
  const n = g.getAttribute('position').count;
  const nor = g.getAttribute('normal') as BufferAttribute | undefined;
  if (!g.hasAttribute('aNs') && nor !== undefined) g.setAttribute('aNs', nor);
  if (!g.hasAttribute('aFace')) g.setAttribute('aFace', new BufferAttribute(new Float32Array(n * 4), 4));
  if (!g.hasAttribute('color')) {
    const c = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { c[i * 3] = 1; c[i * 3 + 1] = 0.5; c[i * 3 + 2] = 0.5; }
    g.setAttribute('color', new BufferAttribute(c, 3));
  }
  if (!g.hasAttribute('uv')) g.setAttribute('uv', new BufferAttribute(new Float32Array(n * 2), 2));
}

const texLoader = new TextureLoader();

function mapPair(base: string, name: string): Promise<[Texture | null, Texture | null]> {
  const one = async (url: string): Promise<Texture | null> => {
    try {
      const t = await ktx2Texture(phoneUrl(url)) ?? await texLoader.loadAsync(url);
      t.colorSpace = NoColorSpace;
      t.flipY = false;
      t.minFilter = LinearMipmapLinearFilter;
      t.anisotropy = 4;
      return t;
    } catch {
      return null;
    }
  };
  return Promise.all([one(`${base}${name}-maps.webp`), one(`${base}${name}-nrm.webp`)]);
}

/** a part's maps (`<base><name>-maps.webp` and `-nrm.webp`, linear, no flip), loaded once: every rig reading them shares
 *  the textures (nothing writes them) */
const mapLoads = new Map<string, Promise<[Texture | null, Texture | null]>>();
export function sharedRigMaps(base: string, name: string): Promise<[Texture | null, Texture | null]> {
  const key = `${base}${name}`;
  let p = mapLoads.get(key);
  if (p === undefined) { p = mapPair(base, name); mapLoads.set(key, p); }
  return p;
}

/**
 * A rig GLB, parsed once: the first rig — the held one — takes the parsed scene itself; a later rig (a Model Explorer
 * specimen) takes a skeleton clone of it made before the first was built: the same geometry (so the same GPU buffers), its
 * own bones, materials, mixer and cloth.
 */
interface RigFile { readonly gltf: GLTF; readonly pristine: Object3D; taken: boolean }
const rigFiles = new Map<string, Promise<RigFile>>();
export async function takeRigScene(url: string): Promise<{ scene: Object3D; animations: AnimationClip[] }> {
  let p = rigFiles.get(url);
  if (p === undefined) {
    p = loadRigFile(url).then((gltf): RigFile => ({ gltf, pristine: cloneSkeleton(gltf.scene), taken: false }));
    rigFiles.set(url, p);
    void p.catch(() => { rigFiles.delete(url); }); // a failed fetch can retry
  }
  const f = await p;
  if (!f.taken) { f.taken = true; return { scene: f.gltf.scene, animations: f.gltf.animations }; }
  return { scene: cloneSkeleton(f.pristine), animations: f.gltf.animations };
}

/** The GLB's `vm_root` (or its scene) moved into a fresh group that keeps its extras. */
export function rigRoot(scene: Object3D): Group {
  const root = scene.getObjectByName('vm_root') ?? scene;
  const g = new Group();
  g.userData = root.userData;
  while (root.children.length > 0) { const c = root.children[0]; if (c !== undefined) g.add(c); }
  return g;
}

/**
 * The root's uniform scale and offset ([s, x, y, z]) that frame `pts` (root space, weighted) on `camera` as they framed on
 * the canonical camera they were baked for: Gauss-Newton on their NDC, 30 steps.
 */
export function fitFraming(pts: readonly Vector3[], wts: readonly number[], camera: PerspectiveCamera, canonFovV: number, canonAspect: number): number[] {
  const ndc = (p: Vector3, fov: number, aspect: number): Vector2 => {
    const ty = Math.tan((fov * Math.PI) / 360);
    return new Vector2(p.x / (-p.z * ty * aspect), p.y / (-p.z * ty));
  };
  const target = pts.map((p) => ndc(p, canonFovV, canonAspect));
  const x = [1, 0, 0, 0];
  const res = (xx: readonly number[]): number[] => {
    const out: number[] = [];
    pts.forEach((p, i) => {
      const q = p.clone().multiplyScalar(xx[0] ?? 1).add(new Vector3(xx[1] ?? 0, xx[2] ?? 0, xx[3] ?? 0));
      const n = ndc(q, camera.fov, camera.aspect), t = target[i] ?? n, w = wts[i] ?? 1;
      out.push((n.x - t.x) * w, (n.y - t.y) * w);
    });
    return out;
  };
  for (let it = 0; it < 30; it++) {
    const r0 = res(x);
    const J: number[][] = [];
    for (let k = 0; k < 4; k++) {
      const xe = [...x];
      xe[k] = (xe[k] ?? 0) + 1e-4;
      const r1 = res(xe);
      J.push(r1.map((v, i) => (v - (r0[i] ?? 0)) / 1e-4));
    }
    // normal equations (4×4), Gauss-Jordan
    const A = [0, 1, 2, 3].map((a) => [0, 1, 2, 3].map((b) => (J[a] ?? []).reduce((s, v, i) => s + v * ((J[b] ?? [])[i] ?? 0), 0) + (a === b ? 1e-6 : 0)));
    const B = [0, 1, 2, 3].map((a) => -(J[a] ?? []).reduce((s, v, i) => s + v * (r0[i] ?? 0), 0));
    for (let c = 0; c < 4; c++) {
      const row = A[c] ?? [];
      const piv = row[c] ?? 1;
      for (let j = 0; j < 4; j++) row[j] = (row[j] ?? 0) / piv;
      B[c] = (B[c] ?? 0) / piv;
      for (let r = 0; r < 4; r++) {
        if (r === c) continue;
        const rr = A[r] ?? [];
        const f = rr[c] ?? 0;
        for (let j = 0; j < 4; j++) rr[j] = (rr[j] ?? 0) - f * (row[j] ?? 0);
        B[r] = (B[r] ?? 0) - f * (B[c] ?? 0);
      }
    }
    for (let k = 0; k < 4; k++) x[k] = (x[k] ?? 0) + (B[k] ?? 0);
  }
  return x;
}

interface RigExtras {
  attach?: Readonly<Record<string, number[] | number | undefined>>;
  clips?: Record<string, { side: 'R' | 'L'; loop: boolean; timing: Timing | null; trailFrom: number | null }>;
}

const isMesh = (o: Object3D): o is Mesh => o instanceof Mesh;
const vec = (at: readonly number[]): Vector3 => new Vector3(at[0] ?? 0, at[1] ?? 0, at[2] ?? 0);

/** A first-person arm rig: the GLB's arms on two channels, the pendants, the trail, the framing fit. */
export class FpArmsRig {
  readonly root = new Group();
  readonly materials: ShaderMaterial[] = [];
  readonly moves: Record<string, MoveInfo> = {};
  readonly trail = new BrushTrail();
  /** triangles in the rig's meshes (bodies, hulls) */
  tris = { body: 0, hull: 0 };
  breeze = 0.6;
  /** the rig's nodes by name (joints are Bones; the sockets are plain nodes: they skin nothing) */
  readonly bones = new Map<string, Object3D>();
  /** the pendants the caller hung (each pivot's attach point is the row's, or the GLB's, under the same name) */
  readonly pendants: { body: FpPendant; at: Vector3 }[] = [];
  readonly attach: { pendants: Map<string, Vector3>; muzzle: Vector3; bladeBase: number; bladeTip: number };
  private readonly row: FpArmsRow;
  private readonly mixer: AnimMachine;
  private readonly actions = new Map<string, AnimationAction>();
  private readonly right: Channel;
  private readonly left: Channel;
  private walkW = 0;
  private moveName: string | null = null;
  private moveT = 0;
  private trailOn = false;
  private readonly rest: { guard: Vector3; tip: Vector3; hub: Vector3 };
  private readonly claws: Object3D[] = [];

  constructor(scene: Group, clips: AnimationClip[], row: FpArmsRow, contract: RigContract, bake: RigBake, hooks: FpArmsHooks) {
    if (scene.userData['rig'] !== contract.skeleton) throw new Error(`[anim] ${contract.skeleton} arm skeleton mismatch`);
    this.row = row;
    const data = scene.userData as RigExtras;
    const at = data.attach;
    const num = (key: string, fallback: number): number => { const v = at?.[key]; return typeof v === 'number' ? v : fallback; };
    const pt = (key: string, fallback: Vec3): Vector3 => { const v = at?.[key]; return new Vector3().fromArray(Array.isArray(v) ? v : fallback); };
    this.attach = {
      pendants: new Map(Object.entries(row.pendants).map(([name, p]) => [name, pt(name, p)])),
      muzzle: pt('muzzle', row.muzzle),
      bladeBase: num('bladeBase', row.bladeBase), bladeTip: num('bladeTip', row.bladeTip),
    };
    // the GLB's root → our root (keep the bones' hierarchy intact)
    while (scene.children.length > 0) { const c = scene.children[0]; if (c !== undefined) this.root.add(c); }
    this.root.traverse((o) => {
      if (!isMesh(o)) { if (o.name !== '') this.bones.set(o.name, o); return; }
      const g = o.geometry;
      prepRigGeometry(g, row.rename);
      const n = (g.index?.count ?? g.getAttribute('position').count) / 3;
      this.tris[hooks.mesh(o, o.userData as FpMeshData, this)] += n;
      o.frustumCulled = false;
      if (o.name.startsWith(row.claw)) this.claws.push(o);
    });
    // clips
    const rig = bindRig(this.root, clips, contract, bake);
    this.mixer = new AnimMachine({ states: {}, loops: armClipNames(ARM_CLIPS).filter((name) => data.clips?.[ARM_CLIPS[name] ?? name]?.loop === true) }, rig, app.levelScope ?? undefined);
    for (const c of clips) {
      const name = armClipNames(ARM_CLIPS).find((alias) => ARM_CLIPS[alias] === c.name);
      if (name === undefined) throw new Error(`${contract.skeleton} has unmapped clip ${c.name}`);
      const a = this.mixer.action(name);
      const meta = data.clips?.[c.name];
      this.moves[c.name] = { duration: c.duration, timing: meta?.timing ?? null, trailFrom: meta?.trailFrom ?? null, loop: meta?.loop ?? false, side: meta?.side ?? 'R' };
      this.actions.set(c.name, a);
    }
    this.right = this.mixer.channel('idle', 'walk');
    this.left = this.mixer.channel('idle.left', 'walk.left');
    hooks.dress(this);
    this.root.add(this.trail.mesh);
    this.materials.push(this.trail.mesh.material as ShaderMaterial);
    // the rest points for layout(): the canonical framing is where the GLB was baked
    this.mixer.update(0);
    this.root.updateMatrixWorld(true);
    const w = this.bones.get(row.weapon), cl = this.bones.get(row.claw);
    this.rest = {
      guard: w === undefined ? new Vector3() : new Vector3().setFromMatrixPosition(w.matrixWorld),
      tip: w === undefined ? new Vector3() : new Vector3(0, this.attach.bladeTip, 0).applyMatrix4(w.matrixWorld),
      hub: cl === undefined ? new Vector3() : new Vector3().setFromMatrixPosition(cl.matrixWorld),
    };
  }

  /** hang a pendant at the attach point `name` (weapon-socket space) */
  hang(name: string, body: FpPendant): void {
    this.pendants.push({ body, at: this.attach.pendants.get(name) ?? new Vector3() });
  }

  /** start a right-arm move (crossfade `fade` s; `seed` varies its trail). The row's holds keep their last pose. */
  play(name: string, fade: number, seed: number): void {
    const a = this.actions.get(name);
    if (a === undefined) return;
    this.right.play(a, name, fade, this.row.holdRight.includes(name));
    this.moveName = name;
    this.moveT = 0;
    this.trailOn = false;
    const info = this.moves[name];
    this.trail.begin((info?.timing?.total ?? this.row.trail.total) * this.row.trail.life, seed);
  }

  /** the left arm: a pose, or 'idle' to fade back */
  playLeft(name: string, fade = 0.1): void {
    if (name === 'idle') { this.left.release(fade); return; }
    const a = this.actions.get(name);
    if (a === undefined) return;
    this.left.play(a, name, fade, this.row.holdLeft.includes(name));
  }

  /** the claw rides the gadget except while it flies */
  setClawVisible(on: boolean): void { for (const c of this.claws) c.visible = on; }

  setTrailLook(look: BrushTrailLook): void { this.trail.setLook(look); }

  /** the current right move and its time; `active` = inside its windup … slashEnd window */
  get move(): string | null { return this.moveName; }
  get time(): number { return this.moveT; }
  get active(): boolean {
    const info = this.moveName === null ? undefined : this.moves[this.moveName];
    const tm = info?.timing;
    return tm !== null && tm !== undefined && this.moveT >= tm.windup && this.moveT <= tm.slashEnd;
  }

  /** every material's `uRes` (buffer size) and `uPx` (7 px at the ratio) */
  resizeMaterials(bw: number, bh: number, pr: number): void {
    for (const m of this.materials) {
      const res = m.uniforms['uRes'];
      if (res !== undefined && res.value instanceof Vector2) res.value.set(bw, bh);
      const px = m.uniforms['uPx'];
      if (px !== undefined) px.value = 7 * pr;
    }
  }

  /**
   * Fit the root (uniform scale + offset) so the rest pose frames the same on this camera as on the canonical one it was
   * baked for: the guard and the tip exactly, the gadget's hub as near as it goes. The clips are untouched.
   */
  layout(camera: PerspectiveCamera, canonFovV = 70, canonAspect = 402 / 874): void {
    const x = fitFraming([this.rest.guard, this.rest.tip, this.rest.hub], this.row.restWeights, camera, canonFovV, canonAspect);
    this.root.scale.setScalar(x[0] ?? 1);
    this.root.position.set(x[1] ?? 0, x[2] ?? 0, x[3] ?? 0);
  }

  /** the rest points layout() fits (guard, tip, hub; root space) */
  restPoints(): number[][] { return [this.rest.guard.toArray(), this.rest.tip.toArray(), this.rest.hub.toArray()]; }

  /** the bone's matrix in root space */
  rootMatrix(name: string, out: Matrix4): Matrix4 | null {
    const b = this.bones.get(name);
    if (b === undefined) return null;
    this.root.updateMatrixWorld();
    return out.copy(this.root.matrixWorld).invert().multiply(b.matrixWorld);
  }

  /** the blade in root space: from the trail's inner share (or the guard) to the tip */
  blade(base: Vector3, tip: Vector3, from = 0): void {
    const m = this.rootMatrix(this.row.weapon, new Matrix4());
    if (m === null) return;
    const { bladeBase: b0, bladeTip: b1 } = this.attach;
    base.set(0, b0 + (b1 - b0) * from, 0).applyMatrix4(m);
    tip.set(0, b1, 0).applyMatrix4(m);
  }

  /** the launcher muzzle in root space */
  muzzle(out: Vector3): Vector3 {
    const m = this.rootMatrix(this.row.claw, new Matrix4());
    return m === null ? out.set(0, 0, 0) : out.copy(this.attach.muzzle).applyMatrix4(m);
  }

  /** the joint angles of both arms as played (degrees): the rig gate's readout */
  jointAngles(): { R: JointAngles; L: JointAngles } {
    const read = (side: 1 | -1, p: string): JointAngles => {
      const S = new Vector3(), E = new Vector3(), W = new Vector3(), q = new Quaternion(), sc = new Vector3();
      this.rootMatrix(`${p}_shoulder`, new Matrix4())?.decompose(S, q, sc);
      this.rootMatrix(`${p}_forearm`, new Matrix4())?.decompose(E, q, sc);
      this.rootMatrix(`${p}_hand`, new Matrix4())?.decompose(W, q, sc);
      return measure(side, S, E, W, q, side === 1 ? RIGHT_HAND : LEFT_HAND);
    };
    return { R: read(1, 'R'), L: read(-1, 'L') };
  }

  /** the pendants' colliders in root space (none while a collider's socket is missing) */
  colliders(): ClothCapsule[] {
    const mats = new Map<string, Matrix4>();
    for (const c of this.row.colliders) for (const end of [c.a, c.b]) {
      if (mats.has(end.bone)) continue;
      const m = this.rootMatrix(end.bone, new Matrix4());
      if (m === null) return [];
      mats.set(end.bone, m);
    }
    const point = (end: FpCapsuleEnd): Vector3 => {
      const m = mats.get(end.bone) ?? new Matrix4();
      return end.at === undefined ? new Vector3().setFromMatrixPosition(m) : vec(end.at).applyMatrix4(m);
    };
    return this.row.colliders.map((c) => ({ a: point(c.a), b: point(c.b), r: c.r }));
  }

  update(dt: number, s: FpArmsState): void {
    const row = this.row;
    this.walkW += (Math.min(1, Math.max(0, s.speed)) - this.walkW) * Math.min(1, dt * row.walkRate);
    this.right.update(dt, this.walkW, s.walkPhase);
    this.left.update(dt, this.walkW, s.walkPhase === undefined ? undefined : s.walkPhase + Math.PI);
    this.mixer.update(dt);
    if (this.moveName !== null) {
      this.moveT += dt;
      if (this.right.top === null) this.moveName = null;
    }
    // look lag: the whole rig trails the view a little
    const lag = s.lookVel, mx = row.lag.max;
    this.root.rotation.set(Math.max(-mx, Math.min(mx, lag.y * row.lag.pitch)), Math.max(-mx, Math.min(mx, -lag.x * row.lag.yaw)), 0);
    this.root.updateMatrixWorld(true);
    // the trail samples the blade through the active window
    const info = this.moveName === null ? undefined : this.moves[this.moveName];
    if (this.active && info !== undefined) {
      const a = new Vector3(), b = new Vector3();
      this.blade(a, b, info.trailFrom ?? row.trail.from);
      this.trail.sample(a, b);
      this.trailOn = true;
    }
    this.trail.update(dt);
    // cloth: pivots ride the weapon; gravity in root space
    const w = this.rootMatrix(row.weapon, new Matrix4());
    if (w !== null) {
      const q = new Quaternion().setFromRotationMatrix(w);
      const caps = this.colliders();
      for (const p of this.pendants) p.body.step(dt, p.at.clone().applyMatrix4(w), q, s.gravity, this.breeze, caps);
    }
  }

  /** true once the trail has sampled in the current move */
  get trailLive(): boolean { return this.trailOn; }

  /** every skinned mesh (for the gate's skin checks) */
  skinned(): SkinnedMesh[] {
    const out: SkinnedMesh[] = [];
    this.root.traverse((o) => { if (o instanceof SkinnedMesh) out.push(o as SkinnedMesh); });
    return out;
  }
}
