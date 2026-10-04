/**
 * The log cabin (E315 M2; PINE-HOLLOW-REMASTER): the Hollow's three, one variant each — the ranger's cabin in the Hollow,
 * the east cabin, the ridge cabin — and the log kit every Pine Hollow log building is built with (the mill hamlet's five:
 * ./huntingLodge.ts, ./traderStall.ts, ./millersHouse.ts, ./watermill.ts, ./hamletShed.ts; the landmarks' timber:
 * ../world/timber.ts).
 *
 * The kit (moved from src/engine/world/Cabin.ts, E347): built procedurally from the Poly Haven PBR sets — every wall log is a real
 * cylinder (round silhouette, interleaved notched-corner overhangs, chinking slab behind), the roof is planks over rafters
 * + purlins + a ridge log, doors are hinged plank doors that swing inward, windows have frames, mullions and reflective
 * glass with a warm interior glow. Building frame: door + porch face local +X, the ridge runs along local Z; the building
 * is turned by its site's `rot` about Y and sits on `heightAt(site)` (the stone plinth reaches 0.9 m below ground).
 *
 * A building is site-fitted: `CabinBuilder` builds it where it stands (the homestead, src/engine/world/Cabin.ts `Cabins.build`,
 * one building per task) — its root with what draws on its own (the door, the lantern, the fire pit, smoke, the wheel;
 * each object's distance band tagged), its parts per material, its world-space colliders and floors, its live parts
 * (doors, fires, lamps) handed to the homestead. `place` draws it (`ModelDef.weld`, src/engine/models/weld.ts): the cabins' parts
 * merged per building and their never-hidden materials welded across the three, the hamlet's five welded into one set,
 * the detail and far sets dropped with distance (src/shards/pine-hollow/world/cabins.ts). The Explorer's specimen is the
 * building built alone and merged as the world merges a cabin (`buildingSpecimen`).
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { SEED } from '@wildshard/engine/core/config';
import { Rng } from '@wildshard/engine/core/rng';
import { TIER_CONFIG } from '@wildshard/engine/core/tier';
import { defineModel, type ModelBuild, type ModelContext } from '@wildshard/engine/models/model';
import { UnitParts, flatPositions, mergeOrNull, nearProxy, shadowProxy, twoSidedPositions, type WeldBuild, type WeldPart } from '@wildshard/engine/models/weld';
import type { BoxSpec as Collider } from '@wildshard/engine/physics/box';
import { boxDesc, type ColliderDesc } from '@wildshard/engine/world/registry';
import type { SkyRig as Sky } from '@wildshard/engine/world/skyRig';
import { terrainHeight as heightAt } from '@wildshard/engine/world/terrainHeight';
import type { Cabins, Mats, MatKey } from '../world/homestead';
import type { Interactable } from '@wildshard/engine/world/interact/types';

// ───────────────────────────── the log kit ─────────────────────────────

const LOG = 0.25;           // log row pitch (m)
const LOG_R = 0.112;        // log radius → ~2.6 cm chinking line between logs
const OVERHANG = 0.32;      // notched log ends past the corner
const BOARDS = 7;           // boards across the wood_trunk_wall texture
const BOARD_LEN = 1.25;     // texture size (m) along the board grain
const PLINTH = 0.18;        // stone foundation above ground
const FLOOR = PLINTH + 0.04;
const RAFTER_H = 0.14;
const SHEET = 0.045;

interface Opening { a0: number; a1: number; y0: number; y1: number } // along-wall range, height range (absolute local y)
const FRAME = 0.09;                                                   // window frame thickness
/** snap a height to the nearest chinking gap of a wall (eave walls: rows at (i+½)·LOG, gable walls: (i+1)·LOG) */
function snapRow(y: number, gableWall: boolean) {
  const off = gableWall ? 0.5 : 0;
  return PLINTH + (Math.round((y - PLINTH) / LOG - off) + off) * LOG;
}
/** the hole cut through the logs for a window: glass opening + frame, top/bottom snapped to log gaps so no cut log end shows */
function roughOpening(o: Opening, gableWall: boolean): Opening {
  return { a0: o.a0 - FRAME + 0.01, a1: o.a1 + FRAME - 0.01, y0: snapRow(o.y0 - FRAME, gableWall), y1: snapRow(o.y1 + FRAME, gableWall) };
}
type WallId = 'front' | 'back' | 'zpos' | 'zneg';
interface WallExt { from?: number; to?: number; overhangFrom?: boolean; overhangTo?: boolean }
interface LogBoxOpts {
  gables: { zpos: boolean; zneg: boolean };
  skip?: WallId[];
  ext?: Partial<Record<WallId, WallExt>>;
  openings?: Partial<Record<WallId, Opening[]>>;
}

/** `open`: an unglazed hatch (the trader's serving window: no glass, a counter + awning outside when on the front wall) */
interface WindowSpec { wall: WallId; at: number; w?: number; y?: number; h?: number; open?: boolean }
export interface CabinSpec {
  W: number; L: number; rows: number; pitch: number;
  doorZ: number;
  windows: WindowSpec[];
  chimney: 'zpos' | 'zneg';
  /** no chimney stack or fireplace (a shed, the stall, the mill); `chimney` still names the end the annex / lean-to avoids */
  noChimney?: boolean;
  /** 0 = no porch (the floor is a 0.22 m step up from the pad) */
  porchDepth: number;
  annex?: { W: number; L: number; rows: number; pitch: number };   // L-shaped wing off the gable end opposite the chimney
  leanTo?: boolean;                                               // wood shed on the gable end opposite the chimney
  lantern?: boolean;
  firePit?: boolean;
  bench?: 'logs' | 'table';
  /** 'swing' (default): a hinged door you open; 'fixed': shut for good, merged into the static mesh (0 draws of its own) */
  door?: 'swing' | 'fixed';
  /** what is inside: the ranger's 'home' (default), the lodge's 'hall', a 'store' of crates, the 'mill' stones, or 'none' */
  interior?: 'home' | 'hall' | 'store' | 'mill' | 'none';
  /** how far the stone plinth reaches below the pad (default 0.9; the mill's creek side falls away) */
  plinthDrop?: number;
  /**
   * the watermill's wheel wing (PH-B3): a log room on stilts off the back wall (local −X), `L` long, reaching out over the
   * creek's bank, and the undershot wheel beside its far end, turning in the creek (radius `r`, axle `axleY` above the pad)
   */
  wing?: { W: number; L: number; rows: number; pitch: number; r: number; axleY: number };
}

/** the three cabins' specs, in CABIN_SITES order (the hamlet's are src/shards/pine-hollow/world/landmarks.ts `pineHamletBuildings`) */
export const CABIN_SPECS: readonly CabinSpec[] = [
  { // cabin 1 — the hollow: classic 7×5, camp fire out front with log benches
    W: 5, L: 7, rows: 11, pitch: 0.72, doorZ: 0.9,
    windows: [{ wall: 'front', at: -1.6 }, { wall: 'back', at: 0.6 }, { wall: 'zpos', at: -1.5 }],
    chimney: 'zneg', porchDepth: 2.1, firePit: true, bench: 'logs', leanTo: true, lantern: true,
  },
  { // cabin 2 — 9×6 with an L-shaped annex, lantern on the porch, table outside
    W: 6, L: 9, rows: 12, pitch: 0.66, doorZ: 1.2,
    windows: [{ wall: 'front', at: -1.5 }, { wall: 'front', at: 3.2, w: 0.7 }, { wall: 'zneg', at: 1.6 }, { wall: 'back', at: 3.0 }],
    chimney: 'zneg', porchDepth: 2.3, annex: { W: 3.6, L: 4.0, rows: 8, pitch: 0.55 }, lantern: true, bench: 'table',
  },
  { // cabin 3 — the ridge: 6×5, steep roof, lean-to wood shed
    W: 5, L: 6, rows: 11, pitch: 0.82, doorZ: -0.6,
    windows: [{ wall: 'front', at: 1.5 }, { wall: 'back', at: 0 }, { wall: 'zneg', at: -1.3, w: 0.7, h: 0.6 }],
    chimney: 'zpos', porchDepth: 1.9, leanTo: true, bench: 'logs', lantern: true,
  },
];

export interface Door {
  id: string; pivot: THREE.Object3D; open: boolean; t: number; collider: Collider; interactable: Interactable;
  /** PHYSICS P3: the leaf as a box in the pivot's local frame */
  slab: ColliderDesc;
}
/** `kind`: a fire burns all day and only reads stronger at night; a lamp (lantern, room light) is lit by the clock (PH-L3) */
export type LightKind = 'fire' | 'lamp';
export interface Fire { light: THREE.PointLight; base: number; seed: number; kind: LightKind }
/** phone tier: a point light's slot — the shared lights jump to the nearest cabin's anchors (`rank`: which ones get a light) */
export interface LightAnchor { anchor: THREE.Object3D; color: number; intensity: number; distance: number; decay: number; seed: number; kind: LightKind; rank: number }
/** a room's floor rectangle in the building's frame (inside = the pooled pair lights the room: Cabins.update) */
export interface Room { x: number; z: number; hw: number; hd: number }
export interface Swing { pivot: THREE.Object3D; seed: number }
export interface Floor { x: number; z: number; rot: number; hw: number; hd: number; y: number }
export type PropKind = 'crate' | 'barrel' | 'bucket' | 'hatchet';
export const PROP_KINDS: readonly PropKind[] = ['crate', 'barrel', 'bucket', 'hatchet'];

/**
 * PHYSICS P3: a prop's box — the glTF scan's bounds (wooden_crate_02 0.53 × 0.45 × 1.17, wine_barrel_01 ⌀0.74 × 0.87,
 * wooden_bucket_01 ⌀0.35 × 0.35) at scale 1, standing on its foot: half-width across (x), half-depth along (z), height.
 * The hatchet has none (it sits in its chopping block's collider). Each prop model collides as its box (E315).
 */
export const PROP_BOXES: Readonly<Record<PropKind, { readonly hw: number; readonly hd: number; readonly h: number } | null>> = {
  crate: { hw: 0.265, hd: 0.583, h: 0.455 }, barrel: { hw: 0.34, hd: 0.34, h: 0.872 }, bucket: { hw: 0.17, hd: 0.17, h: 0.35 }, hatchet: null,
};
/** one (geometry, material, world matrix) part of a flattened glTF prop */
export interface PropPart { geometry: THREE.BufferGeometry; material: THREE.Material; matrix: THREE.Matrix4 }

function makeParticles(mat: THREE.ShaderMaterial, count: number, rng: Rng) {
  const geo = new THREE.InstancedBufferGeometry();
  const quad = new THREE.PlaneGeometry(1, 1);
  geo.setAttribute('position', quad.getAttribute('position'));
  geo.setAttribute('uv', quad.getAttribute('uv'));
  geo.setIndex(quad.index);
  const seeds = new Float32Array(count * 4);
  for (let i = 0; i < seeds.length; i++) seeds[i] = rng.next();
  geo.setAttribute('seed', new THREE.InstancedBufferAttribute(seeds, 4));
  geo.instanceCount = count;
  geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 5, 0), 18);
  return new THREE.Mesh(geo, mat);
}

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
/** `instanceof THREE.Mesh` narrows to `Mesh<any, any>`; this keeps the default generics */
const isMesh = (o: THREE.Object3D): o is THREE.Mesh => 'isMesh' in o;

// ───────────────────────────── geometry helpers ─────────────────────────────

/** planar UVs by dominant face normal, in the geometry's current space, metres / scale */
export function boxUV<G extends THREE.BufferGeometry>(geo: G, scale: number, uOff = 0, vOff = 0): G {
  const pos = geo.getAttribute('position'), nor = geo.getAttribute('normal');
  const uv = geo.getAttribute('uv');
  for (let i = 0; i < pos.count; i++) {
    const nx = Math.abs(nor.getX(i)), ny = Math.abs(nor.getY(i)), nz = Math.abs(nor.getZ(i));
    let u: number, v: number;
    if (ny >= nx && ny >= nz) { u = pos.getX(i); v = pos.getZ(i); }
    else if (nx >= nz) { u = pos.getZ(i); v = pos.getY(i); }
    else { u = pos.getX(i); v = pos.getY(i); }
    uv.setXY(i, u / scale + uOff, v / scale + vOff);
  }
  return geo;
}
export function swapUV<G extends THREE.BufferGeometry>(geo: G): G {
  const uv = geo.getAttribute('uv');
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getY(i), uv.getX(i));
  return geo;
}

/** a horizontal log along +X of `len`, radius r, textured with one board of the log-wall set (or bark when `bark`) */
export function logGeo(len: number, r: number, board: number, vOff: number, segs = 14, bark = false): { side: THREE.CylinderGeometry; caps: THREE.BufferGeometry } {
  const side = new THREE.CylinderGeometry(r, r, len, segs, 1, true);
  const pos = side.getAttribute('position'), uv = side.getAttribute('uv');
  for (let i = 0; i < pos.count; i++) {
    const th = Math.atan2(pos.getZ(i), pos.getX(i)) / (Math.PI * 2) + 0.5; // 0..1 around
    if (bark) uv.setXY(i, th * (r * 6.283) * 0.5, (pos.getY(i) + vOff) * 0.5); // pine_bark is a 2 m tile
    else {
      const tri = th < 0.5 ? th * 2 : 2 - th * 2;                              // mirror so the board wraps front & back
      uv.setXY(i, (board + 0.06 + tri * 0.88) / BOARDS, (pos.getY(i) + vOff) / BOARD_LEN);
    }
  }
  side.rotateZ(-Math.PI / 2); // +Y → +X
  const capA = new THREE.CircleGeometry(r, segs).rotateY(Math.PI / 2).translate(len / 2, 0, 0);
  const capB = new THREE.CircleGeometry(r, segs).rotateY(-Math.PI / 2).translate(-len / 2, 0, 0);
  return { side, caps: mergeGeometries([capA, capB]) };
}

/** wall shape (rect or gable pentagon) with rectangular holes, extruded through the wall thickness; x = along, y = up, z = thickness */
function wallSlab(a0: number, a1: number, h: number, thick: number, openings: Opening[], gableApex?: number) {
  const s = new THREE.Shape();
  s.moveTo(a0, 0); s.lineTo(a1, 0); s.lineTo(a1, h);
  if (gableApex !== undefined) s.lineTo((a0 + a1) / 2, gableApex);
  s.lineTo(a0, h); s.closePath();
  for (const o of openings) {
    const p = new THREE.Path();
    p.moveTo(o.a0, o.y0); p.lineTo(o.a1, o.y0); p.lineTo(o.a1, o.y1); p.lineTo(o.a0, o.y1); p.closePath();
    s.holes.push(p);
  }
  const g = new THREE.ExtrudeGeometry(s, { depth: thick, bevelEnabled: false });
  g.translate(0, 0, -thick / 2);
  return g;
}

// ───────────────────────────── one building ─────────────────────────────

/** small parts drawn only within the detail distance (TIER_CONFIG.cabinDetailDist): their depth only through the near proxy */
const DETAIL_KEYS = new Set<MatKey>(['iron', 'cloth', 'char', 'chink']);
/** merged parts that go past 2× the detail distance (log ends, woodpile bark, door frame) */
const FAR_KEYS = new Set<MatKey>(['endGrain', 'bark', 'door']);

/** a sub-frame inside a building (the mill's wing): local (x, z) turned by `yaw` about +Y, then moved to (x, y, z) */
interface SubFrame { x: number; y: number; z: number; yaw: number }

/**
 * What a log building registers with the homestead as it builds (its live parts: doors, fires, lamps, the mill wheel, the
 * floors and the static boxes): src/engine/world/Cabin.ts `Cabins`. A specimen's owner keeps nothing (`NO_OWNER`).
 */
export interface BuildingOwner {
  readonly _collider: (c: Collider) => void;
  readonly _solid: (d: ColliderDesc, prop: boolean) => void;
  readonly _floor: (f: Floor) => void;
  readonly _door: (d: Door) => void;
  /** a door's use: the owner moves it (`toggle`) unless it is barred, and tells its listeners */
  readonly _doorUse: (d: Door, toggle: () => void) => void;
  readonly _fire: (f: Fire) => void;
  readonly _lamp: (mat: THREE.MeshStandardMaterial, full: number) => void;
  readonly _swing: (sw: Swing) => void;
  readonly _particles: (m: THREE.ShaderMaterial) => void;
  readonly _wheel: (o: THREE.Object3D) => void;
  readonly _firePit: (at: { x: number; y: number; z: number }) => void;
}

const NO_OWNER: BuildingOwner = {
  _collider: () => undefined, _solid: () => undefined, _floor: () => undefined, _door: () => undefined, _doorUse: (_d, toggle) => { toggle(); }, _fire: () => undefined,
  _lamp: () => undefined, _swing: () => undefined, _particles: () => undefined, _wheel: () => undefined, _firePit: () => undefined,
};

/**
 * `cabin`: one of the three, its lights real on a tier with them; `member`: a mill-hamlet building (welded into the
 * hamlet's one unit), its lights anchors only; `specimen`: the Model Explorer's copy, lights as anchors, drawn alone.
 */
export type BuildingRole = 'cabin' | 'member' | 'specimen';


/**
 * One log building, built where it stands (site-fitted: the mill's stilts reach the bank under them; its colliders are
 * world space): its root with what draws on its own (the door on its pivot, the lantern, the fire pit, smoke, the wheel),
 * its parts per material for `place` to merge (./../../../models/weld.ts), its live parts handed to its owner.
 */
export class CabinBuilder {
  root = new THREE.Group();
  /** small parts drawn only within TIER_CONFIG.cabinDetailDist (tagged `userData.until` by `band`) */
  detail: THREE.Object3D[] = [];
  /** mid parts drawn only within 2× cabinDetailDist */
  far: THREE.Object3D[] = [];
  /** desktop: its double-sided dressing's depth for its near proxy (the fire pit here, its props from the homestead); null on
   *  the phone, whose detail casts no shadow */
  readonly casters: THREE.BufferGeometry[] | null = TIER_CONFIG.cabinDetailShadows ? [] : null;
  /** casters whose shadow a near proxy draws while the detail band is on: they cast only past it (tagged `castFrom`) */
  swap: THREE.Object3D[] = [];
  /** phone tier: where this cabin's point lights would be (see Cabins.sharedLights) */
  anchors: LightAnchor[] = [];
  /** the rooms' floor rectangles and the door, in the building's frame (Cabins.update's indoor lamp ranking) */
  rooms: Room[] = [];
  doorAt: [number, number];
  /** its walkable floors and decks, world space (Cabins.floorHeightAt; its piece's floor) */
  readonly floors: Floor[] = [];
  private parts = new Map<MatKey, THREE.BufferGeometry[]>();
  /** its window panes, a list per window group (drawn within the detail distance, after the opaque parts) */
  private readonly glass: THREE.BufferGeometry[][] = [];
  private readonly role: BuildingRole;
  /** its legacy boxes, the door's, and its static solids (a prop's is its model's collider, not the building's) */
  private readonly legacy: Collider[] = [];
  private doorBox: Collider | null = null;
  private readonly solidList: { readonly d: ColliderDesc; readonly prop: boolean }[] = [];
  private rng: Rng;
  private wallTop: number;
  private ridgeY: number;
  private tanP: number;
  private m = new THREE.Matrix4();
  /** the active sub-frame (withFrame) and its matrix */
  private frame: SubFrame | null = null;
  private frameM = new THREE.Matrix4();
  /** a hamlet building's (and a specimen's) lights are anchors only (the phone's pooled pair may visit them; never a light of their own) */
  private anchorLights: boolean;
  private readonly specimen: boolean;
  /** the fire pit and the porch lantern it placed (their models' copies, E315 M2) */
  firePitObj: THREE.Object3D | null = null;
  lanternObj: THREE.Object3D | null = null;

  constructor(
    private owner: BuildingOwner, private spec: CabinSpec, private index: number,
    private cx: number, private cy: number, private cz: number, private rot: number,
    private mats: Mats, private sky: Sky, private propInstances: Record<PropKind, THREE.Matrix4[]>,
    role: BuildingRole = 'cabin',
  ) {
    this.rng = new Rng(SEED + 500 + index * 17);
    this.root.position.set(cx, cy, cz);
    this.root.rotation.y = rot;
    this.root.updateMatrixWorld(true);
    this.role = role;
    this.anchorLights = role !== 'cabin';
    this.specimen = role === 'specimen';
    this.doorAt = [spec.W / 2, spec.doorZ];
    this.rooms.push({ x: 0, z: 0, hw: spec.W / 2, hd: spec.L / 2 });
    if (spec.wing) this.rooms.push({ x: -(spec.W / 2) - spec.wing.L / 2, z: 0, hw: spec.wing.L / 2, hd: spec.wing.W / 2 });
    this.wallTop = PLINTH + spec.rows * LOG;                // top of the eave (Z) walls
    this.tanP = Math.tan(spec.pitch);
    this.ridgeY = this.wallTop + (spec.W / 2) * this.tanP;
  }

  // ── helpers ──
  private add(key: MatKey, geo: THREE.BufferGeometry, matrix?: THREE.Matrix4) {
    if (matrix) geo.applyMatrix4(matrix);
    if (this.frame) geo.applyMatrix4(this.frameM);
    const g = geo.index ? geo.toNonIndexed() : geo;
    if ((key === 'roof' || key === 'stone') && !g.hasAttribute('moss')) {
      // moss density hint: stone = near the ground, roof default = mid-slope
      const pos = g.getAttribute('position'), moss = new Float32Array(pos.count);
      for (let i = 0; i < pos.count; i++) moss[i] = key === 'stone' ? clamp01((0.9 - pos.getY(i)) / 1.1) : 0.35;
      g.setAttribute('moss', new THREE.BufferAttribute(moss, 1));
    }
    const list = this.parts.get(key);
    if (list === undefined) this.parts.set(key, [g]); else list.push(g);
  }
  /** build `fn`'s geometry, colliders and floors in a sub-frame of the building (the mill's wing) */
  private withFrame(f: SubFrame, fn: () => void) {
    this.frame = f;
    this.frameM.makeRotationY(f.yaw).setPosition(f.x, f.y, f.z);
    try { fn(); } finally { this.frame = null; }
  }
  /** a sub-frame point / turn → the building frame */
  private fr(lx: number, lz: number): [number, number] {
    const f = this.frame;
    if (f === null) return [lx, lz];
    const c = Math.cos(f.yaw), s = Math.sin(f.yaw);
    return [f.x + lx * c + lz * s, f.z - lx * s + lz * c];
  }
  private get frYaw(): number { return this.frame?.yaw ?? 0; }
  private get frY(): number { return this.frame?.y ?? 0; }
  private box(key: MatKey, w: number, h: number, d: number, x: number, y: number, z: number, uvScale = 1, ry = 0, rz = 0, rx = 0) {
    const g = new THREE.BoxGeometry(w, h, d);
    boxUV(g, uvScale, this.rng.range(0, 1), this.rng.range(0, 1));
    this.m.makeRotationFromEuler(new THREE.Euler(rx, ry, rz, 'YXZ')).setPosition(x, y, z);
    this.add(key, g, this.m);
  }
  /** log along +X (or +Z when `alongZ`) centred at (x,y,z) */
  private log(len: number, x: number, y: number, z: number, alongZ = false, r = LOG_R, key: MatKey = 'log') {
    const { side, caps } = logGeo(len, r, this.rng.int(0, BOARDS - 1), this.rng.range(0, BOARD_LEN), 14, key === 'bark');
    this.m.makeRotationY(alongZ ? Math.PI / 2 : 0).setPosition(x, y, z);
    this.add(key, side, this.m);
    this.add('endGrain', caps, this.m);
  }
  private collider(lx0: number, lz0: number, hw: number, hd: number, yBottom0: number, yTop0: number, localRot0 = 0): Collider {
    const [lx, lz] = this.fr(lx0, lz0), localRot = localRot0 + this.frYaw, yBottom = yBottom0 + this.frY, yTop = yTop0 + this.frY;
    const c = Math.cos(this.rot), s = Math.sin(this.rot);
    const col: Collider = {
      x: this.cx + lx * c + lz * s, z: this.cz - lx * s + lz * c,
      hw, hd, rot: -(this.rot + localRot), yTop: this.cy + yTop, yBottom: this.cy + yBottom,
    };
    this.owner._collider(col); this.legacy.push(col);
    return col;
  }
  /**
   * PHYSICS P3: a static box for `Cabins.colliderDescs()` only (not a legacy `Collider`), in the cabin's local frame:
   * centre (lx, lz), half-extents hw × hd turned by `localRot`, from yBottom to yTop above the cabin base.
   */
  private solid(lx0: number, lz0: number, hw: number, hd: number, yBottom0: number, yTop0: number, localRot0 = 0, surface?: 'stone' | 'wood', prop = false) {
    const [lx, lz] = this.fr(lx0, lz0), localRot = localRot0 + this.frYaw, yBottom = yBottom0 + this.frY, yTop = yTop0 + this.frY;
    const c = Math.cos(this.rot), s = Math.sin(this.rot);
    const d: ColliderDesc = {
      kind: 'box', x: this.cx + lx * c + lz * s, y: this.cy + (yTop + yBottom) / 2, z: this.cz - lx * s + lz * c,
      hx: hw, hy: (yTop - yBottom) / 2, hz: hd, yaw: this.rot + localRot, ...(surface === undefined ? {} : { surface }),
    };
    this.owner._solid(d, prop); this.solidList.push({ d, prop });
  }
  /** a floor / deck rectangle (world space): the owner's floorHeightAt, and this building's piece */
  private deck(f: Floor) { this.owner._floor(f); this.floors.push(f); }
  private worldPos(lx: number, ly: number, lz: number) {
    const v = new THREE.Vector3(lx, ly, lz);
    if (this.frame) v.applyMatrix4(this.frameM);
    return v.applyMatrix4(this.root.matrixWorld);
  }
  /** a flickering point light under `parent` — a real light on desktop, an anchor for the shared set on the phone (`rank`:
   *  the phone lights the lowest ranks of the nearest cabin: the fire pit, then the porch lantern, the room, the hearth) */
  private pointLight(parent: THREE.Object3D, color: number, intensity: number, distance: number, decay: number, x: number, y: number, z: number, seed: number, kind: LightKind, rank: number) {
    if (TIER_CONFIG.sharedCabinLights || this.anchorLights) {
      const anchor = new THREE.Object3D(); anchor.position.set(x, y, z); parent.add(anchor);
      this.anchors.push({ anchor, color, intensity, distance, decay, seed, kind, rank });
      this.anchors.sort((a, b) => a.rank - b.rank);
      return;
    }
    const light = new THREE.PointLight(color, intensity, distance, decay);
    light.position.set(x, y, z); parent.add(light);
    this.owner._fire({ light, base: intensity, seed, kind });
  }
  private placeProp(kind: PropKind, x: number, y: number, z: number, ry: number, scale = 1) {
    const local = new THREE.Matrix4().makeRotationY(ry).setPosition(x, y, z).scale(new THREE.Vector3(scale, scale, scale));
    if (this.frame) local.premultiply(this.frameM);
    this.propInstances[kind].push(new THREE.Matrix4().multiplyMatrices(this.root.matrixWorld, local));
    // PHYSICS P3: the glTF props' bounds (PROP_BOXES); the hatchet sits in its chopping block's collider. A prop's box is its
    // model's collider (E315: src/shards/pine-hollow/models/woodenCrate.ts …), not its building's — kept here too, in the
    // order it always had, for `colliderDescs` (the navmesh bake)
    const dims = PROP_BOXES[kind];
    if (dims) this.solid(x, z, dims.hw * scale, dims.hd * scale, y, y + dims.h * scale, ry, 'wood', true);
  }

  build(firePit: THREE.Object3D, lantern: THREE.Object3D): void {
    const { W, L } = this.spec;
    const a = this.spec.annex;
    const annexSide = this.spec.chimney === 'zpos' ? -1 : 1;    // annex / lean-to go on the gable end without the chimney
    const hz = L / 2 - LOG_R;
    const ext: Partial<Record<WallId, WallExt>> = {};
    const openings = this.openingsFor();
    let annexBox: { ox: number; oz: number } | undefined;
    if (a) {
      // the back wall is simply extended to cover the annex (no seam), the annex adds its own front + far gable walls
      const oz = annexSide * (hz + a.L / 2), ox = -(W / 2) + a.W / 2;
      annexBox = { ox, oz };
      this.rooms.push({ x: ox, z: oz, hw: a.W / 2, hd: a.L / 2 });
      ext.back = annexSide > 0 ? { to: hz + a.L } : { from: -(hz + a.L) };
      (openings[annexSide > 0 ? 'zpos' : 'zneg'] ??= []).push({ a0: ox - 0.5, a1: ox + 0.5, y0: PLINTH - 0.05, y1: FLOOR + 2.0 });
    }
    if (this.spec.wing) (openings.back ??= []).push({ a0: -0.5, a1: 0.5, y0: PLINTH - 0.05, y1: snapRow(FLOOR + 2.1 + 0.1, false) });
    this.foundation(W, L, 0, 0, this.spec.plinthDrop);
    this.floorPlanks(W, L, 0, 0);
    this.logBox(W, L, 0, 0, this.spec.rows, this.spec.pitch, { gables: { zpos: true, zneg: true }, ext, openings });
    this.roof(W, L, 0, 0, this.spec.pitch, this.wallTop, 0.12, 0.55, 0.5, 0.5);
    this.door();
    this.windows();
    if (!this.spec.noChimney) this.chimney();
    if (this.spec.porchDepth > 0) this.porch();
    const inside = this.spec.interior ?? 'home';
    if (inside === 'home') this.interior();
    else if (inside !== 'none') this.furnish(inside);
    if (annexBox && a) this.annex(annexBox.ox, annexBox.oz, annexSide, a);
    if (this.spec.leanTo) this.leanTo(annexSide);
    else if (!this.spec.wing) this.woodpile(-(W / 2) - 0.32, -annexSide * (L / 2 - 1.6), 0, 4, 1.8, { x: -(W / 2) - 0.25, z: -annexSide * (L / 2 + 0.9) });
    if (this.spec.firePit) this.firePit(firePit);
    if (this.spec.lantern) this.lantern(lantern);
    this.outdoorProps();
    this.rubble();
    if (!this.spec.noChimney) this.smoke();
    if (this.spec.wing) this.wing(this.spec.wing);
    this.band();
  }

  // ── stone plinth: one course above ground, deep enough to hide any slope ──
  private foundation(W: number, L: number, ox: number, oz: number, drop = 0.9) {
    this.box('stone', W + 0.3, PLINTH + drop, L + 0.3, ox, (PLINTH - drop) / 2, oz, 2.0);
    this.box('stone', W + 0.44, 0.1, L + 0.44, ox, 0.05, oz, 2.0); // proud footing course at grade
    this.solid(ox, oz, W / 2 + 0.15, L / 2 + 0.15, -drop, PLINTH, 0, 'stone');   // PHYSICS P3: the plinth's top
  }

  private floorPlanks(W: number, L: number, ox: number, oz: number) {
    const g = new THREE.BoxGeometry(W - 0.2, FLOOR - PLINTH + 0.02, L - 0.2);
    boxUV(g, 1.3, this.rng.next(), this.rng.next());
    this.m.makeTranslation(ox, (FLOOR + PLINTH) / 2, oz);
    this.add('deck', g, this.m);
    const w = this.worldPos(ox, FLOOR, oz);
    this.deck({ x: w.x, z: w.z, rot: this.rot + this.frYaw, hw: W / 2, hd: L / 2, y: w.y });
    this.solid(ox, oz, W / 2, L / 2, PLINTH - 0.15, FLOOR, 0, 'wood');   // PHYSICS P3: the floor, its top = floorHeightAt
  }

  /** four log walls of a W (x) × L (z) rectangle centred at (ox, oz) */
  private logBox(W: number, L: number, ox: number, oz: number, rows: number, pitch: number, opts: LogBoxOpts) {
    const ops = opts.openings ?? {};
    const wallTop = PLINTH + rows * LOG;
    const tanP = Math.tan(pitch);
    const ridge = wallTop + (W / 2) * tanP;
    const hx = W / 2 - LOG_R, hz = L / 2 - LOG_R; // log axes inset by a radius
    // eave walls run along Z at x = ±hx; rows centred at (i + 0.5) LOG
    // gable walls run along X at z = ±hz; rows centred at (i + 1) LOG (interleaved notch)
    const walls: { id: WallId; alongZ: boolean; at: number; from: number; to: number; y0: number; gable: boolean }[] = [
      { id: 'front', alongZ: true, at: hx, from: -hz, to: hz, y0: 0.5, gable: false },
      { id: 'back', alongZ: true, at: -hx, from: -hz, to: hz, y0: 0.5, gable: false },
      { id: 'zpos', alongZ: false, at: hz, from: -hx, to: hx, y0: 1.0, gable: opts.gables.zpos },
      { id: 'zneg', alongZ: false, at: -hz, from: -hx, to: hx, y0: 1.0, gable: opts.gables.zneg },
    ];
    for (const w of walls) {
      if (opts.skip?.includes(w.id)) continue;
      const e = opts.ext?.[w.id] ?? {};
      w.from = e.from ?? w.from; w.to = e.to ?? w.to;
      const ohF = e.overhangFrom ?? true, ohT = e.overhangTo ?? true;
      const wallOps = ops[w.id] ?? [];
      // gable walls start half a row up: a slim sill log fills the gap to the plinth
      if (w.y0 === 1.0) this.log(w.to - w.from, ox + (w.from + w.to) / 2, PLINTH + 0.07, oz + w.at, false, 0.07);
      const nRows = w.gable ? rows + Math.ceil((ridge - wallTop) / LOG) + 1 : rows;
      for (let i = 0; i < nRows; i++) {
        const yc = PLINTH + (i + w.y0) * LOG;
        let from = w.from - (ohF ? OVERHANG : 0), to = w.to + (ohT ? OVERHANG : 0);
        if (yc > wallTop + 1e-3) {
          if (!w.gable) break;
          const half = (ridge - (yc + LOG_R * 0.6)) / tanP;   // shorten to the roof underside
          if (half < 0.3) break;
          from = -half; to = half;
        }
        let segs: [number, number][] = [[from, to]];
        for (const o of wallOps) {
          if (o.y1 <= yc - LOG_R || o.y0 >= yc + LOG_R) continue;
          const next: [number, number][] = [];
          for (const [a, b] of segs) {
            if (o.a1 <= a || o.a0 >= b) { next.push([a, b]); continue; }
            if (o.a0 > a) next.push([a, o.a0]);
            if (o.a1 < b) next.push([o.a1, b]);
          }
          segs = next;
        }
        for (const [a, b] of segs) {
          if (b - a < 0.12) continue;
          const mid = (a + b) / 2;
          if (w.alongZ) this.log(b - a, ox + w.at, yc, oz + mid, true);
          else this.log(b - a, ox + mid, yc, oz + w.at, false);
        }
      }
      // chinking slab behind the logs (openings cut out). Eave walls fill up to the roof sheet like blocking.
      const cosP = Math.cos(pitch);
      const h = (w.gable ? wallTop : wallTop + RAFTER_H / cosP - 0.01) - PLINTH;
      const slab = wallSlab(w.from, w.to, h, LOG_R * 0.75, wallOps.map((o) => ({ ...o, y0: Math.max(0.002, o.y0 - PLINTH), y1: Math.min(h - 0.002, o.y1 - PLINTH) })),
        w.gable ? ridge - PLINTH + LOG * 0.3 : undefined);
      boxUV(slab, 1);
      this.m.makeRotationY(w.alongZ ? -Math.PI / 2 : 0).setPosition(w.alongZ ? ox + w.at : ox, PLINTH, w.alongZ ? oz : oz + w.at);
      this.add('chink', slab, this.m);

      // colliders: the wall minus door openings (doors get their own toggled collider)
      const doorOps = wallOps.filter((o) => o.y0 <= PLINTH + 0.01);
      let cs: [number, number][] = [[w.from - (ohF ? OVERHANG : 0), w.to + (ohT ? OVERHANG : 0)]];
      for (const o of doorOps) cs = cs.flatMap(([a, b]): [number, number][] => (o.a1 <= a || o.a0 >= b ? [[a, b]] : [[a, o.a0], [o.a1, b]])).filter(([a, b]) => b - a > 0.05);
      for (const [a, b] of cs) {
        const mid = (a + b) / 2, half = (b - a) / 2;
        if (w.alongZ) this.collider(ox + w.at, oz + mid, LOG_R, half, 0, wallTop + 1);
        else this.collider(ox + mid, oz + w.at, half, LOG_R, 0, wallTop + 1);
      }
    }
  }

  private openingsFor(): Partial<Record<WallId, Opening[]>> {
    const out: Partial<Record<WallId, Opening[]>> = {};
    (out.front ??= []).push(this.doorOpening());
    for (const w of this.spec.windows) (out[w.wall] ??= []).push(roughOpening(this.windowOpening(w), w.wall === 'zpos' || w.wall === 'zneg'));
    return out;
  }
  private doorOpening(): Opening { return { a0: this.spec.doorZ - 0.54, a1: this.spec.doorZ + 0.54, y0: PLINTH - 0.05, y1: snapRow(FLOOR + 2.1 + 0.1, false) }; }
  private windowOpening(w: WindowSpec): Opening {
    const ww = w.w ?? 0.95, h = w.h ?? 0.85, y = w.y ?? FLOOR + 1.15;
    return { a0: w.at - ww / 2, a1: w.at + ww / 2, y0: y, y1: y + h };
  }

  // ── roof: plank sheets over rafters + purlins + ridge log; ridge along Z ──
  private roof(W: number, L: number, ox: number, oz: number, pitch: number, wallTop: number, eaveFront: number, eaveBack: number, overPos: number, overNeg: number) {
    const tanP = Math.tan(pitch), cosP = Math.cos(pitch);
    const ridge = wallTop + (W / 2) * tanP;
    const len = L + overPos + overNeg, zc = oz + (overPos - overNeg) / 2;
    for (const side of [1, -1]) {
      const run = W / 2 + (side > 0 ? eaveFront : eaveBack);
      const slope = run / cosP;
      const sheet = swapUV(boxUV(new THREE.BoxGeometry(slope, SHEET, len), 1.5, 0, this.rng.range(0, 1)));  // planks run down the slope
      { // moss hint: 0 at the ridge → 1 at the eave (local +x is down-slope on the +side, up-slope on the −side)
        const pos = sheet.getAttribute('position'), moss = new Float32Array(pos.count);
        for (let i = 0; i < pos.count; i++) moss[i] = clamp01(0.5 + (side * pos.getX(i)) / slope);
        sheet.setAttribute('moss', new THREE.BufferAttribute(moss, 1));
      }
      this.m.makeRotationZ(-side * pitch).setPosition(ox + side * run / 2, ridge - (run / 2) * tanP + (RAFTER_H + SHEET / 2) / cosP, zc);
      this.add('roof', sheet, this.m);
      // a few loose / lifted planks
      for (let k = 0; k < 3; k++) {
        const pl = swapUV(boxUV(new THREE.BoxGeometry(this.rng.range(0.7, 1.3), 0.03, 0.14), 1.5, 0, this.rng.next()));
        const px = this.rng.range(-slope / 2 + 0.7, slope / 2 - 0.7), pz = this.rng.range(-len / 2 + 0.3, len / 2 - 0.3);
        const lift = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(this.rng.range(-0.06, 0.06), this.rng.range(-0.05, 0.05), this.rng.range(0.02, 0.06))).setPosition(px, SHEET / 2 + 0.03, pz);
        this.m.makeRotationZ(-side * pitch).setPosition(ox + side * run / 2, ridge - (run / 2) * tanP + (RAFTER_H + SHEET / 2) / cosP, zc).multiply(lift);
        this.add('roof', pl, this.m);
      }
      const n = Math.max(2, Math.round(len / 0.8));
      for (let i = 0; i <= n; i++) {
        const z = zc - len / 2 + 0.08 + (len - 0.16) * (i / n);
        const rg = boxUV(new THREE.BoxGeometry(slope - 0.02, RAFTER_H, 0.09), 1.0, this.rng.range(0, 1));
        this.m.makeRotationZ(-side * pitch).setPosition(ox + side * run / 2, ridge - (run / 2) * tanP + (RAFTER_H / 2) / cosP, z);
        this.add('beam', rg, this.m);
      }
      for (const f of [0.3, 0.64]) this.log(len + 0.1, ox + side * (W / 2) * f, ridge - (W / 2) * f * tanP - LOG_R * 0.9, zc, true, LOG_R * 0.75);
    }
    this.log(len + 0.2, ox, ridge - LOG_R * 0.45, oz + (overPos - overNeg) / 2, true, LOG_R * 0.95);
    for (const side of [1, -1]) {
      const g = boxUV(new THREE.BoxGeometry(0.22, 0.03, len + 0.02), 1.5);
      this.m.makeRotationZ(-side * pitch).setPosition(ox + side * 0.1, ridge + (RAFTER_H + SHEET) / cosP + 0.015, zc);
      this.add('roof', g, this.m);
    }
  }

  // ── plank door on strap hinges, swings inward ──
  private door() {
    const { W } = this.spec;
    const dz = this.spec.doorZ, x = W / 2 - LOG_R;
    const H = 2.1, DW = 0.95;
    const fd = LOG * 1.15;
    const top = this.doorOpening().y1 + 0.01;
    this.box('beam', fd, top - FLOOR, 0.1, x, (top + FLOOR) / 2, dz - 0.5, 1.0);
    this.box('beam', fd, top - FLOOR, 0.1, x, (top + FLOOR) / 2, dz + 0.5, 1.0);
    this.box('beam', fd, top - (FLOOR + H + 0.04), 1.1, x, (top + FLOOR + H + 0.04) / 2, dz, 1.0);
    this.box('beam', fd + 0.06, 0.05, 1.1, x, FLOOR + 0.02, dz, 1.0);
    const leaf = new THREE.BoxGeometry(0.06, H, DW);
    {
      const uv = leaf.getAttribute('uv'), pos = leaf.getAttribute('position'), nor = leaf.getAttribute('normal');
      for (let i = 0; i < uv.count; i++) {
        if (Math.abs(nor.getX(i)) > 0.5) uv.setXY(i, 0.02 + (pos.getZ(i) / DW + 0.5) * 0.46, (pos.getY(i) / H + 0.5) * 1.05);
        else uv.setXY(i, 0.5 + pos.getY(i) * 0.5, 0.05 + pos.getZ(i) * 0.3);
      }
    }
    leaf.translate(0, H / 2, DW / 2);
    if (this.spec.door === 'fixed') {
      // shut for good: the leaf, its battens and strap hinges go into the merged mesh, one box keeps you out
      this.m.makeTranslation(x - 0.02, FLOOR + 0.02, dz - DW / 2);
      this.add('door', leaf, this.m);
      for (const by of [0.35, H / 2, H - 0.35]) this.add('beam', boxUV(new THREE.BoxGeometry(0.03, 0.12, DW - 0.1), 1).translate(-0.045, by, DW / 2), this.m);
      for (const hy of [0.32, H - 0.32]) this.add('iron', new THREE.BoxGeometry(0.015, 0.06, 0.42).translate(0.04, hy, 0.19), this.m);
      this.collider(x, dz, 0.08, DW / 2, 0, FLOOR + H);
      return;
    }
    const pivot = new THREE.Group();
    pivot.position.set(x - 0.02, FLOOR + 0.02, dz - DW / 2);
    const doorMesh = new THREE.Mesh(leaf, this.mats.door);
    doorMesh.castShadow = this.casters === null; doorMesh.receiveShadow = true;
    pivot.add(doorMesh);
    const iron: THREE.BufferGeometry[] = [];
    for (const hy of [0.32, H - 0.32]) {
      iron.push(new THREE.BoxGeometry(0.015, 0.06, 0.42).translate(0.04, hy, 0.19));
      iron.push(new THREE.CylinderGeometry(0.018, 0.018, 0.12, 8).translate(0.045, hy, -0.005));
    }
    iron.push(new THREE.TorusGeometry(0.045, 0.008, 6, 14).rotateY(Math.PI / 2).translate(0.045, 1.0, DW - 0.13));
    iron.push(new THREE.CylinderGeometry(0.012, 0.012, 0.09, 6).rotateZ(Math.PI / 2).translate(0.01, 1.0, DW - 0.13));
    const ironMesh = new THREE.Mesh(mergeGeometries(iron.map((g) => g.toNonIndexed())), this.mats.iron);
    ironMesh.castShadow = this.casters === null;
    pivot.add(ironMesh); this.detail.push(ironMesh);
    const battens: THREE.BufferGeometry[] = [];
    for (const by of [0.35, H / 2, H - 0.35]) battens.push(boxUV(new THREE.BoxGeometry(0.03, 0.12, DW - 0.1), 1).translate(-0.045, by, DW / 2));
    battens.push(boxUV(new THREE.BoxGeometry(0.03, 0.12, Math.hypot(H - 0.7, DW - 0.1) - 0.1), 1).rotateX(Math.atan2(H - 0.7, DW - 0.1)).translate(-0.045, H / 2, DW / 2));
    const battenMesh = new THREE.Mesh(mergeGeometries(battens.map((g) => g.toNonIndexed())), this.mats.beam);
    battenMesh.castShadow = this.casters === null;
    pivot.add(battenMesh); this.detail.push(battenMesh);
    this.root.add(pivot); this.far.push(doorMesh);
    if (this.casters !== null) {
      // desktop: the leaf, its strap hinges and its battens cast as ONE proxy in the pivot (it swings with the door) while
      // the detail LOD is on (3 → 1 shadow draw per cascade); past it the leaf casts alone again, as before (this.swap)
      const proxy = shadowProxy([doorMesh, ironMesh, battenMesh].map((m) => flatPositions(m.geometry)));
      if (proxy !== null) { pivot.add(proxy); this.detail.push(proxy); this.swap.push(doorMesh); }
      else doorMesh.castShadow = true;
    }

    const col = this.collider(x, dz, 0.08, DW / 2, 0, FLOOR + H);
    this.doorBox = col;
    const d: Door = {
      id: `cabin-${this.index + 1}-door`, pivot, open: false, t: 0, collider: col,
      // the leaf (±0.03) with its battens (−0.06) and strap hinges (+0.05), pivot frame: hinge edge at z 0, floor at y 0
      slab: { kind: 'box', x: 0, y: H / 2, z: DW / 2, hx: 0.06, hy: H / 2, hz: DW / 2, surface: 'wood' },
      interactable: { position: this.worldPos(x + 0.5, FLOOR + 1.0, dz), radius: 2.4, label: 'Open door', onInteract: () => { /* bound below, once `d` exists */ } },
    };
    d.interactable.onInteract = () => {
      this.owner._doorUse(d, () => {
        d.open = !d.open;
        d.interactable.label = d.open ? 'Close door' : 'Open door';
        col.yTop = d.open ? -1e4 : this.cy + FLOOR + H;
      });
    };
    this.owner._door(d);
  }

  // ── windows: frame, sill, mullions, glass ──
  private windowFrame(o: Opening, alongZ: boolean, at: number, glass: THREE.BufferGeometry[] | null) {
    const ww = o.a1 - o.a0, hh = o.y1 - o.y0, yc = (o.y0 + o.y1) / 2, ac = (o.a0 + o.a1) / 2;
    const rough = roughOpening(o, !alongZ);
    const sillH = o.y0 - rough.y0 + 0.01, headH = rough.y1 - o.y1 + 0.01;   // fill up to the log gaps
    const fd = LOG * 1.15, ft = FRAME;
    const g: THREE.BufferGeometry[] = [];
    const fb = (w: number, h: number, d: number, x: number, y: number, z: number) => g.push(boxUV(new THREE.BoxGeometry(w, h, d), 1, this.rng.next(), this.rng.next()).translate(x, y, z));
    fb(ww + ft * 2, headH, fd, 0, hh / 2 + headH / 2, 0);
    fb(ww + ft * 2, sillH, fd + 0.06, 0, -hh / 2 - sillH / 2, 0);   // sill, slightly proud
    fb(ft, hh + sillH + headH, fd, -ww / 2 - ft / 2, (headH - sillH) / 2, 0);
    fb(ft, hh + sillH + headH, fd, ww / 2 + ft / 2, (headH - sillH) / 2, 0);
    fb(0.04, hh, 0.04, 0, 0, 0);
    fb(ww, 0.04, 0.04, 0, 0, 0);
    const m = new THREE.Matrix4().makeRotationY(alongZ ? -Math.PI / 2 : 0).setPosition(alongZ ? at : ac, yc, alongZ ? ac : at);
    this.add('beam', mergeGeometries(g.map((x) => x.toNonIndexed())), m);
    if (glass === null) return;
    const pane = new THREE.PlaneGeometry(ww, hh).applyMatrix4(m);
    glass.push(this.frame ? pane.applyMatrix4(this.frameM) : pane);
  }
  private windows() {
    const { W, L } = this.spec;
    const glass: THREE.BufferGeometry[] = [];
    for (const w of this.spec.windows) {
      const alongZ = w.wall === 'front' || w.wall === 'back';
      const at = w.wall === 'front' ? W / 2 - LOG_R : w.wall === 'back' ? -(W / 2 - LOG_R) : w.wall === 'zpos' ? L / 2 - LOG_R : -(L / 2 - LOG_R);
      const o = this.windowOpening(w);
      this.windowFrame(o, alongZ, at, w.open ? null : glass);
      if (w.open && w.wall === 'front') this.counter(o);
    }
    this.glassMesh(glass);
  }
  /** the trader's serving hatch: a plank counter on brackets under it, a shingle awning over it on two raked struts */
  private counter(o: Opening) {
    const { W } = this.spec;
    const x0 = W / 2 - LOG_R, ww = o.a1 - o.a0 + 0.3, ac = (o.a0 + o.a1) / 2, cd = 0.55;
    this.box('deck', cd, 0.06, ww, x0 + cd / 2, o.y0 - 0.03, ac, 1.3);
    for (const z of [o.a0 + 0.05, o.a1 - 0.05]) {
      this.box('beam', cd - 0.1, 0.08, 0.06, x0 + (cd - 0.1) / 2, o.y0 - 0.1, z, 1);
      this.box('beam', 0.06, 0.4, 0.06, x0 + 0.08, o.y0 - 0.3, z, 1);
    }
    this.solid(x0 + cd / 2, ac, cd / 2, ww / 2, o.y0 - 0.4, o.y0, 0, 'wood');
    const ad = 1.1, lean = 0.42, ay = o.y1 + 0.18;
    const sheet = boxUV(new THREE.BoxGeometry(ad, SHEET, ww + 0.3), 1.5, this.rng.next(), 0);
    const pos = sheet.getAttribute('position'), moss = new Float32Array(pos.count);
    for (let i = 0; i < pos.count; i++) moss[i] = clamp01(0.3 + pos.getX(i) / ad);
    sheet.setAttribute('moss', new THREE.BufferAttribute(moss, 1));
    this.m.makeRotationZ(-lean).setPosition(x0 + ad / 2 * Math.cos(lean), ay - (ad / 2) * Math.sin(lean), ac);
    this.add('roof', sheet, this.m);
    for (const z of [o.a0 - 0.05, o.a1 + 0.05]) {
      const len = 0.8;
      this.m.makeRotationZ(0.75).setPosition(x0 + 0.28, ay - 0.42, z);
      this.add('beam', boxUV(new THREE.BoxGeometry(0.06, len, 0.06), 1), this.m);
    }
  }
  private glassMesh(glass: THREE.BufferGeometry[]) {
    if (glass.length > 0) this.glass.push(glass);
  }

  // ── stone chimney on a gable end, with a fireplace inside ──
  private chimney() {
    const { L } = this.spec;
    const side = this.spec.chimney === 'zpos' ? 1 : -1;
    const zWall = side * (L / 2);
    const cw = 1.1, cd = 0.75, cx = -0.6;
    const top = this.ridgeY + 0.7;
    const zc = zWall + side * (cd / 2 + 0.05);
    this.box('stone', cw, top + 0.6, cd, cx, (top - 0.6) / 2, zc, 2.0);
    this.box('stone', cw + 0.5, 1.9 + 0.6, cd + 0.35, cx, (1.9 - 0.6) / 2, zc, 2.0);   // wider shoulder
    this.box('stone', cw + 0.25, 0.12, cd + 0.25, cx, top + 0.06, zc, 2.0);           // cap
    this.box('iron', cw - 0.4, 0.05, cd - 0.3, cx, top + 0.13, zc, 1);                  // dark flue
    this.collider(cx, zc, (cw + 0.5) / 2, (cd + 0.35) / 2, 0, top);
    // fireplace breast inside
    const bz = zWall - side * 0.35;
    this.box('stone', 1.6, 1.5, 0.6, cx, PLINTH + 0.75, bz, 2.0);
    this.box('stone', 1.9, 0.08, 0.9, cx, FLOOR + 0.04, bz - side * 0.1, 2.0); // hearth slab
    this.solid(cx, bz - side * 0.1, 0.95, 0.45, PLINTH, FLOOR + 0.08, 0, 'stone');   // PHYSICS P3
    this.box('stone', 1.7, 0.1, 0.7, cx, PLINTH + 1.55, bz, 2.0);              // mantel
    this.box('iron', 0.8, 0.7, 0.32, cx, FLOOR + 0.4, bz - side * 0.15, 1);    // firebox
    for (let i = 0; i < 3; i++) this.box('char', 0.45, 0.08, 0.08, cx + this.rng.range(-0.15, 0.15), FLOOR + 0.12 + i * 0.05, bz - side * (0.42 + i * 0.03), 1, this.rng.range(-0.4, 0.4));
    const glow = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.6), this.mats.glow);
    glow.position.set(cx, FLOOR + 0.35, bz - side * 0.5); glow.rotation.y = side > 0 ? Math.PI : 0;
    this.root.add(glow); this.detail.push(glow);
    this.pointLight(this.root, 0xffa050, 14, 10, 2, cx, FLOOR + 0.6, bz - side * 0.7, this.index * 3.1, 'fire', 3);
    // room light so the windows glow at dusk
    this.pointLight(this.root, 0xffb070, 16, 11, 2, 0.2, FLOOR + 1.9, 0, this.index * 1.7 + 0.5, 'lamp', 2);
    this.collider(cx, bz, 0.8, 0.3, 0, PLINTH + 1.6);
  }

  // ── porch: decking, steps, posts, rails, lower-pitch roof breaking off the main roof ──
  private porch() {
    const { W, L, porchDepth: D } = this.spec;
    const x0 = W / 2 + 0.05;
    const cx = x0 + D / 2, len = L + 0.3;
    const deck = swapUV(boxUV(new THREE.BoxGeometry(D, 0.05, len), 1.3, this.rng.next(), this.rng.next()));
    this.m.makeTranslation(cx, FLOOR - 0.025, 0);
    this.add('deck', deck, this.m);
    this.box('beam', D, 0.16, 0.12, cx, FLOOR - 0.13, -len / 2 + 0.06, 1);
    this.box('beam', D, 0.16, 0.12, cx, FLOOR - 0.13, len / 2 - 0.06, 1);
    this.box('beam', 0.12, 0.16, len, x0 + D - 0.06, FLOOR - 0.13, 0, 1);
    for (const z of [-len / 2 + 0.3, 0, len / 2 - 0.3]) this.box('stone', 0.35, PLINTH + 0.5, 0.35, x0 + D - 0.25, (PLINTH - 0.5) / 2 - 0.05, z, 2);
    const wf = this.worldPos(cx, FLOOR, 0);
    this.deck({ x: wf.x, z: wf.z, rot: this.rot, hw: D / 2, hd: len / 2, y: wf.y });
    // PHYSICS P3: the deck as a block down into the pad, from the wall line (closing the 5 cm to the floor's edge) out
    this.solid((W / 2 + x0 + D) / 2, 0, (x0 + D - W / 2) / 2, len / 2, -0.4, FLOOR, 0, 'wood');
    // step in front of the door
    const dz = this.spec.doorZ, sw = 1.4;
    this.box('deck', 0.36, 0.05, sw, x0 + D + 0.18, FLOOR - 0.12, dz, 1.3);
    this.box('beam', 0.36, 0.07, sw, x0 + D + 0.18, FLOOR - 0.18, dz, 1.0);
    this.box('stone', 0.5, 0.1, sw + 0.2, x0 + D + 0.55, 0.05, dz, 2);
    // PHYSICS P3: the step (a 0.36 m tread, 0.1 m below the deck) and its stone (0.1 m): rises 0.1 / 0.03 / 0.1
    this.solid(x0 + D + 0.18, dz, 0.18, sw / 2, -0.4, FLOOR - 0.095, 0, 'wood');
    this.solid(x0 + D + 0.55, dz, 0.25, sw / 2 + 0.1, -0.4, 0.1, 0, 'stone');
    // porch roof: breaks off the main roof just past the wall at a lower pitch
    const q = 0.26, tanQ = Math.tan(q), cosQ = Math.cos(q);
    const xb = W / 2 + 0.12, cosP = Math.cos(this.spec.pitch);
    const yTopB = this.ridgeY - xb * this.tanP + (RAFTER_H + SHEET) / cosP - 0.01;  // main sheet top at the break
    const postX = x0 + D - 0.12, xe = x0 + D + 0.3;
    const run = xe - xb, slope = run / cosQ;
    const under = (x: number) => yTopB - (x - xb) * tanQ - (SHEET + RAFTER_H) / cosQ;  // rafter underside line
    const sheet = swapUV(boxUV(new THREE.BoxGeometry(slope, SHEET, len + 0.2), 1.5, 0, this.rng.next()));
    this.m.makeRotationZ(-q).setPosition(xb + run / 2, yTopB - (run / 2) * tanQ - (SHEET / 2) / cosQ, 0);
    this.add('roof', sheet, this.m);
    const nr = Math.max(2, Math.round(len / 0.8));
    for (let i = 0; i <= nr; i++) {
      const z = -len / 2 + 0.07 + (len - 0.14) * (i / nr);
      const rg = boxUV(new THREE.BoxGeometry(slope - 0.05, RAFTER_H * 0.85, 0.08), 1, this.rng.next());
      this.m.makeRotationZ(-q).setPosition(xb + run / 2, yTopB - (run / 2) * tanQ - (SHEET + RAFTER_H * 0.425) / cosQ, z);
      this.add('beam', rg, this.m);
    }
    const headerBottom = under(postX) - 0.02;
    this.box('beam', 0.14, 0.18, len, postX, headerBottom - 0.09, 0, 1);
    const postH = headerBottom - 0.18 - FLOOR;
    const posts = [-len / 2 + 0.12, len / 2 - 0.12];
    for (const p of [dz - sw / 2 - 0.25, dz + sw / 2 + 0.25]) if (Math.abs(p) < len / 2 - 0.7) posts.push(p);
    posts.sort((a, b) => a - b);
    for (const z of posts) {
      this.box('beam', 0.14, postH, 0.14, postX, FLOOR + postH / 2, z, 1);
      this.collider(postX, z, 0.08, 0.08, 0, FLOOR + postH);
    }
    // railing between posts, open in front of the step
    const railY = FLOOR + 0.95;
    for (let i = 0; i < posts.length - 1; i++) {
      const a = posts[i], b = posts[i + 1];
      if (a === undefined || b === undefined) continue;
      if (dz > a && dz < b) continue;
      const mid = (a + b) / 2, l = b - a - 0.14;
      this.box('beam', 0.09, 0.07, l, postX, railY, mid, 1);
      this.box('beam', 0.07, 0.06, l, postX, FLOOR + 0.12, mid, 1);
      const n = Math.max(1, Math.floor(l / 0.32));
      for (let k = 1; k < n; k++) this.box('beam', 0.045, railY - FLOOR - 0.16, 0.045, postX, FLOOR + 0.15 + (railY - FLOOR - 0.16) / 2, a + 0.07 + (l * k) / n, 1);
      this.collider(postX, mid, 0.06, l / 2, 0, railY + 0.1);
    }
    for (const s of [-1, 1]) {
      const z = s * (len / 2 - 0.05), rl = D - 0.4;
      this.box('beam', rl, 0.07, 0.09, x0 + rl / 2, railY, z, 1);
      const n = Math.floor(rl / 0.32);
      for (let k = 1; k < n; k++) this.box('beam', 0.045, railY - FLOOR - 0.16, 0.045, x0 + (rl * k) / n, FLOOR + 0.15 + (railY - FLOOR - 0.16) / 2, z, 1);
      this.collider(x0 + rl / 2, z, rl / 2, 0.06, 0, railY + 0.1);
    }
  }

  // ── interior: bed, table, chairs, shelf, a few props ──
  private interior() {
    const { W, L } = this.spec;
    const chimSide = this.spec.chimney === 'zpos' ? 1 : -1;
    const bx = -(W / 2) + LOG_R + 0.55;
    const bedZ = -chimSide * (L / 2 - LOG_R - 1.15);            // bed at the end away from the fireplace
    this.box('beam', 0.95, 0.12, 2.05, bx, FLOOR + 0.36, bedZ, 1);
    for (const [dx, dz] of [[-0.42, -0.97], [0.42, -0.97], [-0.42, 0.97], [0.42, 0.97]] as const) this.box('beam', 0.08, 0.36, 0.08, bx + dx, FLOOR + 0.18, bedZ + dz, 1);
    this.box('beam', 0.06, 0.55, 1.0, bx - 0.47, FLOOR + 0.55, bedZ, 1);
    this.cloth(0.88, 0.16, 1.95, bx, FLOOR + 0.5, bedZ, 0xd9cdb4);
    this.cloth(0.9, 0.08, 1.3, bx, FLOOR + 0.62, bedZ + 0.3 * chimSide, 0x6a3b2e);
    this.cloth(0.5, 0.1, 0.35, bx, FLOOR + 0.63, bedZ - 0.75 * chimSide, 0xe8e0cc);
    this.collider(bx, bedZ, 0.5, 1.05, 0, FLOOR + 0.7);
    const tx = 0.4, tz = -chimSide * 0.4;
    this.box('beam', 1.25, 0.05, 0.8, tx, FLOOR + 0.75, tz, 1);
    for (const [dx, dz] of [[-0.55, -0.32], [0.55, -0.32], [-0.55, 0.32], [0.55, 0.32]] as const) this.box('beam', 0.07, 0.73, 0.07, tx + dx, FLOOR + 0.365, tz + dz, 1);
    this.collider(tx, tz, 0.62, 0.4, 0, FLOOR + 0.8);
    for (const s of [-1, 1]) this.chair(tx + this.rng.range(-0.15, 0.15), tz + s * 0.75, (s > 0 ? Math.PI : 0) + this.rng.range(-0.3, 0.3));
    const sz = -chimSide * (L / 2 - LOG_R - 0.16), sx = W / 2 - 1.5;
    for (const y of [1.3, 1.75]) {
      this.box('beam', 1.4, 0.035, 0.28, sx, FLOOR + y, sz, 1);
      for (const dx of [-0.6, 0.6]) this.box('beam', 0.05, 0.16, 0.24, sx + dx, FLOOR + y - 0.1, sz, 1);
    }
    this.solid(sx, sz, 0.7, 0.14, FLOOR + 1.12, FLOOR + 1.77, 0, 'wood');   // PHYSICS P3: both shelves + brackets
    this.placeProp('bucket', sx + 0.3, FLOOR + 1.335, sz, this.rng.range(0, 6), 0.75);
    this.placeProp('crate', -W / 2 + 0.9, FLOOR, chimSide * (L / 2 - 1.9), Math.PI / 2 + this.rng.range(-0.2, 0.2), 0.9);
    this.placeProp('barrel', W / 2 - 0.7, FLOOR, sz + chimSide * 0.6, this.rng.range(0, 6), 0.85);
  }
  private chair(x: number, z: number, yaw: number) {
    const g: THREE.BufferGeometry[] = [];
    const b = (w: number, h: number, d: number, px: number, py: number, pz: number) => g.push(boxUV(new THREE.BoxGeometry(w, h, d), 1, this.rng.next(), this.rng.next()).translate(px, py, pz));
    b(0.42, 0.04, 0.42, 0, 0.45, 0);
    for (const [dx, dz] of [[-0.18, -0.18], [0.18, -0.18], [-0.18, 0.18], [0.18, 0.18]] as const) b(0.04, 0.45, 0.04, dx, 0.225, dz);
    for (const dx of [-0.18, 0.18]) b(0.04, 0.45, 0.04, dx, 0.68, -0.19);
    b(0.42, 0.14, 0.03, 0, 0.8, -0.19);
    this.m.makeRotationY(yaw).setPosition(x, FLOOR, z);
    this.add('beam', mergeGeometries(g.map((gg) => gg.toNonIndexed())), this.m);
    this.solid(x, z, 0.21, 0.21, FLOOR, FLOOR + 0.87, yaw, 'wood');   // PHYSICS P3: seat, legs and back
  }
  /** a drying animal hide folded over a rope line: irregular outline, two flaps either side of the rope */
  private hide(x: number, y: number, z: number, yaw: number) {
    const outline = new THREE.Shape();
    const n = 18;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const r = 0.42 * (1 + 0.18 * Math.sin(a * 2 + 0.5) + 0.12 * Math.sin(a * 5 + 1.3) + this.rng.range(-0.05, 0.05));
      const px = Math.cos(a) * r * 1.15, py = Math.sin(a) * r;
      if (i > 0) outline.lineTo(px, py); else outline.moveTo(px, py);
    }
    outline.closePath();
    for (const sgn of [-1, 1]) {
      const g = new THREE.ExtrudeGeometry(outline, { depth: 0.015, bevelEnabled: false }).toNonIndexed();
      g.translate(0, -0.44, 0);                                   // hang from the rope
      const pos = g.getAttribute('position');
      // E341: a tanned-hide brown. It was 0x120b06, near black once linear (≈ 0.006), so by the fire it read as a black hole
      const c = new THREE.Color(0x5e412a), col = new Float32Array(pos.count * 3);
      for (let i = 0; i < pos.count; i++) { const f = 0.75 + 0.35 * Math.abs(Math.sin(pos.getX(i) * 9 + pos.getY(i) * 7)); col[i * 3] = c.r * f; col[i * 3 + 1] = c.g * f; col[i * 3 + 2] = c.b * f; }
      g.setAttribute('color', new THREE.BufferAttribute(col, 3));
      this.m.makeRotationFromEuler(new THREE.Euler(sgn * 0.1, yaw, 0, 'YXZ')).setPosition(x, y, z);
      g.translate(0, 0, sgn > 0 ? 0.01 : -0.025);
      this.add('cloth', g, this.m);
    }
  }
  private cloth(w: number, h: number, d: number, x: number, y: number, z: number, color: number, yaw = 0, lean = 0) {
    const g = new THREE.BoxGeometry(w, h, d).toNonIndexed();
    const c = new THREE.Color(color), col = new Float32Array(g.getAttribute('position').count * 3);
    for (let i = 0; i < col.length; i += 3) { col[i] = c.r * this.rng.range(0.85, 1.05); col[i + 1] = c.g * this.rng.range(0.85, 1.05); col[i + 2] = c.b; }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    if (lean) g.translate(0, -h / 2, lean > 0 ? d : -d);
    this.m.makeRotationFromEuler(new THREE.Euler(lean, yaw, 0, 'YXZ')).setPosition(x, lean ? y + h / 2 : y, z);
    this.add('cloth', g, this.m);
  }

  // ── woodpile (logs along local X of the pile frame, stacked along its Z) + chopping block with a hatchet ──
  private woodpile(px: number, pz: number, yaw: number, rows: number, width: number, block: { x: number; z: number }) {
    const base = new THREE.Matrix4().makeRotationY(yaw).setPosition(px, 0, pz);
    const r0 = 0.085, len = 0.5;
    for (let row = 0; row < rows; row++) {
      const n = Math.max(1, Math.floor(width / (r0 * 2.1)) - row);
      for (let i = 0; i < n; i++) {
        const r = r0 * this.rng.range(0.8, 1.15);
        const along = -width / 2 + r0 * 1.05 + row * r0 * 1.05 + i * r0 * 2.1 + this.rng.range(-0.01, 0.01);
        const { side, caps } = logGeo(len * this.rng.range(0.9, 1.05), r, 0, this.rng.next(), 10, true);
        const m = new THREE.Matrix4().makeRotationY(this.rng.range(-0.08, 0.08)).setPosition(this.rng.range(-0.03, 0.03), r0 + row * r0 * 1.8, along).premultiply(base);
        this.add('bark', side, m);
        this.add('endGrain', caps, m);
      }
    }
    this.collider(px, pz, 0.3, width / 2, 0, rows * r0 * 1.8, yaw);
    const { side, caps } = logGeo(0.55, 0.19, 0, 0, 14, true);
    const m = new THREE.Matrix4().makeRotationZ(Math.PI / 2).setPosition(block.x, 0.275, block.z);
    this.add('bark', side, m); this.add('endGrain', caps, m);
    this.placeProp('hatchet', block.x + 0.02, 0.6, block.z, this.rng.range(0, 6), 1.15);
    this.collider(block.x, block.z, 0.2, 0.2, 0, 0.55);
    // split firewood scattered around the block
    for (let i = 0; i < 9; i++) {
      const a = this.rng.range(0, Math.PI * 2), d = this.rng.range(0.35, 1.2);
      const r = this.rng.range(0.06, 0.09), l = this.rng.range(0.32, 0.45);
      const wedge = new THREE.CylinderGeometry(r, r, l, 7, 1, false, 0, Math.PI);
      const uv = wedge.getAttribute('uv'), pos = wedge.getAttribute('position');
      for (let k = 0; k < uv.count; k++) uv.setXY(k, pos.getX(k) * 0.5 + this.rng.next(), pos.getY(k) * 0.5);
      this.m.makeRotationFromEuler(new THREE.Euler(this.rng.range(-0.1, 0.1), this.rng.range(0, 6.3), Math.PI / 2 + this.rng.range(-0.15, 0.15), 'YXZ')).setPosition(block.x + Math.cos(a) * d, r * 0.5, block.z + Math.sin(a) * d);
      this.add('bark', wedge, this.m);
    }
  }

  // ── L-shaped annex on the gable end: shares the back wall line, own front + far gable walls, lower roof ──
  private annex(ox: number, oz: number, side: number, a: NonNullable<CabinSpec['annex']>) {
    const hza = a.L / 2 - LOG_R;
    this.foundation(a.W - 0.04, a.L, ox, oz);
    this.floorPlanks(a.W, a.L, ox, oz);
    const wallTop = PLINTH + a.rows * LOG;
    const win: Opening = { a0: -0.45, a1: 0.45, y0: FLOOR + 1.1, y1: FLOOR + 1.9 };
    const farWall: WallId = side > 0 ? 'zpos' : 'zneg', nearWall: WallId = side > 0 ? 'zneg' : 'zpos';
    this.logBox(a.W, a.L, ox, oz, a.rows, a.pitch, {
      gables: { zpos: side > 0, zneg: side < 0 },
      skip: [nearWall, 'back'],
      ext: { front: side > 0 ? { from: -hza - LOG_R + 0.05, overhangFrom: false } : { to: hza + LOG_R - 0.05, overhangTo: false } },
      openings: { [farWall]: [roughOpening(win, true)] },
    });
    this.roof(a.W, a.L, ox, oz, a.pitch, wallTop, 0.45, 0.45, side > 0 ? 0.45 : -0.15, side > 0 ? -0.15 : 0.45);
    const glass: THREE.BufferGeometry[] = [];
    this.windowFrame({ ...win, a0: win.a0 + ox, a1: win.a1 + ox }, false, oz + side * hza, glass);
    this.glassMesh(glass);
    // doorway frame through the shared gable wall
    const zW = side * (this.spec.L / 2 - LOG_R);
    this.box('beam', 0.1, 2.0, 0.34, ox - 0.5, FLOOR + 1.0, zW, 1);
    this.box('beam', 0.1, 2.0, 0.34, ox + 0.5, FLOOR + 1.0, zW, 1);
    this.box('beam', 1.1, 0.12, 0.34, ox, FLOOR + 2.06, zW, 1);
    // a second bed + shelf in the annex
    const bz = oz + side * (hza - 1.15), bxa = ox - a.W / 2 + LOG_R + 0.55;
    this.box('beam', 0.95, 0.12, 2.05, bxa, FLOOR + 0.36, bz, 1, Math.PI / 2);
    this.cloth(0.88, 0.16, 1.95, bxa, FLOOR + 0.5, bz, 0xcfc4a8);
    this.cloth(0.9, 0.08, 1.2, bxa, FLOOR + 0.62, bz - side * 0.3, 0x3f4a3a);
    this.collider(bxa, bz, 0.5, 1.05, 0, FLOOR + 0.7);
    this.placeProp('crate', ox + a.W / 2 - 0.7, FLOOR, oz - side * 0.2, this.rng.range(0, 6), 0.9);
    this.placeProp('crate', ox + a.W / 2 - 0.7, FLOOR + 0.43, oz - side * 0.25, this.rng.range(0, 6), 0.8);
  }

  // ── lean-to wood shed on the gable end ──
  private leanTo(side: number) {
    const { W, L } = this.spec;
    const z0 = side * (L / 2 + 0.05), depth = 2.2, width = W - 0.6;
    const hiY = this.wallTop - 0.05, loY = hiY - depth * 0.42;
    const zc = z0 + side * depth / 2;
    for (const x of [-width / 2 + 0.1, width / 2 - 0.1]) {
      this.box('beam', 0.14, loY, 0.14, x, loY / 2, z0 + side * (depth - 0.1), 1);
      this.collider(x, z0 + side * (depth - 0.1), 0.08, 0.08, 0, loY);
    }
    this.box('beam', width, 0.16, 0.14, 0, loY + 0.08, z0 + side * (depth - 0.1), 1);
    this.box('beam', width, 0.16, 0.14, 0, hiY + 0.08, z0 + side * 0.1, 1);
    const pitch = Math.atan2(hiY - loY, depth - 0.2) * side, slope = Math.hypot(hiY - loY, depth);
    for (let i = 0; i <= 4; i++) {
      const x = -width / 2 + 0.07 + (width - 0.14) * (i / 4);
      const rg = boxUV(new THREE.BoxGeometry(0.08, 0.12, slope), 1, this.rng.next());
      this.m.makeRotationX(pitch).setPosition(x, (hiY + loY) / 2 + 0.22, zc);
      this.add('beam', rg, this.m);
    }
    const sheet = boxUV(new THREE.BoxGeometry(width + 0.3, SHEET, slope + 0.2), 1.5);
    this.m.makeRotationX(pitch).setPosition(0, (hiY + loY) / 2 + 0.3, zc);
    this.add('roof', sheet, this.m);
    this.woodpile(0, z0 + side * 0.55, Math.PI / 2, 5, width - 0.8, { x: width / 2 + 0.6, z: z0 + side * 1.3 });
  }

  // ── camp fire out front ──
  private firePit(model: THREE.Object3D) {
    const { W, porchDepth } = this.spec;
    const fx = W / 2 + porchDepth + 3.4, fz = -1.2;
    const pit = model.clone(true);
    pit.traverse((mesh) => {
      if (isMesh(mesh)) { mesh.castShadow = true; mesh.receiveShadow = true; this.sky.setupMaterial(mesh.material as THREE.Material); }
    });
    pit.position.set(fx, 0.19 - 0.06, fz);
    pit.rotation.y = this.rng.range(0, 6);
    this.root.add(pit); this.detail.push(pit);
    this.firePitObj = pit;
    const casters = this.casters;
    if (casters !== null) {
      // desktop: its depth goes into the building's double-sided near proxy (its weld's), in the root's frame
      pit.updateMatrixWorld(true);
      const toRoot = this.root.matrixWorld.clone().invert(), m = new THREE.Matrix4();
      pit.traverse((mesh) => {
        if (!isMesh(mesh)) return;
        mesh.castShadow = false;
        casters.push(twoSidedPositions(mesh.geometry, m.multiplyMatrices(toRoot, mesh.matrixWorld)));
      });
    }
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2 + 0.3;
      const g = boxUV(new THREE.CylinderGeometry(0.05, 0.065, 0.75, 7), 1);
      this.m.makeRotationFromEuler(new THREE.Euler(0, a, 1.15, 'YXZ')).setPosition(fx - Math.cos(a) * 0.1, 0.33, fz + Math.sin(a) * 0.1);
      this.add('char', g, this.m);
    }
    const glow = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.5).rotateX(-Math.PI / 2), this.mats.glow);
    glow.position.set(fx, 0.14, fz);
    this.root.add(glow); this.detail.push(glow);
    const flames = makeParticles(this.mats.flame, 44, this.rng); flames.position.set(fx, 0.16, fz); flames.renderOrder = 5;
    const embers = makeParticles(this.mats.ember, 64, this.rng); embers.position.set(fx, 0.35, fz); embers.renderOrder = 6;
    // ring of stones around the pit
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2 + this.rng.range(-0.1, 0.1), rr = 0.92 + this.rng.range(-0.06, 0.08);
      const r = this.rng.range(0.11, 0.18);
      const g = boxUV(new THREE.DodecahedronGeometry(r, 0), 1.5, this.rng.next(), this.rng.next());
      g.scale(1, this.rng.range(0.55, 0.85), this.rng.range(0.8, 1.3));
      this.m.makeRotationFromEuler(new THREE.Euler(this.rng.range(0, 0.3), a, this.rng.range(0, 0.3))).setPosition(fx + Math.cos(a) * rr, r * 0.4, fz + Math.sin(a) * rr);
      this.add('stone', g, this.m);
    }
    // iron tripod with a hanging cooking pot
    const apexY = 1.75;
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2 + 0.4, foot = 0.8;
      const legLen = Math.hypot(foot, apexY), tilt = Math.atan2(foot, apexY);
      const leg = new THREE.CylinderGeometry(0.014, 0.02, legLen, 6);
      this.m.makeRotationFromEuler(new THREE.Euler(0, -a, tilt, 'YXZ')).setPosition(fx + Math.cos(a) * foot / 2, apexY / 2, fz + Math.sin(a) * foot / 2);
      this.add('iron', leg, this.m);
    }
    this.box('iron', 0.09, 0.05, 0.09, fx, apexY + 0.01, fz, 1);                           // apex ring
    const potY = 1.12;
    this.m.makeTranslation(fx, (apexY + potY + 0.2) / 2, fz);
    this.add('iron', new THREE.CylinderGeometry(0.007, 0.007, apexY - potY - 0.2, 5), this.m);   // chain
    const pot = new THREE.CylinderGeometry(0.2, 0.17, 0.24, 14, 1, true);
    this.m.makeTranslation(fx, potY, fz); this.add('iron', pot, this.m);
    this.add('iron', new THREE.CircleGeometry(0.17, 14).rotateX(Math.PI / 2).translate(fx, potY - 0.12, fz));
    this.add('iron', new THREE.TorusGeometry(0.19, 0.008, 5, 16).rotateX(Math.PI / 2).translate(fx, potY + 0.12, fz));
    this.add('iron', new THREE.TorusGeometry(0.2, 0.008, 5, 16, Math.PI).rotateZ(0).translate(fx, potY + 0.12, fz));   // bail handle
    this.add('char', new THREE.CircleGeometry(0.15, 12).rotateX(-Math.PI / 2).translate(fx, potY + 0.06, fz));           // stew surface
    this.root.add(flames, embers); this.detail.push(flames, embers);
    this.owner._particles(this.mats.flame); this.owner._particles(this.mats.ember);
    this.pointLight(this.root, 0xff9a3c, 28, 22, 2, fx, 0.9, fz, 7.7, 'fire', 0);
    this.collider(fx, fz, 0.7, 0.7, 0, 0.6);
    const wp = this.worldPos(fx, 0.2, fz);
    this.owner._firePit({ x: wp.x, y: wp.y, z: wp.z });
    for (const [bx, bz, yaw] of [[fx - 1.9, fz + 0.2, 0.1], [fx + 0.6, fz + 1.9, Math.PI / 2 + 0.2], [fx + 1.0, fz - 1.9, -Math.PI / 2 - 0.1]] as const) {
      const { side, caps } = logGeo(1.8, 0.2, 0, 0, 12, true);
      const m = new THREE.Matrix4().makeRotationY(yaw + Math.PI / 2).setPosition(bx, 0.18, bz);
      this.add('bark', side, m); this.add('endGrain', caps, m);
      this.box('deck', 0.36, 0.05, 1.7, bx, 0.38, bz, 1.3, yaw);
      this.collider(bx, bz, 0.2, 0.9, 0, 0.45, yaw);
    }
  }

  // ── hanging lantern on the porch ──
  private lantern(model: THREE.Object3D) {
    const x = this.spec.W / 2 + 0.3, z = this.spec.doorZ + 0.78;   // bracket arm out from the wall beside the door
    const hangY = FLOOR + 2.05;
    this.box('iron', 0.42, 0.025, 0.025, x - 0.16, hangY + 0.03, z, 1);
    this.box('iron', 0.025, 0.2, 0.025, this.spec.W / 2 - LOG_R + 0.05, hangY - 0.07, z, 1);
    const lan = model.clone(true);
    lan.traverse((mesh) => {
      if (!isMesh(mesh)) return;
      mesh.castShadow = true;
      // rebuild the materials as plain MeshStandardMaterials (the glTF's physical brass + tangents
      // produced NaN fragments that bloom smeared over the whole frame)
      mesh.geometry = mesh.geometry.clone();
      mesh.geometry.deleteAttribute('tangent');
      const mat = mesh.material as THREE.MeshPhysicalMaterial;
      if (mat.transparent || /glass/i.test(mat.name)) {
        const glassMat = new THREE.MeshStandardMaterial({ color: 0xffd9a0, emissive: new THREE.Color(1.0, 0.72, 0.4), emissiveIntensity: 3.0, roughness: 0.2, metalness: 0, transparent: true, opacity: 0.85 });
        mesh.material = glassMat;
        this.sky.setupMaterial(glassMat); // lit like everything else: one shared program instead of its own non-CSM one
        this.owner._lamp(glassMat, 3.0);
        mesh.castShadow = false;
      } else {
        mesh.material = new THREE.MeshStandardMaterial({ map: mat.map, normalMap: mat.normalMap, roughnessMap: mat.roughnessMap, metalnessMap: mat.metalnessMap, aoMap: mat.aoMap, metalness: 0.9, roughness: 1, color: 0xd8b070 });
        this.sky.setupMaterial(mesh.material);
      }
    });
    const pivot = new THREE.Group();
    pivot.position.set(x, hangY + 0.02, z);
    lan.position.set(0, -0.46, 0);
    lan.scale.setScalar(1.35);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.022, 0.005, 6, 12), this.mats.iron);
    ring.position.y = -0.03;
    pivot.add(lan, ring);
    this.pointLight(pivot, 0xffb060, 9, 11, 2, 0, -0.3, 0, 2.2 + this.index, 'lamp', 1);
    this.root.add(pivot);
    this.detail.push(lan, ring); // never the pivot: its light must stay visible (a changing light count recompiles every shader)
    this.lanternObj = lan;
    this.owner._swing({ pivot, seed: this.index * 2.3 });
  }

  // ── stone rubble and mossy stones along the foundation ──
  private rubble() {
    const { W, L } = this.spec;
    const n = Math.round((W + L) * 2.2);
    for (let i = 0; i < n; i++) {
      const side = this.rng.int(0, 3);
      const t = this.rng.range(-0.5, 0.5);
      let x: number, z: number;
      if (side === 0) { x = W / 2 + 0.25 + this.rng.range(0, 0.5); z = t * L; }
      else if (side === 1) { x = -(W / 2) - 0.25 - this.rng.range(0, 0.5); z = t * L; }
      else if (side === 2) { z = L / 2 + 0.25 + this.rng.range(0, 0.5); x = t * W; }
      else { z = -(L / 2) - 0.25 - this.rng.range(0, 0.5); x = t * W; }
      if (side === 0 && Math.abs(z) < L / 2 + 0.3) continue;                    // porch side
      const r = this.rng.range(0.07, 0.2);
      const g = boxUV(new THREE.DodecahedronGeometry(r, 0), 1.5, this.rng.next(), this.rng.next());
      g.scale(1, this.rng.range(0.5, 0.8), this.rng.range(0.8, 1.3));
      this.m.makeRotationFromEuler(new THREE.Euler(this.rng.range(0, 0.4), this.rng.range(0, 6.3), this.rng.range(0, 0.4))).setPosition(x, r * 0.35, z);
      this.add('stone', g, this.m);
    }
  }

  // ── crates, barrels, bucket, outdoor table/bench ──
  private outdoorProps() {
    const { L, porchDepth: D } = this.spec;
    const x0 = this.spec.W / 2 + 0.05, dz = this.spec.doorZ;
    const far = dz > 0 ? -1 : 1;
    if (D === 0) {
      // no porch: a barrel at the front corner, a crate beside it, the rain barrel under the back eave
      this.placeProp('barrel', x0 + 0.45, 0, far * (L / 2 - 0.4), this.rng.range(0, 6));
      this.placeProp('crate', x0 + 0.4, 0, far * (L / 2 - 1.3), Math.PI / 2 + this.rng.range(-0.15, 0.15), 0.9);
      if (!this.spec.wing) this.placeProp('barrel', -(this.spec.W / 2) - 0.5, 0, -far * (L / 2 - 0.4), this.rng.range(0, 6));
      return;
    }
    this.placeProp('barrel', x0 + 0.5, FLOOR, far * (L / 2 - 0.6), this.rng.range(0, 6));
    this.placeProp('crate', x0 + 0.55, FLOOR, far * (L / 2 - 1.5), Math.PI / 2 + this.rng.range(-0.15, 0.15));
    this.placeProp('bucket', x0 + D - 0.45, FLOOR, far * (L / 2 - 0.5) * 0.9, this.rng.range(0, 6));
    this.placeProp('crate', x0 + D + 0.9, 0, dz + far * -1.4, this.rng.range(0, 6), 0.85);          // crate by the steps
    this.placeProp('barrel', -(this.spec.W / 2) - 0.5, 0, -far * (L / 2 - 0.4), this.rng.range(0, 6));  // rain barrel under the back eave
    if (this.spec.firePit) {
      // rope line with a drying hide between two posts
      const px = x0 + D + 1.4, pz = far * (L / 2 + 1.2), yaw = 0.3;
      const dx = Math.cos(yaw) * 1.5, dzz = -Math.sin(yaw) * 1.5;
      for (const sgn of [-1, 1]) { this.box('beam', 0.09, 1.9, 0.09, px + sgn * dx, 0.95, pz + sgn * dzz, 1); this.collider(px + sgn * dx, pz + sgn * dzz, 0.06, 0.06, 0, 1.9); }
      const rope = new THREE.CylinderGeometry(0.008, 0.008, 3.0, 5).rotateZ(Math.PI / 2);
      this.m.makeRotationY(yaw).setPosition(px, 1.78, pz); this.add('bark', rope, this.m);
      this.hide(px + 0.2 * Math.cos(yaw), 1.78, pz - 0.2 * Math.sin(yaw), yaw);
      this.collider(px, pz, 0.5, 0.05, 0, 1.8, yaw);
    }
    if (this.spec.bench === 'table') {
      const tx = x0 + D + 2.2, tz = -far * (L / 2 - 0.5);
      this.box('deck', 1.6, 0.06, 0.8, tx, 0.76, tz, 1.3);
      for (const [dx, dz2] of [[-0.65, -0.3], [0.65, -0.3], [-0.65, 0.3], [0.65, 0.3]] as const) this.box('beam', 0.09, 0.74, 0.09, tx + dx, 0.37, tz + dz2, 1);
      this.collider(tx, tz, 0.8, 0.4, 0, 0.8);
      for (const s of [-1, 1]) {
        this.box('deck', 1.5, 0.05, 0.28, tx, 0.45, tz + s * 0.7, 1.3);
        for (const dx of [-0.6, 0.6]) this.box('beam', 0.08, 0.43, 0.08, tx + dx, 0.215, tz + s * 0.7, 1);
        this.collider(tx, tz + s * 0.7, 0.75, 0.14, 0, 0.5);
      }
      this.placeProp('bucket', tx + 0.5, 0.79, tz - 0.15, this.rng.range(0, 6), 0.8);
    }
  }

  // ── the hamlet's other interiors (PH-B3): the lodge's hall, a store of crates, the mill's stones ──
  private furnish(kind: 'hall' | 'store' | 'mill') {
    const { W, L } = this.spec;
    const chimSide = this.spec.chimney === 'zpos' ? 1 : -1;
    const inX = W / 2 - LOG_R - 0.12, inZ = L / 2 - LOG_R - 0.12;   // the walls' inside faces, a hand's width off
    if (kind === 'hall') {
      // a long trestle table down the hall with a bench each side, a sideboard + shelves on the back wall, hides hung up
      const tl = Math.min(L - 4.4, 5.6), tx = -0.35, tz = -chimSide * 0.7;
      this.box('beam', 0.95, 0.07, tl, tx, FLOOR + 0.76, tz, 1);
      for (const dz of [-tl / 2 + 0.45, tl / 2 - 0.45]) {
        this.box('beam', 0.72, 0.7, 0.08, tx, FLOOR + 0.37, tz + dz, 1);
        this.box('beam', 0.85, 0.08, 0.14, tx, FLOOR + 0.04, tz + dz, 1);
      }
      this.box('beam', 0.1, 0.1, tl - 1.0, tx, FLOOR + 0.3, tz, 1);
      this.collider(tx, tz, 0.5, tl / 2, 0, FLOOR + 0.8);
      for (const s of [-1, 1]) {
        const bx = tx + s * 0.78;
        this.box('deck', 0.3, 0.05, tl - 0.4, bx, FLOOR + 0.45, tz, 1.3);
        for (const dz of [-tl / 2 + 0.6, 0, tl / 2 - 0.6]) this.box('beam', 0.24, 0.43, 0.07, bx, FLOOR + 0.215, tz + dz, 1);
        this.collider(bx, tz, 0.16, (tl - 0.4) / 2, 0, FLOOR + 0.48);
      }
      const sz = chimSide * (inZ - 1.6);
      this.box('beam', 0.5, 0.9, 2.2, -inX + 0.25, FLOOR + 0.45, sz, 1);
      this.box('deck', 0.56, 0.05, 2.3, -inX + 0.28, FLOOR + 0.92, sz, 1.3);
      this.solid(-inX + 0.28, sz, 0.28, 1.15, FLOOR, FLOOR + 0.95, 0, 'wood');
      for (const y of [1.45, 1.9]) this.box('beam', 0.3, 0.035, 2.0, -inX + 0.15, FLOOR + y, -sz, 1);
      this.solid(-inX + 0.15, -sz, 0.15, 1.0, FLOOR + 1.3, FLOOR + 1.95, 0, 'wood');
      this.placeProp('bucket', -inX + 0.3, FLOOR + 0.945, sz + 0.6, this.rng.range(0, 6), 0.8);
      this.placeProp('bucket', -inX + 0.15, FLOOR + 1.47, -sz - 0.5, this.rng.range(0, 6), 0.7);
      for (const z of [-sz + 0.6, -sz - 0.6]) this.hide(-inX + 0.06, FLOOR + 2.35, z, Math.PI / 2);
      this.placeProp('barrel', inX - 0.45, FLOOR, -chimSide * (inZ - 0.45), this.rng.range(0, 6));
      this.placeProp('barrel', inX - 0.45, FLOOR, -chimSide * (inZ - 1.25), this.rng.range(0, 6), 0.9);
      this.placeProp('crate', -inX + 0.4, FLOOR, -chimSide * (inZ - 0.5), this.rng.range(-0.2, 0.2), 0.9);
      for (const s of [-1, 1]) this.chair(tx + this.rng.range(-0.1, 0.1), tz + s * (tl / 2 + 0.45), (s > 0 ? Math.PI : 0) + this.rng.range(-0.2, 0.2));
      return;
    }
    if (kind === 'store') {
      // crates stacked two high along the back wall, barrels in the corners, a shelf over the door side
      for (let i = 0; i < 3; i++) {
        const z = -inZ + 0.7 + i * 0.95;
        if (z > inZ - 0.5) break;
        this.placeProp('crate', -inX + 0.35, FLOOR, z, Math.PI / 2 + this.rng.range(-0.15, 0.15), 0.95);
        if (i !== 1) this.placeProp('crate', -inX + 0.35, FLOOR + 0.43, z + this.rng.range(-0.05, 0.05), Math.PI / 2 + this.rng.range(-0.2, 0.2), 0.85);
      }
      this.placeProp('barrel', inX - 0.45, FLOOR, inZ - 0.45, this.rng.range(0, 6), 0.9);
      this.placeProp('barrel', 0.1, FLOOR, inZ - 0.45, this.rng.range(0, 6), 0.9);
      this.box('beam', 1.3, 0.035, 0.3, 0.2, FLOOR + 1.6, -inZ + 0.15, 1);
      this.solid(0.2, -inZ + 0.15, 0.65, 0.15, FLOOR + 1.5, FLOOR + 1.64, 0, 'wood');
      return;
    }
    // the mill: a pair of millstones on a timber hurst with the hopper over them, the shaft in from the wheel, flour sacks
    const mx = 0.7, mz = -chimSide * 1.3;
    this.box('beam', 1.7, 0.5, 1.7, mx, FLOOR + 0.25, mz, 1);
    for (const [y, h] of [[FLOOR + 0.62, 0.24], [FLOOR + 0.87, 0.22]] as const) {
      const g = boxUV(new THREE.CylinderGeometry(0.66, 0.68, h, 20), 1.6, this.rng.next(), this.rng.next());
      this.m.makeTranslation(mx, y, mz); this.add('stone', g, this.m);
    }
    const hop = new THREE.CylinderGeometry(0.5, 0.12, 0.6, 4, 1, true).rotateY(Math.PI / 4);
    boxUV(hop, 1);
    this.m.makeTranslation(mx, FLOOR + 1.55, mz); this.add('beam', hop, this.m);
    for (const s of [-1, 1]) this.box('beam', 0.07, 0.75, 0.07, mx + s * 0.42, FLOOR + 1.35, mz, 1);
    this.solid(mx, mz, 0.85, 0.85, FLOOR, FLOOR + 1.0, 0, 'wood');
    // the drive shaft from the wing's doorway line to the stones (under the floor's joists would hide it: run it low)
    this.log(W / 2 - 0.3, -W / 4 + mx / 2, FLOOR + 0.25, mz, false, 0.09, 'bark');
    for (let i = 0; i < 5; i++) this.cloth(0.42, 0.55, 0.3, inX - 0.4 - (i % 3) * 0.45, FLOOR + 0.275 + (i > 2 ? 0.5 : 0), chimSide * (inZ - 0.4), 0xd8ceb4, this.rng.range(-0.3, 0.3));
    this.solid(inX - 0.85, chimSide * (inZ - 0.4), 0.7, 0.2, FLOOR, FLOOR + 1.0, 0, 'wood');
    this.placeProp('barrel', -inX + 0.45, FLOOR, chimSide * (inZ - 0.45), this.rng.range(0, 6), 0.85);
  }

  /** a log from `a` to `b` (building-local, or the sub-frame's) */
  private logBetween(a: THREE.Vector3, b: THREE.Vector3, r: number, key: MatKey = 'bark') {
    const d = new THREE.Vector3().subVectors(b, a), len = d.length();
    const { side, caps } = logGeo(len, r, this.rng.int(0, BOARDS - 1), this.rng.range(0, 2), 10, key === 'bark');
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(1, 0, 0), d.normalize());
    const m = new THREE.Matrix4().makeRotationFromQuaternion(q).setPosition(a.clone().lerp(b, 0.5));
    this.add(key, side, m.clone());
    this.add('endGrain', caps, m);
  }

  // ── the watermill's wheel wing: a log room on stilts off the back wall, out over the bank, the wheel beside its far end ──
  private wing(w: NonNullable<CabinSpec['wing']>) {
    const { W } = this.spec;
    // the doorway through the back wall into the wing
    const xW = -(W / 2 - LOG_R);
    for (const z of [-0.5, 0.5]) this.box('beam', 0.34, 2.0, 0.1, xW, FLOOR + 1.0, z, 1);
    this.box('beam', 0.34, 0.12, 1.1, xW, FLOOR + 2.06, 0, 1);
    const hz = w.L / 2;
    // wing frame: its local +Z runs out along the building's −X (over the bank), its local +X along the building's +Z
    this.withFrame({ x: -(W / 2) - hz, y: 0, z: 0, yaw: -Math.PI / 2 }, () => {
      this.floorPlanks(w.W, w.L, 0, 0);
      for (const s of [-1, 1]) this.box('beam', 0.22, 0.24, w.L, s * (w.W / 2 - 0.11), PLINTH - 0.12, 0, 1);
      this.box('beam', w.W, 0.24, 0.22, 0, PLINTH - 0.12, hz - 0.11, 1);
      const win: Opening = { a0: -0.4, a1: 0.4, y0: FLOOR + 1.0, y1: FLOOR + 1.7 };
      const sideWin: Opening = { a0: hz - 3.6, a1: hz - 2.8, y0: FLOOR + 1.0, y1: FLOOR + 1.7 };
      this.logBox(w.W, w.L, 0, 0, w.rows, w.pitch, {
        gables: { zpos: true, zneg: false }, skip: ['zneg'],
        ext: { front: { from: -hz + 0.02, overhangFrom: false }, back: { from: -hz + 0.02, overhangFrom: false } },
        openings: { zpos: [roughOpening(win, true)], back: [roughOpening(sideWin, false)] },
      });
      this.roof(w.W, w.L, 0, 0, w.pitch, PLINTH + w.rows * LOG, 0.35, 0.35, 0.45, -0.08);
      const glass: THREE.BufferGeometry[] = [];
      this.windowFrame(win, false, hz - LOG_R, glass);
      this.windowFrame(sideWin, true, -(w.W / 2 - LOG_R), glass);
      this.glassMesh(glass);
      // stilts: log posts from the bank up to the sill beams, every ~2.4 m down both sides, X-braced between
      const n = Math.max(2, Math.round((w.L - 0.6) / 2.4));
      const feet: { x: number; z: number; g: number }[][] = [[], []];
      for (let i = 0; i <= n; i++) {
        const z = -hz + 0.35 + (w.L - 0.7) * (i / n);
        [-1, 1].forEach((s, k) => {
          const x = s * (w.W / 2 - 0.12);
          const wp = this.worldPos(x, 0, z);
          const g = heightAt(wp.x, wp.z) - this.cy - 0.3;   // the posts sink 0.3 m into the bank
          if (PLINTH - 0.24 - g < 0.25) return;
          this.logBetween(new THREE.Vector3(x, g, z), new THREE.Vector3(x, PLINTH - 0.2, z), 0.13);
          this.collider(x, z, 0.14, 0.14, g, PLINTH - 0.24);
          feet[k]?.push({ x, z, g });
        });
      }
      for (const side of feet) for (let i = 0; i + 1 < side.length; i++) {
        const a = side[i], b = side[i + 1];
        if (!a || !b) continue;
        const lo = Math.max(a.g, b.g) + 0.6, hi = PLINTH - 0.35;
        if (hi - lo < 0.8) continue;
        this.logBetween(new THREE.Vector3(a.x, lo, a.z), new THREE.Vector3(b.x, hi, b.z), 0.07);
        this.logBetween(new THREE.Vector3(a.x, hi, a.z), new THREE.Vector3(b.x, lo, b.z), 0.07);
      }
      // the wheel past the wing's far gable, out over the creek (its axle runs on along the wing's line, so the wheel turns
      // in the plane of the flow), carried by a bearing beam across the last pair of stilts and an outer post in the bed
      const half = 0.55, wz = hz + 0.3 + half;
      const outZ = wz + half + 0.5, inZ = hz - 0.35;
      const wpOut = this.worldPos(0, 0, outZ);
      const gOut = heightAt(wpOut.x, wpOut.z) - this.cy - 0.3;
      this.logBetween(new THREE.Vector3(0, gOut, outZ), new THREE.Vector3(0, w.axleY + 0.25, outZ), 0.16);
      this.box('beam', 0.7, 0.22, 0.3, 0, w.axleY + 0.3, outZ, 1);
      this.box('beam', w.W - 0.1, 0.24, 0.24, 0, w.axleY + 0.3, inZ, 1);
      this.collider(0, outZ, 0.18, 0.18, gOut, w.axleY + 0.4);
      this.solid(0, wz, w.r, half + 0.05, w.axleY - w.r, w.axleY + w.r, 0, 'wood');
      const [bx, bz] = this.fr(0, wz);
      const pivot = new THREE.Group();
      pivot.position.set(bx, w.axleY, bz);
      pivot.rotation.y = this.frYaw - Math.PI / 2;   // the wheel's own axle (local X) along the wing (its local +Z)
      const wheel = new THREE.Mesh(this.wheelGeo(w.r, half, wz - inZ + 0.2, outZ - wz + 0.2), this.mats.beam);
      wheel.castShadow = true; wheel.receiveShadow = true;
      pivot.add(wheel);
      this.root.add(pivot);
      this.owner._wheel(wheel);
    });
  }

  /** an undershot wheel about local X: hub, axle (`inner` m into the wall side, `outer` m out to the bearing), two rims, spokes, 20 paddles */
  private wheelGeo(r: number, half: number, inner: number, outer: number) {
    const g: THREE.BufferGeometry[] = [];
    const push = (geo: THREE.BufferGeometry, m: THREE.Matrix4) => { g.push(boxUV(geo, 1, this.rng.next(), this.rng.next()).applyMatrix4(m).toNonIndexed()); };
    const m = new THREE.Matrix4();
    push(new THREE.CylinderGeometry(0.34, 0.34, half * 2 + 0.3, 12).rotateZ(Math.PI / 2), m.identity());
    const axle = new THREE.CylinderGeometry(0.13, 0.13, inner + outer, 10).rotateZ(Math.PI / 2);
    push(axle, m.makeTranslation((outer - inner) / 2, 0, 0));
    const seg = 20, chord = 2 * r * Math.sin(Math.PI / seg) + 0.04;
    for (const x of [-half + 0.06, half - 0.06]) {
      for (let i = 0; i < seg; i++) {
        const a = (i / seg) * Math.PI * 2;
        m.makeRotationX(a).setPosition(x, Math.cos(a) * (r - 0.12), Math.sin(a) * (r - 0.12));
        push(new THREE.BoxGeometry(0.1, 0.2, chord), m);
      }
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2 + 0.2;
        const len = r - 0.4;
        m.makeRotationX(a).setPosition(x, Math.cos(a) * (0.3 + len / 2), Math.sin(a) * (0.3 + len / 2));
        push(new THREE.BoxGeometry(0.09, len, 0.13), m);
      }
    }
    for (let i = 0; i < seg; i++) {
      const a = ((i + 0.5) / seg) * Math.PI * 2;
      m.makeRotationX(a).setPosition(0, Math.cos(a) * (r - 0.3), Math.sin(a) * (r - 0.3));
      push(new THREE.BoxGeometry(half * 2 - 0.1, 0.6, 0.05), m);
    }
    const merged = mergeGeometries(g);
    merged.computeBoundingSphere();
    return merged;
  }

  private smoke() {
    const { L } = this.spec;
    const side = this.spec.chimney === 'zpos' ? 1 : -1;
    const p = makeParticles(this.mats.smoke, 40, this.rng);
    p.position.set(-0.6, this.ridgeY + 0.85, side * (L / 2 + 0.42));
    p.renderOrder = 4;
    this.root.add(p);
    this.owner._particles(this.mats.smoke);
  }

  /**
   * Its own objects' bands (the weld culls them, ../../../models/place.ts `finishWeld`): the detail set within the detail
   * distance, the far set within twice it; a swap caster casts only past the detail distance (its near proxy draws its
   * depth nearer). On a tier without detail shadows, the detail set casts none.
   */
  private band() {
    const dd = TIER_CONFIG.cabinDetailDist;
    for (const o of this.detail) o.userData['until'] = dd;
    for (const o of this.far) o.userData['until'] = dd * 2;
    for (const o of this.swap) o.userData['castFrom'] = dd;
    if (!this.specimen && !TIER_CONFIG.cabinDetailShadows) for (const o of this.detail) o.traverse((c) => { c.castShadow = false; });
  }

  /**
   * Its parts for `place` to merge, per material in the order they first came, then the glass: the detail set within
   * the detail distance (its depth only in the near proxy), the far set within twice it, the rest at every distance —
   * those two cast through their band's position-only proxy. The glass casts none.
   */
  weldParts(): WeldPart[] {
    const dd = TIER_CONFIG.cabinDetailDist, out: WeldPart[] = [];
    for (const [key, geometries] of this.parts) {
      const material = this.mats[key];
      if (DETAIL_KEYS.has(key)) out.push({ material, geometries, until: dd, depth: 'near', receiveShadow: true, castShadow: this.specimen && this.casters === null });
      else if (FAR_KEYS.has(key)) out.push({ material, geometries, until: dd * 2, depth: 'proxy', receiveShadow: true });
      else out.push({ material, geometries, depth: 'proxy', receiveShadow: true });
    }
    // a building drawn alone draws each window group as its own mesh; a hamlet building's panes join the hamlet's one
    const glass = { material: this.mats.glass, until: dd, receiveShadow: true, renderOrder: 2 };
    if (this.role === 'member') { if (this.glass.length > 0) out.push({ ...glass, geometries: this.glass.flat() }); }
    else this.glass.forEach((geometries, i) => { out.push({ ...glass, geometries, key: `glass-${i}` }); });
    return out;
  }

  /** its colliders, world space: its legacy boxes but the door's, then its static solids but its props' (their models' own) */
  colliderDescs(): ColliderDesc[] {
    return [...this.legacy.filter((c) => c !== this.doorBox).map((c) => boxDesc(c)), ...this.solidList.filter((s) => !s.prop).map((s) => s.d)];
  }

  /** what it hands `place` (../../../models/weld.ts `WeldBuild`) */
  weldBuild(): WeldBuild {
    const root = this.root, floors = this.floors;
    return { root, parts: this.weldParts(), ...(this.casters === null ? {} : { casters: this.casters }), colliders: this.colliderDescs(),
      box: (target) => buildingBox(root, floors, target) };
  }
}

/**
 * Merge a timber's parts per material under `root` (src/shards/pine-hollow/world/timber.ts: the landmarks, drawn `single`):
 * one mesh per material, the small hardware in `detailList` (it casts its own shadow), the mid parts in `farList`, and the
 * static shadow casters as two position-only proxies (the silhouette set, and the far set that goes with the far list).
 */
export function finishParts(parts: Map<MatKey, THREE.BufferGeometry[]>, mats: Mats, root: THREE.Object3D, detailList: THREE.Object3D[], farList: THREE.Object3D[]): void {
  // (the bands are markers here: the timber tags its lists with its own distances)
  const DETAIL = 1, FAR = 2;
  const unit = new UnitParts();
  for (const [key, geometries] of parts) {
    const material = mats[key];
    if (DETAIL_KEYS.has(key)) unit.add([{ material, geometries, until: DETAIL, depth: 'near', receiveShadow: true, castShadow: true }]);
    else if (FAR_KEYS.has(key)) unit.add([{ material, geometries, until: FAR, depth: 'proxy', receiveShadow: true }]);
    else unit.add([{ material, geometries, depth: 'proxy', receiveShadow: true }]);
  }
  parts.clear();
  const drawn = unit.draw(root, false);
  for (const { mesh, part } of drawn.meshes) {
    if (part.until === DETAIL) detailList.push(mesh);
    else if (part.until === FAR) farList.push(mesh);
  }
  for (const { mesh, until } of drawn.proxies) if (until === FAR) farList.push(mesh);
}

/** a building's world box: what its root draws, and its decks' rectangles up to its ridge */
function buildingBox(root: THREE.Object3D, floors: readonly Floor[], box: THREE.Box3): THREE.Box3 {
  box.setFromObject(root);
  const v = new THREE.Vector3();
  for (const f of floors) {
    const c = Math.cos(f.rot), s = Math.sin(f.rot);
    for (const [sx, sz] of [[-1, -1], [-1, 1], [1, -1], [1, 1]] as const) {
      const lx = sx * f.hw, lz = sz * f.hd;
      box.expandByPoint(v.set(f.x + lx * c + lz * s, f.y - 0.3, f.z - lx * s + lz * c));
      box.expandByPoint(v.set(f.x + lx * c + lz * s, f.y + 4.5, f.z - lx * s + lz * c));
    }
  }
  return box;
}

/**
 * Collapse the parts that share a material into one part (their matrices baked into the geometry) — the same pixels, one
 * draw instead of one per glTF mesh. Parts whose attributes do not line up for a merge stay as they are.
 */
export function mergeParts(parts: PropPart[]): PropPart[] {
  const byMat = new Map<THREE.Material, PropPart[]>();
  for (const p of parts) { const l = byMat.get(p.material); if (l === undefined) byMat.set(p.material, [p]); else l.push(p); }
  const out: PropPart[] = [];
  for (const [material, list] of byMat) {
    const first = list[0];
    if (list.length === 1 && first !== undefined) { out.push(first); continue; }
    const merged = mergeOrNull(list.map((p) => p.geometry.clone().applyMatrix4(p.matrix)));
    if (merged === null) { out.push(...list); continue; }
    merged.computeBoundingSphere();
    out.push({ geometry: merged, material, matrix: new THREE.Matrix4() });
  }
  return out;
}

// ───────────────────────────── the homestead, as its models read it ─────────────────────────────

const KEY = 'pine-hollow/cabins';

/** hand the built homestead to its models (src/shards/pine-hollow/world/cabins.ts) */
export function useCabins(ctx: ModelContext, cabins: Cabins): void { ctx.once(KEY, () => cabins); }

/** the homestead handed to this shard's models */
export const cabinsOf = (ctx: ModelContext): Cabins => ctx.once<Cabins>(KEY, () => { throw new Error('[cabins] not built (useCabins)'); });

/** building `id` (`cabin-1` … or a hamlet building's) as the homestead built it where it stands: its `place` weld build */
export function builtBuilding(ctx: ModelContext, id: string): WeldBuild {
  const b = cabinsOf(ctx).buildings.find((x) => x.id === id);
  if (b === undefined) throw new Error(`[cabins] no building '${id}'`);
  return b.weld;
}

/**
 * Building `id` alone, in its own frame, for the Model Explorer (E315 M2): built where it stands (its site-fitted parts:
 * the mill's stilts) with its lights as anchors, its parts merged as the world merges a cabin's (its near proxy on a tier
 * with one), then set at the origin; its props drawn with it. An empty group before the homestead is built.
 */
export function buildingSpecimen(ctx: ModelContext, id: string): ModelBuild {
  const cabins = cabinsOf(ctx), b = cabins.buildings.find((x) => x.id === id), kit = cabins.kit;
  if (b === undefined || kit === null) return new THREE.Group();
  const props: Record<PropKind, THREE.Matrix4[]> = { crate: [], barrel: [], bucket: [], hatchet: [] };
  const cb = new CabinBuilder(NO_OWNER, b.spec, b.index, b.x, b.y, b.z, b.rot, kit.mats, ctx.sky, props, 'specimen');
  cb.build(kit.firePit, kit.lantern);
  const unit = new UnitParts();
  unit.add(cb.weldParts());
  const casters = cb.casters;
  const drawn = unit.draw(cb.root, casters !== null);
  const np = casters === null ? null : nearProxy(drawn.front, casters);
  if (np !== null) cb.root.add(np);
  const toLocal = cb.root.matrixWorld.clone().invert();
  cb.root.position.set(0, 0, 0); cb.root.rotation.set(0, 0, 0);
  cb.root.updateMatrixWorld(true);
  const m = new THREE.Matrix4();
  for (const k of PROP_KINDS) for (const part of kit.props[k]) {
    const list = props[k];
    if (list.length === 0) continue;
    const im = new THREE.InstancedMesh(part.geometry, part.material, list.length);
    list.forEach((w, j) => { im.setMatrixAt(j, m.multiplyMatrices(toLocal, w).multiply(part.matrix)); });
    im.instanceMatrix.needsUpdate = true;
    im.computeBoundingSphere();
    im.castShadow = true; im.receiveShadow = true;
    cb.root.add(im);
  }
  return cb.root;
}

// ───────────────────────────── the log cabin ─────────────────────────────

export const CABIN_VARIANTS = ['hollow', 'east', 'ridge'] as const;

export interface LogCabinParams { readonly site: number }

export const logCabin = defineModel<LogCabinParams>({
  id: 'pine-hollow/log-cabin', name: 'Log cabin', category: 'buildings', pipeline: 'code',
  file: 'src/shards/pine-hollow/models/logCabin.ts', surface: 'wood',
  defaults: { site: 0 },
  variants: [
    { id: 'hollow', label: "The ranger's (the Hollow)", params: { site: 0 } },
    { id: 'east', label: 'East', params: { site: 1 } },
    { id: 'ridge', label: 'Ridge', params: { site: 2 } },
  ],
  build: (ctx, p) => buildingSpecimen(ctx, `cabin-${p.site + 1}`),
  weld: (ctx, p) => builtBuilding(ctx, `cabin-${p.site + 1}`),
});
