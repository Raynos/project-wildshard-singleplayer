/**
 * NomadCamp — the spring camp (kystau) in the Kunes valley, the shard's hub (map-01 "NOMAD CAMP", (95, 205)).
 * Six white felt yurts in an arc round a yard that opens east toward the N road; a round pole corral to the west;
 * the hitching rail on the road side where TULPAR waits (`HITCHING_RAIL`); an eagle perch (a lashed tripod with a
 * T-bar) with a static golden eagle; a ribbon pole in the yard streaming seven colours; felt rugs drying on a rack
 * and laid at two doors; an iron stove and a kazan on a tripod, both smoking; a cart, barrels, chests, a woodpile,
 * a saddle rack, a water trough and a hay pile.
 *
 *   const camp = buildNomadCamp(ctx);      // PoiPiece: object, colliders, platforms, tris
 *
 * One merged mesh; the ribbons / pennants go into `ctx.flutter`, the plumes into `ctx.smoke`.
 * Terrain request: a flat pad r 30 at (95, 205) (the valley floor, ≈ −8).
 */
import * as THREE from 'three';
import { PaintKit, M, pole, v3, blob } from './paint';
import { addYurt } from './Yurt';
import { PC, addBarrel, addChest, addWoodpile, addStove, addKazan, addCart, addSaddleRack, addEagle, addGroundRug, addRugRack, addCarvedPost, addChurn } from './props';
import { CAMP, CORRAL, HITCHING_RAIL } from './layout';
import type { Collider } from '../../player/Player';
import type { PoiCtx, PoiPiece } from './types';

/** the yurts: angle round the yard (deg, 0 = +x/west, 90 = +z/north), distance, radius, flue, palette */
const YURTS: { a: number; d: number; r: number; flue: boolean; pal: number; old?: boolean; base: 'lattice' | 'reed' | 'felt' }[] = [
  { a: 128, d: 13.5, r: 3.0, flue: true, pal: 0, base: 'lattice' },
  { a: 88, d: 14.5, r: 3.5, flue: true, pal: 1, base: 'reed' },      // the big one (the host's)
  { a: 46, d: 13.0, r: 2.8, flue: false, pal: 2, old: true, base: 'felt' },
  { a: 2, d: 13.5, r: 3.1, flue: true, pal: 0, base: 'lattice' },
  { a: -44, d: 13.0, r: 2.7, flue: false, pal: 1, base: 'reed' },
  { a: -92, d: 13.5, r: 3.2, flue: false, pal: 2, base: 'lattice' },
];

const RIBBONS = ['#c8321e', '#2f5fae', '#e8b632', '#3f8f4a', '#f4efe4', '#e0772c', '#7a3f8c'];

export function buildNomadCamp(ctx: PoiCtx): PoiPiece {
  const { sky, ground, flutter, smoke } = ctx;
  const kit = new PaintKit(0x7a17);
  const rng = kit.rng;
  const colliders: Collider[] = [];
  const cx = CAMP.x, cz = CAMP.z;

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
    const top = addYurt(kit, { x, y: gy, z, rot, r: y.r, flue: y.flue, palette: y.pal, old: y.old ?? false, base: y.base }, colliders);
    if (top.flue) smoke.emitter(top.flue, { puffs: 26, rise: 8, size: [0.35, 2.4], life: 8 });
    // a red pennant on a short pole at the crown of every other yurt
    if (y.pal !== 2) {
      const pc = top.crown.clone();
      const pb = pc.clone().add(v3(0, 0.05, 0)), pt = pc.clone().add(v3(0, 1.4, 0));
      kit.add(pole(pb, pt, 0.03, 0.022, 5), PC.woodDark);
      flutter.flag(pt.clone().add(v3(0, -0.04, 0)), 0.34, 0.75, y.pal === 0 ? '#c9361f' : '#d9772a', { taper: 1, droop: 0.15 });
    }
    doors.push({ x, z, rot, r: y.r });
  }

  // ── ribbon pole in the yard: striped pole, a trident finial, seven streamers ──
  {
    const x = cx + 1.5, z = cz - 0.5, y = ground(x, z), H = 6.6;
    kit.add(new THREE.CylinderGeometry(0.075, 0.1, H, 10, 12).translate(0, H / 2, 0), (p) => (Math.floor((p.y * 3 + Math.atan2(p.x, p.z) / Math.PI) % 2) === 0 ? PC.red : PC.cream), { matrix: M(x, y - 0.2, z) });
    kit.add(new THREE.SphereGeometry(0.12, 10, 8).translate(0, H - 0.15, 0), PC.gold, { matrix: M(x, y - 0.2, z) });
    for (const sx of [-1, 0, 1]) {
      kit.add(new THREE.ConeGeometry(0.045, 0.5, 6).translate(sx * 0.16, H + 0.25 + (sx === 0 ? 0.12 : 0), 0), PC.gold, { matrix: M(x, y - 0.2, z) });
    }
    kit.add(new THREE.BoxGeometry(0.4, 0.05, 0.05).translate(0, H + 0.02, 0), PC.gold, { matrix: M(x, y - 0.2, z) });
    for (let i = 0; i < 9; i++) { const a = (i / 9) * Math.PI * 2; kit.add(blob(0.2, rng, 1, 0.6), PC.stone, { matrix: M(x + Math.cos(a) * 0.55, y, z + Math.sin(a) * 0.55, a) }); }
    RIBBONS.forEach((c, i) => {
      const a = (i / RIBBONS.length) * Math.PI * 2;
      flutter.streamer(v3(x + Math.cos(a) * 0.08, y - 0.2 + H - 0.25 - i * 0.06, z + Math.sin(a) * 0.08), rng.range(2.4, 3.6), 0.13, c, { droop: 0.5, taper: 0.3 });
    });
    colliders.push({ x, z, hw: 0.7, hd: 0.7, rot: 0, yBottom: y - 1, yTop: y + H });
  }

  // ── eagle perch: a lashed tripod with a T-bar, the eagle facing the road ──
  {
    const x = cx - 9, z = cz + 1.5, y = ground(x, z), H = 2.55;
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2 + 0.3;
      kit.add(pole(v3(x + Math.cos(a) * 0.95, y - 0.2, z + Math.sin(a) * 0.95), v3(x - Math.cos(a) * 0.1, y + H + 0.1, z - Math.sin(a) * 0.1), 0.055, 0.04, 6), PC.woodGrey);
    }
    kit.add(new THREE.CylinderGeometry(0.075, 0.075, 0.22, 8).translate(x, y + H - 0.25, z), PC.leather);          // lashing
    kit.add(pole(v3(x - 0.5, y + H + 0.08, z), v3(x + 0.5, y + H + 0.08, z), 0.045, 0.045, 7), PC.wood);             // T-bar
    kit.add(new THREE.CylinderGeometry(0.05, 0.05, 0.36, 8).rotateZ(Math.PI / 2).translate(x + 0.05, y + H + 0.08, z), PC.red); // leather wrap
    addEagle(kit, v3(x + 0.05, y + H + 0.12, z), Math.PI / 2 + 0.35);                                                // looking east, toward the road
    // jesses: a cord from the leg to the bar end
    kit.add(pole(v3(x + 0.1, y + H + 0.14, z), v3(x + 0.48, y + H + 0.02, z), 0.01, 0.01, 3), PC.leather);
    kit.add(pole(v3(x + 0.48, y + H + 0.08, z), v3(x + 0.52, y + H - 0.6, z + 0.02), 0.01, 0.01, 3), PC.leather);
    colliders.push({ x, z, hw: 0.9, hd: 0.9, rot: 0, yBottom: y - 1, yTop: y + H + 0.5 });
  }

  // ── cooking: the stove and the kazan in the yard, smoking ──
  smoke.emitter(addStove(kit, ground, cx + 4.5, cz - 5.5, 0.4, colliders), { puffs: 22, rise: 7, size: [0.3, 2.0], life: 7 });
  smoke.emitter(addKazan(kit, ground, cx - 3.2, cz - 6.2, colliders), { puffs: 16, rise: 4.5, size: [0.35, 1.7], life: 5 });
  addWoodpile(kit, ground, cx + 8.5, cz - 3, 0.9, colliders);
  // low wooden bench by the kazan
  {
    const x = cx - 3.2, z = cz - 9.0, y = ground(x, z), m = M(x, y, z, 0.1);
    kit.add(new THREE.BoxGeometry(1.8, 0.07, 0.36).translate(0, 0.42, 0), PC.woodLight, { matrix: m, flat: true });
    for (const bx of [-0.75, 0.75]) kit.add(new THREE.BoxGeometry(0.08, 0.42, 0.3).translate(bx, 0.21, 0), PC.wood, { matrix: m, flat: true });
    colliders.push({ x, z, hw: 0.9, hd: 0.2, rot: -0.1, yBottom: y - 1, yTop: y + 0.46 });
  }

  // ── rugs: a rack of drying felts, two rugs laid out at doors ──
  addRugRack(kit, ground, cx + 6.5, cz + 4.5, -0.5, colliders, [0, 1, 2]);
  for (const k of [1, 3]) {
    const d = doors[k];
    if (!d) continue;
    const fx = -Math.sin(d.rot), fz = -Math.cos(d.rot), rx = d.x + fx * (d.r + 1.4), rz = d.z + fz * (d.r + 1.4);
    addGroundRug(kit, ground, rx, rz, d.rot, 1.5, 2.2, k);
  }

  // ── props round the yard ──
  addCart(kit, ground, cx - 11, cz - 11, 2.3, colliders);
  for (const [bx, bz] of [[cx + 6.8, cz - 1.2], [cx + 6.3, cz - 0.3], [cx - 1.5, cz + 10.5]] as const) addBarrel(kit, ground, bx, bz, colliders, rng.range(0.9, 1.05));
  addChest(kit, ground, cx + 0.6, cz + 9.4, 0.2, colliders);
  addChest(kit, ground, cx - 9.5, cz - 4.5, 1.8, colliders);

  // ── hitching rail (road side, runs north–south) + trough + saddle rack ──
  {
    const { x, z, length: L, height: H } = HITCHING_RAIL;
    for (const t of [-0.5, 0, 0.5]) addCarvedPost(kit, ground, x, z + t * L, H, Math.PI / 2);
    const y0 = ground(x, z - L / 2), y1 = ground(x, z + L / 2);
    kit.add(pole(v3(x, y0 + H, z - L / 2 - 0.25), v3(x, y1 + H, z + L / 2 + 0.25), 0.075, 0.07, 8), PC.woodLight);
    for (const t of [-0.3, 0.28]) {
      const pz = z + t * L, py = ground(x, pz) + H;
      kit.add(new THREE.TorusGeometry(0.09, 0.018, 4, 10).rotateY(Math.PI / 2).translate(x, py - 0.02, pz), PC.leather);
      kit.add(pole(v3(x - 0.02, py - 0.08, pz), v3(x - 0.12, py - 0.55, pz + 0.05), 0.012, 0.012, 3), PC.leather);
    }
    colliders.push({ x, z, hw: 0.15, hd: L / 2 + 0.3, rot: 0, yBottom: Math.min(y0, y1) - 1, yTop: Math.max(y0, y1) + H + 0.1 });
    // water trough: a hollowed half-log on two chocks
    const tx = x + 1.3, tz = z - L / 2 - 1.2, ty = ground(tx, tz);
    kit.add(new THREE.CylinderGeometry(0.32, 0.32, 2.4, 12, 1, false, Math.PI / 2, Math.PI).rotateZ(Math.PI / 2).rotateY(Math.PI / 2).translate(0, 0.42, 0), PC.wood, { matrix: M(tx, ty, tz) });
    kit.add(new THREE.BoxGeometry(0.5, 0.02, 2.3).translate(0, 0.36, 0), new THREE.Color('#6f9fb8'), { matrix: M(tx, ty, tz), flat: true });
    for (const s of [-0.8, 0.8]) kit.add(new THREE.BoxGeometry(0.7, 0.2, 0.2).translate(0, 0.1, s), PC.wood, { matrix: M(tx, ty, tz), flat: true });
    colliders.push({ x: tx, z: tz, hw: 0.35, hd: 1.2, rot: 0, yBottom: ty - 1, yTop: ty + 0.45 });
    addSaddleRack(kit, ground, x + 2.2, z + L / 2 + 1.4, 0.3, colliders);
  }

  // ── corral: round pole fence, gate open toward the yard (east, −x) ──
  {
    const { x, z, r } = CORRAL;
    const n = 26, gate = Math.PI;                        // gate direction: −x
    const posts: THREE.Vector3[] = [];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const px = x + Math.cos(a) * r, pz = z + Math.sin(a) * r;
      posts.push(v3(px, ground(px, pz), pz));
    }
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2, p = posts[i];
      if (!p) continue;
      const da = Math.abs(((a - gate + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI);
      const big = da < 0.3;
      kit.add(pole(v3(p.x, p.y - 0.4, p.z), v3(p.x + rng.range(-0.04, 0.04), p.y + (big ? 1.75 : 1.45), p.z + rng.range(-0.04, 0.04)), big ? 0.12 : 0.085, big ? 0.1 : 0.07, 7), PC.woodGrey, { foot: 0.7, jitter: 0.1 });
      const q = posts[(i + 1) % n];
      const am = ((i + 0.5) / n) * Math.PI * 2;
      const dm = Math.abs(((am - gate + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI);
      if (!q || dm < 0.2) continue;                     // the gate gap
      for (const ry of [0.62, 1.2]) kit.add(pole(v3(p.x, p.y + ry, p.z), v3(q.x, q.y + ry - 0.03, q.z), 0.055, 0.055, 6), PC.woodGrey, { jitter: 0.12 });
      const mx = (p.x + q.x) / 2, mz = (p.z + q.z) / 2, len = Math.hypot(q.x - p.x, q.z - p.z);
      const yaw = Math.atan2(q.x - p.x, q.z - p.z), gy = Math.min(p.y, q.y);
      colliders.push({ x: mx, z: mz, hw: 0.1, hd: len / 2 + 0.05, rot: -yaw, yBottom: gy - 1, yTop: gy + 1.3 });
    }
    // the gate panel swung open against the fence outside
    {
      const gx = x + Math.cos(gate + 0.12) * r, gz = z + Math.sin(gate + 0.12) * r, gy = ground(gx, gz);
      const m = M(gx - 1.1, gy, gz + 0.9, 0.5);
      for (const ry of [0.4, 0.8, 1.2]) kit.add(new THREE.BoxGeometry(0.06, 0.1, 2.2).translate(0, ry, 0), PC.woodGrey, { matrix: m, flat: true });
      for (const s of [-1.05, 1.05]) kit.add(new THREE.BoxGeometry(0.07, 1.35, 0.1).translate(0, 0.68, s), PC.woodGrey, { matrix: m, flat: true });
      kit.add(new THREE.BoxGeometry(0.05, 0.1, 2.5).rotateX(0.5).translate(0, 0.8, 0), PC.woodGrey, { matrix: m, flat: true });
    }
    // hay pile + a feed trough inside
    const hx = x + 3, hz = z + 2, hy = ground(hx, hz);
    kit.add(new THREE.SphereGeometry(1.3, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 0.6, 1.3), PC.hay, { matrix: M(hx, hy - 0.05, hz, 0.4), brush: 0.14 });
    colliders.push({ x: hx, z: hz, hw: 1.1, hd: 1.5, rot: -0.4, yBottom: hy - 1, yTop: hy + 0.7 });
    const fx = x - 2.5, fz = z + 5, fy = ground(fx, fz);
    kit.add(new THREE.BoxGeometry(0.6, 0.35, 1.8).translate(0, 0.35, 0), PC.woodDark, { matrix: M(fx, fy, fz, 0.9), flat: true });
    kit.add(new THREE.BoxGeometry(0.5, 0.05, 1.7).translate(0, 0.51, 0), PC.hay, { matrix: M(fx, fy, fz, 0.9), flat: true });
  }

  // the kumis corner by the big yurt: the wooden churn and the leather saba on its tripod
  addChurn(kit, ground, cx + 3.6, cz + 10.2, colliders);

  const mesh = kit.mesh(sky, { ground });
  mesh.name = 'nalati-camp';
  const tris = mesh.geometry.getAttribute('position').count / 3;
  return { name: 'camp', object: mesh, colliders, platforms: [], tris };
}
