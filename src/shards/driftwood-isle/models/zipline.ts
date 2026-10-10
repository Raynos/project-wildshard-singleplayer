/**
 * The zipline (E306 / E315 M1, second pass: a model on the contract, src/engine/models/model.ts; its geometry was built in
 * src/shards/driftwood-isle/world/Zipline.ts) — the traversal reward (DRIFTWOOD-REMASTER A7): a plank launch deck jutting out over a cliff lip
 * (planks, two stringers, four posts down to the rock, a back rail, a red flag board), the launch A-frame with the cable's
 * anchor block, a steel cable sagging down to a stout landing post with a padded stop board and a straw pile, and the
 * pulley trolley with its T-bar (the rig and the trolley: two draws, the low-poly kit on lowPolyMaterial, no AO).
 *
 * Its params are the cable's two ends in the world: `top` = the deck's outer edge (on the floor), `bottom` = the landing
 * (on the floor); the deck turns to face down the line. Its own space: the origin is `top`. The ride (src/shards/driftwood-isle/world/Zipline.ts)
 * builds the rig and the trolley from `ziplineGeometry` where the zipline stands, draws them itself (the trolley runs
 * the wire) and places this model `drawnInto` its group; the Explorer's specimen is a short run from the origin with
 * the trolley parked at the top.
 */
import * as THREE from 'three';
import { defineModel } from '@wildshard/engine/models/model';
import { log, beam, plank, rope, rock } from '@wildshard/engine/world/geometryKit';
import { LowPolyKit, lowPolyMaterial } from '@wildshard/engine/world/lowpolyKit';
import { ZiplineLayout } from '../runtime/ziplineLayout';



const C = { wood: '#8a6440', woodDark: '#5f432a', woodLight: '#a88157', steel: '#3c4046', rope: '#b9a57a', pad: '#c9b27c', straw: '#d8c07a', red: '#a83a2a' };
const V = (x: number, y: number, z: number): THREE.Vector3 => new THREE.Vector3(x, y, z);

/** the rig (deck, A-frame, cable, landing: world space) and the trolley (its origin on the cable), built where it stands */
export function ziplineGeometry(lay: ZiplineLayout): { rig: THREE.BufferGeometry; trolley: THREE.BufferGeometry } {
  const k = new LowPolyKit(0x21e);
  const d = lay.deck, cs = Math.cos(d.yaw), sn = Math.sin(d.yaw);
  const W = (lx: number, ly: number, lz: number): THREE.Vector3 => V(d.x + lx * cs + lz * sn, ly, d.z - lx * sn + lz * cs);
  const m = new THREE.Matrix4();
  // the deck: planks across, two stringers, four posts down to the rock, a rail at the back
  for (let i = 0; i < 12; i++) {
    const lz = -d.hd + 0.15 + i * 0.3;
    k.add(plank(d.hw * 2, 0.28, 0.06, k.rng, 0.012), i % 2 ? C.wood : C.woodLight, { matrix: m.compose(W(0, d.y - 0.03, lz), new THREE.Quaternion().setFromAxisAngle(V(0, 1, 0), d.yaw), V(1, 1, 1)) });
  }
  for (const sx of [-1, 1]) {
    k.add(beam(W(sx * (d.hw - 0.1), d.y - 0.12, -d.hd), W(sx * (d.hw - 0.1), d.y - 0.12, d.hd), 0.12, 0.16), C.woodDark);
    for (const sz of [-1, 1]) { const p = W(sx * (d.hw - 0.12), 0, sz * (d.hd - 0.15)); k.add(log(V(p.x, d.y - 3.5, p.z), V(p.x, d.y + (sz < 0 ? 1.0 : 0), p.z), 0.1, 0.09, 6), C.woodDark); }
  }
  k.add(beam(W(-d.hw, d.y + 0.95, -d.hd + 0.15), W(d.hw, d.y + 0.95, -d.hd + 0.15), 0.08, 0.1), C.wood);
  // the launch A-frame at the outer edge: two legs, a cross beam, the cable anchor block
  const a = lay.a;
  for (const sx of [-1, 1]) k.add(log(W(sx * (d.hw - 0.2), d.y, d.hd - 0.1), V(a.x + sx * 0.12 * cs, a.y + 0.35, a.z - sx * 0.12 * sn), 0.09, 0.07, 6), C.woodDark);
  k.add(beam(V(a.x - 0.5 * cs, a.y + 0.3, a.z + 0.5 * sn), V(a.x + 0.5 * cs, a.y + 0.3, a.z - 0.5 * sn), 0.14, 0.14), C.wood);
  k.add(new THREE.BoxGeometry(0.22, 0.22, 0.22), C.steel, { matrix: m.makeTranslation(a.x, a.y + 0.05, a.z) });
  k.add(new THREE.BoxGeometry(0.5, 0.3, 0.06), C.red, { matrix: m.compose(W(0, d.y + 1.25, -d.hd + 0.15), new THREE.Quaternion().setFromAxisAngle(V(0, 1, 0), d.yaw), V(1, 1, 1)) });   // a red flag board
  // the cable: 40 sagging segments
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i <= 40; i++) pts.push(lay.at((i / 40) * lay.len, V(0, 0, 0)));
  k.add(rope(pts, 0.022, 4), C.steel, { jitter: 0.02 });
  // the landing: a stout post the cable ends on, a padded stop board, a straw pile to land in
  const b = lay.b, bg = lay.spec.bottom.y, dir = lay.dir;
  k.add(log(V(b.x + dir.x * 0.5, bg - 0.6, b.z + dir.z * 0.5), V(b.x + dir.x * 0.5, b.y + 0.5, b.z + dir.z * 0.5), 0.14, 0.12, 7), C.woodDark);
  k.add(new THREE.BoxGeometry(0.9, 0.9, 0.2), C.pad, { matrix: m.compose(V(b.x + dir.x * 0.3, bg + 1.4, b.z + dir.z * 0.3), new THREE.Quaternion().setFromAxisAngle(V(0, 1, 0), d.yaw), V(1, 1, 1)) });
  for (let i = 0; i < 6; i++) { const ang = (i / 6) * Math.PI * 2; k.add(rock(0.55, 0, k.rng, 0.45, 0.35), C.straw, { matrix: m.makeTranslation(b.x - dir.x * 1.2 + Math.cos(ang) * 0.9, bg + 0.08, b.z - dir.z * 1.2 + Math.sin(ang) * 0.9), jitter: 0.12 }); }
  const rig = k.finish({ ao: false });
  // the trolley: a pulley housing on the wire, two straps, a T-bar (origin = on the cable)
  const t = new LowPolyKit(0x21f);
  t.add(new THREE.CylinderGeometry(0.11, 0.11, 0.06, 10).rotateX(Math.PI / 2), C.steel);
  t.add(new THREE.BoxGeometry(0.08, 0.26, 0.22), C.red, { matrix: m.makeTranslation(0, -0.08, 0) });
  for (const sx of [-1, 1]) t.add(log(V(0, -0.18, 0), V(sx * 0.28, -0.72, 0), 0.018, 0.018, 4), C.rope);
  t.add(log(V(-0.34, -0.74, 0), V(0.34, -0.74, 0), 0.03, 0.03, 6), C.woodDark);
  return { rig, trolley: t.finish({ ao: false }) };
}

export interface ZiplineParams {
  readonly top: { readonly x: number; readonly y: number; readonly z: number };
  readonly bottom: { readonly x: number; readonly y: number; readonly z: number };
}

export const zipline = defineModel<ZiplineParams>({
  id: 'driftwood-isle/zipline', name: 'Zipline', category: 'buildings', pipeline: 'code',
  file: 'src/shards/driftwood-isle/models/zipline.ts', surface: 'planks',
  // a short run (14 m down a 5 m drop) from the origin, so the turntable frames the deck, the A-frame and the landing
  defaults: { top: { x: 0, y: 0, z: 0 }, bottom: { x: 13, y: -5, z: 3 } },
  build: (ctx, p) => {
    const lay = new ZiplineLayout({ top: V(p.top.x, p.top.y, p.top.z), bottom: V(p.bottom.x, p.bottom.y, p.bottom.z) });
    const { rig, trolley } = ziplineGeometry(lay);
    const at = new THREE.Vector3(), yaw = lay.park(at);
    trolley.applyMatrix4(new THREE.Matrix4().compose(at, new THREE.Quaternion().setFromAxisAngle(V(0, 1, 0), yaw), V(1, 1, 1)));
    const mat = lowPolyMaterial(ctx.sky);
    return [{ geometry: rig, material: mat, castShadow: true, receiveShadow: true }, { geometry: trolley, material: mat, castShadow: true }];
  },
});
