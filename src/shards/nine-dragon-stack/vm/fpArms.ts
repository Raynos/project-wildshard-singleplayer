// NineDragonArms — the engine-ready first-person rig of Nine Dragon Stack (lab P8 "viewmodel", round 13, E169).
// (Moved into the shard from the dev labs (deleted in E357 F7) for P0-5c; the engine drives it through vm/arms.ts.)
//
// ONE skinned GLB (`fp-rig.glb`, baked by bake.ts) holds both arms (shoulder → upper arm → forearm with three twist
// bones → hand), the Neon Jian (a rigid child of R_weapon), the Fei Zhua gauntlet with its claw (L_claw), the ink-hull
// proxies and every clip. The SDK's first-person arm rig (@wildshard/sdk/viewmodel/fpArmsRig, its row data/arms.ts) plays
// it: two channels (right: the jian arm, left: the Fei Zhua arm), each a base loop (idle ↔ walk by speed) under one-shot
// moves that CROSSFADE (80–150 ms) — a move never restarts from a snap — the 飞白 trail and the cloth. This module dresses
// it: the toon and ink-hull materials, the verlet tassel + talisman (colliding with the fist, the forearm and the guard),
// the tassel's knot, the edge halo.
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
  type AnimationClip, type BufferGeometry, DoubleSide, Group, Matrix3, Mesh, type Object3D, type ShaderMaterial, SkinnedMesh, type Texture, Vector3,
} from 'three';
import { Talisman, Tassel, penetration } from './cloth';
import { Geo, v3 } from './geo';
import { CLS } from '../data/vmLook';
import { ARMS, ARMS_BASE, ARMS_MAPS } from '../data/arms';
import { plainWeaveTexture } from '@wildshard/sdk/looks/weave';
import { buildHalo } from './jian';
import { type Decals, type VmUniforms, decalAtlas, inkHullMaterial, vmMaterial, vmUniforms } from './materials';
import { FpArmsRig, type FpArmsRigView, type FpArmsState, type FpMeshData, armRigBake, armRigContract, rigRoot, sharedRigMaps, takeRigScene } from '@wildshard/sdk/viewmodel/fpArmsRig';
import type { RigContract, RigBake } from '@wildshard/engine/anim/rig';
import { app } from '@wildshard/engine/app/runtime';
import type { NdTier } from '../tier';

export const RIG_URL = `${ARMS_BASE}fp-rig.glb`;

export const ARMS_CONTRACT: RigContract = armRigContract('nine-dragon-fp', ['R_weapon', 'L_claw']);
export const ARMS_BAKE: RigBake = armRigBake('nine-dragon-fp', ['R', 'L'], ['shoulder', 'upperarm', 'forearm', 'twist1', 'twist2', 'twist3', 'hand']);

export type MoveName = 'light' | 'light2' | 'light3' | 'charge' | 'heavy' | 'parry' | 'draw' | 'sheathe' | 'sheathed';
export type LeftName = 'grapple_aim' | 'grapple_fire' | 'grapple_hold' | 'idle';
export type ArmsState = FpArmsState;

/** the decal atlas (a 2048 × 1024 canvas, drawn once): every rig of the shard reads the same one */
const atlases = new Map<NdTier, Decals>();
function sharedDecals(tier: NdTier): Decals {
  let d = atlases.get(tier);
  if (d === undefined) { d = decalAtlas(tier); atlases.set(tier, d); }
  return d;
}

/** the GLB's meshes: the ink hulls, and the toon bodies with their part's maps */
function dressMesh(o: Mesh, ud: FpMeshData, rig: FpArmsRigView, u: VmUniforms, textures: Map<string, [Texture | null, Texture | null]>): 'hull' | 'body' {
  if (ud.hull === true) {
    const m = inkHullMaterial(u, ud.hullK ?? 1);
    o.material = m;
    o.renderOrder = -1;
    rig.materials.push(m);
    return 'hull';
  }
  const tex = ud.maps === undefined ? undefined : textures.get(ud.maps);
  const rot = ud.assetRot === undefined ? null : new Matrix3().fromArray(ud.assetRot);
  const m = vmMaterial(u, tex?.[0] ?? null, tex?.[1] ?? null, rot);
  // the sleeves, cuffs and the gauntlet are open tubes: a swing looks into them, so their insides are drawn too
  // (single-sided, the ink hull's back faces showed through as a black hole)
  if (o instanceof SkinnedMesh) m.side = DoubleSide;
  o.material = m;
  rig.materials.push(m);
  return 'body';
}

/** the living parts: the tassel's knot + cap, the strands, the talisman (root space), the halo on the weapon */
function dressParts(rig: FpArmsRigView, u: VmUniforms, tassel: Tassel, talisman: Talisman): { knot: Group; halo: Mesh } {
  const kx = new Geo();
  kx.ellipsoid(v3(0, 0.008, 0), v3(1, 0, 0), v3(0, 1, 0), v3(0, 0, 1), 0.012, 0.0135, 0.012, { cls: CLS.silk }, (d) => 1 + 0.08 * Math.sin(d.x * 9) * Math.sin(d.z * 9), 14);
  kx.lathe(0, -0.024, 0, [[0.007, 0], [0.0135, 0.005], [0.0145, 0.012], [0.012, 0.018], [0.008, 0.022]], 16, { cls: CLS.brass, line: 1, edges: 4 | 8 });
  const knotGeo = kx.build();
  const knot = new Group();
  const hullThin = inkHullMaterial(u, 0.55);
  // the tassel's strands are 5–7 px wide on the phone: a full brush hull would ink them solid black
  const hullHair = inkHullMaterial(u, 0.18);
  const body = vmMaterial(u);
  const cloth = vmMaterial(u);
  cloth.side = DoubleSide;
  rig.materials.push(hullThin, hullHair, body, cloth);
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
  hulled(knotGeo, body, knot, true);
  rig.root.add(knot);
  hulled(tassel.geo, body, rig.root, false, hullHair);
  hulled(talisman.geo, cloth, rig.root, false);
  hulled(talisman.cordGeo, body, rig.root, false);
  const h = buildHalo();
  const halo = new Mesh(h.geo, h.mat);
  halo.frustumCulled = false;
  halo.renderOrder = 4;
  rig.materials.push(h.mat);
  rig.bones.get(ARMS.weapon)?.add(halo);
  rig.hang('tassel', tassel);
  rig.hang('talisman', talisman);
  return { knot, halo };
}

export class NineDragonArms extends FpArmsRig {
  readonly u: VmUniforms;
  readonly halo: Mesh;
  private readonly tassel: Tassel;
  private readonly talisman: Talisman;
  private readonly knot: Group;
  private t = 0;

  private constructor(scene: Group, clips: AnimationClip[], textures: Map<string, [Texture | null, Texture | null]>, silk: Texture, tier: NdTier) {
    const tassel = new Tassel(), talisman = new Talisman();
    const u = vmUniforms(silk, sharedDecals(tier));
    const parts: { knot?: Group; halo?: Mesh } = {};
    super(scene, clips, ARMS, ARMS_CONTRACT, ARMS_BAKE, {
      mesh: (o, ud, rig) => dressMesh(o, ud, rig, u, textures),
      dress: (rig) => { Object.assign(parts, dressParts(rig, u, tassel, talisman)); },
    });
    if (parts.knot === undefined || parts.halo === undefined) throw new Error('nine-dragon: the arms were not dressed');
    this.u = u;
    this.tassel = tassel;
    this.talisman = talisman;
    this.knot = parts.knot;
    this.halo = parts.halo;
  }

  static async load(tier: NdTier = app.render?.tier ?? 'desktop', url = RIG_URL): Promise<NineDragonArms> {
    const gltf = await takeRigScene(url);
    const pairs = await Promise.all(ARMS_MAPS.map((n) => sharedRigMaps(ARMS_BASE, n)));
    const textures = new Map<string, [Texture | null, Texture | null]>();
    for (let i = 0; i < ARMS_MAPS.length; i++) textures.set(ARMS_MAPS[i] ?? '', pairs[i] ?? [null, null]);
    return new NineDragonArms(rigRoot(gltf.scene), gltf.animations, textures, plainWeaveTexture(), tier);
  }

  /** start a right-arm move (crossfade `fade` s). 'charge' and 'sheathe' hold their last pose until the next play. */
  override play(name: MoveName, fade = 0.1): void { super.play(name, fade, Math.random() * 100); }

  /** the left arm: the grapple's poses, or 'idle' to fade back */
  override playLeft(name: LeftName, fade = 0.1): void { super.playLeft(name, fade); }

  /** buffer size + pixel ratio: the ink widths and the halo are in pixels */
  resize(bw: number, bh: number, pr: number): void {
    this.u.uRes.value.set(bw, bh);
    this.u.uLinePx.value = Math.max(1.0, 1.6 * (pr / 2));
    this.u.uHullPx.value = Math.max(1.0, 2.4 * (pr / 2));
    this.resizeMaterials(bw, bh, pr);
  }

  override update(dt: number, s: ArmsState): void {
    this.t += dt;
    this.u.uTime.value = this.t;
    const hu = (this.halo.material as ShaderMaterial).uniforms['uTime'];
    if (hu !== undefined) hu.value = this.t;
    super.update(dt, s);
    if (this.bones.has(ARMS.weapon)) {
      this.knot.position.copy(this.tassel.cap);
      this.knot.quaternion.setFromUnitVectors(new Vector3(0, -1, 0), this.tassel.capDir);
    }
  }

  /** how deep the tassel / talisman sit inside the fist, forearm or guard right now (m; the gate's cloth check) */
  clothPenetration(): number {
    return penetration([...this.tassel.points(), ...this.talisman.points()], this.colliders());
  }
}
