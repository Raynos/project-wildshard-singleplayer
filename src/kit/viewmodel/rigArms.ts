import type { ClipChannel } from '@wildshard/engine/anim/channel';
import { AnimMachine } from '@wildshard/engine/anim/machine';
import { loadRigFile, bindRig, type RigContract, type RigBake } from '@wildshard/engine/anim/rig';
import { cacheUntilDisposed, retainCachedResources } from '@wildshard/engine/app/cachedAssets';
import { app } from '@wildshard/engine/app/runtime';
import type { SkyRig as Sky } from '@wildshard/engine/world/skyRig';
import { ARM_CLIPS, SWIM_CLIPS, armClipNames } from './armClips';
// rigArms — the first-person arm player shared by the skinned viewmodel rigs (E334).
//
//   ClipChannel     one arm's clips: a base loop (idle ↔ walk by speed) under one-shot moves that CROSSFADE (80–150 ms),
//                   so a move never restarts from a snap; a held pose (charge, sheathe) stays until the next play
//   vmScale(fov)    the viewmodel's own projection: the clips are framed for a 70° vertical field on the portrait phone
//                   (the mockups' look) and the world camera is wider there (~94–100°). Scaling the rig's camera-space x
//                   and y by tan(world fov / 2) / tan(70° / 2), z kept, draws it exactly as a 70° camera would, so the
//                   world's FOV kicks (dodge, the heavy's punch) leave the arms still
//   RigArms         a baked arm rig (a GLB like scripts/blender/driftwood-isle/fp-arms: one skinned `arms` mesh, the
//                   weapons as children of R_weapon, the clips' metadata in vm_root's extras) played on the two
//                   channels, or — `swim` — its looping swim clips blended by speed with the stroke's phase set from outside
//   swordArmsOf     a RigArms as the engine Sword's animated rig (Sword.ts `SwordArms`)
import {
  type AnimationAction, type AnimationClip, Group, Matrix4, type Mesh, type Object3D, type Vector2, Vector3,
} from 'three';
import { clone as cloneSkeleton } from 'three/examples/jsm/utils/SkeletonUtils.js';
import type { SwordArms, Move } from '@wildshard/engine/combat/view/melee';


/** the viewmodel's vertical field (degrees): the clips' canonical camera */
export const VM_FOV = 70;

/** the root's x / y scale that draws a rig framed for `vmFov` through a camera of vertical field `worldFov` (degrees) */
export function vmScale(worldFov: number, vmFov = VM_FOV): number {
  return Math.tan((worldFov * Math.PI) / 360) / Math.tan((vmFov * Math.PI) / 360);
}

// ───────────────────────────── a baked rig (Driftwood's castaway arms) ─────────────────────────────

/** vm_root's extras (bake.mjs): each clip's side / loop / the engine's timing, the blade per weapon, the swim water line */
export interface RigMeta {
  clips: Record<string, { side: 'R' | 'L' | 'B'; loop: boolean; timing: { windup: number; slashEnd: number; total: number } | null }>;
  swords: Record<string, { bladeBase: number; bladeTip: number }>;
  water?: { y: number };
}

const isMesh = (o: Object3D): o is Mesh => 'isMesh' in o;
/** one parse per URL per shard; every rig is a skeleton clone of it (the same geometry, so the same GPU buffers) */
const parsed = new Map<string, Promise<{ scene: Object3D; animations: AnimationClip[] }>>();
async function rigScene(url: string): Promise<{ scene: Object3D; animations: AnimationClip[] }> {
  let p = parsed.get(url);
  if (p === undefined) {
    p = loadRigFile(url).then((g) => ({ scene: retainCachedResources(g.scene), animations: g.animations }));
    const pending = p; void cacheUntilDisposed(pending, () => { if (parsed.get(url) === pending) parsed.delete(url); });
    parsed.set(url, p);
    void p.catch(() => { parsed.delete(url); }); // a failed fetch can retry
  }
  const f = await p;
  return { scene: cloneSkeleton(f.scene), animations: f.animations };
}

export interface RigState {
  /** 0 standing … 1 full walk */
  speed: number;
  /** the step phase in radians (the player's bobTime), to sync the walk loop; omitted = free-running */
  walkPhase?: number;
  /** look velocity (rad/s, x yaw, y pitch) for the lag */
  lookVel: Vector2;
}

/** first-person arms on a skinned rig, posed by the weapon's moves (walk bob, look lag) */
export class RigArms {
  readonly root = new Group();
  readonly meta: RigMeta;
  /** the rig's nodes by name (joints, R_weapon, the weapon meshes) */
  readonly nodes = new Map<string, Object3D>();
  private readonly mixer: AnimMachine;
  private readonly actions = new Map<string, AnimationAction>();
  private readonly right: ClipChannel | null = null;
  private readonly left: ClipChannel | null = null;
  private walkW = 0;
  private moveName: string | null = null;
  private moveT = 0;
  private blade0 = 0.012;
  private blade1 = 0.53;
  private readonly m = new Matrix4();

  /** `swim`: the swim clips only (no channels): swimStroke / swimTread blended by `swim()` */
  private constructor(scene: Object3D, clips: AnimationClip[], readonly swimming: boolean, contract: RigContract, bake: RigBake) {
    const vm = scene.getObjectByName('vm_root') ?? scene;
    if (vm.userData['rig'] !== contract.skeleton) throw new Error(`[anim] arm rig skeleton mismatch: ${String(vm.userData['rig'])}`);
    this.meta = vm.userData as RigMeta;
    while (vm.children.length > 0) { const c = vm.children[0]; if (c !== undefined) this.root.add(c); }
    this.root.traverse((o) => {
      if (o.name !== '') this.nodes.set(o.name, o);
      if (isMesh(o)) o.frustumCulled = false;
    });
    const aliases = { ...ARM_CLIPS, ...SWIM_CLIPS };
    const rig = bindRig(this.root, clips, contract, bake);
    const loops = armClipNames(aliases).filter((name) => this.meta.clips[aliases[name] ?? name]?.loop === true);
    this.mixer = new AnimMachine({ states: {}, loops }, rig, app.levelScope ?? undefined);
    for (const name of armClipNames(aliases)) this.actions.set(aliases[name] ?? name, this.mixer.action(name));
    if (!swimming) {
      this.right = this.mixer.channel('idle', 'walk');
      this.left = this.mixer.channel('idle.left', 'walk.left');
    } else {
      for (const n of ['swimStroke', 'swimTread']) this.actions.get(n)?.play();
    }
    this.mixer.update(0);
  }

  static async load(url: string, contract: RigContract, bake: RigBake, swimming = false): Promise<RigArms> {
    const { scene, animations } = await rigScene(url);
    return new RigArms(scene, animations, swimming, contract, bake);
  }

  /** every mesh of the rig: the skinned arms, the weapons */
  meshes(): Mesh[] {
    const out: Mesh[] = [];
    this.root.traverse((o) => { if (isMesh(o)) out.push(o); });
    return out;
  }

  /** show one of the weapons on R_weapon (`sword_<kind>`), or none; the blade the hit sweep and the trail read follows it */
  weapon(kind: string | null): void {
    for (const [name, o] of this.nodes) if (name.startsWith('sword_') && isMesh(o)) o.visible = name === `sword_${kind ?? ''}`;
    const b = kind === null ? undefined : this.meta.swords[kind];
    if (b !== undefined) { this.blade0 = b.bladeBase; this.blade1 = b.bladeTip; }
  }

  /** start a right-arm move (crossfade `fade` s); 'charge' and 'sheathe' hold their last pose until the next play */
  play(name: string, fade = 0.1): void {
    const a = this.actions.get(name);
    if (a === undefined || this.right === null) return;
    this.right.play(a, name, fade, name === 'charge' || name === 'sheathe' || name === 'sheathed');
    this.moveName = name;
    this.moveT = 0;
  }

  /** the current right move and how long it has run */
  get move(): string | null { return this.moveName; }
  get time(): number { return this.moveT; }

  /** the blade in root space: base (the guard end of the blade) and tip */
  blade(base: Vector3, tip: Vector3): void {
    const w = this.nodes.get('R_weapon');
    if (w === undefined) return;
    this.root.updateMatrixWorld();
    this.m.copy(this.root.matrixWorld).invert().multiply(w.matrixWorld);
    base.set(0, this.blade0, 0).applyMatrix4(this.m);
    tip.set(0, this.blade1, 0).applyMatrix4(this.m);
  }

  /** the sword channels: the walk, the look lag, the moves */
  update(dt: number, s: RigState): void {
    this.walkW += (Math.min(1, Math.max(0, s.speed)) - this.walkW) * Math.min(1, dt * 6);
    this.right?.update(dt, this.walkW, s.walkPhase);
    this.left?.update(dt, this.walkW, s.walkPhase === undefined ? undefined : s.walkPhase + Math.PI);
    this.mixer.update(dt);
    if (this.moveName !== null) {
      this.moveT += dt;
      if (this.right?.top === null) this.moveName = null;
    }
    // look lag: the whole rig trails the view a little
    const lag = s.lookVel;
    this.root.rotation.set(Math.max(-0.05, Math.min(0.05, lag.y * 0.01)), Math.max(-0.05, Math.min(0.05, -lag.x * 0.012)), 0);
  }

  /** the swim clips: `stroke` 0 (treading water) … 1 (the breaststroke), the stroke at `phase` (0..1 of a cycle) */
  swim(dt: number, stroke: number, phase: number, treadDt = dt): void {
    const st = this.actions.get('swimStroke'), tr = this.actions.get('swimTread');
    if (st === undefined || tr === undefined) return;
    st.setEffectiveWeight(stroke);
    tr.setEffectiveWeight(1 - stroke);
    st.time = (((phase % 1) + 1) % 1) * st.getClip().duration;
    tr.time = (tr.time + treadDt) % tr.getClip().duration;
    this.mixer.update(0);
  }
}

/** the engine's moves → a round-13 rig's clips (their timings are the engine's: light = SLASH, light2 = BACKHAND,
 *  light3 = FINISHER, heavy = HEAVY after charge) */
const CLIP: Readonly<Record<Move['name'] | 'charge', string>> = {
  slash: 'light', backhand: 'light2', finisher: 'light3', heavy: 'heavy', charge: 'charge', 'pass-left': 'light', 'pass-right': 'light2',
};

/**
 * A RigArms as the engine Sword's animated rig: the moves → the clips, the viewmodel's projection (vmScale), a framing
 * offset in canonical rig units, the blade for the hit sweep and the engine's own trail (`engineTrail`), and `setup` —
 * the shard's materials, made once the Sword hands over the sky.
 *
 * `frame` places the whole rig on the screen without re-authoring a clip: `size` shrinks it about the view's centre (its
 * camera-space x and y; the arms still run out of the frame, they reach back to the shoulders), then `pitch` / `yaw` /
 * `roll` (rad) turn it about the eye — a turn about the eye moves the picture, it does not change it. The object is
 * kept on `root.userData.vmFrame` and read every frame (a capture script can tune it live).
 */
export interface VmFrame { size: number; pitch: number; yaw: number; roll: number }
/** a sword viewmodel built on rigged arms (its offset, framing and sky setup) */
export function swordArmsOf(rig: RigArms, opts: { offset?: Vector3; frame?: Partial<VmFrame>; setup?: (sky: Sky) => void }): SwordArms {
  const off = opts.offset ?? new Vector3();
  const frame: VmFrame = { size: 1, pitch: 0, yaw: 0, roll: 0, ...opts.frame };
  rig.root.userData['vmFrame'] = frame;
  let k = 1;
  return {
    root: rig.root,
    engineTrail: true,
    play: (move) => { rig.play(CLIP[move]); },
    update: (dt, s) => {
      k = vmScale(s.camera.fov);
      const ks = k * frame.size;
      rig.root.scale.set(ks, ks, 1);
      rig.root.position.set(off.x * ks, off.y * ks, off.z);
      rig.update(dt, { speed: s.speed, walkPhase: s.walkPhase, lookVel: s.lookVel });
      // put away (a weapon swap, the talk's stow, E129): the Sword drops the holder 0.45 m, which leaves the tip of a blade
      // held this high in the frame; tipping the rig down about the eye as well takes it all out
      rig.root.rotation.x += frame.pitch - (s.holster ?? 0) * 0.5;
      rig.root.rotation.y += frame.yaw;
      rig.root.rotation.z += frame.roll;
      rig.root.position.applyEuler(rig.root.rotation);
    },
    blade: (base, tip) => {
      rig.blade(base, tip);
      rig.root.updateMatrix();
      base.applyMatrix4(rig.root.matrix);
      tip.applyMatrix4(rig.root.matrix);
    },
    ...(opts.setup === undefined ? {} : { setup: opts.setup }),
  };
}
