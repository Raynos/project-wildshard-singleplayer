// NineDragonArms — the engine-ready first-person rig of Nine Dragon Stack (lab P8 "viewmodel", round 13, E169).
// (Moved into the shard from the dev labs (deleted in E357 F7) for P0-5c; the engine drives it through vm/arms.ts.)
//
// ONE skinned GLB (`fp-rig.glb`, baked by bake.ts) holds both arms (shoulder → upper arm → forearm with three twist
// bones → hand), the Neon Jian (a rigid child of R_weapon), the Fei Zhua gauntlet with its claw (L_claw), the ink-hull
// proxies and every clip. The SDK's first-person arm rig (@wildshard/sdk/viewmodel/fpArmsRig, its row data/arms.ts) plays
// it: two channels (right: the jian arm, left: the Fei Zhua arm), each a base loop (idle ↔ walk by speed) under one-shot
// moves that CROSSFADE (80–150 ms) — a move never restarts from a snap — the 飞白 trail and the cloth. This module dresses
// it: the toon and ink-hull materials, the baked tassel + talisman in weapon space,
// the tassel's baked drape and bounded flutter, the edge halo.
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
import { type BufferGeometry, BufferGeometryLoader, MaterialLoader, ShaderMaterial, DoubleSide, type Matrix3, Mesh, type Texture, type Material, Matrix4, Vector3, Vector2 } from 'three';
import rigRows from '../data/arms.json' with { type: 'json' };
import { restoreWeave } from '../look/style';
import * as v from 'valibot';
import { loadFirstPartyProduct } from '@wildshard/game/shardfile/runtimeProduct';

import { type Decals, type VmUniforms, decalAtlas, inkHullMaterial, vmMaterial, vmUniforms, prepareVmGraphs } from './materials';
import { RigArms, swordArmsOf, type RigState } from '@wildshard/game/systems/viewmodel/rigArms';
import { ARM_CLIPS, armClipNames } from '@wildshard/game/systems/viewmodel/armClips';
import { BrushTrail } from '../runtime/viewmodel/brushTrail';
import type { ShardSword } from '@wildshard/game/shard/manifest';
import { type InkedRigMaps, addInkedPair, dressInkedMesh, loadInkedRigMaps, prepRigGeometry } from '../runtime/viewmodel/inkedRig';
import type { RigContract, RigBake } from '@wildshard/engine/anim/rig';
import { app } from '@wildshard/engine/app/runtime';
import type { Tier as NdTier } from '@wildshard/engine/core/tier';

interface ClothGeometry { readonly knot: BufferGeometry; readonly tassel: BufferGeometry; readonly sheet: BufferGeometry; readonly cord: BufferGeometry }
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


export const RIG_URL = `${rigRows.ARMS_BASE}fp-rig.glb`;

export const ARMS_CONTRACT: RigContract = { skeleton: 'nine-dragon-fp', clips: armClipNames(ARM_CLIPS), sockets: ['R_weapon', 'L_claw'] };
export const ARMS_BAKE: RigBake = { skeleton: 'nine-dragon-fp', clips: ARM_CLIPS, joints: ['R', 'L'].map(side => ['shoulder', 'upperarm', 'forearm', 'twist1', 'twist2', 'twist3', 'hand'].map(joint => `${side}_${joint}`)) };

export type MoveName = 'light' | 'light2' | 'light3' | 'charge' | 'heavy' | 'parry' | 'draw' | 'sheathe' | 'sheathed';
export type LeftName = 'grapple_aim' | 'grapple_fire' | 'grapple_hold' | 'idle';
export type ArmsState = RigState;

/** the decal atlas (a 2048 × 1024 canvas, drawn once): every rig of the shard reads the same one */
const atlases = new Map<NdTier, Decals>();
function sharedDecals(tier: NdTier): Decals {
  let d = atlases.get(tier);
  if (d === undefined) { d = decalAtlas(tier); atlases.set(tier, d); }
  return d;
}

/** the living parts: the tassel's knot + cap, the strands, the talisman (root space), the halo on the weapon */
function dressParts(rig: NineDragonArms, u: VmUniforms, haloRows: HaloRows, geometry: ClothGeometry): Mesh {
  const weapon = rig.bones.get(rigRows.ARMS.weapon);
  if (weapon === undefined) throw new Error('Jian pendant socket is missing');
  const hullThin = inkHullMaterial(u, 0.55, true);
  // the tassel's strands are 5–7 px wide on the phone: a full brush hull would ink them solid black
  const hullHair = inkHullMaterial(u, 0.18, true);
  const body = vmMaterial(u);
  const cloth = vmMaterial(u, null, null, null, true);
  const silk = vmMaterial(u, null, null, null, true);
  const knotHull = inkHullMaterial(u, 0.55);
  cloth.side = DoubleSide;
  rig.materials.push(hullThin, hullHair, body, cloth, silk, knotHull);
  addInkedPair(weapon, geometry.knot, body, knotHull, true);
  addInkedPair(weapon, geometry.tassel, silk, hullHair, false);
  addInkedPair(weapon, geometry.sheet, cloth, hullThin, false);
  addInkedPair(weapon, geometry.cord, silk, hullThin, false);
  const material = new MaterialLoader().parse({ ...haloRows.material, vertexShader: VS_HALO, fragmentShader: FS_HALO });
  if (!(material instanceof ShaderMaterial)) throw new Error('Jian halo requires its shader material');
  const halo = new Mesh(new BufferGeometryLoader().parse(haloRows.geometry), material);
  halo.frustumCulled = false;
  halo.renderOrder = 4;
  rig.materials.push(material);
  rig.bones.get(rigRows.ARMS.weapon)?.add(halo);
  return halo;
}

export class NineDragonArms {
  readonly u: VmUniforms;
  readonly halo: Mesh;
  readonly materials: Material[] = [];
  readonly trail = new BrushTrail();
  readonly root: RigArms['root'];
  readonly bones: RigArms['nodes'];
  private t = 0;
  private readonly matrix = new Matrix4();

  private constructor(readonly rig: RigArms, textures: InkedRigMaps, silk: Texture, tier: NdTier, halo: HaloRows, geometry: ClothGeometry) {
    this.root = rig.root; this.bones = rig.nodes;
    this.u = vmUniforms(silk, sharedDecals(tier));
    const look = { body: (maps: Texture | null, nrm: Texture | null, rot: Matrix3 | null) => vmMaterial(this.u, maps, nrm, rot), hull: (k: number) => inkHullMaterial(this.u, k) };
    for (const mesh of rig.meshes()) {
      prepRigGeometry(mesh.geometry, rigRows.ARMS.rename);
      dressInkedMesh(mesh, mesh.userData, this, look, textures);
    }
    this.halo = dressParts(this, this.u, halo, geometry);
    this.root.add(this.trail.mesh);
  }

  static async load(tier: NdTier = app.render?.tier ?? 'desktop', url = RIG_URL): Promise<NineDragonArms> {
    const render = app.render;
    if (render === null) throw new Error('Held graphs require the render service');
    await prepareVmGraphs(render.renderer);
    const product = await loadFirstPartyProduct('nine-dragon-stack');
    const halo = v.parse(v.strictObject({ geometry: v.unknown(), material: v.record(v.string(), v.unknown()) }), JSON.parse(new TextDecoder().decode(await product.file('weapons/jian-halo.json')), (_key, value: unknown) => value === '-0' ? -0 : value));
    const parts = v.parse(v.strictObject({ knot: v.unknown(), tassel: v.unknown(), sheet: v.unknown(), cord: v.unknown() }), JSON.parse(new TextDecoder().decode(await product.file('weapons/jian-cloth.json')), (_key, value: unknown) => value === '-0' ? -0 : value));
    const loader = new BufferGeometryLoader();
    const geometry = { knot: loader.parse(parts.knot), tassel: loader.parse(parts.tassel), sheet: loader.parse(parts.sheet), cord: loader.parse(parts.cord) };
    const rig = await RigArms.load(url, ARMS_CONTRACT, ARMS_BAKE, false, { aliases: ARM_CLIPS, holdRight: rigRows.ARMS.holdRight, holdLeft: rigRows.ARMS.holdLeft, walkRate: rigRows.ARMS.walkRate, lag: rigRows.ARMS.lag });
    const textures = await loadInkedRigMaps(rigRows.ARMS_BASE, rigRows.ARMS_MAPS);
    return new NineDragonArms(rig, textures, restoreWeave(await product.file('looks/plain-weave.r8')), tier, halo, geometry);
  }

  /** start a right-arm move (crossfade `fade` s). 'charge' and 'sheathe' hold their last pose until the next play. */
  beginTrail(): void {
    const name = this.rig.move ?? 'light';
    this.trail.begin((this.rig.meta.clips[name]?.timing?.total ?? rigRows.ARMS.trail.total) * rigRows.ARMS.trail.life, Math.random() * 100);
  }

  /** the left arm: the grapple's poses, or 'idle' to fade back */
  playLeft(name: LeftName, fade = 0.1): void { this.rig.playLeft(name, fade); }

  setClawVisible(on: boolean): void { for (const mesh of this.rig.meshes()) if (mesh.name.startsWith(rigRows.ARMS.claw)) mesh.visible = on; }

  blade(base: Vector3, tip: Vector3, from = 0): void {
    const weapon = this.bones.get(rigRows.ARMS.weapon); if (weapon === undefined) return;
    this.root.updateMatrixWorld(true);
    this.matrix.copy(this.root.matrixWorld).invert().multiply(weapon.matrixWorld);
    base.set(0, rigRows.ARMS.bladeBase + (rigRows.ARMS.bladeTip - rigRows.ARMS.bladeBase) * from, 0).applyMatrix4(this.matrix);
    tip.set(0, rigRows.ARMS.bladeTip, 0).applyMatrix4(this.matrix);
  }

  /** buffer size + pixel ratio: the ink widths and the halo are in pixels */
  resize(bw: number, bh: number, pr: number): void {
    this.u.uRes.value.set(bw, bh);
    this.u.uLinePx.value = Math.max(1.0, 1.6 * (pr / 2));
    this.u.uHullPx.value = Math.max(1.0, 2.4 * (pr / 2));
    const material = this.halo.material;
    if (material instanceof ShaderMaterial) {
      const res = material.uniforms['uRes'], px = material.uniforms['uPx'];
      if (res?.value instanceof Vector2) res.value.set(bw, bh);
      if (px !== undefined) px.value = 7 * pr;
    }
  }

  update(dt: number, s: ArmsState): void { this.rig.update(dt, s); this.advanceLook(dt); }

  advanceLook(dt: number): void {
    this.t += dt;
    this.u.uTime.value = this.t;
    const hu = (this.halo.material as ShaderMaterial).uniforms['uTime'];
    if (hu !== undefined) hu.value = this.t;
    const name = this.rig.move, clip = name === null ? undefined : this.rig.meta.clips[name];
    const timing = clip?.timing;
    if (timing !== null && timing !== undefined && this.rig.time >= timing.windup && this.rig.time <= timing.slashEnd) {
      const base = new Vector3(), tip = new Vector3();
      const trailFrom = clip !== undefined && 'trailFrom' in clip && typeof clip.trailFrom === 'number' ? clip.trailFrom : rigRows.ARMS.trail.from;
      this.blade(base, tip, trailFrom); this.trail.sample(base, tip);
    }
    this.trail.update(dt);
  }
}

/** The shared rig player owns clip blending and the held camera projection. */
export async function jianArms(): Promise<ShardSword> {
  const rig = await NineDragonArms.load();
  rig.root.traverse(node => { node.userData['treatAsOpaque'] = true; });
  const arms = swordArmsOf(rig.rig, {});
  return { arms: { ...arms, engineTrail: false,
    play: move => { arms.play(move); rig.beginTrail(); },
    blade: (base, tip) => {
      rig.blade(base, tip); rig.root.updateMatrix();
      base.applyMatrix4(rig.root.matrix); tip.applyMatrix4(rig.root.matrix);
    },
    playLeft: name => { rig.playLeft(name); },
    setClawVisible: visible => { rig.setClawVisible(visible); },
    update: (dt, state) => {
      const renderer = state.renderer;
      rig.resize(renderer.domElement.width, renderer.domElement.height, renderer.getPixelRatio());
      arms.update(dt, state); rig.advanceLook(dt);
    },
  } };
}
