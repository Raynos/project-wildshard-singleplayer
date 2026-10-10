/**
 * The fire lookout built (E315 M2; PINE-HOLLOW-REMASTER PH-B3; G285: an offline bake). Build-time only:
 * `src/shards/pine-hollow/generators/bake-pine-lookout.mjs` runs `bakeFireLookout` on the cabins' timber kit (../world/timber.ts) and writes what the
 * builder leaves (each material's parts, the glass, the colliders, deck floors and anchors) to
 * `public/assets/pine-hollow/baked/lookout.bin` + `../data/lookout.json`; the page finishes the timber from them
 * (../models/fireLookout.ts) and never runs this. test/shards/pine-hollow/lookout-bake.test.ts is the stale gate. The
 * timber's stream is the level seed's (1337, the page's engine SEED while the landmarks build) + 901.
 *
 * Four splayed peeled-log legs with girts and X-bracing, a stair of five flights inside a railed cage (treads the
 * character climbs), a 6 m deck with a railing, the glazed cab with a hipped moss roof, and the zipline's launch jutting
 * off the deck. Its frame: local -Z faces down the cable to the landing, local +X the trail's arrival (the stair's door);
 * the origin on the crag-top pad.
 */
import * as THREE from 'three';
import { SEED } from '@wildshard/engine/core/config';
import { boxUV } from '../world/logKit';
import { ZIPLINE } from '../layout';
import { TimberBuilder, V } from './timberKit';
import { LOOKOUT_SEED, type LookoutRows } from '../models/fireLookout';
import { TimberRecorder } from './timberBake';

type V3 = THREE.Vector3;

/** tower frame: local −Z faces the zipline's landing (the launch side), local +X the trail's arrival (the stair's door) */
const TOWER = { base: 3.0, top: 2.1, deck: ZIPLINE.from.deck, deckHalf: 3.4, cab: 2.4, cabH: 2.3, flights: 5, flightRise: ZIPLINE.from.deck / 5, riser: 7, tread: 0.36, stairHalf: 1.26, landing: 0.9 } as const;
const LAUNCH = { half: 0.8, out: 1.4, gantry: 3.6, cable: 3.3 };

function buildLookout(t: TimberBuilder): void {
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
  t.anchors['zipTop'] = V(0, deck + LAUNCH.cable, z1 + 0.1); t.anchors['launch'] = V(0, deck, z1 + 0.5);
}

/** The bake: the lookout built at the level seed, its parts' and glass's attribute blocks in one binary, the rest as rows. */
export function bakeFireLookout(): { bin: Uint8Array; rows: Omit<LookoutRows, 'bin' | 'bytes'> } {
  const t = new TimberBuilder(LOOKOUT_SEED);
  buildLookout(t);
  const recorder = new TimberRecorder();
  const row = recorder.record(t);
  return { bin: recorder.bin(), rows: { seed: SEED, ...row } };
}
