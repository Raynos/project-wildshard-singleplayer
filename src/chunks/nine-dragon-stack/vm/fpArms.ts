// NineDragonArms — the engine-ready first-person rig of Nine Dragon Stack (lab P8 "viewmodel", round 13, E169).
// (Moved into the shard from src/dev/nd-lab/viewmodel/ for P0-5c; the engine drives it through vm/arms.ts.)
//
// ONE skinned GLB (`fp-rig.glb`, baked by bake.ts) holds both arms (shoulder → upper arm → forearm with three twist
// bones → hand), the Neon Jian (a rigid child of R_weapon), the Fei Zhua gauntlet with its claw (L_claw), the ink-hull
// proxies and every clip. This module plays it: two channels (right: the jian arm, left: the Fei Zhua arm), each a
// base loop (idle ↔ walk by speed) under one-shot moves that CROSSFADE (80–150 ms) — a move never restarts from a snap —
// plus the living parts the GLB can't hold: the verlet tassel + talisman (colliding with the fist, the forearm and the
// guard), the edge halo, the 飞白 trail.
//
//   const arms = await NineDragonArms.load();            // fp-rig.glb + the four map pairs
//   camera.add(arms.root);  arms.layout(camera);         // or any group rendered in the viewmodel pass
//   arms.resize(bufferW, bufferH, pixelRatio);
//   arms.play('light');                                  // light | light2 | light3 | charge | heavy | parry | draw | sheathe
//   arms.playLeft('grapple_aim');                        // grapple_aim | grapple_fire | grapple_hold | idle
//   every frame: arms.update(dt, { speed, walkPhase?, lookVel, gravity });
//   the hit sweep / trail: arms.blade(base, tip) (root space) while arms.active (the move's windup … slashEnd)
//
// Timing is the engine's sword timing (SwordMoves.ts): `arms.moves[name].timing` = { windup, slashEnd, total, sweep } —
// light = SLASH, light2 = BACKHAND, light3 = FINISHER, heavy = HEAVY (after `charge`, CHARGE_BLEND 0.16 s). Chain a
// combo by calling play(next) at slashEnd: the crossfade carries the arm from the follow-through into the next cut.
import {
  type AnimationAction, AnimationMixer, type AnimationClip, BufferAttribute, type BufferGeometry, DoubleSide, Group, LinearMipmapLinearFilter,
  LoopOnce, Matrix3, Matrix4, Mesh, NoColorSpace, type Object3D, type PerspectiveCamera, Quaternion, type ShaderMaterial, SkinnedMesh, type Texture, TextureLoader,
  Vector2, Vector3,
} from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { type Capsule, Talisman, Tassel, penetration } from './cloth';
import { CLS, Geo, v3 } from './geo';
import { buildHalo } from './jian';
import { type VmUniforms, decalAtlas, inkHullMaterial, vmMaterial, vmUniforms, weaveTexture } from './materials';
import { type JointAngles, LEFT_HAND, RIGHT_HAND, measure } from './rig';
import { Trail, type TrailLook } from './trail';

export const ASSET_BASE = '/assets/nine-dragon/viewmodel/';
export const RIG_URL = `${ASSET_BASE}fp-rig.glb`;

export type MoveName = 'light' | 'light2' | 'light3' | 'charge' | 'heavy' | 'parry' | 'draw' | 'sheathe' | 'sheathed';
export type LeftName = 'grapple_aim' | 'grapple_fire' | 'grapple_hold' | 'idle';

export interface Timing { windup: number; slashEnd: number; total: number; sweep: number }
export interface MoveInfo { duration: number; timing: Timing | null; trailFrom: number | null; loop: boolean; side: 'R' | 'L' }

export interface ArmsState {
  /** 0 standing … 1 full walk */
  speed: number;
  /** the step phase in radians (the engine's player.bobTime), to sync the walk loop; omitted = free-running */
  walkPhase?: number;
  /** look velocity (rad/s, x yaw, y pitch) for the lag */
  lookVel: Vector2;
  /** gravity in the root's space (camera space: (0, −cos pitch, −sin pitch) · 9.8) */
  gravity: Vector3;
}

const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
const texLoader = new TextureLoader();

/** GLTFExporter writes custom attributes as `_NAME`, GLTFLoader reads them back lower case */
const RENAME: Readonly<Record<string, string>> = { _amat: 'aMat', _aface: 'aFace', _ans: 'aNs', _ahulln: 'aHullN' };

function prepGeometry(g: BufferGeometry): void {
  for (const [from, to] of Object.entries(RENAME)) {
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

function mapPair(name: string): Promise<[Texture | null, Texture | null]> {
  const one = async (url: string): Promise<Texture | null> => {
    try {
      const t = await texLoader.loadAsync(url);
      t.colorSpace = NoColorSpace;
      t.flipY = false;
      t.minFilter = LinearMipmapLinearFilter;
      t.anisotropy = 4;
      return t;
    } catch {
      return null;
    }
  };
  return Promise.all([one(`${ASSET_BASE}${name}-maps.webp`), one(`${ASSET_BASE}${name}-nrm.webp`)]);
}

interface Layer { action: AnimationAction; name: string; w: number; target: number; rate: number; hold: boolean }

/** one arm's clip channel: a base (idle ↔ walk) under crossfading one-shot moves */
class Channel {
  readonly layers: Layer[] = [];
  constructor(private readonly base: AnimationAction, private readonly walk: AnimationAction | null) {
    base.play();
    walk?.play();
  }

  play(action: AnimationAction, name: string, fade: number, hold: boolean): void {
    for (const l of this.layers) { l.target = 0; l.rate = 1 / Math.max(0.016, fade); }
    action.reset();
    action.enabled = true;
    action.setEffectiveTimeScale(1);
    action.setEffectiveWeight(0);
    action.play();
    this.layers.push({ action, name, w: 0, target: 1, rate: 1 / Math.max(0.016, fade), hold });
  }

  /** back to the base (a held pose released) */
  release(fade: number): void { for (const l of this.layers) { l.target = 0; l.rate = 1 / Math.max(0.016, fade); } }

  /** the move that is fading in / playing (null when on the base) */
  get top(): Layer | null {
    for (let i = this.layers.length - 1; i >= 0; i--) { const l = this.layers[i]; if (l !== undefined && l.target > 0) return l; }
    return null;
  }

  update(dt: number, walkW: number, walkPhase: number | undefined): void {
    for (const l of this.layers) {
      // a finished one-shot fades back to the base; a held pose (charge, sheathe) stays until the next play
      const dur = l.action.getClip().duration;
      if (l.target > 0 && !l.hold && l.action.time >= dur - 1e-4) { l.target = 0; l.rate = 1 / 0.15; }
      l.w += Math.sign(l.target - l.w) * Math.min(Math.abs(l.target - l.w), l.rate * dt);
    }
    for (let i = this.layers.length - 1; i >= 0; i--) {
      const l = this.layers[i];
      if (l !== undefined && l.w <= 0 && l.target <= 0) { l.action.stop(); this.layers.splice(i, 1); }
    }
    const moveW = Math.min(1, this.layers.reduce((a, l) => a + l.w, 0));
    for (const l of this.layers) l.action.setEffectiveWeight(l.w);
    const baseW = 1 - moveW;
    this.base.setEffectiveWeight(baseW * (this.walk === null ? 1 : 1 - walkW));
    if (this.walk !== null) {
      this.walk.setEffectiveWeight(baseW * walkW);
      if (walkPhase !== undefined) {
        const d = this.walk.getClip().duration;
        this.walk.time = (((walkPhase / (Math.PI * 2)) % 1) + 1) % 1 * d;
      }
    }
  }
}

export class NineDragonArms {
  readonly root = new Group();
  readonly u: VmUniforms;
  readonly materials: ShaderMaterial[] = [];
  readonly moves: Record<string, MoveInfo> = {};
  readonly trail = new Trail();
  readonly halo: Mesh;
  /** triangles in the rig's meshes (bodies, hulls) */
  tris = { body: 0, hull: 0 };
  breeze = 0.6;
  private readonly mixer: AnimationMixer;
  private readonly actions = new Map<string, AnimationAction>();
  private readonly right: Channel;
  private readonly left: Channel;
  /** the rig's nodes by name (joints are Bones; R_weapon / L_claw are plain nodes: they skin nothing) */
  private readonly bones = new Map<string, Object3D>();
  private readonly tassel = new Tassel();
  private readonly talisman = new Talisman();
  private readonly knot: Group;
  private readonly attach: { tassel: Vector3; talisman: Vector3; muzzle: Vector3; bladeBase: number; bladeTip: number };
  private walkW = 0;
  private t = 0;
  private moveName: string | null = null;
  private moveT = 0;
  private trailOn = false;
  private readonly rest: { guard: Vector3; tip: Vector3; hub: Vector3 };
  private readonly claws: Object3D[] = [];

  private constructor(scene: Group, clips: AnimationClip[], textures: Map<string, [Texture | null, Texture | null]>, silk: Texture) {
    this.u = vmUniforms(silk, decalAtlas());
    const data = scene.userData as { attach?: { tassel: number[]; talisman: number[]; muzzle: number[]; bladeBase: number; bladeTip: number }; clips?: Record<string, { side: 'R' | 'L'; loop: boolean; timing: Timing | null; trailFrom: number | null }> };
    const at = data.attach;
    this.attach = {
      tassel: new Vector3().fromArray(at?.tassel ?? [-0.026, -0.048, 0.014]),
      talisman: new Vector3().fromArray(at?.talisman ?? [0.05, -0.036, 0.022]),
      muzzle: new Vector3().fromArray(at?.muzzle ?? [0, 0.006, 0]),
      bladeBase: at?.bladeBase ?? 0.05, bladeTip: at?.bladeTip ?? 0.81,
    };
    // the GLB's root → our root (keep the bones' hierarchy intact)
    while (scene.children.length > 0) { const c = scene.children[0]; if (c !== undefined) this.root.add(c); }
    this.root.traverse((o) => {
      if (!(o instanceof Mesh)) { if (o.name !== '') this.bones.set(o.name, o); return; }
      const g = o.geometry as BufferGeometry;
      prepGeometry(g);
      const ud = o.userData as { hull?: boolean; hullK?: number; maps?: string; assetRot?: number[] };
      const n = (g.index?.count ?? g.getAttribute('position').count) / 3;
      if (ud.hull === true) {
        const m = inkHullMaterial(this.u, ud.hullK ?? 1);
        o.material = m;
        o.renderOrder = -1;
        this.materials.push(m);
        this.tris.hull += n;
      } else {
        const tex = ud.maps === undefined ? undefined : textures.get(ud.maps);
        const rot = ud.assetRot === undefined ? null : new Matrix3().fromArray(ud.assetRot);
        const m = vmMaterial(this.u, tex?.[0] ?? null, tex?.[1] ?? null, rot);
        // the sleeves, cuffs and the gauntlet are open tubes: a swing looks into them, so their insides are drawn too
        // (single-sided, the ink hull's back faces showed through as a black hole)
        if (o instanceof SkinnedMesh) m.side = DoubleSide;
        o.material = m;
        this.materials.push(m);
        this.tris.body += n;
      }
      o.frustumCulled = false;
      if (o.name.startsWith('L_claw')) this.claws.push(o);
    });
    // clips
    this.mixer = new AnimationMixer(this.root);
    for (const c of clips) {
      const a = this.mixer.clipAction(c);
      const meta = data.clips?.[c.name];
      this.moves[c.name] = { duration: c.duration, timing: meta?.timing ?? null, trailFrom: meta?.trailFrom ?? null, loop: meta?.loop ?? false, side: meta?.side ?? 'R' };
      if (meta?.loop !== true) { a.setLoop(LoopOnce, 1); a.clampWhenFinished = true; }
      this.actions.set(c.name, a);
    }
    const act = (n: string): AnimationAction => {
      const a = this.actions.get(n);
      if (a === undefined) throw new Error(`fp-rig.glb has no clip ${n}`);
      return a;
    };
    this.right = new Channel(act('idle'), this.actions.get('walk') ?? null);
    this.left = new Channel(act('idleL'), this.actions.get('walkL') ?? null);
    // the living parts: the tassel's knot + cap, the strands, the talisman (root space), the halo on the weapon
    const kx = new Geo();
    kx.ellipsoid(v3(0, 0.008, 0), v3(1, 0, 0), v3(0, 1, 0), v3(0, 0, 1), 0.012, 0.0135, 0.012, { cls: CLS.silk }, (d) => 1 + 0.08 * Math.sin(d.x * 9) * Math.sin(d.z * 9), 14);
    kx.lathe(0, -0.024, 0, [[0.007, 0], [0.0135, 0.005], [0.0145, 0.012], [0.012, 0.018], [0.008, 0.022]], 16, { cls: CLS.brass, line: 1, edges: 4 | 8 });
    const knotGeo = kx.build();
    this.knot = new Group();
    const hullThin = inkHullMaterial(this.u, 0.55);
    // the tassel's strands are 5–7 px wide on the phone: a full brush hull would ink them solid black
    const hullHair = inkHullMaterial(this.u, 0.18);
    const body = vmMaterial(this.u);
    const cloth = vmMaterial(this.u);
    cloth.side = DoubleSide;
    this.materials.push(hullThin, hullHair, body, cloth);
    const hulled = (g: BufferGeometry, m: ShaderMaterial, parent: Object3D, hullNormals: boolean, hm = hullThin): void => {
      if (hullNormals) {
        const nor = g.getAttribute('normal');
        g.setAttribute('aHullN', nor.clone());
      }
      const b = new Mesh(g, m), h = new Mesh(g, hm);
      h.renderOrder = -1;
      b.frustumCulled = false;
      h.frustumCulled = false;
      parent.add(h, b);
    };
    hulled(knotGeo, body, this.knot, true);
    this.root.add(this.knot);
    hulled(this.tassel.geo, body, this.root, false, hullHair);
    hulled(this.talisman.geo, cloth, this.root, false);
    hulled(this.talisman.cordGeo, body, this.root, false);
    const halo = buildHalo();
    this.halo = new Mesh(halo.geo, halo.mat);
    this.halo.frustumCulled = false;
    this.halo.renderOrder = 4;
    this.materials.push(halo.mat);
    this.bones.get('R_weapon')?.add(this.halo);
    this.root.add(this.trail.mesh);
    this.materials.push(this.trail.mesh.material as ShaderMaterial);
    // the rest points for layout(): the canonical framing is where the GLB was baked
    this.mixer.update(0);
    this.root.updateMatrixWorld(true);
    const w = this.bones.get('R_weapon'), cl = this.bones.get('L_claw');
    this.rest = {
      guard: w === undefined ? new Vector3() : new Vector3().setFromMatrixPosition(w.matrixWorld),
      tip: w === undefined ? new Vector3() : v3(0, this.attach.bladeTip, 0).applyMatrix4(w.matrixWorld),
      hub: cl === undefined ? new Vector3() : new Vector3().setFromMatrixPosition(cl.matrixWorld),
    };
  }

  static async load(url = RIG_URL): Promise<NineDragonArms> {
    const gltf = await loader.loadAsync(url);
    const names = ['hand-r', 'arm-r', 'fist-l', 'gauntlet'];
    const pairs = await Promise.all(names.map((n) => mapPair(n)));
    const textures = new Map<string, [Texture | null, Texture | null]>();
    for (let i = 0; i < names.length; i++) textures.set(names[i] ?? '', pairs[i] ?? [null, null]);
    const scene = gltf.scene.getObjectByName('vm_root') ?? gltf.scene;
    const g = new Group();
    g.userData = scene.userData;
    while (scene.children.length > 0) { const c = scene.children[0]; if (c !== undefined) g.add(c); }
    return new NineDragonArms(g, gltf.animations, textures, weaveTexture());
  }

  /** start a right-arm move (crossfade `fade` s). 'charge' and 'sheathe' hold their last pose until the next play. */
  play(name: MoveName, fade = 0.1): void {
    const a = this.actions.get(name);
    if (a === undefined) return;
    this.right.play(a, name, fade, name === 'charge' || name === 'sheathe' || name === 'sheathed');
    this.moveName = name;
    this.moveT = 0;
    this.trailOn = false;
    const info = this.moves[name];
    this.trail.begin((info?.timing?.total ?? 0.35) * 0.45, Math.random() * 100);
  }

  /** the left arm: the grapple's poses, or 'idle' to fade back */
  playLeft(name: LeftName, fade = 0.1): void {
    if (name === 'idle') { this.left.release(fade); return; }
    const a = this.actions.get(name);
    if (a === undefined) return;
    this.left.play(a, name, fade, name === 'grapple_aim' || name === 'grapple_hold');
  }

  /** the claw rides the gauntlet except while the grapple flies (the grapple lab draws the flying one) */
  setClawVisible(on: boolean): void { for (const c of this.claws) c.visible = on; }

  setTrailLook(look: TrailLook): void { this.trail.setLook(look); }

  /** the current right move and its time; `active` = inside its windup … slashEnd window */
  get move(): string | null { return this.moveName; }
  get time(): number { return this.moveT; }
  get active(): boolean {
    const info = this.moveName === null ? undefined : this.moves[this.moveName];
    const tm = info?.timing;
    return tm !== null && tm !== undefined && this.moveT >= tm.windup && this.moveT <= tm.slashEnd;
  }

  /** buffer size + pixel ratio: the ink widths and the halo are in pixels */
  resize(bw: number, bh: number, pr: number): void {
    this.u.uRes.value.set(bw, bh);
    this.u.uLinePx.value = Math.max(1.0, 1.6 * (pr / 2));
    this.u.uHullPx.value = Math.max(1.0, 2.4 * (pr / 2));
    for (const m of this.materials) {
      const res = m.uniforms['uRes'];
      if (res !== undefined && res.value instanceof Vector2) res.value.set(bw, bh);
      const px = m.uniforms['uPx'];
      if (px !== undefined) px.value = 7 * pr;
    }
  }

  /**
   * Fit the root (uniform scale + offset) so the rest pose frames the same on this camera as on the canonical one it was
   * baked for (the portrait viewmodel camera, vertical fov 70°): the guard and the tip exactly, the Fei Zhua's hub
   * as near as it goes. The clips are untouched (they live under the root).
   */
  layout(camera: PerspectiveCamera, canonFovV = 70, canonAspect = 402 / 874): void {
    const ndc = (p: Vector3, fov: number, aspect: number): Vector2 => {
      const ty = Math.tan((fov * Math.PI) / 360);
      return new Vector2(p.x / (-p.z * ty * aspect), p.y / (-p.z * ty));
    };
    const pts = [this.rest.guard, this.rest.tip, this.rest.hub];
    const wts = [1, 1, 0.4];
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
    this.root.scale.setScalar(x[0] ?? 1);
    this.root.position.set(x[1] ?? 0, x[2] ?? 0, x[3] ?? 0);
  }

  /** the rest points layout() fits (guard, tip, hub; root space) */
  restPoints(): number[][] { return [this.rest.guard.toArray(), this.rest.tip.toArray(), this.rest.hub.toArray()]; }

  /** the bone's matrix in root space */
  private rootMatrix(name: string, out: Matrix4): Matrix4 | null {
    const b = this.bones.get(name);
    if (b === undefined) return null;
    this.root.updateMatrixWorld();
    return out.copy(this.root.matrixWorld).invert().multiply(b.matrixWorld);
  }

  /** the blade in root space: from the trail's inner share (or the guard) to the tip */
  blade(base: Vector3, tip: Vector3, from = 0): void {
    const m = this.rootMatrix('R_weapon', new Matrix4());
    if (m === null) return;
    const { bladeBase: b0, bladeTip: b1 } = this.attach;
    base.set(0, b0 + (b1 - b0) * from, 0).applyMatrix4(m);
    tip.set(0, b1, 0).applyMatrix4(m);
  }

  /** the launcher muzzle in root space */
  muzzle(out: Vector3): Vector3 {
    const m = this.rootMatrix('L_claw', new Matrix4());
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

  /** the cloth's colliders in root space: the fist round the grip, the forearm, the guard */
  private colliders(): Capsule[] {
    const w = this.rootMatrix('R_weapon', new Matrix4());
    const f = this.rootMatrix('R_forearm', new Matrix4());
    const h = this.rootMatrix('R_hand', new Matrix4());
    if (w === null || f === null || h === null) return [];
    return [
      // the fist round the grip (index … pinky), the palm / back-of-hand mass toward the wrist, the forearm, the guard
      { a: v3(0, -0.125, 0).applyMatrix4(w), b: v3(0, -0.2, 0).applyMatrix4(w), r: 0.042 },
      { a: v3(0.02, -0.14, 0.015).applyMatrix4(w), b: v3(0.023, -0.216, 0.026).applyMatrix4(w), r: 0.036 },
      { a: new Vector3().setFromMatrixPosition(h), b: new Vector3().setFromMatrixPosition(f), r: 0.042 },
      { a: v3(-0.02, -0.01, 0).applyMatrix4(w), b: v3(0.01, 0.02, 0).applyMatrix4(w), r: 0.03 },
    ];
  }

  update(dt: number, s: ArmsState): void {
    this.t += dt;
    this.u.uTime.value = this.t;
    const hu = (this.halo.material as ShaderMaterial).uniforms['uTime'];
    if (hu !== undefined) hu.value = this.t;
    this.walkW += (Math.min(1, Math.max(0, s.speed)) - this.walkW) * Math.min(1, dt * 6);
    this.right.update(dt, this.walkW, s.walkPhase);
    this.left.update(dt, this.walkW, s.walkPhase === undefined ? undefined : s.walkPhase + Math.PI);
    this.mixer.update(dt);
    if (this.moveName !== null) {
      this.moveT += dt;
      if (this.right.top === null) this.moveName = null;
    }
    // look lag: the whole rig trails the view a little
    const lag = s.lookVel;
    this.root.rotation.set(Math.max(-0.05, Math.min(0.05, lag.y * 0.01)), Math.max(-0.05, Math.min(0.05, -lag.x * 0.012)), 0);
    this.root.updateMatrixWorld(true);
    // the trail samples the blade through the active window
    const info = this.moveName === null ? undefined : this.moves[this.moveName];
    if (this.active && info !== undefined) {
      const a = new Vector3(), b = new Vector3();
      this.blade(a, b, info.trailFrom ?? 0.4);
      this.trail.sample(a, b);
      this.trailOn = true;
    }
    this.trail.update(dt);
    // cloth: pivots ride the weapon; gravity in root space
    const w = this.rootMatrix('R_weapon', new Matrix4());
    if (w !== null) {
      const q = new Quaternion().setFromRotationMatrix(w);
      const caps = this.colliders();
      this.tassel.step(dt, this.attach.tassel.clone().applyMatrix4(w), q, s.gravity, this.breeze, caps);
      this.talisman.step(dt, this.attach.talisman.clone().applyMatrix4(w), q, s.gravity, this.breeze, caps);
      this.knot.position.copy(this.tassel.cap);
      this.knot.quaternion.setFromUnitVectors(new Vector3(0, -1, 0), this.tassel.capDir);
    }
  }

  /** how deep the tassel / talisman sit inside the fist, forearm or guard right now (m; the gate's cloth check) */
  clothPenetration(): number {
    return penetration([...this.tassel.points(), ...this.talisman.points()], this.colliders());
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
