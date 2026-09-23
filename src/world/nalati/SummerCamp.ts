/**
 * SummerCamp — the jailau camp on the Sky Grassland (the real "Nomad Home" stop at the foot of the south mountain):
 * three yurts round a small hearth, a kazan smoking over it, a tether line on two posts for the horses, a drying
 * board of kurt (curd balls), felts airing on the grass, a cart and a ribbon post.
 *
 *   const summer = buildSummerCamp(ctx);   // PoiPiece
 */
import * as THREE from 'three';
import { PaintKit, M, pole, v3 } from './paint';
import { addYurt } from './Yurt';
import { PC, addKazan, addCart, addGroundRug, addChest, addBarrel } from './props';
import { SUMMER_CAMP } from './layout';
import type { Collider } from '../../player/Player';
import type { PoiCtx, PoiPiece } from './types';

export function buildSummerCamp(ctx: PoiCtx): PoiPiece {
  const { sky, ground, flutter, smoke } = ctx;
  const kit = new PaintKit(0x5a33);
  const rng = kit.rng;
  const colliders: Collider[] = [];
  const cx = SUMMER_CAMP.x, cz = SUMMER_CAMP.z;
  const Y = [{ a: 70, d: 9, r: 2.9, flue: true, pal: 1 }, { a: 175, d: 9.5, r: 2.6, flue: false, pal: 0 }, { a: -60, d: 9, r: 2.7, flue: true, pal: 2, old: true }];
  for (const y of Y) {
    const a = (y.a * Math.PI) / 180, x = cx + Math.cos(a) * y.d, z = cz + Math.sin(a) * y.d;
    const rot = Math.atan2(-(cx - x), -(cz - z)) + rng.range(-0.25, 0.25);
    let gy = ground(x, z);
    for (let k = 0; k < 8; k++) { const t = (k / 8) * Math.PI * 2; gy = Math.min(gy, ground(x + Math.cos(t) * y.r, z + Math.sin(t) * y.r)); }
    const top = addYurt(kit, { x, y: gy, z, rot, r: y.r, flue: y.flue, palette: y.pal, old: y.old ?? false }, colliders);
    if (top.flue) smoke.emitter(top.flue, { puffs: 24, rise: 8, size: [0.35, 2.3], life: 8 });
  }
  smoke.emitter(addKazan(kit, ground, cx + 1, cz - 1, colliders), { puffs: 16, rise: 4.5, size: [0.35, 1.6], life: 5 });
  addCart(kit, ground, cx - 7, cz + 7.5, 0.6, colliders);
  addChest(kit, ground, cx + 3.5, cz + 3.5, 2.2, colliders);
  addBarrel(kit, ground, cx - 3.2, cz - 4.6, colliders);
  addGroundRug(kit, ground, cx - 1.5, cz + 4.2, 0.3, 1.4, 2.0, 3);
  addGroundRug(kit, ground, cx + 4.8, cz - 3.2, 1.2, 1.2, 1.8, 2);
  // tether line: two posts, a rope between them (the horses will be tied here)
  {
    const ax = cx - 12, az = cz - 3, bx = cx - 12, bz = cz + 5;
    const ay = ground(ax, az), by = ground(bx, bz);
    kit.add(pole(v3(ax, ay - 0.4, az), v3(ax, ay + 1.3, az), 0.09, 0.08, 7), PC.woodGrey, { foot: 0.7 });
    kit.add(pole(v3(bx, by - 0.4, bz), v3(bx, by + 1.3, bz), 0.09, 0.08, 7), PC.woodGrey, { foot: 0.7 });
    const n = 8;
    for (let i = 0; i < n; i++) {
      const t0 = i / n, t1 = (i + 1) / n;
      const p = v3(ax, ay + 1.2, az).lerp(v3(bx, by + 1.2, bz), t0); p.y -= Math.sin(Math.PI * t0) * 0.25;
      const q = v3(ax, ay + 1.2, az).lerp(v3(bx, by + 1.2, bz), t1); q.y -= Math.sin(Math.PI * t1) * 0.25;
      kit.add(pole(p, q, 0.02, 0.02, 4), PC.leather);
    }
    colliders.push({ x: ax, z: az, hw: 0.12, hd: 0.12, rot: 0, yBottom: ay - 1, yTop: ay + 1.3 });
    colliders.push({ x: bx, z: bz, hw: 0.12, hd: 0.12, rot: 0, yBottom: by - 1, yTop: by + 1.3 });
  }
  // kurt drying board on trestles: rows of white curd balls
  {
    const x = cx + 6.5, z = cz + 2.5, y = ground(x, z), m = M(x, y, z, 0.7);
    kit.add(new THREE.BoxGeometry(2.0, 0.05, 0.8).translate(0, 0.85, 0), PC.woodLight, { matrix: m, flat: true });
    for (const sx of [-0.8, 0.8]) for (const sz of [-0.3, 0.3]) kit.add(new THREE.CylinderGeometry(0.03, 0.03, 0.85, 5).translate(sx, 0.42, sz), PC.woodGrey, { matrix: m });
    for (let i = 0; i < 9; i++) for (let j = 0; j < 3; j++) kit.add(new THREE.SphereGeometry(0.055, 6, 5).translate(-0.8 + i * 0.2, 0.9, -0.25 + j * 0.25), new THREE.Color('#f3efe2'), { matrix: m, brush: 0.03 });
    colliders.push({ x, z, hw: 1.0, hd: 0.4, rot: -0.7, yBottom: y - 1, yTop: y + 0.95 });
  }
  // a ribbon post by the hearth
  {
    const x = cx - 2.5, z = cz + 1.2, y = ground(x, z);
    kit.add(pole(v3(x, y - 0.3, z), v3(x, y + 3.6, z), 0.06, 0.045, 7), PC.woodGrey);
    for (const [i, c] of ['#c8321e', '#f4efe4', '#2f5fae'].entries()) flutter.streamer(v3(x, y + 3.5 - i * 0.12, z), rng.range(1.6, 2.3), 0.1, c);
    colliders.push({ x, z, hw: 0.1, hd: 0.1, rot: 0, yBottom: y - 1, yTop: y + 3.6 });
  }
  const mesh = kit.mesh(sky, { ground });
  mesh.name = 'nalati-summer-camp';
  return { name: 'summerCamp', object: mesh, colliders, platforms: [], tris: mesh.geometry.getAttribute('position').count / 3 };
}
