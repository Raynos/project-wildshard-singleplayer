import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { getSetting } from '../ui/Settings';
import { LightPool } from '../fx/LightPool';
import {
  Puffs, viewmodelMaterial, viewmodelTexSet, whiteColors, edgeWear, fovForAspect, FOV_HIP, FOV_ADS, box, cyl, stripExtra, sstep, clamp01,
  isMesh, worldHit, impactSurfaceOf, fixIBL, VIEWMODEL_GROUP, type TexSet, type Targets, type ImpactSurface, type CrossbowWorld, type CrossbowOptions,
} from './Crossbow';
import { makeFlashTexture, HitLine, brassFloor } from './Rifle';
import type { KitWeapon, WeaponState, AimInfo } from './Weapons';
import { SHADOW_LAYER } from '../core/shadowLayer';

/**
 * LeverRifle — Pine Hollow's rifle (PINE-HOLLOW-REMASTER PH-U5 / PH-C11): a 1900s backwoods lever-action carbine in the
 * Winchester 1894 mould, replacing the AR-15 on Pine Hollow only (Driftwood and the dev harnesses keep Rifle.ts). It fills
 * the same kit slot (`id 'rifle'`: the cabin pickup, Old Ironhide's skin, the trader's Scarback Furnace finish) and the
 * same `KitWeapon` contract, so Weapons.ts / the HUD / Combat / the feel hooks need nothing new.
 *
 *   const rifle = new LeverRifle({ game, sky, player, forest }, targets, { allowUnlocked, woodFrom: crossbow.model });
 *   weapons = new Weapons(crossbow, rifle, [...]);   // the manager calls setActive / update / drives `holster`
 *   rifle.onCycle = () => sfx.shot('leverCycle')     // the lever thrown (after every shot, and to chamber after a reload)
 *   rifle.onRoundIn = () => …                        // one cartridge thumbed through the loading gate
 *
 * The model (PH-C11 remaster) is modelled + baked in Blender (scripts/blender/weapons/: lever_rifle.py, run.sh) and loaded
 * from `LEVER_MODEL_URL` (meshopt, WebP atlases; the phone tier's `.phone.glb` through tierUrl — ≈ 8 k tris + 1024²
 * atlases desktop, ≈ 4 k + 512² phone): a colour-case-hardened receiver (the bolt in its top channel, the loading gate on
 * the right), the hammer + spur, a round tapered barrel with a crowned muzzle over the magazine tube, the forend band and
 * the carbine's barrel band, the loop lever, the trigger, the tangs, an oiled-walnut forend and straight-grip stock with a
 * crescent buttplate, a semi-buckhorn rear sight on its base, the front ramp + blade (the gold bead stays this file's
 * sphere, the aim reference). `preloadLeverModel()` (main.ts, awaited by the weapon step) fetches it; `?rifle=proc` — or a
 * failed load — keeps the procedural build below (thin parts: image-to-3D mangles a 9 mm barrel and a lever loop). Either
 * way the same parts (the static steel, the forend, the stock, the lever / hammer about their pivots, the bolt), the same
 * seven draws and four materials ('lever-wood', 'lever-steel', 'lever-brass', + the flash), all on the viewmodels'
 * shared lit program (Crossbow.viewmodelMaterial) — the rifle compiles no program of its own. The skins restyle it by
 * those names. The cabin pickup (`displayModel`) draws with its own copies of the materials, so its orb's glow stays off
 * the rifle in your hands.
 *
 * Action: TUBE_MAX rounds in the tube + one chambered (7 in the gun). A shot fires the chambered round (HITSCAN like
 * Rifle.ts, ×DAMAGE_SCALE the bolt model — a .30-30 hits hard) and drops the hammer; after CYCLE_DELAY the lever is thrown
 * (LEVER_TIME: the loop swings down, the bolt runs back and cocks the hammer, the empty case spins up out of the top, the
 * lever closes and chambers the next round from the tube). No second shot until the cycle is done — the defining rhythm.
 * `R` (or a trigger pull on an empty gun) reloads THROUGH THE GATE, ONE ROUND AT A TIME (ROUND_TIME each: the rifle rolls
 * its right side up, a cartridge is pushed in); a trigger pull mid-reload stops it after the round in hand; a gun that
 * was run dry is cycled at the end to chamber one.
 *
 * ADS = iron sights at a real eye relief: model rotation 0, the eye on the comb (EYE_Z) exactly on the sight line, the
 * gold bead sitting in the buckhorn's notch on the crosshair, the receiver's top and the hammer low in the frame; FOV
 * 72 → 58 (the crossbow's 1.3×). The cycle pulls the rifle down off the eye and back.
 */

export interface LeverRifleOptions extends CrossbowOptions {
  /** take the muzzle flash's light from the scene's LightPool at boot (default) — Rifle.ts's reasoning */
  muzzleLight?: boolean;
  /** a viewmodel to borrow the walnut from (the crossbow's 'xbow-wood' textures, shared on the GPU); absent = drawn here.
   *  The procedural build's only. */
  woodFrom?: THREE.Object3D | null;
  /** the Blender model to build from; absent = whatever `preloadLeverModel()` has delivered, null = the procedural build */
  model?: LeverModel | null;
}

export const TUBE_MAX = 6;
const MAGAZINE = TUBE_MAX + 1, RESERVE_START = 21;
const CYCLE_DELAY = 0.12;     // s from the shot to the lever starting down
const LEVER_TIME = 0.56;      // s for the full throw (open + close)
const ROUND_TIME = 0.4;       // s per cartridge through the gate
const RELOAD_IN = 0.22, RELOAD_OUT = 0.2; // s to roll into / out of the loading pose
const AUTO_RELOAD_DELAY = 0.35;
const DAMAGE_SCALE = 1.5;     // × the bolt's damageFor
const HITSCAN_RANGE = 320;
const KICK_PITCH = THREE.MathUtils.degToRad(1.25);
const SPREAD_ADS = 0.06, SPREAD_HIP = 0.9; // degrees
const FLASH_FRAMES = 2, FLASH_LIGHT_TIME = 0.06, FLASH_LIGHT = 34;
const BRASS_COUNT = 4, BRASS_LIFE = 1.8;
const TRACER_COUNT = 2, TRACER_TIME = 0.09;
const ADS_BLEND_TIME = 0.17, ADS_MOTION = 0.3;
/** the lever's throw (rad about X at its pivot), the bolt's travel (m), the hammer down / cocked (rad) */
const LEVER_OPEN = 0.92, BOLT_TRAVEL = 0.058, HAMMER_DOWN = -0.12, HAMMER_COCKED = 0.5;

// model space: −Z along the bore, +Y up, the bore axis at y = 0
/** sight line height over the bore: the gold bead's centre and the buckhorn notch's floor */
export const SIGHT_Y = 0.045;
/** the eye on the comb, the buckhorn 45 cm ahead of it (a carbine's eye relief); the sights stand on raised bases, the
 *  line higher over the receiver than a real 1894's, so the receiver's top and the wrist sit low in the frame, not across the view */
const EYE_Z = 0.36;
const REAR_Z = -0.13, FRONT_Z = -0.512, MUZZLE_Z = -0.535;
const RECV_F = -0.035, RECV_B = 0.14;
const LEVER_PIVOT = new THREE.Vector3(0, -0.047, -0.018);
const HAMMER_PIVOT = new THREE.Vector3(0, -0.006, 0.122);
const GATE = new THREE.Vector3(0.0158, -0.024, 0.028);
/** the Blender model's receiver is 16 mm shallower (a real 1894's proportions): its lever pivot and loading gate sit higher */
const MODEL_LEVER_PIVOT = new THREE.Vector3(0, -0.031, -0.018);
const MODEL_GATE = new THREE.Vector3(0.0158, -0.021, 0.028);
const PORT = new THREE.Vector3(0.0, 0.026, 0.045);
const BEAD_R = 0.0055;

interface Brass { mesh: THREE.Mesh; vel: THREE.Vector3; spin: THREE.Vector3; life: number; down: boolean; floor: number }
/** where the action is: idle (ready), firing (the recoil beat before the cycle), cycling, reloading */
type Phase = 'idle' | 'beat' | 'cycle' | 'reload';

const _o = new THREE.Vector3(), _d = new THREE.Vector3(), _v1 = new THREE.Vector3(), _v2 = new THREE.Vector3(), _v3 = new THREE.Vector3();
const _q = new THREE.Quaternion();
/** mergeGeometries as it behaves: null (and a console error) when the parts' attributes do not match */
function mergeOrNull(list: THREE.BufferGeometry[]): THREE.BufferGeometry | null { return mergeGeometries(list, false); }
/** the display model's shadow: depth only, on SHADOW_LAYER (front-sided like the lever's materials, so the same depth) */
const DEPTH_ONLY = new THREE.MeshBasicMaterial({ colorWrite: false });

/** the lever's throw over one cycle u 0..1: down fast, a beat open, up and home */
export function leverOpen(u: number): number {
  if (u <= 0 || u >= 1) return 0;
  if (u < 0.4) return sstep(0, 0.4, u);
  if (u < 0.52) return 1;
  return 1 - sstep(0.52, 1, u);
}

/** Rounds-left maths for the tube + chamber (pure; test/pine-loadout.test.ts) */
export interface ActionState { tube: number; chambered: boolean; reserve: number }
/** after a cycle: the chamber takes a round from the tube if it has one */
export function cycleAction(a: ActionState): ActionState {
  if (a.chambered || a.tube <= 0) return { ...a };
  return { ...a, tube: a.tube - 1, chambered: true };
}
/** one round through the gate: from the reserve into the tube, if both allow */
export function feedRound(a: ActionState): ActionState {
  if (a.tube >= TUBE_MAX || a.reserve <= 0) return { ...a };
  return { ...a, tube: a.tube + 1, reserve: a.reserve - 1 };
}

// ───────────────────────────── the Blender model ─────────────────────────────

/** scripts/blender/weapons/run.sh's output; the phone tier gets `lever-rifle.phone.glb` (tierUrl, the loaders' URL modifier) */
export const LEVER_MODEL_URL = '/assets/pine-hollow/weapons/lever-rifle.glb';
/** the GLB's meshes: the static steel, the forend, the stock (hidden sighted), the lever + hammer (each about its pivot), the bolt */
const MODEL_PARTS = ['steel', 'forend', 'stock', 'lever', 'hammer', 'bolt'] as const;
type ModelPart = (typeof MODEL_PARTS)[number];
/** the loaded model: plain float geometry per part (model space, as the procedural build's) + the two atlases */
export interface LeverModel { geo: Record<ModelPart, THREE.BufferGeometry>; steel: TexSet; wood: TexSet }
let modelLoad: Promise<LeverModel | null> | null = null;
let modelReady: LeverModel | null = null;

/** `?rifle=proc` keeps the procedural lever-action (the fallback, and the before of the remaster board) */
export function leverModelWanted(search: string = typeof location === 'undefined' ? '' : location.search): boolean {
  return new URLSearchParams(search).get('rifle') !== 'proc';
}

/** Fetch + decode the Blender model once (main.ts starts it early; the weapon step awaits it). null = the procedural build. */
export function preloadLeverModel(): Promise<LeverModel | null> {
  if (!leverModelWanted()) return Promise.resolve(null);
  modelLoad ??= new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).loadAsync(LEVER_MODEL_URL)
    .then((gltf) => { modelReady = parseLeverModel(gltf.scene); return modelReady; })
    .catch((e: unknown) => { console.warn('[lever-action] the Blender model did not load — the procedural build stands in:', e); return null; });
  return modelLoad;
}

/** one GLB mesh as plain float geometry: meshopt's quantised streams decoded, its node's dequantising transform applied,
 *  only what the viewmodel program reads (position, normal, uv; the colour attribute is added white by the constructor) */
function plainGeometry(mesh: THREE.Mesh): THREE.BufferGeometry {
  const src = mesh.geometry, g = new THREE.BufferGeometry();
  const copy = (name: string, size: number): Float32Array => {
    const a = src.getAttribute(name) as THREE.BufferAttribute | THREE.InterleavedBufferAttribute | undefined;
    if (!a) throw new Error(`[lever-action] ${mesh.name}: no ${name}`);
    const out = new Float32Array(a.count * size);
    for (let i = 0; i < a.count; i++) {
      out[i * size] = a.getX(i); out[i * size + 1] = a.getY(i);
      if (size > 2) out[i * size + 2] = a.getZ(i);
    }
    return out;
  };
  g.setAttribute('position', new THREE.BufferAttribute(copy('position', 3), 3));
  g.setAttribute('normal', new THREE.BufferAttribute(copy('normal', 3), 3));
  g.setAttribute('uv', new THREE.BufferAttribute(copy('uv', 2), 2));
  const idx = src.getIndex();
  if (!idx) throw new Error(`[lever-action] ${mesh.name}: not indexed`);
  g.setIndex(new THREE.BufferAttribute(Uint32Array.from(idx.array), 1));
  mesh.updateWorldMatrix(true, false);
  g.applyMatrix4(mesh.matrixWorld);
  g.computeBoundingSphere();
  src.dispose();
  return g;
}

/** the atlas a GLB mesh's material carries: albedo, normal, ARM (the glTF's occlusion + metallic-roughness image) */
function atlasOf(mesh: THREE.Mesh): TexSet {
  const m = mesh.material;
  if (Array.isArray(m) || !(m instanceof THREE.MeshStandardMaterial)) throw new Error(`[lever-action] ${mesh.name}: not a PBR material`);
  const { map, normalMap, roughnessMap } = m;
  if (map === null || normalMap === null || roughnessMap === null) throw new Error(`[lever-action] ${mesh.name}: an atlas map is missing`);
  for (const t of [map, normalMap, roughnessMap]) { t.anisotropy = 8; t.needsUpdate = true; }
  return { map, normalMap, armMap: roughnessMap };
}

function parseLeverModel(root: THREE.Object3D): LeverModel {
  root.updateMatrixWorld(true);
  const meshes = new Map<string, THREE.Mesh>();
  root.traverse((o) => { if (isMesh(o)) meshes.set(o.name, o); });
  const need = (p: ModelPart): THREE.Mesh => {
    const m = meshes.get(p);
    if (!m) throw new Error(`[lever-action] ${LEVER_MODEL_URL} has no mesh '${p}'`);
    return m;
  };
  // the atlases first (plainGeometry disposes the GLB's own buffers)
  const steel = atlasOf(need('steel')), wood = atlasOf(need('forend'));
  const geo: Record<ModelPart, THREE.BufferGeometry> = {
    steel: plainGeometry(need('steel')), forend: plainGeometry(need('forend')), stock: plainGeometry(need('stock')),
    lever: plainGeometry(need('lever')), hammer: plainGeometry(need('hammer')), bolt: plainGeometry(need('bolt')),
  };
  return { geo, steel, wood };
}

/** a build's parts, in model space (the lever / hammer about their pivots) */
interface LeverParts { wood: THREE.BufferGeometry; stock: THREE.BufferGeometry; steel: THREE.BufferGeometry; lever: THREE.BufferGeometry; hammer: THREE.BufferGeometry; bolt: THREE.BufferGeometry; leverPivot: THREE.Vector3; gate: THREE.Vector3 }

export class LeverRifle implements KitWeapon {
  readonly id = 'rifle' as const;
  readonly name = 'Lever-action';
  readonly ammoLabel = 'Cartridges';
  readonly segments = MAGAZINE;
  readonly state: WeaponState & { ammo: number } = { ammo: MAGAZINE, magazine: MAGAZINE, reserve: RESERVE_START, loaded: true, reloading: false, reloadProgress: 0, ads: false };
  enabled = true;
  allowUnlocked = false;
  adsHeld = false;
  holster = 0;
  aimInfo: AimInfo | null = null;
  private aimFrame = 0;
  private aimCache: AimInfo = { kind: 'deer', distance: 0 };

  onFire?: () => void;
  onHit?: (kind: string, headshot: boolean, killed: boolean) => void;
  onImpact?: (surface: ImpactSurface, point: THREE.Vector3) => void;
  onReloadStart?: () => void;
  onReloadEnd?: () => void;
  onDry?: () => void;
  /** the lever is thrown (a cycle starts) — the 'leverCycle' sound */
  onCycle?: () => void;
  /** a cartridge went through the loading gate */
  onRoundIn?: () => void;

  readonly model = new THREE.Group();
  private readonly game: CrossbowWorld['game']; private readonly sky: CrossbowWorld['sky']; private readonly player: CrossbowWorld['player'];
  private readonly targets: Targets | undefined;
  private active = true;

  // the action
  private tube = TUBE_MAX; private chambered = true; private caseInChamber = false;
  private phase: Phase = 'idle'; private phaseT = 0;
  /** reload: rounds pushed this reload, whether to stop after the round in hand, whether the gun was run dry (chamber at the end) */
  private fed = 0; private planned = 0; private stopAfter = false; private dryAtStart = false;
  private hammerCocked = true;
  /** dev (the evidence strip): hold the cycle at u (0..1) — `__weapons.get('rifle').freezeCycle = 0.45`; null = live */
  freezeCycle: number | null = null;
  /** dev: > 0 = the rifle held out side-on for inspection, turned `inspectYaw` rad (π/2: the right side, the gate) */
  inspect = 0; inspectYaw = Math.PI / 2;
  private sinceEmpty = 99;

  // parts
  private readonly stock: THREE.Mesh;
  /** where the loading gate is (the cartridge's reload path aims at it) — the build's */
  private readonly gate: THREE.Vector3;
  private readonly lever: THREE.Mesh; private readonly hammer: THREE.Mesh; private readonly bolt: THREE.Mesh; private readonly round: THREE.Mesh;
  private readonly flash = new THREE.Group(); private readonly flashQuads: THREE.Mesh[] = []; private readonly flashLight: THREE.PointLight;
  private flashFrames = 0; private flashLightT = 0;
  private readonly displayParts: { geo: THREE.BufferGeometry; mat: THREE.Material; pos?: THREE.Vector3; rot?: THREE.Euler }[] = [];
  private readonly brass: Brass[] = [];
  private readonly brassMat: THREE.MeshPhysicalMaterial;
  private readonly caseGeo: THREE.BufferGeometry;
  private readonly tracers: HitLine[] = []; private readonly tracerRes = new THREE.Vector2();
  private readonly puffs = new Puffs();

  // pose
  private recoil = 0; private kickPending = 0; private kickApplied = 0;
  private mouseAds = false; private fov = FOV_HIP;
  private lastYaw = 0; private lastPitch = 0; private lagYaw = 0; private lagYawVel = 0; private lagPitch = 0; private lagPitchVel = 0;
  private readonly posePos = new THREE.Vector3(); private readonly poseRot = new THREE.Euler(); private poseInit = false;
  private adsBlend = 0; private sprintBlend = 0; private loadBlend = 0;
  private time = 0;
  tracerLife = TRACER_TIME;
  /** hip pose (lower-right); a dev knob: `__weapons.get('rifle').hip.py = …` */
  readonly hip = { px: 0.07, py: -0.085, pz: -0.26, rx: 0.05, ry: 0.14, rz: -0.15, scale: 1.0 };
  /** the lever's throw, added to the hip pose at full throw (dev knob) */
  readonly cyclePose = { px: -0.03, py: 0.03, pz: 0, rx: 0.1, ry: 0.1, rz: -0.45 };
  /** the solved sighted pose (dev / verification) */
  readonly adsPose = { px: 0, py: 0, pz: 0, scale: 0, rearDepth: 0, frontDepth: 0 };

  constructor(world: CrossbowWorld, targets?: Targets, opts: LeverRifleOptions = {}) {
    this.game = world.game; this.sky = world.sky; this.player = world.player;
    this.flashLight = opts.muzzleLight === false ? new THREE.PointLight(0xffb060, 0, 8, 2) : LightPool.for(this.game.scene).acquire(0xffb060, 0, 8, 2);
    this.targets = targets;
    this.allowUnlocked = opts.allowUnlocked ?? false;
    this.lastYaw = this.player.yaw; this.lastPitch = this.player.pitch;

    // ── materials: the viewmodels' shared lit program (MeshPhysical + vertex colours + the five map slots) ──
    const model = opts.model !== undefined ? opts.model : modelReady;
    const std = (name: string, t: TexSet, extra: THREE.MeshPhysicalMaterialParameters) => viewmodelMaterial(this.sky, name, { map: t.map, normalMap: t.normalMap, aoMap: t.armMap, roughnessMap: t.armMap, metalnessMap: t.armMap, roughness: 1, metalness: 1, ...extra });
    const steelTex = viewmodelTexSet('steel-rifle'); // the brass's (the cartridges' tiled UVs), and the procedural build's steel
    for (const t of [steelTex.map, steelTex.normalMap, steelTex.armMap]) t.repeat.set(2, 2);
    this.brassMat = std('lever-brass', steelTex, { normalScale: new THREE.Vector2(0.25, 0.25), color: new THREE.Color(0.95, 0.7, 0.34), roughness: 0.75, envMapIntensity: 1.1 });
    let woodMat: THREE.MeshPhysicalMaterial, steelMat: THREE.MeshPhysicalMaterial, parts: LeverParts;
    if (model) {
      // the baked atlases carry the colour, the AO and the roughness / metalness: the factors stay 1 (the skins set theirs);
      // glTF's v runs down the image, so the normal map's green is flipped (three's GLTFLoader does the same)
      woodMat = std('lever-wood', model.wood, { normalScale: new THREE.Vector2(0.9, -0.9), envMapIntensity: 0.55, specularIntensity: 0.55 });
      steelMat = std('lever-steel', model.steel, { normalScale: new THREE.Vector2(0.8, -0.8), envMapIntensity: 0.95 });
      const g = model.geo;
      parts = { wood: g.forend, stock: g.stock, steel: g.steel, lever: g.lever, hammer: g.hammer, bolt: g.bolt, leverPivot: MODEL_LEVER_PIVOT, gate: MODEL_GATE };
    } else {
      const wood = borrowWood(opts.woodFrom ?? null);
      for (const t of [wood.map, wood.normalMap, wood.armMap]) t.repeat.set(1.6, 0.9);
      woodMat = std('lever-wood', wood, { normalScale: new THREE.Vector2(0.8, 0.8), color: new THREE.Color(0.62, 0.47, 0.36), metalness: 0, roughness: 0.8, envMapIntensity: 0.5, specularIntensity: 0.45 });
      steelMat = std('lever-steel', steelTex, { normalScale: new THREE.Vector2(0.45, 0.45), color: new THREE.Color(0.1, 0.105, 0.12), roughness: 0.95, envMapIntensity: 0.7 });
      parts = proceduralParts();
    }
    this.gate = parts.gate;

    // the gold bead (both builds): the aim reference, on the sight line; it catches the light — a vertex colour over 1
    // brightens it on the shared program (no emissive, no new draw)
    const beadGeo = new THREE.SphereGeometry(BEAD_R, 12, 10); beadGeo.translate(0, SIGHT_Y, FRONT_Z - 0.0035);
    beadGeo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(beadGeo.getAttribute('position').count * 3).fill(2.2), 3));
    // the stock is its own draw: sighted, the wrist and comb sit under the eye (a flat brown plane across the view) — hidden
    this.stock = new THREE.Mesh(parts.stock, woodMat);
    const meshW = new THREE.Mesh(parts.wood, woodMat), meshS = new THREE.Mesh(parts.steel, steelMat), meshB = new THREE.Mesh(beadGeo, this.brassMat);
    this.model.add(meshW, this.stock, meshS, meshB);
    // ── animated: the lever (in its pivot's frame), the hammer, the bolt, the cartridge being thumbed in ──
    this.lever = new THREE.Mesh(parts.lever, steelMat); this.lever.position.copy(parts.leverPivot);
    this.hammer = new THREE.Mesh(parts.hammer, steelMat); this.hammer.position.copy(HAMMER_PIVOT); this.hammer.rotation.x = HAMMER_COCKED;
    this.bolt = new THREE.Mesh(parts.bolt, steelMat);
    this.caseGeo = cartridgeGeometry(false);
    this.round = new THREE.Mesh(cartridgeGeometry(true), this.brassMat); this.round.visible = false;
    this.model.add(this.lever, this.hammer, this.bolt, this.round);
    this.displayParts.push({ geo: parts.wood, mat: woodMat }, { geo: parts.stock, mat: woodMat }, { geo: parts.steel, mat: steelMat }, { geo: beadGeo, mat: this.brassMat },
      { geo: parts.lever, mat: steelMat, pos: parts.leverPivot.clone() }, { geo: parts.hammer, mat: steelMat, pos: HAMMER_PIVOT.clone(), rot: new THREE.Euler(HAMMER_DOWN, 0, 0) }, { geo: parts.bolt, mat: steelMat });

    // ── muzzle flash: two additive quads (Rifle.ts's sprite), the pooled light ──
    const flashMat = new THREE.MeshBasicMaterial({ map: makeFlashTexture(), blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, toneMapped: false, fog: false, side: THREE.DoubleSide });
    const fq = new THREE.PlaneGeometry(0.2, 0.2);
    const q1 = new THREE.Mesh(fq, flashMat), q2 = new THREE.Mesh(fq, flashMat); q2.rotation.y = Math.PI / 2; q2.position.z = -0.06; q2.scale.set(1.5, 0.55, 1);
    this.flashQuads.push(q1, q2); this.flash.add(q1, q2);
    this.flash.position.set(0, 0, MUZZLE_Z - 0.02); this.flash.visible = false;
    this.model.add(this.flash);

    // depth clear + render after the world (Crossbow.ts / Rifle.ts)
    const clearer = new THREE.Mesh(new THREE.BoxGeometry(0.001, 0.001, 0.001), new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false, transparent: true, fog: false }));
    clearer.renderOrder = 999; clearer.frustumCulled = false;
    clearer.onBeforeRender = (renderer) => { renderer.clearDepth(); };
    this.model.add(clearer);
    this.model.traverse((m) => {
      if (!isMesh(m)) return;
      m.frustumCulled = false; m.castShadow = false; m.receiveShadow = m !== clearer;
      if (m === clearer) return;
      m.renderOrder = this.flashQuads.includes(m) ? 1001 : 1000;
      if ((Array.isArray(m.material) ? m.material : [m.material]).some((mat) => mat.vertexColors)) whiteColors(m.geometry);
      for (const mat of Array.isArray(m.material) ? m.material : [m.material]) { mat.transparent = true; if (mat !== flashMat) mat.depthWrite = true; }
    });

    whiteColors(this.caseGeo);
    for (let i = 0; i < BRASS_COUNT; i++) {
      const mesh = new THREE.Mesh(this.caseGeo, this.brassMat);
      mesh.visible = false; mesh.frustumCulled = false;
      this.game.scene.add(mesh);
      this.brass.push({ mesh, vel: new THREE.Vector3(), spin: new THREE.Vector3(), life: 0, down: false, floor: 0 });
    }
    for (let i = 0; i < TRACER_COUNT; i++) this.tracers.push(new HitLine(this.game.scene));

    const cam = this.game.camera;
    cam.add(this.model);
    if (!cam.parent) this.game.scene.add(cam);
    this.game.scene.add(this.puffs.points);
    this.bindInput();
    this.syncState();
  }

  // ── input ──
  inputAllowed(): boolean { return this.enabled && (this.player.locked || this.allowUnlocked); }
  private bindInput(): void {
    document.addEventListener('mousedown', (e) => {
      if (!this.inputAllowed()) return;
      if (e.button === 0) this.tryFire();
      if (e.button === 2) this.mouseAds = !this.mouseAds;
    });
    document.addEventListener('contextmenu', (e) => { if (this.inputAllowed()) e.preventDefault(); });
    document.addEventListener('keydown', (e) => {
      if (!this.inputAllowed() || e.repeat) return;
      if (e.code === 'KeyF') this.tryFire();
      if (e.code === 'KeyR') this.reload();
    });
    window.addEventListener('blur', () => { this.mouseAds = false; });
  }

  setActive(on: boolean): void {
    this.active = on;
    this.model.visible = on;
    if (!on) { this.enabled = false; this.mouseAds = false; }
  }

  /** rounds in the gun, the chamber, the reserve → the HUD's state */
  private syncState(): void {
    const s = this.state;
    s.ammo = this.tube + (this.chambered ? 1 : 0);
    s.loaded = this.chambered;
    s.reloading = this.phase === 'reload';
  }
  /** the action as the pure helpers see it */
  get action(): ActionState { return { tube: this.tube, chambered: this.chambered, reserve: this.state.reserve }; }
  /** 0..1 through the lever's throw (0 when it is shut) */
  get cycleU(): number { return this.freezeCycle ?? (this.phase === 'cycle' ? clamp01(this.phaseT / LEVER_TIME) : 0); }

  /** Pull the trigger: fire the chambered round; mid-reload, stop after the round in hand; empty → the dry click + a reload. */
  tryFire(): void {
    if (this.phase === 'reload') { if (this.fed > 0 || this.tube > 0 || this.chambered) this.stopAfter = true; return; }
    if (this.phase !== 'idle') return;
    if (!this.chambered) {
      this.onDry?.(); this.sinceEmpty = 0;
      if (this.tube > 0) this.startCycle(); else if (this.state.reserve > 0) this.reload();
      return;
    }
    this.fire();
  }

  reload(): void {
    if (this.phase !== 'idle' || this.tube >= TUBE_MAX || this.state.reserve <= 0) return;
    this.phase = 'reload'; this.phaseT = 0; this.fed = 0; this.stopAfter = false; this.dryAtStart = !this.chambered;
    this.planned = Math.min(TUBE_MAX - this.tube, this.state.reserve);
    this.state.reloadProgress = 0;
    this.syncState();
    this.onReloadStart?.();
  }

  addRounds(n: number): void { this.state.reserve += n; }
  addBolts(n: number): void { this.addRounds(n); }

  private fire(): void {
    this.chambered = false; this.caseInChamber = true; this.hammerCocked = false;
    this.phase = 'beat'; this.phaseT = 0;
    this.recoil = 1; this.kickPending = KICK_PITCH;
    this.flashFrames = FLASH_FRAMES; this.flashLightT = FLASH_LIGHT_TIME;
    for (const q of this.flashQuads) { q.rotation.z = Math.random() * Math.PI * 2; q.scale.setScalar(0.8 + Math.random() * 0.5); }
    this.flash.visible = true; this.flashLight.intensity = FLASH_LIGHT; this.placeFlashLight();
    this.syncState();
    this.onFire?.();
    this.hitscan();
  }

  private startCycle(): void {
    this.phase = 'cycle'; this.phaseT = 0;
    this.onCycle?.();
  }

  private placeFlashLight(): void {
    this.model.updateWorldMatrix(true, false);
    this.model.localToWorld(this.flashLight.position.set(0, 0.03, MUZZLE_Z + 0.1));
  }

  /** the aim line is the camera forward, hip or sighted */
  aimRay(origin: THREE.Vector3, dir: THREE.Vector3): THREE.Vector3 {
    const cam = this.game.camera;
    cam.getWorldDirection(dir);
    origin.copy(cam.position);
    return dir;
  }

  private hitscan(): void {
    this.aimRay(_o, _d);
    const a = sstep(0, 1, this.adsBlend);
    const spread = THREE.MathUtils.degToRad(SPREAD_ADS + (1 - a) * SPREAD_HIP + this.player.speedFactor * 0.5 * (1 - a * 0.6));
    _v1.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).cross(_d).normalize();
    _d.addScaledVector(_v1, Math.tan(spread * Math.sqrt(Math.random()))).normalize();
    let dist = HITSCAN_RANGE, surface: ImpactSurface | null = null;
    const wall = worldHit(_o, _v2.copy(_o).addScaledVector(_d, HITSCAN_RANGE), 0);
    if (wall) { dist = wall.distance; surface = impactSurfaceOf(wall.material); }
    const hit = this.targets?.raycast(_o, _d, dist) ?? null;
    if (hit) { dist = hit.distance; surface = 'flesh'; }
    const point = _v2.copy(_o).addScaledVector(_d, dist);
    if (surface === 'flesh' && hit) {
      point.copy(hit.point);
      const killed = hit.animal.applyDamage(hit.animal.damageFor(hit.headshot, hit.distance) * DAMAGE_SCALE, hit.point, _d);
      this.onHit?.(hit.animal.kind, hit.headshot, killed);
    }
    if (getSetting('tracers')) {
      const tr = this.tracers.reduce((acc, x) => (x.t0 < acc.t0 ? x : acc));
      this.model.updateMatrixWorld();
      this.model.localToWorld(_v3.set(0, 0, MUZZLE_Z));
      tr.show(_v3, point, this.time);
    }
    if (surface) { this.puffs.emit(point, _d, surface); this.onImpact?.(surface, point); }
  }

  /** A world-space copy for the cabin pickup / the skin drops: the same geometry, its own copies of the materials (one
   *  program), hammer down. */
  displayModel(): THREE.Group {
    // one mesh per material (PINE-HOLLOW PH-P2): the seven parts were 7 draws + 7 per shadow cascade wherever the pickup
    // was in range; the posed parts are baked into their material's geometry (the same triangles)
    const g = new THREE.Group();
    // the copy's own materials (PH-C11): the pickup orb tints its item's materials, and on shared ones the glow sat on the
    // rifle in your hands until the orb was taken. A clone is the same program: the dfg fix's group and the sky's CSM
    // hooks re-applied, as a skin's clones (Skins.cloneWith)
    const own = new Map<THREE.Material, THREE.Material>();
    const copyOf = (m: THREE.Material): THREE.Material => {
      let c = own.get(m);
      if (!c) { c = m.clone(); c.name = m.name; fixIBL(c, VIEWMODEL_GROUP); this.sky.setupMaterial(c); own.set(m, c); }
      return c;
    };
    const byMat = new Map<THREE.Material, THREE.BufferGeometry[]>();
    const xf = new THREE.Matrix4(), quat = new THREE.Quaternion(), one = new THREE.Vector3(1, 1, 1);
    for (const { geo, mat, pos, rot } of this.displayParts) {
      const part = pos || rot ? geo.clone().applyMatrix4(xf.compose(pos ?? new THREE.Vector3(), rot ? quat.setFromEuler(rot) : quat.identity(), one)) : geo;
      const list = byMat.get(mat) ?? [];
      list.push(part);
      byMat.set(mat, list);
    }
    const positions: THREE.BufferGeometry[] = [];
    for (const [mat, parts] of byMat) {
      const merged = parts.length > 1 ? mergeGeometries(parts, false) : parts[0] ?? null;
      for (const geo of merged === null ? parts : [merged]) {
        const m = new THREE.Mesh(geo, copyOf(mat));
        m.castShadow = false; m.receiveShadow = true;
        g.add(m);
        const p = new THREE.BufferGeometry(); p.setAttribute('position', geo.getAttribute('position')); p.setIndex(geo.getIndex());
        positions.push(p);
      }
    }
    // one shadow draw per cascade for the three materials' parts (3 → 1)
    const indexed = positions.every((p) => p.getIndex() !== null);
    // three types mergeGeometries non-null; it returns null (and logs) on mismatched attributes: then each part casts itself
    const caster = mergeOrNull(indexed ? positions : positions.map((p) => (p.getIndex() === null ? p : p.toNonIndexed())));
    if (caster !== null) {
      const proxy = new THREE.Mesh(caster, DEPTH_ONLY);
      proxy.castShadow = true; proxy.layers.set(SHADOW_LAYER);
      g.add(proxy);
    } else for (const m of g.children) m.castShadow = true;
    return g;
  }

  private ejectCase(): void {
    const b = this.brass.find((x) => x.life <= 0) ?? this.brass.reduce((acc, x) => (x.life < acc.life ? x : acc));
    const cam = this.game.camera;
    this.model.updateMatrixWorld();
    this.model.localToWorld(b.mesh.position.copy(PORT));
    _v1.set(1, 0, 0).applyQuaternion(cam.quaternion); _v2.set(0, 1, 0).applyQuaternion(cam.quaternion); cam.getWorldDirection(_v3);
    // Winchester top eject: up and a little right and back, spinning end over end
    b.vel.copy(_v2).multiplyScalar(2.6 + Math.random() * 0.6).addScaledVector(_v1, 0.8 + Math.random() * 0.5).addScaledVector(_v3, -0.6 + Math.random() * 0.2);
    b.spin.set(18 + Math.random() * 12, (Math.random() - 0.5) * 8, (Math.random() - 0.5) * 8);
    b.mesh.quaternion.copy(cam.quaternion).multiply(_q.setFromAxisAngle(_v1.set(1, 0, 0), -Math.PI / 2));
    b.life = BRASS_LIFE; b.down = false; b.mesh.visible = true;
    b.floor = brassFloor(b.mesh.position, b.vel) + 0.006;
  }
  private stepBrass(dt: number): void {
    for (const b of this.brass) {
      if (b.life <= 0) continue;
      b.life -= dt;
      if (b.life <= 0) { b.mesh.visible = false; continue; }
      if (b.down) continue;
      b.vel.y -= 9.8 * dt;
      b.mesh.position.addScaledVector(b.vel, dt);
      b.mesh.rotation.x += b.spin.x * dt; b.mesh.rotation.y += b.spin.y * dt; b.mesh.rotation.z += b.spin.z * dt;
      if (b.mesh.position.y < b.floor) { b.mesh.position.y = b.floor; b.down = true; b.mesh.rotation.set(0, Math.random() * Math.PI, Math.PI / 2 + (Math.random() - 0.5) * 0.3); }
    }
  }

  /** Sighted: rotation 0, the eye on the comb on the sight line — the bead in the notch on the crosshair. */
  private solveAds(scale: number): LeverRifle['adsPose'] {
    const o = this.adsPose;
    if (o.scale === scale) return o;
    o.scale = scale; o.px = 0; o.py = -SIGHT_Y * scale; o.pz = -EYE_Z * scale;
    o.rearDepth = (EYE_Z - REAR_Z) * scale; o.frontDepth = (EYE_Z - FRONT_Z) * scale;
    return o;
  }

  // ── per frame ──
  update(dt: number, t: number): void {
    this.time = t;
    const p = this.player, cam = this.game.camera;
    this.sinceEmpty += dt;
    this.stepAction(dt);

    // the parts: lever, bolt, hammer from the cycle; the cartridge in hand on a reload
    const u = this.cycleU, open = this.freezeCycle !== null || this.phase === 'cycle' ? leverOpen(u) : 0;
    this.lever.rotation.x = LEVER_OPEN * open;
    this.bolt.position.z = BOLT_TRAVEL * open;
    const cocked = this.freezeCycle !== null ? u >= 0.2 : this.hammerCocked;
    this.hammer.rotation.x += ((cocked ? HAMMER_COCKED : HAMMER_DOWN) - this.hammer.rotation.x) * Math.min(1, dt * (cocked ? 18 : 60));
    this.poseRound();

    // muzzle flash
    if (this.flashFrames > 0 && --this.flashFrames === 0) this.flash.visible = false;
    if (this.flashLightT > 0) { this.flashLightT -= dt; this.flashLight.intensity = this.flashLightT <= 0 ? 0 : FLASH_LIGHT * clamp01(this.flashLightT / FLASH_LIGHT_TIME); this.placeFlashLight(); }

    // ADS + FOV (only the held weapon owns the FOV)
    const s = this.state;
    if (p.sprinting || !this.enabled) this.mouseAds = false;
    s.ads = (this.mouseAds || this.adsHeld) && this.enabled && this.phase !== 'reload' && !p.sprinting;
    { const step = dt / ADS_BLEND_TIME; this.adsBlend = clamp01(this.adsBlend + THREE.MathUtils.clamp((s.ads ? 1 : 0) - this.adsBlend, -step, step)); }
    const targetFov = fovForAspect(FOV_HIP + (FOV_ADS - FOV_HIP) * sstep(0, 1, this.adsBlend), cam.aspect);
    if (this.active && Math.abs(targetFov - this.fov) > 0.01) { this.fov = targetFov; cam.fov = this.fov; cam.updateProjectionMatrix(); this.sky.csm.updateFrustums(); }

    // recoil + camera kick (a .30-30 shoves: up hard, recovered over ~0.3 s)
    this.recoil *= Math.exp(-dt * 10);
    if (this.kickPending > 0) { const k = Math.min(this.kickPending, KICK_PITCH * dt * 30); p.pitch += k; this.kickApplied += k; this.kickPending -= k; }
    else if (this.kickApplied > 0) { const r = this.kickApplied * Math.min(1, dt * 6); p.pitch -= r; this.kickApplied -= r; }

    // look lag (spring, substepped — Crossbow.ts)
    let dYaw = p.yaw - this.lastYaw, dPitch = p.pitch - this.lastPitch;
    this.lastYaw = p.yaw; this.lastPitch = p.pitch;
    if (Math.abs(dYaw) > 1) dYaw = 0; if (Math.abs(dPitch) > 1) dPitch = 0;
    this.lagYaw = THREE.MathUtils.clamp(this.lagYaw - dYaw * 0.5, -0.12, 0.12);
    this.lagPitch = THREE.MathUtils.clamp(this.lagPitch - dPitch * 0.5, -0.1, 0.1);
    for (let rem = dt; rem > 0; rem -= 1 / 120) {
      const h = Math.min(rem, 1 / 120);
      this.lagYawVel += (-this.lagYaw * 220 - this.lagYawVel * 20) * h; this.lagYaw += this.lagYawVel * h;
      this.lagPitchVel += (-this.lagPitch * 220 - this.lagPitchVel * 20) * h; this.lagPitch += this.lagPitchVel * h;
    }
    this.lagYaw = THREE.MathUtils.clamp(this.lagYaw, -0.12, 0.12); this.lagPitch = THREE.MathUtils.clamp(this.lagPitch, -0.1, 0.1);

    // pose: hip ↔ sighted ↔ sprint ↔ the loading roll ↔ the lever's rock ↔ holster
    this.sprintBlend += ((p.sprinting ? 1 : 0) - this.sprintBlend) * Math.min(1, dt * 7);
    const loading = this.phase === 'reload' ? 1 : 0;
    this.loadBlend += (loading - this.loadBlend) * Math.min(1, dt / (loading ? RELOAD_IN : RELOAD_OUT) * 2.2);
    const portrait = cam.aspect < 1 ? Math.min(1, (1 - cam.aspect) * 1.6) : 0;
    const a = sstep(0, 1, this.adsBlend), sp = this.sprintBlend * (1 - portrait * 0.7), ld = sstep(0, 1, this.loadBlend);
    const port = portrait, scale = this.hip.scale * (1 - port * 0.14);
    const swX = Math.sin(t * 0.7) * 0.0025, swY = Math.sin(t * 1.1) * 0.002, swRz = Math.sin(t * 0.5) * 0.006;
    const sf = p.speedFactor;
    const bobX = Math.cos(p.bobTime) * 0.014 * sf, bobY = -Math.abs(Math.sin(p.bobTime)) * 0.011 * sf, bobRz = Math.cos(p.bobTime) * 0.018 * sf, bobRx = Math.sin(p.bobTime * 2) * 0.009 * sf;
    const lagX = this.lagYaw * 0.25, lagY = this.lagPitch * 0.2, lagRy = this.lagYaw, lagRx = this.lagPitch;
    const rc = this.recoil, cy = open; // the lever's rock follows the throw
    let { px, py, pz, rx, ry, rz } = this.hip;
    px += sp * -0.06; py += sp * -0.08; pz += sp * 0.05; rx += sp * 0.3; ry += sp * 0.5; rz += sp * -0.12;
    // the loading pose: rolled right side up toward you, the gate in view, muzzle a touch high
    px += ld * -0.05; py += ld * 0.01; pz += ld * 0.05; rx += ld * 0.16; ry += ld * -0.32; rz += ld * -0.62;
    px += swX + bobX + lagX; py += swY + bobY + lagY; rz += swRz + bobRz; rx += bobRx + lagRx; ry += lagRy;
    pz += rc * 0.07; py += rc * 0.012; rx += rc * 0.1; rz += rc * -0.02;
    { const c = this.cyclePose; px += cy * c.px; py += cy * c.py; pz += cy * c.pz; rx += cy * c.rx; ry += cy * c.ry; rz += cy * c.rz; } // the lever thrown: the rifle cants, the loop swings clear
    px *= 1 - port * 0.35; py *= 1 + port * 0.25; pz *= 1 + port * 0.35;
    if (a > 0) {
      const ads = this.solveAds(scale), m = ADS_MOTION;
      const ax = ads.px + (swX + bobX + lagX) * m, ay = ads.py + (swY + bobY + lagY) * m + rc * 0.008 - cy * 0.03 * scale, az = ads.pz + rc * 0.03 + cy * 0.02;
      const arx = (bobRx + lagRx) * m + rc * 0.06 - cy * 0.05, ary = lagRy * m, arz = (swRz + bobRz) * m + rc * -0.012 + cy * 0.06;
      px += (ax - px) * a; py += (ay - py) * a; pz += (az - pz) * a; rx += (arx - rx) * a; ry += (ary - ry) * a; rz += (arz - rz) * a;
    }
    if (this.holster > 0) { const h = sstep(0, 1, this.holster); py -= h * 0.3; pz += h * 0.06; rx -= h * 0.5; rz += h * 0.2; }
    if (this.inspect > 0) { px = 0; py = -0.02; pz = -1.15 / this.inspect; rx = 0; ry = this.inspectYaw; rz = 0; }
    this.stock.visible = a < 0.85 || this.inspect > 0;
    this.model.scale.setScalar(scale);
    const sm = this.inspect > 0 ? 1 : this.poseInit ? Math.min(1, dt * 16) : 1; this.poseInit = true;
    this.posePos.x += (px - this.posePos.x) * sm; this.posePos.y += (py - this.posePos.y) * sm; this.posePos.z += (pz - this.posePos.z) * sm;
    this.poseRot.x += (rx - this.poseRot.x) * sm; this.poseRot.y += (ry - this.poseRot.y) * sm; this.poseRot.z += (rz - this.poseRot.z) * sm;
    this.model.position.copy(this.posePos);
    this.model.rotation.set(this.poseRot.x, this.poseRot.y, this.poseRot.z);

    // aim readout (held weapon only)
    if (this.active && this.targets && (++this.aimFrame & 3) === 0) {
      this.aimRay(_o, _d);
      const wall = worldHit(_o, _v2.copy(_o).addScaledVector(_d, 150), 0);
      const hit = this.targets.raycast(_o, _d, wall?.distance ?? 150);
      if (hit?.animal.alive) { this.aimCache.kind = hit.animal.kind; this.aimCache.distance = hit.distance; this.aimInfo = this.aimCache; }
      else this.aimInfo = null;
    }

    this.stepBrass(dt);
    this.puffs.update(dt, this.game.renderer, cam);
    this.game.renderer.getDrawingBufferSize(this.tracerRes);
    for (const tr of this.tracers) tr.update(t, this.tracerRes, this.tracerLife);
  }

  /** the action's clock: the recoil beat → the lever cycle → idle; the reload's rounds */
  private stepAction(dt: number): void {
    const s = this.state;
    if (this.freezeCycle !== null) return;
    this.phaseT += dt;
    if (this.phase === 'beat' && this.phaseT >= CYCLE_DELAY) this.startCycle();
    else if (this.phase === 'cycle') {
      const u = this.phaseT / LEVER_TIME;
      if (this.caseInChamber && u >= 0.34) { this.caseInChamber = false; this.ejectCase(); }
      if (u >= 0.2) this.hammerCocked = true;
      if (u >= 1) {
        const next = cycleAction(this.action);
        this.tube = next.tube; this.chambered = next.chambered;
        this.phase = 'idle'; this.phaseT = 0;
        this.syncState();
      }
    } else if (this.phase === 'reload') {
      const inT = this.phaseT - RELOAD_IN;
      const done = Math.max(0, Math.floor(inT / ROUND_TIME));
      while (this.fed < Math.min(done, this.planned)) {
        const next = feedRound(this.action);
        this.tube = next.tube; s.reserve = next.reserve; this.fed++;
        this.onRoundIn?.();
        if (this.stopAfter || this.tube >= TUBE_MAX || s.reserve <= 0) { this.planned = this.fed; break; }
      }
      s.reloadProgress = this.planned > 0 ? clamp01(Math.max(0, inT) / (ROUND_TIME * this.planned)) : 1;
      if (this.fed >= this.planned && inT >= ROUND_TIME * this.planned) {
        this.phase = 'idle'; this.phaseT = 0; s.reloadProgress = 0;
        this.syncState();
        this.onReloadEnd?.();
        if (this.dryAtStart && !this.chambered && this.tube > 0) this.startCycle(); // run dry: work the lever to chamber one
        return;
      }
      this.syncState();
    } else if (this.phase === 'idle' && !this.chambered && this.tube === 0 && s.reserve > 0 && this.sinceEmpty > AUTO_RELOAD_DELAY && this.sinceEmpty < 5 && this.active && this.enabled) {
      this.reload(); // auto reload: the gun ran dry on a trigger pull
    }
  }

  /** the cartridge in hand during a reload: in from the right, nose first into the gate, then gone into the tube */
  private poseRound(): void {
    if (this.phase !== 'reload') { this.round.visible = false; return; }
    const inT = this.phaseT - RELOAD_IN;
    if (inT < 0 || this.fed >= this.planned) { this.round.visible = false; return; }
    const k = (inT % ROUND_TIME) / ROUND_TIME;
    this.round.visible = k < 0.8;
    const approach = sstep(0, 0.45, k), push = sstep(0.45, 0.8, k);
    const gate = this.gate;
    this.round.position.set(gate.x + 0.03 * (1 - approach) + 0.003, gate.y - 0.03 * (1 - approach), gate.z + 0.03 + 0.05 * (1 - approach) - push * 0.05);
    this.round.rotation.set(0, -0.35 * (1 - approach), 0);
  }
}

/** The procedural lever-action (the build before the Blender model; `?rifle=proc`, or the model failed to load) */
function proceduralParts(): LeverParts {
  const W: THREE.BufferGeometry[] = [], S: THREE.BufferGeometry[] = [];
  let stockGeo: THREE.BufferGeometry;
  // ── receiver: a flat-sided block, rounded on top at the back, the lower tang running back under the wrist ──
  {
    const sh = new THREE.Shape(); // x = forward (→ −Z), y = up
    sh.moveTo(-RECV_F, 0.021);
    sh.lineTo(-0.07, 0.021);
    sh.quadraticCurveTo(-0.118, 0.021, -0.132, 0.008);
    sh.lineTo(-RECV_B, -0.002);
    sh.lineTo(-RECV_B - 0.05, -0.004); // upper tang
    sh.lineTo(-RECV_B - 0.05, -0.012);
    sh.lineTo(-RECV_B, -0.014);
    sh.lineTo(-RECV_B, -0.046);
    sh.lineTo(-RECV_B - 0.07, -0.05); // lower tang (the trigger plate)
    sh.lineTo(-RECV_B - 0.07, -0.058);
    sh.lineTo(-0.06, -0.056);
    sh.quadraticCurveTo(-RECV_F + 0.004, -0.056, -RECV_F, -0.046);
    sh.closePath();
    const g = new THREE.ExtrudeGeometry(sh, { depth: 0.028, bevelEnabled: true, bevelThickness: 0.0018, bevelSize: 0.0016, bevelSegments: 2, curveSegments: 8 });
    g.rotateY(Math.PI / 2); g.translate(-0.014, 0, 0);
    S.push(g);
  }
  // the loading gate (right side), its screw, the side-plate screws, the saddle-ring stud (left)
  S.push(box(0.0022, 0.017, 0.034, GATE.x, GATE.y, GATE.z));
  for (const [y, z] of [[-0.008, 0.02], [-0.03, 0.095], [0.004, -0.02]] as const) for (const sx of [-1, 1]) S.push(cyl(0.0028, 0.0028, 0.002, 10, sx * 0.0156, y, z, 0, 0, Math.PI / 2));
  // ── barrel (a little taper) + the muzzle crown; the magazine tube under it with its end cap ──
  S.push(cyl(0.0098, 0.0089, RECV_F - MUZZLE_Z, 14, 0, 0, (RECV_F + MUZZLE_Z) / 2, Math.PI / 2, 0, 0)); // cyl's top end lands at +Z (the breech)
  S.push(cyl(0.0094, 0.0094, 0.004, 14, 0, 0, MUZZLE_Z + 0.002, Math.PI / 2, 0, 0));
  S.push(cyl(0.0079, 0.0079, 0.445, 12, 0, -0.0192, -0.26, Math.PI / 2, 0, 0));
  S.push(cyl(0.0084, 0.0084, 0.012, 12, 0, -0.0192, -0.484, Math.PI / 2, 0, 0));
  // the carbine barrel band (round over the barrel, round under the tube) and the forend cap
  for (const [z, d] of [[-0.462, 0.011], [-0.272, 0.013]] as const) {
    S.push(cyl(0.0112, 0.0112, d, 14, 0, 0, z, Math.PI / 2, 0, 0));
    S.push(cyl(0.0101, 0.0101, d, 12, 0, -0.0192, z, Math.PI / 2, 0, 0));
    S.push(box(0.0215, 0.0192, d, 0, -0.0096, z));
  }
  // ── the rear sight: a raised base, the semi-buckhorn leaf with its U notch and ears. The notch floor sits under the
  //    sight line by the bead's radius as the eye sees it, so the whole gold bead sits ON the floor, its centre on the aim ──
  {
    S.push(box(0.011, 0.018, 0.03, 0, 0.0165, REAR_Z)); // the raised base
    const floor = SIGHT_Y - BEAD_R * (EYE_Z - REAR_Z) / (EYE_Z - FRONT_Z);
    const leafBot = 0.024, notchW = 0.0074, earTop = SIGHT_Y + 0.0065;
    S.push(box(0.026, floor - leafBot, 0.0022, 0, (floor + leafBot) / 2, REAR_Z)); // up to the notch floor
    for (const sx of [-1, 1]) {
      const x0 = notchW / 2, x1 = 0.013;
      S.push(box(x1 - x0, earTop - floor, 0.0022, sx * (x0 + x1) / 2, (earTop + floor) / 2, REAR_Z));
      S.push(box(0.004, 0.006, 0.0022, sx * 0.0142, earTop + 0.0018, REAR_Z, 0, 0, sx * -0.55)); // the buckhorn's ear
    }
    S.push(box(0.012, 0.004, 0.018, 0, 0.0238, REAR_Z + 0.02)); // the elevator
  }
  // ── the front sight: a ramp, a blade, the gold bead on the sight line ──
  S.push(box(0.008, 0.024, 0.032, 0, 0.02, FRONT_Z + 0.006, -0.12, 0, 0)); // the ramp
  S.push(box(0.0028, SIGHT_Y - 0.03, 0.011, 0, (SIGHT_Y + 0.03) / 2, FRONT_Z)); // the blade
  // ── trigger + the lower tang's guard notch ──
  { const trig = new THREE.TorusGeometry(0.014, 0.0026, 8, 12, Math.PI * 0.55); trig.rotateY(Math.PI / 2); trig.rotateX(Math.PI * 0.5); trig.translate(0, -0.056, 0.13); S.push(trig); }
  // ── walnut: the forend (rounded section under the barrel + tube) and the straight-grip stock ──
  {
    const fw = 0.0175, fh = 0.019, fr = 0.009, fs = new THREE.Shape();
    fs.moveTo(-fw + fr, -fh); fs.lineTo(fw - fr, -fh); fs.quadraticCurveTo(fw, -fh, fw, -fh + fr); fs.lineTo(fw, fh - 0.004); fs.lineTo(-fw, fh - 0.004); fs.lineTo(-fw, -fh + fr); fs.quadraticCurveTo(-fw, -fh, -fw + fr, -fh);
    const fore = new THREE.ExtrudeGeometry(fs, { depth: 0.23, bevelEnabled: true, bevelThickness: 0.004, bevelSize: 0.003, bevelSegments: 3, curveSegments: 6 });
    fore.translate(0, -0.0165, -0.266); // z −0.266 … −0.036
    W.push(fore);
    const st = new THREE.Shape(); // x = forward (→ −Z), y = up
    st.moveTo(-RECV_B + 0.002, -0.004);
    st.lineTo(-0.2, 0.0);
    st.quadraticCurveTo(-0.29, 0.004, -0.49, -0.012); // the comb falls a touch to the heel
    st.lineTo(-0.5, -0.016);
    st.lineTo(-0.5, -0.128);                           // the butt
    st.lineTo(-0.47, -0.128);
    st.quadraticCurveTo(-0.33, -0.088, -0.232, -0.06); // the belly up to the wrist
    st.lineTo(-RECV_B - 0.066, -0.056);
    st.lineTo(-RECV_B + 0.002, -0.046);
    st.closePath();
    const stock = new THREE.ExtrudeGeometry(st, { depth: 0.03, bevelEnabled: true, bevelThickness: 0.0055, bevelSize: 0.0045, bevelSegments: 3, curveSegments: 10 });
    stock.rotateY(Math.PI / 2); stock.translate(-0.015, 0, 0);
    stockGeo = stripExtra(stock);
  }
  // the steel butt plate, its two screws
  S.push(box(0.04, 0.114, 0.006, 0, -0.072, 0.503));
  for (const y of [-0.03, -0.11]) S.push(cyl(0.003, 0.003, 0.002, 10, 0, y, 0.507, Math.PI / 2, 0, 0));

  const woodGeo = mergeGeometries(W.map(stripExtra), false); edgeWear(woodGeo, 0.22);
  edgeWear(stockGeo, 0.22);
  const steelGeo = mergeGeometries(S.map(stripExtra), false);
  const L: THREE.BufferGeometry[] = [];
  L.push(box(0.009, 0.0065, 0.108, 0, -0.004, 0.058)); // the bar under the receiver, pivot → the loop
  const loop = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, -0.004, 0.105), new THREE.Vector3(0, -0.024, 0.118), new THREE.Vector3(0, -0.046, 0.142), new THREE.Vector3(0, -0.058, 0.18),
    new THREE.Vector3(0, -0.052, 0.214), new THREE.Vector3(0, -0.036, 0.222), new THREE.Vector3(0, -0.02, 0.2), new THREE.Vector3(0, -0.006, 0.168),
  ], false, 'catmullrom', 0.5);
  L.push(new THREE.TubeGeometry(loop, 28, 0.0036, 8, false));
  L.push(cyl(0.0052, 0.0052, 0.012, 12, 0, 0, 0, 0, 0, Math.PI / 2)); // the pivot boss
  const leverGeo = mergeGeometries(L.map(stripExtra), false);
  const H: THREE.BufferGeometry[] = [];
  H.push(box(0.007, 0.03, 0.01, 0, 0.012, 0.004, -0.2, 0, 0));
  H.push(box(0.009, 0.006, 0.02, 0, 0.028, 0.014, 0.35, 0, 0)); // the spur
  for (let k = 0; k < 4; k++) H.push(box(0.0092, 0.0012, 0.0016, 0, 0.0312, 0.008 + k * 0.004, 0.35, 0, 0)); // chequering
  const hammerGeo = mergeGeometries(H.map(stripExtra), false);
  const boltGeo = mergeGeometries([stripExtra(box(0.013, 0.0085, 0.075, 0, 0.0215, 0.068)), stripExtra(box(0.004, 0.003, 0.05, 0, 0.0265, 0.07))], false);
  return { wood: woodGeo, stock: stockGeo, steel: steelGeo, lever: leverGeo, hammer: hammerGeo, bolt: boltGeo, leverPivot: LEVER_PIVOT, gate: GATE };
}

/** a .30-30 cartridge (tip at −Z, 6.8 cm long); `live` has the bullet, an empty is the case alone */
function cartridgeGeometry(live: boolean): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  parts.push(cyl(0.0053, 0.0053, 0.0015, 10, 0, 0, 0.0255, Math.PI / 2, 0, 0)); // the rim
  parts.push(cyl(0.0052, 0.0054, 0.036, 10, 0, 0, 0.007, Math.PI / 2, 0, 0));
  parts.push(cyl(0.0042, 0.0052, 0.008, 10, 0, 0, -0.015, Math.PI / 2, 0, 0)); // the shoulder
  parts.push(cyl(0.0042, 0.0042, 0.006, 10, 0, 0, -0.022, Math.PI / 2, 0, 0)); // the neck
  if (live) { parts.push(cyl(0.0022, 0.0039, 0.014, 10, 0, 0, -0.032, Math.PI / 2, 0, 0)); parts.push(cyl(0.0015, 0.0022, 0.003, 8, 0, 0, -0.0405, Math.PI / 2, 0, 0)); } // the flat-nose bullet
  const g = mergeGeometries(parts.map(stripExtra), false);
  whiteColors(g);
  return g;
}

/** the crossbow's walnut textures, cloned (the GPU keeps one copy: the clones share their source), else drawn here */
function borrowWood(from: THREE.Object3D | null): TexSet {
  const mats: THREE.Material[] = [];
  from?.traverse((m) => { if (isMesh(m) && !Array.isArray(m.material)) mats.push(m.material); });
  for (const mat of mats) {
    if (mat.name !== 'xbow-wood' || !(mat instanceof THREE.MeshStandardMaterial)) continue;
    const { map, normalMap, roughnessMap } = mat;
    if (map !== null && normalMap !== null && roughnessMap !== null) return { map: map.clone(), normalMap: normalMap.clone(), armMap: roughnessMap.clone() };
  }
  return viewmodelTexSet('walnut');
}
