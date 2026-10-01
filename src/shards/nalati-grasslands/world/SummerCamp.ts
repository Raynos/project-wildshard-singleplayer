/**
 * SummerCamp — the jailau camp on the Sky Grassland (the real "Nomad Home" stop at the foot of the south mountain):
 * three yurts round a small hearth, a kazan smoking over it, a tether line on two posts for the horses, a drying
 * board of kurt (curd balls), felts airing on the grass, a cart and a ribbon post.
 *
 *   const summer = buildSummerCamp(ctx);   // PoiPiece: the camp registers itself (`register`: one `place` per model)
 *
 * E306 / E315 second pass: the camp places models (src/shards/nalati-grasslands/models/: yurt.ts, campProps.ts,
 * campGenerated.ts) through a NalatiSet (./painted.ts), in the old builder's order, like the spring camp
 * (./NomadCamp.ts); NalatiPOIs names them the Summer camp set. The yard's trodden earth is a decal (world).
 */
import * as THREE from 'three';
import { PaintKit, v3 } from './paint';
import { NalatiSet } from './painted';
import { SUMMER_CAMP } from './layout';
import { buildYardDecal, wearDisc, wearPath } from './Yard';
import type { PoiCtx, PoiPiece } from './types';
import { yurt } from '../models/yurt';
import { cart, barrel, feltRug, tetherLine, kurtBoard, ribbonPost } from '../models/campProps';
import { kazan, chest } from '../models/campGenerated';

export function buildSummerCamp(ctx: PoiCtx): PoiPiece {
  const { sky, ground, smoke } = ctx;
  const kit = new PaintKit(0x5a33);
  const set = new NalatiSet(kit, ctx);
  const rng = kit.rng;
  const cx = SUMMER_CAMP.x, cz = SUMMER_CAMP.z;
  const on = (x: number, z: number, yaw = 0) => ({ x, y: ground(x, z), z, yaw });
  const Y = [{ a: 70, d: 9, r: 2.9, flue: true, pal: 1 }, { a: 175, d: 9.5, r: 2.6, flue: false, pal: 0 }, { a: -60, d: 9, r: 2.7, flue: true, pal: 2, old: true }];
  for (const y of Y) {
    const a = (y.a * Math.PI) / 180, x = cx + Math.cos(a) * y.d, z = cz + Math.sin(a) * y.d;
    const rot = Math.atan2(-(cx - x), -(cz - z)) + rng.range(-0.25, 0.25);
    let gy = ground(x, z);
    for (let k = 0; k < 8; k++) { const t = (k / 8) * Math.PI * 2; gy = Math.min(gy, ground(x + Math.cos(t) * y.r, z + Math.sin(t) * y.r)); }
    set.paint(yurt, { x, y: gy, z, yaw: rot }, { r: y.r, flue: y.flue, palette: y.pal, old: y.old ?? false, base: 'lattice', pennant: false });
  }
  {
    const x = cx + 1, z = cz - 1, y = ground(x, z);
    set.instance(kazan, { x, y, z, rot: 0.4 }, {});
    smoke.emitter(v3(x, y + 0.9, z), { puffs: 28, rise: 4.5, size: [0.5, 3.0], life: 6 });
  }
  set.paint(cart, on(cx - 7, cz + 7.5, 0.6), {});
  set.instance(chest, { x: cx + 3.5, y: ground(cx + 3.5, cz + 3.5), z: cz + 3.5, rot: 2.2 }, {});
  set.paint(barrel, on(cx - 3.2, cz - 4.6), { s: 1 });
  set.paint(feltRug, on(cx - 1.5, cz + 4.2, 0.3), { w: 1.4, h: 2.0, pal: 3 });
  set.paint(feltRug, on(cx + 4.8, cz - 3.2, 1.2), { w: 1.2, h: 1.8, pal: 2 });
  // the tether line: two posts, a rope between them (the horses will be tied here)
  {
    const ax = cx - 12, az = cz - 3, bx = cx - 12, bz = cz + 5;
    set.paint(tetherLine, on(ax, az), { dx: bx - ax, dz: bz - az });
  }
  set.paint(kurtBoard, on(cx + 6.5, cz + 2.5, 0.7), {});
  set.paint(ribbonPost, on(cx - 2.5, cz + 1.2), {});
  const group = new THREE.Group();
  group.name = 'nalati-summer-camp';
  {
    const wear = [wearDisc(cx, cz, 6.5), wearDisc(cx - 12, cz + 1, 3.5), wearPath(cx - 12, cz + 1, cx, cz, 1.6)];
    for (const y of Y) { const a = (y.a * Math.PI) / 180; wear.push(wearPath(cx + Math.cos(a) * (y.d - y.r - 0.3), cz + Math.sin(a) * (y.d - y.r - 0.3), cx, cz, 1.4)); }
    group.add(buildYardDecal(sky, ground, { x: cx - 3, z: cz, half: 16 }, (x, z) => { let m = 0; for (const w of wear) { const v = w(x, z); if (v > m) m = v; } return m; }));
  }
  const felt = kit.texturedMesh(sky, 'felt', { ground });
  const mesh = kit.mesh(sky, { ground });
  group.add(mesh);
  let tris = mesh.geometry.getAttribute('position').count / 3;
  if (felt) { group.add(felt); tris += felt.geometry.getAttribute('position').count / 3; }
  const wood = kit.texturedMesh(sky, 'rock', { ground });   // the posts (props.ts GRAIN)
  if (wood) { wood.name = 'nalati-summer-wood'; group.add(wood); tris += wood.geometry.getAttribute('position').count / 3; }
  tris += set.tris();
  set.flush(group, sky);
  return { name: 'summerCamp', object: group, colliders: set.boxes, surface: 'wood', tris, register: (o) => set.register({ ...o, object: group, group }) };
}
