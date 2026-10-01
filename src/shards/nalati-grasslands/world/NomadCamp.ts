/**
 * NomadCamp — the spring camp (kystau) in the Kunes valley, the shard's hub (map-01 "NOMAD CAMP", (95, 205)).
 * Six white felt yurts in an arc round a yard that opens east toward the N road; a round pole corral to the west;
 * the hitching rail on the road side where TULPAR waits (`HITCHING_RAIL`); an eagle perch (a lashed tripod with a
 * T-bar) with a static golden eagle; a ribbon pole in the yard streaming seven colours; felt rugs drying on a rack
 * and laid at two doors; an iron stove and a kazan on a tripod, both smoking; a cart, barrels, chests, a woodpile,
 * a saddle rack, a water trough and a hay pile.
 *
 *   const camp = buildNomadCamp(ctx);      // PoiPiece: the camp registers itself (`register`: one `place` per model)
 *
 * E306 / E315 second pass: the camp places models (src/shards/nalati-grasslands/models/: yurt.ts, campProps.ts,
 * campGenerated.ts) through a NalatiSet (./painted.ts), in the old builder's order — the code models painted into the
 * camp's one mesh (+ its felt and timber layers), the generated GLBs (kazan, chests, woodpile, churns, ground saddles,
 * the eagle) one InstancedMesh per model, added when they have loaded — and NalatiPOIs names them the Spring camp set.
 * The ribbons / pennants go into `ctx.flutter`, the plumes into `ctx.smoke`; the trodden earth of the yard is a decal
 * draped over the terrain (./Yard.ts: world, welded to the ground).
 * Terrain request: a flat pad r 30 at (95, 205) (the valley floor, ≈ −8).
 */
import * as THREE from 'three';
import { PaintKit, v3 } from './paint';
import { NalatiSet } from './painted';
import { buildYardDecal, wearDisc, wearPath } from './Yard';
import { CAMP, CORRAL, HITCHING_RAIL } from './layout';
import type { Box } from './solid';
import type { PoiCtx, PoiPiece } from './types';
import { yurt } from '../models/yurt';
import {
  ribbonPole, eaglePerch, EAGLE_PERCH_H, stove, campBench, rugRack, feltRug, cart, barrel, hitchingRail, waterTrough, saddleRack,
  corral, hayPile, feedTrough, rugLine, choppingBlock, milkCans,
} from '../models/campProps';
import { kazan, chest, firewood, kumisChurn, groundSaddle, perchedEagle } from '../models/campGenerated';

/** the yurts: angle round the yard (deg, 0 = +x/west, 90 = +z/north), distance, radius, flue, palette */
const YURTS: { a: number; d: number; r: number; flue: boolean; pal: number; old?: boolean; base: 'lattice' | 'reed' | 'felt' }[] = [
  { a: 128, d: 13.5, r: 3.0, flue: true, pal: 0, base: 'lattice' },
  { a: 88, d: 14.5, r: 3.5, flue: true, pal: 1, base: 'reed' },      // the big one (the host's)
  { a: 46, d: 13.0, r: 2.8, flue: false, pal: 2, old: true, base: 'felt' },
  { a: 2, d: 13.5, r: 3.1, flue: true, pal: 0, base: 'lattice' },
  { a: -44, d: 13.0, r: 2.7, flue: false, pal: 1, base: 'reed' },
  { a: -92, d: 13.5, r: 3.2, flue: false, pal: 2, base: 'lattice' },
];

export function buildNomadCamp(ctx: PoiCtx): PoiPiece {
  const { sky, ground, smoke } = ctx;
  const kit = new PaintKit(0x7a17);
  const set = new NalatiSet(kit, ctx);
  const rng = kit.rng;
  const cx = CAMP.x, cz = CAMP.z;
  const on = (x: number, z: number, yaw = 0) => ({ x, y: ground(x, z), z, yaw });

  // ── yurts ──
  const doors: { x: number; z: number; rot: number; r: number }[] = [];
  for (const y of YURTS) {
    const a = (y.a * Math.PI) / 180;
    const x = cx + Math.cos(a) * y.d, z = cz + Math.sin(a) * y.d;
    // door toward the yard (with a little irregularity)
    const fx = cx - x, fz = cz - z;
    const rot = Math.atan2(-fx, -fz) + rng.range(-0.18, 0.18);
    // stand on the lowest point of the footprint so no edge floats; the wall skirt runs 0.25 m into the ground
    let gy = Infinity;
    for (let k = 0; k < 8; k++) { const t = (k / 8) * Math.PI * 2; gy = Math.min(gy, ground(x + Math.cos(t) * y.r, z + Math.sin(t) * y.r)); }
    gy = Math.min(gy, ground(x, z));
    // a pennant at the crown of every other yurt
    set.paint(yurt, { x, y: gy, z, yaw: rot }, { r: y.r, flue: y.flue, palette: y.pal, old: y.old ?? false, base: y.base, pennant: y.pal !== 2 });
    doors.push({ x, z, rot, r: y.r });
  }

  // ── the ribbon pole in the yard; the eagle perch, the eagle facing the road (east) ──
  set.paint(ribbonPole, on(cx + 1.5, cz - 0.5), {});
  {
    const at = on(cx - 9, cz + 1.5);
    set.paint(eaglePerch, at, {});
    set.instance(perchedEagle, { x: at.x + 0.05, y: at.y + EAGLE_PERCH_H + 0.12, z: at.z, rot: Math.PI / 2 + 0.35 }, {});
  }

  // ── cooking: the stove and the kazan in the yard, smoking; the woodpile; a low bench by the kazan ──
  set.paint(stove, on(cx + 4.5, cz - 5.5, 0.4), {});
  {
    const x = cx - 3.2, z = cz - 6.2, y = ground(x, z);
    set.instance(kazan, { x, y, z, rot: 0.4 }, {});
    smoke.emitter(v3(x, y + 0.9, z), { puffs: 28, rise: 4.5, size: [0.5, 3.0], life: 6 });
  }
  {
    // two birch stacks side by side along the pile; the pile's one box
    const x = cx + 8.5, z = cz - 3, yaw = 0.9, cs = Math.cos(yaw), sn = Math.sin(yaw);
    const pile: Box = { x, z, hw: 0.8, hd: 0.85, rot: -yaw, yBottom: ground(x, z) - 1, yTop: ground(x, z) + 0.85 };
    for (const [k, [o, dy]] of ([[-0.45, 0.2], [0.45, -0.15]] as const).entries()) {
      const px = x + o * cs, pz = z - o * sn;
      set.instance(firewood, { x: px, y: ground(px, pz), z: pz, rot: yaw }, k === 0 ? { dy, pile } : { dy });
    }
  }
  set.paint(campBench, on(cx - 3.2, cz - 9.0, 0.1), {});

  // ── rugs: a rack of drying felts, two rugs laid out at doors ──
  set.paint(rugRack, on(cx + 6.5, cz + 4.5, -0.5), { pals: [0, 1, 2] });
  for (const k of [1, 3]) {
    const d = doors[k];
    if (!d) continue;
    const fx = -Math.sin(d.rot), fz = -Math.cos(d.rot), rx = d.x + fx * (d.r + 1.4), rz = d.z + fz * (d.r + 1.4);
    set.paint(feltRug, on(rx, rz, d.rot), { w: 1.5, h: 2.2, pal: k });
  }

  // ── props round the yard ──
  set.paint(cart, on(cx - 11, cz - 11, 2.3), {});
  for (const [bx, bz] of [[cx + 6.8, cz - 1.2], [cx + 6.3, cz - 0.3], [cx - 1.5, cz + 10.5]] as const) set.paint(barrel, on(bx, bz), { s: rng.range(0.9, 1.05) });
  for (const [hx, hz, hyaw] of [[cx + 0.6, cz + 9.4, 0.2], [cx - 9.5, cz - 4.5, 1.8]] as const) set.instance(chest, { x: hx, y: ground(hx, hz), z: hz, rot: hyaw }, {});

  // ── the hitching rail (road side, runs north–south) + the water trough + the saddle rack ──
  {
    const { x, z, length: L, height: H } = HITCHING_RAIL;
    set.paint(hitchingRail, on(x, z), { length: L, height: H });
    set.paint(waterTrough, on(x + 1.3, z - L / 2 - 1.2), {});
    set.paint(saddleRack, on(x + 2.2, z + L / 2 + 1.4, 0.3), {});
  }

  // ── the corral: round pole fence, gate open toward the yard (east, −x); a hay pile and a feed trough inside ──
  {
    const { x, z, r } = CORRAL;
    set.paint(corral, on(x, z), { r, posts: 26 });
    set.paint(hayPile, on(x + 3, z + 2, 0.4), {});
    set.paint(feedTrough, on(x - 2.5, z + 5, 0.9), {});
  }

  // the kumis corner by the big yurt: a churn by the yurt, a bigger one 1.1 m east of it
  {
    const x = cx + 3.6, z = cz + 10.2;
    set.instance(kumisChurn, { x, y: ground(x, z), z, rot: 0.6, scale: 1 }, { hw: 0.28, h: 1.1 });
    const sx = x + 1.1, sz = z + 0.2;
    set.instance(kumisChurn, { x: sx, y: ground(sx, sz), z: sz, rot: 2.4, scale: 1.15 }, { hw: 0.34, h: 1.25 });
  }

  // ── yard set pieces: rugs on a line, the chopping block, saddles set down by the rail, the milk cans ──
  {
    const ax = cx - 7, az = cz + 6, bx = cx - 2.6, bz = cz + 8.6;
    set.paint(rugLine, on(ax, az), { dx: bx - ax, dz: bz - az, pals: [1, 3, 0] });
  }
  set.paint(choppingBlock, on(cx + 9.5, cz - 5.5), {});
  for (const [sx, sz, syaw] of [[HITCHING_RAIL.x + 2.8, HITCHING_RAIL.z - 2.2, 1.9], [HITCHING_RAIL.x + 3.2, HITCHING_RAIL.z + 1.2, 0.6]] as const) set.instance(groundSaddle, { x: sx, y: ground(sx, sz), z: sz, rot: syaw }, {});
  set.paint(milkCans, on(cx + 5.2, cz + 8.4), {});

  const group = new THREE.Group();
  group.name = 'nalati-camp';
  // trodden earth: the ring inside the yurts, a path to every door, the track in from the road, bare patches at the
  // rail, the stove and the kazan, and the corral's floor + the path to its gate
  {
    const wear: ((x: number, z: number) => number)[] = [wearDisc(cx, cz, 10.5), wearPath(HITCHING_RAIL.x + 3, cz, cx, cz, 2.4), wearDisc(HITCHING_RAIL.x + 1.2, HITCHING_RAIL.z, 4.2),
      wearDisc(cx + 4.5, cz - 5.5, 2.4), wearDisc(cx - 3.2, cz - 6.2, 3), wearPath(cx + 8, cz + 2, CORRAL.x - CORRAL.r, CORRAL.z, 1.8), wearDisc(CORRAL.x, CORRAL.z, CORRAL.r - 1.5)];
    for (const d of doors) {
      const fx = -Math.sin(d.rot), fz = -Math.cos(d.rot);
      wear.push(wearPath(d.x + fx * (d.r + 0.4), d.z + fz * (d.r + 0.4), cx + (d.x - cx) * 0.4, cz + (d.z - cz) * 0.4, 1.5));
    }
    group.add(buildYardDecal(sky, ground, { x: cx + 6, z: cz + 3, half: 28 }, (x, z) => { let m = 0; for (const w of wear) { const v = w(x, z); if (v > m) m = v; } return m; }));
  }
  const felt = kit.texturedMesh(sky, 'felt', { ground });
  const mesh = kit.mesh(sky, { ground });
  group.add(mesh);
  let tris = mesh.geometry.getAttribute('position').count / 3;
  if (felt) { felt.name = 'nalati-camp-felt'; group.add(felt); tris += felt.geometry.getAttribute('position').count / 3; }
  const wood = kit.texturedMesh(sky, 'rock', { ground });   // the corral, the gate, the racks and the perch (props.ts GRAIN)
  if (wood) { wood.name = 'nalati-camp-wood'; group.add(wood); tris += wood.geometry.getAttribute('position').count / 3; }
  tris += set.tris();
  set.flush(group, sky);
  // every model's tap target is the whole camp (its felt and timber layers too): a tap picks the copy under the finger
  return { name: 'camp', object: group, colliders: set.boxes, surface: 'wood', tris, register: (o) => set.register({ ...o, object: group, group }) };
}
