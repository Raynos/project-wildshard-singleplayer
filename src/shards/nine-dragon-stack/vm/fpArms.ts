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
import { type AnimationClip, type BufferGeometry, BufferGeometryLoader, MaterialLoader, ShaderMaterial, DoubleSide, Group, type Matrix3, Mesh, type Texture, Vector3 } from 'three';
import { ClothSheet, StrandTassel, clothPenetration } from '../runtime/looks/strandCloth';
import { ARMS, ARMS_BASE, ARMS_MAPS } from '../data/arms';
import { plainWeaveTexture } from '../runtime/looks/weave';
import * as v from 'valibot';
import { loadFirstPartyProduct } from '@wildshard/game/shardfile/runtimeProduct';

import { type Decals, type VmUniforms, decalAtlas, inkHullMaterial, vmMaterial, vmUniforms } from './materials';
import { FpArmsRig, type FpArmsRig as FpArmsRigView, type FpArmsState, armRigBake, armRigContract, rigRoot, takeRigScene } from '../runtime/viewmodel/fpArmsRig';
import { type InkedRigMaps, addInkedPair, dressInkedMesh, loadInkedRigMaps } from '../runtime/viewmodel/inkedRig';
import type { RigContract, RigBake } from '@wildshard/engine/anim/rig';
import { app } from '@wildshard/engine/app/runtime';
import type { NdTier } from '../tier';

const finite = v.number();
const breeze = v.tuple([finite, finite, finite, finite, finite]);
const attributes = v.strictObject({ normals: v.array(v.string()), hull: v.string() });
const ClothRows = v.strictObject({
  tassel: v.strictObject({
    strands: finite, pts: finite, len: finite, cordPts: finite, cordLen: finite, capR: finite, strandR: finite, cap: finite,
    cordSegs: finite, strandSegs: finite, cordRadius: finite, strandTaper: v.tuple([finite, finite, finite, finite]),
    substeps: finite, cordDamp: finite, strandDamp: finite, cordIters: finite, strandIters: finite,
    bundle: finite, bundleFall: finite, bundleWiden: finite, restDrop: finite, restWiden: finite, bend: finite, cordPad: finite,
    spread: v.tuple([finite, finite, finite, finite]), breezeX: breeze, breezeZ: breeze, attributes,
  }),
  sheet: v.strictObject({
    cols: finite, rows: finite, w: finite, h: finite, cordPts: finite, cordLen: finite, cordSegs: finite, cordRadius: finite,
    substeps: finite, cordDamp: finite, sheetDamp: finite, cordIters: finite, iters: finite,
    shear: finite, bendRows: finite, bendCols: finite, pad: finite, flutterPow: finite, flutter: breeze, sway: breeze, attributes,
  }),
});
interface ClothGeometry { readonly rows: v.InferOutput<typeof ClothRows>; readonly knot: BufferGeometry; readonly tassel: BufferGeometry; readonly sheet: BufferGeometry; readonly cord: BufferGeometry }
interface HaloRows { readonly geometry: unknown; readonly material: Readonly<Record<string, unknown>> }
const VS_HALO = /* glsl */ `
attribute vec3 aTan;
attribute vec2 aSide;
attribute float aOut;
uniform vec2 uRes;
uniform float uPx;
varying vec2 vS;
void main() {
  vec4 c0 = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  vec4 c1 = projectionMatrix * modelViewMatrix * vec4(position + aTan * 0.01, 1.0);
  vec4 c2 = projectionMatrix * modelViewMatrix * vec4(position + vec3(aOut * 0.01, 0.0, 0.0), 1.0);
  vec2 s0 = c0.xy / c0.w, s1 = c1.xy / c1.w, s2 = c2.xy / c2.w;
  vec2 d = normalize((s1 - s0) * uRes + 1e-6);
  vec2 perp = vec2(-d.y, d.x);
  // the glow lives outside the blade: the side over the black body is a third as wide
  float outer = dot(perp * aSide.x, (s2 - s0) * uRes) > 0.0 ? 1.0 : 0.3;
  c0.xy += perp * aSide.x * uPx * outer * 2.0 / uRes * c0.w;
  vS = vec2(aSide.x, aSide.y);
  gl_Position = c0;
}
`;
const FS_HALO = /* glsl */ `
uniform float uTime;
uniform vec3 uColor;
uniform float uGain;
varying vec2 vS;
float h21(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float vn(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(h21(i), h21(i + vec2(1, 0)), f.x), mix(h21(i + vec2(0, 1)), h21(i + vec2(1, 1)), f.x), f.y); }
void main() {
  // across: |vS.x| 0 at the edge → 1 at the ribbon's rim; along: vS.y in metres from the root
  float along = vS.y;
  // heat shimmer: the falloff's width and brightness waver along the edge, drifting toward the tip
  float n1 = vn(vec2(along * 90.0 - uTime * 3.1, vS.x * 1.5 + uTime * 0.7));
  float n2 = vn(vec2(along * 230.0 - uTime * 7.0, 3.0));
  float w = 0.55 + 0.45 * n1;
  float a = exp(-pow(abs(vS.x) / (0.35 * w + 0.12), 2.0) * 2.2);
  a *= 0.7 + 0.5 * n2;
  // fade in from the root, out at the very tip
  a *= smoothstep(0.0, 0.05, along) * (1.0 - smoothstep(0.7, 0.76, along));
  gl_FragColor = vec4(uColor * a * uGain, 1.0);
}
`;


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

/** the living parts: the tassel's knot + cap, the strands, the talisman (root space), the halo on the weapon */
function dressParts(rig: FpArmsRigView, u: VmUniforms, tassel: StrandTassel, talisman: ClothSheet, haloRows: HaloRows, geometry: ClothGeometry): { knot: Group; halo: Mesh } {
  const knot = new Group();
  const hullThin = inkHullMaterial(u, 0.55);
  // the tassel's strands are 5–7 px wide on the phone: a full brush hull would ink them solid black
  const hullHair = inkHullMaterial(u, 0.18);
  const body = vmMaterial(u);
  const cloth = vmMaterial(u);
  cloth.side = DoubleSide;
  rig.materials.push(hullThin, hullHair, body, cloth);
  addInkedPair(knot, geometry.knot, body, hullThin, true);
  rig.root.add(knot);
  addInkedPair(rig.root, tassel.geo, body, hullHair, false);
  addInkedPair(rig.root, talisman.geo, cloth, hullThin, false);
  addInkedPair(rig.root, talisman.cordGeo, body, hullThin, false);
  const material = new MaterialLoader().parse({ ...haloRows.material, vertexShader: VS_HALO, fragmentShader: FS_HALO });
  if (!(material instanceof ShaderMaterial)) throw new Error('Jian halo requires its shader material');
  const halo = new Mesh(new BufferGeometryLoader().parse(haloRows.geometry), material);
  halo.frustumCulled = false;
  halo.renderOrder = 4;
  rig.materials.push(material);
  rig.bones.get(ARMS.weapon)?.add(halo);
  rig.hang('tassel', tassel);
  rig.hang('talisman', talisman);
  return { knot, halo };
}

export class NineDragonArms extends FpArmsRig {
  readonly u: VmUniforms;
  readonly halo: Mesh;
  private readonly tassel: StrandTassel;
  private readonly talisman: ClothSheet;
  private readonly knot: Group;
  private t = 0;

  private constructor(scene: Group, clips: AnimationClip[], textures: InkedRigMaps, silk: Texture, tier: NdTier, halo: HaloRows, geometry: ClothGeometry) {
    const tassel = new StrandTassel(geometry.rows.tassel, geometry.tassel), talisman = new ClothSheet(geometry.rows.sheet, geometry.sheet, geometry.cord);
    const u = vmUniforms(silk, sharedDecals(tier));
    const parts: { knot?: Group; halo?: Mesh } = {};
    const look = { body: (maps: Texture | null, nrm: Texture | null, rot: Matrix3 | null) => vmMaterial(u, maps, nrm, rot), hull: (k: number) => inkHullMaterial(u, k) };
    super(scene, clips, ARMS, ARMS_CONTRACT, ARMS_BAKE, {
      mesh: (o, ud, rig) => dressInkedMesh(o, ud, rig, look, textures),
      dress: (rig) => { Object.assign(parts, dressParts(rig, u, tassel, talisman, halo, geometry)); },
    });
    if (parts.knot === undefined || parts.halo === undefined) throw new Error('nine-dragon: the arms were not dressed');
    this.u = u;
    this.tassel = tassel;
    this.talisman = talisman;
    this.knot = parts.knot;
    this.halo = parts.halo;
  }

  static async load(tier: NdTier = app.render?.tier ?? 'desktop', url = RIG_URL): Promise<NineDragonArms> {
    const product = await loadFirstPartyProduct('nine-dragon-stack');
    const halo = v.parse(v.strictObject({ geometry: v.unknown(), material: v.record(v.string(), v.unknown()) }), JSON.parse(new TextDecoder().decode(await product.file('weapons/jian-halo.json')), (_key, value: unknown) => value === '-0' ? -0 : value));
    const parts = v.parse(v.strictObject({ rows: ClothRows, knot: v.unknown(), tassel: v.unknown(), sheet: v.unknown(), cord: v.unknown() }), JSON.parse(new TextDecoder().decode(await product.file('weapons/jian-cloth.json')), (_key, value: unknown) => value === '-0' ? -0 : value));
    const loader = new BufferGeometryLoader();
    const geometry = { rows: parts.rows, knot: loader.parse(parts.knot), tassel: loader.parse(parts.tassel), sheet: loader.parse(parts.sheet), cord: loader.parse(parts.cord) };
    const gltf = await takeRigScene(url);
    const textures = await loadInkedRigMaps(ARMS_BASE, ARMS_MAPS);
    return new NineDragonArms(rigRoot(gltf.scene), gltf.animations, textures, plainWeaveTexture(), tier, halo, geometry);
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
    return clothPenetration([...this.tassel.points(), ...this.talisman.points()], this.colliders());
  }
}
