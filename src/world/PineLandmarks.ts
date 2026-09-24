/**
 * PineLandmarks — Pine Hollow's landmarks (PINE-HOLLOW-REMASTER PH-B3 and the B6-adjacent buildings), every site from
 * src/chunks/pineHollowLayout.ts:
 *
 *   · the FIRE LOOKOUT on the ridge pad: four splayed peeled-log legs with girts and X-bracing, a stair of five flights
 *     inside a railed cage (treads the character climbs), a 6 m deck with a railing, the glazed cab with a hipped moss
 *     roof, and the zipline's launch jutting off the deck toward the Hollow;
 *   · the ZIPLINE: the steel cable (a sagging chord) from the launch gantry to the LANDING platform in the Hollow (4, 20),
 *     a 3 m deck on log posts with a stair down; `zipTop` / `zipBottom` are the ride's anchors (the ride is a later row);
 *   · the CREEK FOOTBRIDGE on the E road: two log stringers, split-plank deck, log trestles in the gully, a log handrail;
 *   · image-to-3D hero props (TRELLIS.2, PBR kept; public/assets/models/pine-hollow-hero/): the King's 7 standing
 *     stones, the 3 waystone lanterns (pond shore, ridge by the lookout, the den's cave mouth), the beaver dam on the
 *     sill, the canoe on the pond shore, the lodge's contract board, and the bear cave's rock arch with a dark mouth.
 *
 * The timber pieces build with the cabins' own kit and materials (Cabin.ts: `cabinMats`, `logGeo`, `finishParts`): one
 * merged mesh per material per landmark, two position-only shadow proxies, no new programs. Each prop type is ONE
 * InstancedMesh per LOD. Lights: none of their own — the waystones' flames and the cab's glass are emissive, driven by
 * `sky.lamps` (PH-L3), and the waystones are lamp sites the phone's pooled cabin pair may visit (Cabins.addLampSite).
 *
 *   const lm = await installPineLandmarks({ sky, registry, cabins, game });   // registers, adds to the scene, updates
 *   lm.setLit('pond', true);                                                  // the quest relights a waystone
 */
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { heightAt } from './Heightfield';
import { cabinMats, finishParts, logGeo, boxUV, makeGlowTexture, type Mats, type MatKey, type ExtraBuilding, type Cabins } from './Cabin';
import {
  LOOKOUT, ZIPLINE, CREEK_BRIDGE, E_ROAD, BEAVER_DAM, CREEK, BEAR_CAVE, STANDING_STONES, KINGS_CLEARING, HAMLET_SITES, POND, SPURS,
} from '../chunks/pineHollowLayout';
import type { ColliderDesc, WorldRegistry } from './registry';
import type { Sky } from './Sky';
import { TIER_CONFIG } from '../core/tier';
import { Rng } from '../core/rng';
import { SEED } from '../core/config';
import { macrotask } from '../boot/plan';
import { PINE_HERO_IDS, pineHeroUrl, type PineHeroId } from './pineHero';

type V3 = THREE.Vector3;
const V = (x: number, y: number, z: number): V3 => new THREE.Vector3(x, y, z);

// ───────────────────────────── the mill hamlet's buildings (built by Cabins as one cluster) ─────────────────────────────

/** the kit's frame turns a layout yaw (the door faces (−sin y, −cos y)) into its own (the door faces local +X) */
const kitRot = (yaw: number): number => yaw + Math.PI / 2;
const FLOOR_Y = 0.22; // Cabin.ts FLOOR: the floor's top above the pad

/** the hamlet's five buildings for `new Cabins(sky, pineHamletBuildings())` (PH-B3 / C6: the lodge, trader, miller, mill, shed) */
export function pineHamletBuildings(): ExtraBuilding[] {
  const s = HAMLET_SITES;
  return [
    { // the hunting lodge: a long log hall, a deep porch, the contract board stands by its steps (a prop, below)
      id: 'hunting-lodge', x: s.lodge.x, z: s.lodge.z, rot: kitRot(s.lodge.rot),
      spec: {
        W: 7, L: 12, rows: 13, pitch: 0.66, doorZ: 0.8, chimney: 'zneg', porchDepth: 2.6, lantern: true, bench: 'table', interior: 'hall',
        windows: [{ wall: 'front', at: -3.2 }, { wall: 'front', at: 3.6 }, { wall: 'back', at: -3.5 }, { wall: 'back', at: 0 }, { wall: 'back', at: 3.5 }, { wall: 'zpos', at: 1.2 }],
      },
    },
    { // the trader's stall: a log booth with a serving hatch, a counter and an awning; its door is shut for good
      id: 'trader-stall', x: s.trader.x, z: s.trader.z, rot: kitRot(s.trader.rot),
      spec: {
        W: 3.4, L: 5.2, rows: 9, pitch: 0.55, doorZ: 1.75, door: 'fixed', chimney: 'zneg', noChimney: true, porchDepth: 0, interior: 'store',
        windows: [{ wall: 'front', at: -0.55, w: 2.4, y: FLOOR_Y + 0.85, h: 1.05, open: true }],
      },
    },
    { // the miller's house: a cabin with a lean-to woodshed
      id: 'millers-house', x: s.miller.x, z: s.miller.z, rot: kitRot(s.miller.rot),
      spec: {
        W: 5, L: 7, rows: 11, pitch: 0.75, doorZ: -0.8, chimney: 'zneg', porchDepth: 1.8, leanTo: true, lantern: true, bench: 'logs',
        windows: [{ wall: 'front', at: 1.6 }, { wall: 'back', at: -1.2 }, { wall: 'back', at: 1.6 }],
      },
    },
    { // the watermill: its stones inside, the wheel wing on stilts out over the creek, the wheel past its end
      id: 'watermill', x: s.mill.x, z: s.mill.z, rot: kitRot(s.mill.rot),
      spec: {
        // its door is shut for now (0 draws: the miller's errand, PH-C6, is what opens the mill again)
        W: 6, L: 8, rows: 12, pitch: 0.72, doorZ: -1.4, door: 'fixed', chimney: 'zneg', noChimney: true, porchDepth: 1.6, interior: 'mill', plinthDrop: 1.8,
        windows: [{ wall: 'front', at: 1.8 }, { wall: 'zpos', at: 0.6 }, { wall: 'zneg', at: -0.8 }],
        wing: { W: 3.6, L: 11, rows: 8, pitch: 0.5, r: 3.0, axleY: -3.3 },
      },
    },
    { // the shed: a small log store, a lean-to of firewood on its end
      id: 'hamlet-shed', x: s.shed.x, z: s.shed.z, rot: kitRot(s.shed.rot),
      spec: { W: 3.2, L: 4.2, rows: 9, pitch: 0.6, doorZ: 0, door: 'fixed', chimney: 'zneg', noChimney: true, porchDepth: 0, leanTo: true, interior: 'none', windows: [] },
    },
  ];
}

// ───────────────────────────── the timber kit: one landmark's parts in its own frame ─────────────────────────────

interface Floor { x: number; z: number; rot: number; hw: number; hd: number; y: number }

class Timber {
  readonly root = new THREE.Group();
  readonly detail: THREE.Object3D[] = [];
  readonly far: THREE.Object3D[] = [];
  readonly glass: THREE.BufferGeometry[] = [];
  readonly rng: Rng;
  private parts = new Map<MatKey, THREE.BufferGeometry[]>();
  private m = new THREE.Matrix4();
  private q = new THREE.Quaternion();

  constructor(name: string, readonly x: number, readonly y: number, readonly z: number, readonly yaw: number, seed: number,
    private out: ColliderDesc[], private floors: Floor[]) {
    this.rng = new Rng(SEED + seed);
    this.root.name = name;
    this.root.position.set(x, y, z);
    this.root.rotation.y = yaw;
    this.root.updateMatrixWorld(true);
    this.q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
  }

  add(key0: MatKey, geo: THREE.BufferGeometry, m?: THREE.Matrix4): void {
    if (m) geo.applyMatrix4(m);
    const g = geo.index ? geo.toNonIndexed() : geo;
    // fewer materials, fewer draws (a landmark is mostly seen from afar): the decks are the beams' planks
    const key: MatKey = key0 === 'deck' ? 'beam' : key0;
    const list = this.parts.get(key);
    if (list === undefined) this.parts.set(key, [g]); else list.push(g);
  }
  /** a box of w × h × d centred at (x, y, z), turned ry about +Y (then rz, rx) */
  box(key: MatKey, w: number, h: number, d: number, x: number, y: number, z: number, uv = 1, ry = 0, rz = 0, rx = 0): void {
    const g = boxUV(new THREE.BoxGeometry(w, h, d), uv, this.rng.next(), this.rng.next());
    this.m.makeRotationFromEuler(new THREE.Euler(rx, ry, rz, 'YXZ')).setPosition(x, y, z);
    this.add(key, g, this.m);
  }
  /** a round log from a to b (peeled 'log' texture, or 'bark') with end grain caps */
  log(a: V3, b: V3, r: number, key: 'log' | 'bark' = 'log', segs = 10): void {
    const d = new THREE.Vector3().subVectors(b, a), len = d.length();
    if (len < 0.02) return;
    const { side, caps } = logGeo(len, r, this.rng.int(0, 6), this.rng.range(0, 2), segs, key === 'bark');
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(1, 0, 0), d.normalize());
    const m = new THREE.Matrix4().makeRotationFromQuaternion(q).setPosition(a.clone().lerp(b, 0.5));
    this.add(key, side, m.clone());
    this.add(key, caps, m); // the caps in the log's own material: one draw per landmark for its logs
  }
  /** a sawn beam (square section `s`) from a to b */
  beam(a: V3, b: V3, s: number, key: MatKey = 'beam'): void {
    const d = new THREE.Vector3().subVectors(b, a), len = d.length();
    const g = boxUV(new THREE.BoxGeometry(len, s, s), 1, this.rng.next(), this.rng.next());
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(1, 0, 0), d.normalize());
    this.add(key, g, new THREE.Matrix4().makeRotationFromQuaternion(q).setPosition(a.clone().lerp(b, 0.5)));
  }
  world(lx: number, ly: number, lz: number): V3 { return V(lx, ly, lz).applyMatrix4(this.root.matrixWorld); }
  /** a static box collider: local centre (lx, lz), half extents, from y0 to y1 above the frame's origin */
  solid(lx: number, lz: number, hx: number, hz: number, y0: number, y1: number, localYaw = 0, surface: 'wood' | 'stone' = 'wood'): void {
    const c = this.world(lx, (y0 + y1) / 2, lz);
    this.out.push({ kind: 'box', x: c.x, y: c.y, z: c.z, hx, hy: (y1 - y0) / 2, hz, yaw: this.yaw + localYaw, surface });
  }
  /** a box collider along a sloped segment a → b (a leg, a deck on a slope): `hw` across (local ±Z of the segment), `hh` thick */
  solidAlong(a: V3, b: V3, hw: number, hh: number): void {
    const d = new THREE.Vector3().subVectors(b, a), len = d.length();
    const ql = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(1, 0, 0), d.clone().normalize());
    const rot = this.q.clone().multiply(ql);
    const mid = a.clone().lerp(b, 0.5), c = this.world(mid.x, mid.y, mid.z);
    this.out.push({ kind: 'box', x: c.x, y: c.y, z: c.z, hx: len / 2, hy: hh, hz: hw, rot: { x: rot.x, y: rot.y, z: rot.z, w: rot.w }, surface: 'wood' });
  }
  /** a stair (Rapier treads): `count` risers from `from` (the first tread's foot) to `to` (the top edge), local */
  treads(from: V3, to: V3, width: number, count: number): void {
    const f = this.world(from.x, from.y, from.z), t = this.world(to.x, to.y, to.z);
    this.out.push({ kind: 'treads', from: { x: f.x, y: f.y, z: f.z }, to: { x: t.x, y: t.y, z: t.z }, width, count, surface: 'wood' });
  }
  /** a walkable deck rectangle for `floorHeightAt` (placement only: the colliders are the real floor) */
  floor(lx: number, lz: number, hw: number, hd: number, y: number): void {
    const c = this.world(lx, y, lz);
    this.floors.push({ x: c.x, z: c.z, rot: this.yaw, hw, hd, y: c.y });
  }
  finish(mats: Mats): void {
    finishParts(this.parts, mats, this.root, this.detail, this.far);
    if (this.glass.length > 0) {
      const merged = this.glass.length === 1 ? this.glass[0] : mergeList(this.glass);
      if (merged) {
        const gm = new THREE.Mesh(merged, mats.glass);
        gm.renderOrder = 2; gm.receiveShadow = true;
        this.root.add(gm); this.detail.push(gm);
      }
    }
  }
}

function mergeList(list: THREE.BufferGeometry[]): THREE.BufferGeometry | undefined {
  const pos: number[] = [], nor: number[] = [], uv: number[] = [];
  for (const g0 of list) {
    const g = g0.index ? g0.toNonIndexed() : g0;
    const p = g.getAttribute('position'), n = g.getAttribute('normal'), u = g.getAttribute('uv');
    for (let i = 0; i < p.count; i++) { pos.push(p.getX(i), p.getY(i), p.getZ(i)); nor.push(n.getX(i), n.getY(i), n.getZ(i)); uv.push(u.getX(i), u.getY(i)); }
  }
  if (pos.length === 0) return undefined;
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  out.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  out.computeBoundingSphere();
  return out;
}

// ───────────────────────────── the fire lookout ─────────────────────────────

/** tower frame: local −Z faces the zipline's landing (the launch side), local +X the trail's arrival (the stair's door) */
const TOWER = { base: 3.0, top: 2.1, deck: ZIPLINE.from.deck, deckHalf: 3.4, cab: 2.4, cabH: 2.3, flights: 5, flightRise: ZIPLINE.from.deck / 5, riser: 7, tread: 0.36, stairHalf: 1.26, landing: 0.9 } as const;
const LAUNCH = { half: 0.8, out: 1.4, gantry: 3.6, cable: 3.3 };
const LANDING = { hx: 1.5, hz: 1.6, deck: ZIPLINE.to.deck, gantry: 3.8, cable: 3.3 };
/** the tower (and landing) turn: local −Z points from the lookout down the cable to the landing */
const ZIP_YAW = Math.atan2(ZIPLINE.from.x - ZIPLINE.to.x, ZIPLINE.from.z - ZIPLINE.to.z);

function buildLookout(t: Timber): { zipTop: V3; launch: V3 } {
  const { base, top, deck, deckHalf, cab, cabH } = TOWER;
  const legAt = (sx: number, sz: number, h: number): V3 => {
    const f = (h + 0.4) / (deck - 0.2 + 0.4);
    const r = base + (top - base) * f;
    return V(sx * r, h, sz * r);
  };
  const corners: [number, number][] = [[1, 1], [-1, 1], [-1, -1], [1, -1]];
  // the legs, sunk into the crag
  for (const [sx, sz] of corners) {
    t.log(legAt(sx, sz, -0.4), legAt(sx, sz, deck - 0.2), 0.17);
    t.solidAlong(legAt(sx, sz, -0.4), legAt(sx, sz, deck - 0.2), 0.18, 0.18);
  }
  // girts at the bay lines and X-bracing in every bay; the lowest bay of the +X face is the door into the stair
  const bays = [0.35, 2.75, 5.5, 8.25, deck - 0.35];
  for (let f = 0; f < 4; f++) {
    const a = corners[f], b = corners[(f + 1) % 4];
    if (!a || !b) continue;
    const doorFace = a[0] === 1 && b[0] === 1;
    for (let i = 0; i < bays.length; i++) {
      const h = bays[i] ?? 0;
      if (i > 0 || !doorFace) t.log(legAt(a[0], a[1], h), legAt(b[0], b[1], h), 0.1);
      const h1 = bays[i + 1];
      if (h1 === undefined || (i === 0 && doorFace)) continue;
      t.log(legAt(a[0], a[1], h + 0.15), legAt(b[0], b[1], h1 - 0.15), 0.075);
      t.log(legAt(b[0], b[1], h + 0.15), legAt(a[0], a[1], h1 - 0.15), 0.075);
    }
    // the lowest bay walls you off the stair's cage everywhere but the door face
    if (!doorFace) {
      const pa = legAt(a[0], a[1], 0), pb = legAt(b[0], b[1], 0);
      t.solidAlong(V(pa.x, 1.2, pa.z), V(pb.x, 1.2, pb.z), 0.08, 1.2);
    }
  }
  t.log(legAt(1, 1, 2.75), legAt(1, -1, 2.75), 0.1); // the door face's lintel girt
  // outriggers: the deck (and the cab, wider than the leg tops) rides out on knee braces at the corners and mid-faces
  for (const [sx, sz] of corners) t.log(legAt(sx, sz, deck - 1.7), V(sx * (deckHalf - 0.15), deck - 0.25, sz * (deckHalf - 0.15)), 0.08);
  for (const [ax, az] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
    const r0 = top + (base - top) * (1.5 / (deck + 0.2));
    t.log(V(ax * r0, deck - 1.5, az * r0), V(ax * (deckHalf - 0.15), deck - 0.25, az * (deckHalf - 0.15)), 0.08);
  }

  // ── the stair: five flights zig-zag inside a railed cage (flights at z = ±0.5, landings at the x ends) ──
  const { flightRise, riser, tread, stairHalf, landing, flights } = TOWER;
  const run = riser * tread;                 // 2.52 m
  for (let k = 0; k < flights; k++) {
    const y0 = k * flightRise, even = k % 2 === 0;
    const zc = even ? -0.5 : 0.5, x0 = even ? stairHalf : -stairHalf, dir = even ? -1 : 1;
    t.treads(V(x0, y0, zc), V(x0 + dir * run, y0 + flightRise, zc), 0.9, riser);
    for (let i = 0; i < riser - 1; i++) t.box('deck', 0.4, 0.05, 0.86, x0 + dir * tread * (i + 0.5), y0 + (flightRise / riser) * (i + 1) - 0.025, zc, 1.2);
    // stringers under the tread ends, the outer handrail
    for (const dz of [-0.45, 0.45]) t.beam(V(x0 + dir * 0.1, y0 + 0.05, zc + dz), V(x0 + dir * (run - 0.1), y0 + flightRise - 0.1, zc + dz), 0.09);
    const zo = zc * 1.96;
    t.beam(V(x0, y0 + 0.95, zo), V(x0 + dir * run, y0 + flightRise + 0.95, zo), 0.06);
    t.beam(V(x0 + dir * run * 0.5, y0 + flightRise * 0.5, zo), V(x0 + dir * run * 0.5, y0 + flightRise * 0.5 + 0.95, zo), 0.06);
    // the landing it arrives at (the top flight arrives at the deck)
    if (k < flights - 1) {
      const lx = (x0 + dir * run) + dir * landing / 2 - dir * 0.36 / 2, ly = y0 + flightRise;
      const lxc = dir * (stairHalf + landing / 2);
      t.box('deck', landing + 0.36, 0.06, 1.9, lxc - dir * 0.18, ly - 0.03, 0, 1.2);
      t.beam(V(lxc - dir * 0.6, ly - 0.14, -0.95), V(lxc - dir * 0.6, ly - 0.14, 0.95), 0.12);
      t.beam(V(lxc + dir * 0.4, ly - 0.14, -0.95), V(lxc + dir * 0.4, ly - 0.14, 0.95), 0.12);
      t.solid(lxc - dir * 0.18, 0, (landing + 0.36) / 2, 0.95, ly - 0.14, ly);
      // the landing's end rail (at the cage's end) with its posts
      t.beam(V(dir * (stairHalf + landing), ly + 0.95, -0.95), V(dir * (stairHalf + landing), ly + 0.95, 0.95), 0.06);
      for (const pz of [-0.95, 0.95]) t.beam(V(dir * (stairHalf + landing), ly, pz), V(dir * (stairHalf + landing), ly + 1.0, pz), 0.07);
      void lx;
    }
  }
  // the cage: a divider between the flights, the outer sides, the −X end all the way up, the +X end above the first
  // landing on that side (below it is the door)
  const endX = stairHalf + landing + 0.05;
  t.solid(0, 0, stairHalf, 0.04, 0, deck);
  t.solid(0, -1.0, endX, 0.04, 0, deck);
  t.solid(0, 1.0, endX, 0.04, 0, deck);
  t.solid(-endX, 0, 0.04, 1.0, 0, deck);
  t.solid(endX, 0, 0.04, 1.0, 2 * flightRise, deck);
  // the centre posts of the stair column (the divider drawn as posts + a mid rail per flight)
  for (const px of [-stairHalf, 0, stairHalf]) t.beam(V(px, 0, 0), V(px, deck, 0), 0.1);

  // ── the deck: joists, planks round the stairwell, a railing with a gap for the launch ──
  // the stairwell is open over the top flight AND over the last landing + the flight before it (2.0 m under a closed deck
  // is less than the capsule's head room): x from the top flight's arrival to the landing's end, the stair's full width
  const well = { x0: -stairHalf, x1: stairHalf + landing + 0.06, z0: -1.0, z1: 1.0 };
  for (let i = 0; i < 5; i++) { const z = -deckHalf + 0.15 + (i / 4) * (deckHalf * 2 - 0.3); t.box('beam', deckHalf * 2, 0.2, 0.14, 0, deck - 0.18, z, 1); }
  const deckRects: [number, number, number, number][] = [
    [-deckHalf, deckHalf, well.z1, deckHalf], [-deckHalf, deckHalf, -deckHalf, well.z0],
    [-deckHalf, well.x0, well.z0, well.z1], [well.x1, deckHalf, well.z0, well.z1],
  ];
  for (const [x0, x1, z0, z1] of deckRects) {
    t.box('deck', x1 - x0, 0.07, z1 - z0, (x0 + x1) / 2, deck - 0.035, (z0 + z1) / 2, 1.2);
    t.solid((x0 + x1) / 2, (z0 + z1) / 2, (x1 - x0) / 2, (z1 - z0) / 2, deck - 0.2, deck);
  }
  t.floor(0, 0, deckHalf, deckHalf, deck);
  // the stairwell's guard rail: both long sides, the far end, and the arrival end's half over the flight below (the top
  // flight comes up through the other half: that is the way off the stair)
  const guard = (a: V3, b: V3): void => {
    t.beam(V(a.x, deck + 1.0, a.z), V(b.x, deck + 1.0, b.z), 0.06);
    t.beam(V(a.x, deck + 0.5, a.z), V(b.x, deck + 0.5, b.z), 0.05);
    for (const p of [a, b]) t.beam(V(p.x, deck, p.z), V(p.x, deck + 1.05, p.z), 0.07);
    const c = a.clone().lerp(b, 0.5), len = a.distanceTo(b) / 2;
    if (Math.abs(a.x - b.x) > Math.abs(a.z - b.z)) t.solid(c.x, c.z, len, 0.04, deck, deck + 1.05); else t.solid(c.x, c.z, 0.04, len, deck, deck + 1.05);
  };
  guard(V(well.x0, 0, well.z0), V(well.x1, 0, well.z0));
  guard(V(well.x0, 0, well.z1), V(well.x1, 0, well.z1));
  guard(V(well.x1, 0, well.z0), V(well.x1, 0, well.z1));
  guard(V(well.x0, 0, 0), V(well.x0, 0, well.z1));
  // the deck's railing: posts every ~1.5 m, a top and a mid rail, open on −Z for the launch
  const railH = 1.05;
  for (let side = 0; side < 4; side++) {
    const n = 4;
    for (let i = 0; i <= n; i++) {
      const s = -deckHalf + (i / n) * deckHalf * 2;
      const [px, pz] = side === 0 ? [s, deckHalf] : side === 1 ? [deckHalf, s] : side === 2 ? [s, -deckHalf] : [-deckHalf, s];
      t.beam(V(px, deck - 0.3, pz), V(px, deck + railH, pz), 0.1);
    }
    const segs: [number, number][] = side === 2 ? [[-deckHalf, -LAUNCH.half], [LAUNCH.half, deckHalf]] : [[-deckHalf, deckHalf]];
    for (const [a, b] of segs) {
      const p = (s: number, y: number): V3 => (side === 0 ? V(s, y, deckHalf) : side === 1 ? V(deckHalf, y, s) : side === 2 ? V(s, y, -deckHalf) : V(-deckHalf, y, s));
      t.beam(p(a, deck + railH), p(b, deck + railH), 0.08);
      t.beam(p(a, deck + 0.5), p(b, deck + 0.5), 0.06);
      const c = p((a + b) / 2, 0);
      if (side === 0 || side === 2) t.solid(c.x, c.z, (b - a) / 2, 0.05, deck, deck + railH + 0.05);
      else t.solid(c.x, c.z, 0.05, (b - a) / 2, deck, deck + railH + 0.05);
    }
  }

  // ── the cab: a plank dado, a window band all round, corner posts, a hipped moss roof; the door faces the launch ──
  const door = { x0: -1.45, x1: -0.55 };
  const dado = 1.0, sill = deck + dado, head = deck + 2.1;
  for (let side = 0; side < 4; side++) {
    const p = (s: number, y: number): V3 => (side === 0 ? V(s, y, cab) : side === 1 ? V(cab, y, s) : side === 2 ? V(s, y, -cab) : V(-cab, y, s));
    const segs: [number, number][] = side === 2 ? [[-cab, door.x0], [door.x1, cab]] : [[-cab, cab]];
    for (const [a, b] of segs) {
      const c = p((a + b) / 2, 0), along = b - a;
      const w = side % 2 === 0 ? along : 0.07, d = side % 2 === 0 ? 0.07 : along;
      t.box('beam', w, dado, d, c.x, deck + dado / 2, c.z, 1);
      t.box('beam', w, cabH - 2.1, d, c.x, head + (cabH - 2.1) / 2, c.z, 1);
      if (side % 2 === 0) t.solid(c.x, c.z, along / 2, 0.06, deck, deck + cabH); else t.solid(c.x, c.z, 0.06, along / 2, deck, deck + cabH);
      // mullions + glass panes in the band between the dado and the head
      const n = Math.max(1, Math.round(along / 0.95));
      for (let i = 0; i <= n; i++) { const s = a + (i / n) * along, q = p(s, 0); t.box('beam', 0.07, 2.1 - dado, 0.07, q.x, sill + (2.1 - dado) / 2, q.z, 1); }
      const pane = new THREE.PlaneGeometry(along, 2.1 - dado - 0.04);
      const m = new THREE.Matrix4().makeRotationY(side === 0 ? 0 : side === 1 ? Math.PI / 2 : side === 2 ? Math.PI : -Math.PI / 2).setPosition(c.x, (sill + head) / 2, c.z);
      t.glass.push(pane.applyMatrix4(m));
    }
    t.box('beam', side % 2 === 0 ? cab * 2 + 0.1 : 0.12, 0.08, side % 2 === 0 ? 0.12 : cab * 2 + 0.1, p(0, 0).x, sill, p(0, 0).z, 1);   // sill board
  }
  // the door's jambs above the dado line (the doorway itself is open)
  for (const x of [door.x0, door.x1]) t.box('beam', 0.09, 2.1, 0.12, x, deck + 1.05, -cab, 1);
  for (const [sx, sz] of corners) t.box('beam', 0.14, cabH + 0.05, 0.14, sx * cab, deck + cabH / 2, sz * cab, 1);
  t.box('beam', cab * 2 + 0.1, 0.05, cab * 2 + 0.1, 0, deck + cabH + 0.02, 0, 1); // ceiling
  // the hipped roof: four planked slopes up to a finial, the eaves out over the catwalk
  const eave = 3.0, rise = 1.45, roofY = deck + cabH + 0.04;
  const roof = new THREE.ConeGeometry(eave * Math.SQRT2, rise, 4, 1, true).rotateY(Math.PI / 4);
  boxUV(roof, 1.5);
  t.add('roof', roof, new THREE.Matrix4().makeTranslation(0, roofY + rise / 2, 0));
  const soffit = boxUV(new THREE.BoxGeometry(eave * 2, 0.04, eave * 2), 1.5);
  t.add('beam', soffit, new THREE.Matrix4().makeTranslation(0, roofY - 0.01, 0));
  t.add('iron', new THREE.CylinderGeometry(0.02, 0.03, 1.1, 6), new THREE.Matrix4().makeTranslation(0, roofY + rise + 0.45, 0));
  t.add('iron', new THREE.SphereGeometry(0.06, 8, 6), new THREE.Matrix4().makeTranslation(0, roofY + rise + 1.0, 0));
  // the fire finder on its pedestal (the vista bench is PH-C8's), by the cab's north wall
  t.box('beam', 0.18, 1.0, 0.18, 0.9, deck + 0.5, 1.45, 1);
  t.box('beam', 0.62, 0.05, 0.62, 0.9, deck + 1.02, 1.45, 1);
  t.add('iron', new THREE.CylinderGeometry(0.26, 0.26, 0.05, 20), new THREE.Matrix4().makeTranslation(0.9, deck + 1.07, 1.45));
  t.solid(0.9, 1.45, 0.31, 0.31, deck, deck + 1.05);

  // ── the zipline's launch: a railed plank jetty off the −Z deck edge, a two-post gantry with the cable's anchor ──
  const z0 = -deckHalf, z1 = -deckHalf - LAUNCH.out;
  t.box('deck', LAUNCH.half * 2, 0.07, LAUNCH.out, 0, deck - 0.035, (z0 + z1) / 2, 1.2);
  t.solid(0, (z0 + z1) / 2, LAUNCH.half, LAUNCH.out / 2, deck - 0.2, deck);
  t.floor(0, (z0 + z1) / 2, LAUNCH.half, LAUNCH.out / 2, deck);
  for (const sx of [-1, 1]) {
    const x = sx * (LAUNCH.half + 0.1);
    t.log(V(x, deck - 2.6, z0 + 0.2), V(x, deck - 0.15, z1 + 0.15), 0.09);                     // strut from the leg bay
    t.log(V(x, deck - 0.3, z1 + 0.1), V(x, deck + LAUNCH.gantry, z1 + 0.1), 0.12);               // gantry post
    t.beam(V(x, deck + railH, z0), V(x, deck + railH, z1 + 0.1), 0.07);
    t.solid(x, (z0 + z1) / 2, 0.05, LAUNCH.out / 2, deck, deck + railH + 0.05);
  }
  t.log(V(-LAUNCH.half - 0.35, deck + LAUNCH.gantry - 0.2, z1 + 0.1), V(LAUNCH.half + 0.35, deck + LAUNCH.gantry - 0.2, z1 + 0.1), 0.1);
  t.box('iron', 0.18, 0.28, 0.12, 0, deck + LAUNCH.cable + 0.08, z1 + 0.1, 1);                  // the cable's anchor block
  t.add('iron', new THREE.TorusGeometry(0.045, 0.012, 6, 12), new THREE.Matrix4().makeTranslation(0, deck + 0.95, z1 + 0.05)); // the gate chain's ring
  t.beam(V(-LAUNCH.half, deck + 0.95, z1 + 0.05), V(LAUNCH.half, deck + 0.95, z1 + 0.05), 0.03, 'iron');
  t.solid(0, z1 + 0.05, LAUNCH.half, 0.05, deck, deck + 1.0);   // the gate (the ride row opens it)
  return { zipTop: t.world(0, deck + LAUNCH.cable, z1 + 0.1), launch: t.world(0, deck, z1 + 0.5) };
}

// ───────────────────────────── the zipline's landing (the Hollow, N of the crossroads) ─────────────────────────────

function buildLanding(t: Timber): { zipBottom: V3; landing: V3 } {
  // the N road runs under the deck along local Z (the cable's line): the posts stand 3 m apart either side of it, the
  // X-bracing is on the road's sides only, and the stair comes down off the −X side, away from the road
  const { hx, hz, deck } = LANDING;
  const posts: [number, number][] = [[hx, hz], [-hx, hz], [-hx, -hz], [hx, -hz]];
  const g = (lx: number, lz: number): number => { const w = t.world(lx, 0, lz); return heightAt(w.x, w.z) - t.y; };
  for (const [px, pz] of posts) {
    t.log(V(px, g(px, pz) - 0.35, pz), V(px, deck + 1.05, pz), 0.15);
    t.solid(px, pz, 0.16, 0.16, g(px, pz) - 0.3, deck + 1.05);
  }
  for (const sx of [-1, 1]) {
    const x = sx * hx, ga = g(x, hz) + 0.35, gb = g(x, -hz) + 0.35;
    t.log(V(x, ga, hz), V(x, deck - 0.3, -hz), 0.07);
    t.log(V(x, gb, -hz), V(x, deck - 0.3, hz), 0.07);
    t.log(V(x, deck - 0.12, -hz - 0.2), V(x, deck - 0.12, hz + 0.2), 0.12);       // the beams the joists sit on
  }
  for (let i = 0; i < 4; i++) { const z = -hz + (i / 3) * hz * 2; t.box('beam', hx * 2 + 0.3, 0.16, 0.12, 0, deck - 0.2, z, 1); }
  t.box('deck', hx * 2 + 0.3, 0.07, hz * 2 + 0.3, 0, deck - 0.035, 0, 1.2);
  t.solid(0, 0, hx + 0.15, hz + 0.15, deck - 0.25, deck);
  t.floor(0, 0, hx + 0.15, hz + 0.15, deck);
  // rails: the +X side whole, the −X side either side of the stair's gap, the −Z end whole (the +Z end is the arrival)
  const rail = (a: V3, b: V3): void => {
    t.beam(V(a.x, deck + 1.0, a.z), V(b.x, deck + 1.0, b.z), 0.08);
    t.beam(V(a.x, deck + 0.5, a.z), V(b.x, deck + 0.5, b.z), 0.06);
    const c = a.clone().lerp(b, 0.5), len = a.distanceTo(b) / 2;
    if (Math.abs(a.x - b.x) > Math.abs(a.z - b.z)) t.solid(c.x, c.z, len, 0.05, deck, deck + 1.05); else t.solid(c.x, c.z, 0.05, len, deck, deck + 1.05);
  };
  const gap = 0.6;
  rail(V(hx, 0, -hz), V(hx, 0, hz));
  rail(V(-hx, 0, -hz), V(-hx, 0, -gap));
  rail(V(-hx, 0, gap), V(-hx, 0, hz));
  rail(V(-hx, 0, -hz), V(hx, 0, -hz));
  // the gantry: two posts at the +Z edge, a cross log, the cable's anchor + the buffer block the trolley meets
  for (const sx of [-1, 1]) t.log(V(sx * (hx - 0.2), deck - 0.3, hz + 0.05), V(sx * (hx - 0.2), deck + LANDING.gantry, hz + 0.05), 0.12);
  t.log(V(-hx - 0.1, deck + LANDING.gantry - 0.2, hz + 0.05), V(hx + 0.1, deck + LANDING.gantry - 0.2, hz + 0.05), 0.11);
  t.box('iron', 0.18, 0.28, 0.12, 0, deck + LANDING.cable + 0.08, hz + 0.05, 1);
  t.box('beam', 0.5, 0.7, 0.3, 0, deck + LANDING.cable - 0.9, hz - 0.1, 1);
  // the stair down off the −X side: as many risers as the ground asks (≤ 0.33 m each), 0.38 m treads
  const gFoot0 = g(-hx - 3.4, 0);
  const count = Math.max(3, Math.ceil((deck - gFoot0) / 0.33)), run = count * 0.38;
  const xTop = -hx - 0.15, xFoot = xTop - run, gf = g(xFoot, 0);
  t.treads(V(xFoot, gf, 0), V(xTop, deck, 0), 1.1, count);
  for (let i = 0; i < count - 1; i++) t.box('deck', 0.42, 0.05, 1.1, xFoot + 0.38 * (i + 0.5), gf + (deck - gf) * ((i + 1) / count) - 0.025, 0, 1.2);
  for (const sz of [-gap, gap]) {
    t.beam(V(xFoot, gf, sz), V(xTop, deck - 0.05, sz), 0.08);
    t.beam(V(xFoot + 0.2, gf + 0.95, sz), V(xTop, deck + 0.95, sz), 0.06);
    t.beam(V(xFoot + 0.2, gf - 0.2, sz), V(xFoot + 0.2, gf + 1.0, sz), 0.08);
    t.solidAlong(V(xFoot + 0.2, gf + 0.6, sz * 1.08), V(xTop, deck + 0.6, sz * 1.08), 0.04, 0.5);
  }
  return { zipBottom: t.world(0, deck + LANDING.cable, hz + 0.05), landing: t.world(0, deck, 0) };
}

/** the steel cable: a sagging chord from the lookout's launch gantry to the landing's (sag ≈ 1.2 % of the span) */
function zipCable(a: V3, b: V3, mats: Mats): THREE.Mesh {
  const span = a.distanceTo(b), sag = span * 0.012;
  const pts: V3[] = [];
  for (let i = 0; i <= 40; i++) { const t = i / 40; pts.push(a.clone().lerp(b, t).add(V(0, -4 * sag * t * (1 - t), 0))); }
  const geo = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 80, 0.022, 5, false);
  const mesh = new THREE.Mesh(geo, mats.iron);
  mesh.name = 'zipline-cable';
  return mesh;
}

// ───────────────────────────── the creek footbridge (the E road over the gully) ─────────────────────────────

function bridgeFrame(): { x: number; z: number; yaw: number; half: number } {
  // along the E road through the crossing: from its previous vertex to its next
  const i = E_ROAD.findIndex(([x, z]) => x === CREEK_BRIDGE.x && z === CREEK_BRIDGE.z);
  const a = E_ROAD[i - 1] ?? E_ROAD[0], b = E_ROAD[i + 1] ?? E_ROAD[1];
  const dx = (b?.[0] ?? 1) - (a?.[0] ?? 0), dz = (b?.[1] ?? 0) - (a?.[1] ?? 0);
  return { x: CREEK_BRIDGE.x, z: CREEK_BRIDGE.z, yaw: Math.atan2(-dz, dx), half: 12 };
}

function buildBridge(t: Timber, half: number): void {
  const g = (lx: number, lz: number): number => { const w = t.world(lx, 0, lz); return heightAt(w.x, w.z) - t.y; };
  const yA = g(-half, 0) + 0.25, yB = g(half, 0) + 0.25;
  const deckAt = (s: number): number => yA + (yB - yA) * ((s + half) / (half * 2));
  const W = 1.9;
  // two stringer logs, split-plank deck across them
  for (const z of [-0.55, 0.55]) t.log(V(-half - 0.3, deckAt(-half) - 0.3, z), V(half + 0.3, deckAt(half) - 0.3, z), 0.22, 'bark', 12);
  const n = Math.round((half * 2) / 0.27);
  for (let i = 0; i < n; i++) {
    const s = -half + (i + 0.5) * ((half * 2) / n);
    t.box('deck', 0.25, 0.08, W + t.rng.range(-0.1, 0.1), s, deckAt(s) - 0.04, t.rng.range(-0.04, 0.04), 1.2, t.rng.range(-0.03, 0.03));
  }
  // the deck's collider: one box along the slope
  t.solidAlong(V(-half, deckAt(-half) - 0.1, 0), V(half, deckAt(half) - 0.1, 0), W / 2, 0.1);
  t.floor(0, 0, half, W / 2, (yA + yB) / 2);
  // trestles in the gully (where the ground falls a metre or more below the stringers)
  for (const s of [-8, -2.5, 3, 8.5]) {
    const top = deckAt(s) - 0.52, gl = Math.min(g(s, -0.7), g(s, 0.7));
    if (top - gl < 0.8) continue;
    for (const z of [-0.7, 0.7]) { t.log(V(s, gl - 0.4, z * 1.25), V(s, top, z), 0.14, 'bark'); t.solid(s, z * 1.1, 0.16, 0.16, gl - 0.4, top); }
    t.log(V(s, top - 0.05, -1.05), V(s, top - 0.05, 1.05), 0.13, 'bark');
    if (top - gl > 2.2) { t.log(V(s, gl + 0.5, -0.85), V(s, top - 0.3, 0.75), 0.07, 'bark'); t.log(V(s, gl + 0.5, 0.85), V(s, top - 0.3, -0.75), 0.07, 'bark'); }
  }
  // abutments: a crib of cross logs under each end
  for (const [s, y] of [[-half, yA], [half, yB]] as const) for (let k = 0; k < 2; k++) t.log(V(s + (s < 0 ? 0.3 : -0.3) * k, y - 0.55 - k * 0.3, -1.2), V(s + (s < 0 ? 0.3 : -0.3) * k, y - 0.55 - k * 0.3, 1.2), 0.16, 'bark');
  // the handrails: log posts every ~3 m on both sides, a peeled log rail
  const m = Math.round((half * 2) / 3);
  for (const z of [-W / 2 - 0.05, W / 2 + 0.05]) {
    for (let i = 0; i <= m; i++) { const s = -half + 0.2 + (i / m) * (half * 2 - 0.4); t.log(V(s, deckAt(s) - 0.35, z), V(s, deckAt(s) + 1.0, z), 0.07); }
    t.log(V(-half + 0.1, deckAt(-half) + 0.95, z), V(half - 0.1, deckAt(half) + 0.95, z), 0.06);
    t.solidAlong(V(-half, deckAt(-half) + 0.5, z), V(half, deckAt(half) + 0.5, z), 0.05, 0.55);
  }
}

// ───────────────────────────── the image-to-3D hero props ─────────────────────────────

/** every prop the landmarks can place (src/world/pineHero.ts lists the ones built so far: the rest are skipped) */
type HeroId = PineHeroId;
interface Place { x: number; y: number; z: number; yaw: number; scale: number; pitch?: number; roll?: number }
/**
 * the turn that brings each generation's front (the face the reference showed: the carved glyphs, the lantern's arm, the
 * board's notices, the arch's mouth) to local +Z — TRELLIS keeps the reference camera's side, but not always the same way
 * round (read off render_still.py turntables of every build)
 */
const FRONT: Record<HeroId, number> = { 'stone-a': Math.PI, 'stone-b': 0, 'stone-c': 0, waystone: 0, 'beaver-dam': 0, canoe: 0, 'contract-board': 0, 'cave-arch': 0 };
interface HeroLod { geometry: THREE.BufferGeometry; material: THREE.Material; box: THREE.Box3 }

const gltf = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
/** the meshopt build quantizes (normalized int16 positions under a scaled node): back to float before a matrix is baked in,
 *  or `applyMatrix4` clamps every position to the unit box */
function dequantize(g: THREE.BufferGeometry): THREE.BufferGeometry {
  for (const name of Object.keys(g.attributes)) {
    const a = g.getAttribute(name);
    if (a.array instanceof Float32Array && !a.normalized && !('isInterleavedBufferAttribute' in a)) continue;
    const f = new Float32Array(a.count * a.itemSize);
    for (let i = 0; i < a.count; i++) for (let k = 0; k < a.itemSize; k++) f[i * a.itemSize + k] = a.getComponent(i, k);
    g.setAttribute(name, new THREE.BufferAttribute(f, a.itemSize));
  }
  return g;
}
async function loadHero(id: string, sky: Sky): Promise<HeroLod | null> {
  try {
    const g = await gltf.loadAsync(pineHeroUrl(id));
    let found: HeroLod | null = null;
    g.scene.updateMatrixWorld(true);
    g.scene.traverse((o) => {
      if (found !== null || !('isMesh' in o)) return;
      const mesh = o as THREE.Mesh;
      const material = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
      if (!material) return;
      const geometry = dequantize(mesh.geometry.clone()).applyMatrix4(mesh.matrixWorld);
      geometry.computeBoundingBox();
      if (material instanceof THREE.MeshStandardMaterial) {
        for (const t of [material.map, material.normalMap]) if (t) t.anisotropy = 4;
        material.envMapIntensity = 0.8;
      }
      sky.setupMaterial(material);
      found = { geometry, material, box: geometry.boundingBox ?? new THREE.Box3() };
    });
    return found;
  } catch (e: unknown) {
    console.warn(`[landmarks] ${id} did not load`, e);
    return null;
  }
}

const placeMatrix = (p: Place): THREE.Matrix4 => new THREE.Matrix4().compose(
  V(p.x, p.y, p.z), new THREE.Quaternion().setFromEuler(new THREE.Euler(p.pitch ?? 0, p.yaw, p.roll ?? 0, 'YXZ')), V(p.scale, p.scale, p.scale));

/** one prop type: an InstancedMesh per LOD, LOD1 beyond `lodDist` from the nearest instance, gone past `far` */
class HeroSet {
  readonly lod0: THREE.InstancedMesh;
  readonly lod1: THREE.InstancedMesh | null;
  private on = -1;
  constructor(readonly places: Place[], l0: HeroLod, l1: HeroLod | null, private lodDist: number, private far: number, shadows: boolean) {
    const mk = (l: HeroLod): THREE.InstancedMesh => {
      const im = new THREE.InstancedMesh(l.geometry, l.material, places.length);
      places.forEach((p, i) => { im.setMatrixAt(i, placeMatrix(p)); });
      im.instanceMatrix.needsUpdate = true;
      im.computeBoundingSphere();
      im.castShadow = shadows; im.receiveShadow = true;
      return im;
    };
    this.lod0 = mk(l0);
    this.lod0.castShadow = shadows;
    // the decimated LOD1's own base-centre pivot can land off LOD0's (a lopsided stone): line its bounds up with LOD0's
    if (l1) {
      const c0 = l0.box.getCenter(new THREE.Vector3()), c1 = l1.box.getCenter(new THREE.Vector3());
      l1.geometry.translate(c0.x - c1.x, 0, c0.z - c1.z);
      l1.box.translate(V(c0.x - c1.x, 0, c0.z - c1.z));
    }
    this.lod1 = l1 ? mk(l1) : null;
    if (this.lod1) { this.lod1.visible = false; this.lod1.castShadow = false; } // past lodDist its shadow is a few pixels
  }
  update(cam: V3): void {
    let d2 = Infinity;
    for (const p of this.places) d2 = Math.min(d2, (p.x - cam.x) ** 2 + (p.z - cam.z) ** 2);
    const d = Math.sqrt(d2);
    const state = d > this.far ? 2 : d > this.lodDist && this.lod1 ? 1 : 0;
    if (state === this.on) return;
    this.on = state;
    this.lod0.visible = state === 0;
    if (this.lod1) this.lod1.visible = state === 1;
  }
}

/** a convex hull collider per placed instance, from the prop's (LOD1) vertices */
function hullDescs(l: HeroLod, places: Place[], surface: 'stone' | 'wood' | 'rock', maxPts = 180): ColliderDesc[] {
  const pos = l.geometry.getAttribute('position');
  const step = Math.max(1, Math.floor(pos.count / maxPts));
  const out: ColliderDesc[] = [];
  const v = new THREE.Vector3();
  for (const p of places) {
    const m = placeMatrix(p), pts = new Float32Array(Math.ceil(pos.count / step) * 3);
    let k = 0;
    for (let i = 0; i < pos.count; i += step) { v.fromBufferAttribute(pos, i).applyMatrix4(m); pts[k++] = v.x - p.x; pts[k++] = v.y - p.y; pts[k++] = v.z - p.z; }
    out.push({ kind: 'hull', x: p.x, y: p.y, z: p.z, points: pts.subarray(0, k), surface });
  }
  return out;
}

// the sites: layout coordinates → placements (the props' own orientation is fixed in their build: front toward −Z…
// TRELLIS faces the reference's camera down +Z; `front` turns that face toward the given yaw)
const ground = (x: number, z: number): number => heightAt(x, z);
const faceYaw = (fromX: number, fromZ: number, toX: number, toZ: number): number => Math.atan2(toX - fromX, toZ - fromZ);

/** where the lookout trail comes in (its second-last vertex) */
const LOOKOUT_TRAIL_IN: [number, number] = (SPURS['lookout'] ?? [])[3] ?? [76, 196];

export type WaystoneId = 'pond' | 'ridge' | 'den';
/** the three waystone lanterns (PH-C1): the pond's W shore by the pond spur, the ridge by the lookout's stair door, the den's cave mouth */
export function waystoneSites(): Record<WaystoneId, { x: number; z: number; yaw: number }> {
  const pondSpur = SPURS['pond'] ?? [];
  const pp = pondSpur[2] ?? [-60, 98];
  const px = pp[0] - 3.2, pz = pp[1] + 5.5;             // a step off the spur toward the water
  const c = Math.cos(ZIP_YAW), s = Math.sin(ZIP_YAW);
  const rx = LOOKOUT.x + 6.0 * c + 1.6 * s, rz = LOOKOUT.z - 6.0 * s + 1.6 * c;      // tower-local (6.0, 1.6): by the stair door, off the trail's line
  const fx = -Math.sin(BEAR_CAVE.rot), fz = -Math.cos(BEAR_CAVE.rot);            // the cave mouth faces (fx, fz)
  const dx = BEAR_CAVE.x + fx * 4.5 + fz * 3.4, dz = BEAR_CAVE.z + fz * 4.5 - fx * 3.4;
  // each lantern's arm reaches out over the way you come
  return {
    pond: { x: px, z: pz, yaw: faceYaw(px, pz, pp[0], pp[1]) },
    ridge: { x: rx, z: rz, yaw: faceYaw(rx, rz, LOOKOUT_TRAIL_IN[0], LOOKOUT_TRAIL_IN[1]) },
    den: { x: dx, z: dz, yaw: faceYaw(dx, dz, dx + fx, dz + fz) },
  };
}

// ───────────────────────────── the whole set ─────────────────────────────

export interface PineLandmarksHandle {
  group: THREE.Group;
  /** the zipline's cable ends (world) and where you stand to ride / where you land */
  zip: { top: V3; bottom: V3; launch: V3; landing: V3 };
  setLit: (id: WaystoneId, on: boolean) => void;
  isLit: (id: WaystoneId) => boolean;
  floorHeightAt: (x: number, z: number) => number | undefined;
}

export class PineLandmarks implements PineLandmarksHandle {
  readonly group = new THREE.Group();
  zip = { top: V(0, 0, 0), bottom: V(0, 0, 0), launch: V(0, 0, 0), landing: V(0, 0, 0) };
  /** the timber builds' colliders, then the props' (split so the phone's per-task collider budget holds) */
  readonly timberColliders: ColliderDesc[] = [];
  readonly propColliders: ColliderDesc[] = [];
  private floors: Floor[] = [];
  private timbers: { t: Timber; pad: number; detailOn: boolean; farOn: boolean }[] = [];
  private sets: HeroSet[] = [];
  private lit: Record<WaystoneId, boolean> = { pond: true, ridge: true, den: true };
  private glow: THREE.Points | null = null;
  private glowMat: THREE.PointsMaterial | null = null;
  private anchors: Record<WaystoneId, THREE.Object3D> | null = null;
  private tmp = new THREE.Vector3();

  constructor(private sky: Sky) { this.group.name = 'pine-landmarks'; }

  async build(cabins: Cabins | null): Promise<this> {
    const mats = await cabinMats(this.sky);
    // the timber landmarks, one task each
    const lookout = new Timber('fire-lookout', LOOKOUT.x, ground(LOOKOUT.x, LOOKOUT.z), LOOKOUT.z, ZIP_YAW, 901, this.timberColliders, this.floors);
    const top = buildLookout(lookout);
    this.addTimber(lookout, mats, 6);
    await macrotask();
    const landing = new Timber('zipline-landing', ZIPLINE.to.x, ground(ZIPLINE.to.x, ZIPLINE.to.z), ZIPLINE.to.z, ZIP_YAW, 902, this.timberColliders, this.floors);
    const bottom = buildLanding(landing);
    this.addTimber(landing, mats, 4);
    this.zip = { top: top.zipTop, bottom: bottom.zipBottom, launch: top.launch, landing: bottom.landing };
    const cable = zipCable(top.zipTop, bottom.zipBottom, mats);
    this.group.add(cable);
    await macrotask();
    const bf = bridgeFrame();
    const bridge = new Timber('creek-footbridge', bf.x, (ground(bf.x - bf.half, bf.z) + ground(bf.x + bf.half, bf.z)) / 2, bf.z, bf.yaw, 903, this.timberColliders, this.floors);
    buildBridge(bridge, bf.half);
    this.addTimber(bridge, mats, bf.half);
    await macrotask();
    await this.buildProps(cabins);
    return this;
  }

  private addTimber(t: Timber, mats: Mats, pad: number): void {
    t.finish(mats);
    if (!TIER_CONFIG.cabinDetailShadows) for (const o of t.detail) o.traverse((c) => { c.castShadow = false; });
    this.group.add(t.root);
    this.timbers.push({ t, pad, detailOn: true, farOn: false });
  }

  private async buildProps(cabins: Cabins | null): Promise<void> {
    const ids: readonly HeroId[] = PINE_HERO_IDS;
    const loaded = await Promise.all(ids.flatMap((id) => [loadHero(id, this.sky), loadHero(`${id}-lod1`, this.sky)]));
    const lod = (id: HeroId): [HeroLod | null, HeroLod | null] => { const i = ids.indexOf(id); return i === -1 ? [null, null] : [loaded[i * 2] ?? null, loaded[i * 2 + 1] ?? null]; };
    // the props' own draw distance: the forest props' (phone 220 m), capped at 260 m on desktop — a 3 m stone is a few
    // pixels there, and desktop's 700 m kept every set (and its shadows) drawn from anywhere on the slab
    const far = Math.min(TIER_CONFIG.propsFar, 260);
    const add = (id: HeroId, places: Place[], lodDist: number, shadows: boolean, surface: 'stone' | 'wood' | 'rock', collide = true): HeroSet | null => {
      const [l0, l1] = lod(id);
      if (!l0 || places.length === 0) return null;
      const turned = places.map((p) => ({ ...p, yaw: p.yaw + FRONT[id] }));
      const set = new HeroSet(turned, l0, l1, lodDist, far, shadows);
      this.group.add(set.lod0); if (set.lod1) this.group.add(set.lod1);
      this.sets.push(set);
      if (collide) this.propColliders.push(...hullDescs(l1 ?? l0, turned, surface));
      return set;
    };
    const rng = new Rng(SEED + 907);

    // the King's standing stones: three shapes round the ring, each turned to face the arena, leaning a little
    const kinds: HeroId[] = ['stone-a', 'stone-c', 'stone-b'];
    const byKind = new Map<HeroId, Place[]>();
    STANDING_STONES.forEach(([x, z], i) => {
      const k = kinds[i % 3] ?? 'stone-a';
      const list = byKind.get(k) ?? [];
      // half as big again as the references (3–3.5 m → 4.5–5 m): the old-growth's giants dwarfed them at human size
      list.push({ x, y: ground(x, z) - 0.5, z, yaw: faceYaw(x, z, KINGS_CLEARING.x, KINGS_CLEARING.z) + rng.range(-0.25, 0.25), scale: rng.range(1.35, 1.6), pitch: rng.range(-0.06, 0.06), roll: rng.range(-0.07, 0.07) });
      byKind.set(k, list);
    });
    for (const [k, list] of byKind) add(k, list, 60, true, 'stone');

    // the waystones
    const ws = waystoneSites();
    const wsPlaces = (['pond', 'ridge', 'den'] as const).map((id): Place => {
      const s = ws[id];
      const onDeck = this.floorHeightAt(s.x, s.z);
      return { x: s.x, y: (onDeck ?? ground(s.x, s.z)) - 0.15, z: s.z, yaw: s.yaw, scale: 1 };
    });
    const waySet = add('waystone', wsPlaces, 45, true, 'stone');
    if (waySet) this.lanterns(waySet, cabins);

    // the beaver dam across the creek on the pond's sill, the canoe drawn up on the W shore facing the islet
    const d0 = CREEK[BEAVER_DAM.at - 1], d1 = CREEK[BEAVER_DAM.at + 1];
    // the dam's length is the model's X: turned so its Z runs with the flow, it lies across the creek; sunk so it stands
    // ~1.3 m over the pond's water line at the sill
    const flow = d0 && d1 ? Math.atan2(d1[0] - d0[0], d1[1] - d0[1]) : 0;
    add('beaver-dam', [{ x: BEAVER_DAM.x, y: ground(BEAVER_DAM.x, BEAVER_DAM.z) - 0.45, z: BEAVER_DAM.z, yaw: flow, scale: 1 }], 50, true, 'wood');
    const cx = -67.8, cz = 119;                                     // its bow (local +Z) out toward the islet (−X), its stern up the bank
    const bowH = Math.max(ground(cx - 2.3, cz), POND.level), sternH = Math.max(ground(cx + 2.3, cz), POND.level);
    add('canoe', [{ x: cx, y: (bowH + sternH) / 2 - 0.05, z: cz, yaw: -Math.PI / 2, scale: 1, pitch: Math.atan2(sternH - bowH, 4.6) * 0.85 }], 40, true, 'wood');

    // the lodge's contract board, beside its porch steps, facing the way in
    const L = HAMLET_SITES.lodge, fyaw = L.rot;
    const fx = -Math.sin(fyaw), fz = -Math.cos(fyaw), rx = Math.cos(fyaw), rz = -Math.sin(fyaw);   // front, and its right hand
    const bx = L.x + fx * (3.5 + 2.6 + 1.4) + rx * 4.2, bz = L.z + fz * (3.5 + 2.6 + 1.4) + rz * 4.2;
    add('contract-board', [{ x: bx, y: ground(bx, bz) - 0.1, z: bz, yaw: fyaw + Math.PI, scale: 1 }], 40, true, 'wood');

    // the bear cave's mouth: the rock arch set into the den wall, a dark plane just inside its opening
    const cyaw = BEAR_CAVE.rot, cfx = -Math.sin(cyaw), cfz = -Math.cos(cyaw);
    const ax = BEAR_CAVE.x - cfx * 1.2, az = BEAR_CAVE.z - cfz * 1.2;
    const arch = add('cave-arch', [{ x: ax, y: ground(BEAR_CAVE.x, BEAR_CAVE.z) - 0.45, z: az, yaw: cyaw + Math.PI, scale: 1.4 }], 70, true, 'rock', false);
    const [archL0, archL1] = lod('cave-arch');
    const archLod = archL1 ?? archL0;
    if (arch && archLod) {
      const b = archLod.box, w = b.max.x - b.min.x, h = b.max.y - b.min.y, d = b.max.z - b.min.z;
      const p = arch.places[0];
      if (p) {
        // the rock round the opening: two jambs and a lintel (the interior is a later row: the mouth is closed for now)
        const place = (lx: number, ly: number, lz: number): V3 => V(lx, ly, lz).applyMatrix4(placeMatrix(p));
        const qy = p.yaw, k = p.scale;
        for (const s of [-1, 1]) { const c = place(s * w * 0.36, h * 0.5, 0); this.propColliders.push({ kind: 'box', x: c.x, y: c.y, z: c.z, hx: w * 0.14 * k, hy: h * 0.5 * k, hz: d * 0.45 * k, yaw: qy, surface: 'rock' }); }
        const lt = place(0, h * 0.86, 0); this.propColliders.push({ kind: 'box', x: lt.x, y: lt.y, z: lt.z, hx: w * 0.5 * k, hy: h * 0.14 * k, hz: d * 0.45 * k, yaw: qy, surface: 'rock' });
        const back = place(0, h * 0.4, -d * 0.1); this.propColliders.push({ kind: 'box', x: back.x, y: back.y, z: back.z, hx: w * 0.24 * k, hy: h * 0.4 * k, hz: 0.3 * k, yaw: qy, surface: 'rock' });
        const darkMat = new THREE.MeshStandardMaterial({ color: 0x040404, roughness: 1, metalness: 0 }); // the chinking's program
        this.sky.setupMaterial(darkMat);
        const dark = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.5, h * 0.72), darkMat);
        const dp = place(0, h * 0.36, d * 0.05);
        dark.position.copy(dp); dark.rotation.y = qy; dark.scale.setScalar(k);
        dark.name = 'bear-cave-dark';
        this.group.add(dark);
      }
    }
  }

  /** the waystones' flames (emissive, one instanced draw) and their glow (one Points draw), both on sky.lamps */
  private lanterns(set: HeroSet, cabins: Cabins | null): void {
    // the lantern hangs off the bracket: the model's vertex cloud furthest from the post, in the top half
    const geo = set.lod0.geometry, pos = geo.getAttribute('position');
    geo.computeBoundingBox();
    const bb = geo.boundingBox ?? new THREE.Box3();
    const h = bb.max.y - bb.min.y;
    let px = 0, pz = 0, pn = 0;
    const v = new THREE.Vector3();
    for (let i = 0; i < pos.count; i++) { v.fromBufferAttribute(pos, i); if (v.y < bb.min.y + h * 0.3) { px += v.x; pz += v.z; pn++; } }
    px /= Math.max(1, pn); pz /= Math.max(1, pn);
    let far = 0;
    for (let i = 0; i < pos.count; i++) { v.fromBufferAttribute(pos, i); if (v.y > bb.min.y + h * 0.5) far = Math.max(far, Math.hypot(v.x - px, v.z - pz)); }
    const lamp = new THREE.Vector3(); let ln = 0;
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i);
      if (v.y > bb.min.y + h * 0.45 && Math.hypot(v.x - px, v.z - pz) > far * 0.7) { lamp.add(v); ln++; }
    }
    if (ln === 0) lamp.set(px, bb.min.y + h * 0.7, pz); else lamp.divideScalar(ln);
    const glowPos = new Float32Array(set.places.length * 3);
    const anchors = {} as Record<WaystoneId, THREE.Object3D>;
    const ids: WaystoneId[] = ['pond', 'ridge', 'den'];
    set.places.forEach((p, i) => {
      const w = lamp.clone().applyMatrix4(placeMatrix(p));
      glowPos.set([w.x, w.y, w.z], i * 3);
      const id = ids[i];
      if (id) { const a = new THREE.Object3D(); a.position.copy(w); this.group.add(a); anchors[id] = a; }
    });
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(glowPos, 3));
    // the flame: one additive point per lantern (the lantern's own glass is in its baked texture), bright core, soft halo
    this.glowMat = new THREE.PointsMaterial({ map: makeGlowTexture(), color: 0xffa050, size: 0.95, sizeAttenuation: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
    this.glow = new THREE.Points(g, this.glowMat);
    this.glow.name = 'waystone-glow';
    this.glow.renderOrder = 6;
    this.group.add(this.glow);
    this.anchors = anchors;
    if (cabins) for (const id of ids) { const a = anchors[id]; cabins.addLampSite(a, 0xffb060, 9, 12, () => this.lit[id]); }
  }

  setLit(id: WaystoneId, on: boolean): void {
    this.lit[id] = on;
    const i = (['pond', 'ridge', 'den'] as const).indexOf(id);
    const pos = this.glow?.geometry.getAttribute('position');
    if (pos && this.anchors) { const a = this.anchors[id]; pos.setY(i, on ? a.position.y : -1e4); pos.needsUpdate = true; }
  }
  isLit(id: WaystoneId): boolean { return this.lit[id]; }

  floorHeightAt(x: number, z: number): number | undefined {
    let best: number | undefined;
    for (const f of this.floors) {
      const c = Math.cos(f.rot), s = Math.sin(f.rot);
      const lx = (x - f.x) * c - (z - f.z) * s, lz = (x - f.x) * s + (z - f.z) * c;
      if (Math.abs(lx) <= f.hw && Math.abs(lz) <= f.hd && (best === undefined || f.y > best)) best = f.y;
    }
    return best;
  }

  update(t: number): void {
    const cam = this.sky.viewCamera; cam.getWorldPosition(this.tmp);
    const dd = TIER_CONFIG.cabinDetailDist;
    for (const e of this.timbers) {
      const d = Math.max(0, this.tmp.distanceTo(e.t.root.position) - e.pad);
      const on = d < dd, farOff = d > dd * 2;
      if (on !== e.detailOn) { e.detailOn = on; for (const o of e.t.detail) o.visible = on; }
      if (farOff !== e.farOn) { e.farOn = farOff; for (const o of e.t.far) o.visible = !farOff; }
    }
    for (const s of this.sets) s.update(this.tmp);
    // the lanterns on the clock (PH-L3): a banked ember by day, full flame at night, a slow flicker
    const lamps = this.sky.lamps;
    if (this.glowMat && this.glow && this.anchors) {
      // a banked ember by day, the full flame at night, a slow flicker; past 150 m (or none lit) it is not drawn at all
      this.glowMat.opacity = (0.1 + 0.9 * lamps) * (1 + 0.1 * Math.sin(t * 9.3) + 0.05 * Math.sin(t * 23.1));
      let near = Infinity;
      for (const id of ['pond', 'ridge', 'den'] as const) if (this.lit[id]) near = Math.min(near, this.anchors[id].position.distanceToSquared(this.tmp));
      this.glow.visible = near < 150 * 150;
    }
  }
}

/**
 * Build Pine Hollow's landmarks, register them (drawn, colliding, the decks as floors) and keep them updated. The hamlet's
 * buildings are not here: `new Cabins(sky, pineHamletBuildings())` builds them with the cabins.
 */
export async function installPineLandmarks(h: { sky: Sky; registry: WorldRegistry; cabins: Cabins | null; onUpdate: (fn: (dt: number, t: number) => void) => void }): Promise<PineLandmarks> {
  const lm = await new PineLandmarks(h.sky).build(h.cabins);
  h.registry.add({ id: 'pine-landmarks', name: 'Fire lookout, zipline, footbridge', category: 'buildings', file: 'src/world/PineLandmarks.ts', object: lm.group,
    colliders: lm.timberColliders, surface: 'wood', floor: (x, z) => lm.floorHeightAt(x, z), solidFloor: true });
  await macrotask();
  h.registry.add({ id: 'pine-landmark-props', name: 'Standing stones, waystones, dam, canoe, cave', category: 'props', file: 'src/world/PineLandmarks.ts', colliders: lm.propColliders, surface: 'stone' });
  h.onUpdate((_dt, t) => { lm.update(t); });
  return lm;
}
