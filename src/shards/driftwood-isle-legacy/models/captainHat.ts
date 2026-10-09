/**
 * The Drowned Captain's hat (E314, project/archive/2026-09-30-driftwood-loot.md: the captain's trophy, worn — board 4 C — and a GEAR
 * cosmetic): a black felt tricorne with a gold-braided brim, a faded red cockade on the front-left, and a strand of kelp
 * still hanging off its right-hand corner from the wreck. The brim is one sheet turned up steeply between its three
 * points (front, back-left, back-right) and nearly flat at them, so its silhouette — and its shadow — reads as a
 * tricorne from any side.
 *
 * One mesh, one draw on the island's shared low-poly material. The kelp sways in the island's wind (the kit's `sway`,
 * vertex shader only). It is the world pickup too (it sits level on its crown's rim and brim points) and what the
 * player wears: src/engine/player/Cosmetics.ts hangs it on the player's head socket.
 *
 * Own space: the origin is the centre of the head band (the crown's bottom rim), +Y up, the front point toward +Z.
 * About 0.48 m across the points, 0.13 m tall. No colliders (a pickup is a trigger, not a solid).
 */
import * as THREE from 'three';
import { defineModel, type ModelContext, type ModelPart } from '@wildshard/engine/models/model';
import { rock, tris } from '@wildshard/engine/world/geometryKit';
import { LowPolyKit, lowPolyMaterial } from '@wildshard/engine/world/lowpolyKit';
import { swayDepthMaterial } from '@wildshard/engine/world/wind';

const C = { felt: '#2a292f', feltB: '#232228', top: '#323039', trim: '#c9a24a', band: '#3a2f2c', cockade: '#8e302a', button: '#d8b457', kelp: '#4f7a3a' };

/** the brim's inner edge (it tucks under the crown) and the crown's base radius */
const RI = 0.096, CROWN_R = 0.106;
/** angular steps round the brim, and its radial stations (0 inner … 1 outer; the gold braid from TRIM) */
const STEPS = 36, STATIONS = [0, 0.28, 0.62, 0.86, 1] as const, TRIM = 3;

/** the brim at angle θ (0 = the front point, turning toward +x) and radial station s: its position in own space */
function brimPoint(theta: number, s: number): THREE.Vector3 {
  const f = Math.sin(1.5 * theta) ** 2;           // 0 at the three points, 1 midway between them
  const width = 0.1 + 0.045 * (1 - f);             // the points reach further out
  const cock = 0.12 + f * 1.36;                    // how steeply the brim is turned up (rad): the upturns hide most of the crown
  let r = RI, y = 0;
  let prev = 0;
  for (const st of STATIONS) {
    const end = Math.min(st, s);
    if (end <= prev) { if (st > s) break; continue; }
    const mid = (prev + st) / 2, ang = cock * Math.min(1, mid / 0.35);
    r += (end - prev) * width * Math.cos(ang);
    y += (end - prev) * width * Math.sin(ang);
    prev = end;
  }
  return new THREE.Vector3(Math.sin(theta) * r, y + 0.004, Math.cos(theta) * r);
}

/** the hat's geometry in own space (one draw; the kelp carries sway weights) */
export function captainHatGeometry(): THREE.BufferGeometry {
  const kit = new LowPolyKit(0xca97a1);
  // the brim: a sheet of quads between the angular steps and the radial stations, felt inside the braid, gold outside
  const felt: number[] = [], trim: number[] = [];
  for (let i = 0; i < STEPS; i++) {
    const t0 = (i / STEPS) * Math.PI * 2, t1 = ((i + 1) / STEPS) * Math.PI * 2;
    for (let j = 0; j + 1 < STATIONS.length; j++) {
      const s0 = STATIONS[j] ?? 0, s1 = STATIONS[j + 1] ?? 1;
      const a = brimPoint(t0, s0), b = brimPoint(t1, s0), c = brimPoint(t1, s1), d = brimPoint(t0, s1);
      const out = j >= TRIM ? trim : felt;
      out.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z, a.x, a.y, a.z, c.x, c.y, c.z, d.x, d.y, d.z);
    }
  }
  kit.add(tris(felt), C.feltB, { jitter: 0.06 });
  kit.add(tris(trim), C.trim, { jitter: 0.08 });
  // the crown: a nine-sided drum a little narrower at the top, a low domed cap, a dark band round its foot
  kit.add(new THREE.CylinderGeometry(CROWN_R * 0.92, CROWN_R, 0.08, 10, 1, true).translate(0, 0.035, 0), C.felt, { jitter: 0.05 });
  kit.add(new THREE.CylinderGeometry(0.06, CROWN_R * 0.92, 0.035, 10, 1).translate(0, 0.0925, 0), C.top, { jitter: 0.05 });
  kit.add(new THREE.CylinderGeometry(CROWN_R + 0.003, CROWN_R + 0.004, 0.022, 9, 1, true).translate(0, 0.014, 0), C.band, { jitter: 0.04 });
  // the cockade: a faded red rosette with a brass button on the front-left upturn
  const at = brimPoint(-Math.PI / 3, 0.55), outward = new THREE.Vector3(Math.sin(-Math.PI / 3), 0.35, Math.cos(-Math.PI / 3)).normalize();
  const face = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), outward);
  kit.add(new THREE.CylinderGeometry(0.034, 0.034, 0.008, 8).applyQuaternion(face).translate(at.x, at.y, at.z).translate(outward.x * 0.006, outward.y * 0.006, outward.z * 0.006), C.cockade, { jitter: 0.08 });
  kit.add(new THREE.CylinderGeometry(0.011, 0.011, 0.01, 6).applyQuaternion(face).translate(at.x, at.y, at.z).translate(outward.x * 0.012, outward.y * 0.012, outward.z * 0.012), C.button, { jitter: 0.04 });
  // the kelp: a thin ribbon hanging off the back-right point, swaying
  const corner = brimPoint((Math.PI * 2) / 3, 0.9);
  const kelp: number[] = [];
  const pts = [corner, corner.clone().add(new THREE.Vector3(0.012, -0.05, -0.004)), corner.clone().add(new THREE.Vector3(0.004, -0.1, 0.006)), corner.clone().add(new THREE.Vector3(0.016, -0.145, 0))];
  for (let i = 0; i + 1 < pts.length; i++) {
    const p = pts[i], q = pts[i + 1];
    if (p === undefined || q === undefined) continue;
    const w0 = 0.014 * (1 - i * 0.25), w1 = 0.014 * (1 - (i + 1) * 0.25);
    kelp.push(p.x - w0, p.y, p.z, p.x + w0, p.y, p.z, q.x + w1, q.y, q.z, p.x - w0, p.y, p.z, q.x + w1, q.y, q.z, q.x - w1, q.y, q.z);
  }
  kit.add(tris(kelp), C.kelp, { jitter: 0.1, sway: { w: 0.35, hang: true } });
  kit.add(rock(0.012, 0, kit.rng, 0.8, 0.3).translate(corner.x, corner.y, corner.z), C.kelp); // where it's snagged
  return kit.finish({ ao: false });
}

/** the hat as one mesh (a pickup, a specimen, the worn hat) */
export function buildCaptainHat(ctx: ModelContext): THREE.Mesh {
  const m = new THREE.Mesh(captainHatGeometry(), lowPolyMaterial(ctx.sky));
  m.name = 'captain-hat';
  m.castShadow = true;
  m.receiveShadow = true;
  m.customDepthMaterial = swayDepthMaterial();
  return m;
}

export interface CaptainHatParams {
  /** uniform size (1 = the player's; the captain wears his at his own scale) */
  readonly size: number;
}

export const captainHat = defineModel<CaptainHatParams>({
  id: 'driftwood-isle/captain-hat', name: "Captain's hat", category: 'gear', pipeline: 'code',
  file: 'src/shards/driftwood-isle/models/captainHat.ts', surface: 'felt',
  defaults: { size: 1 },
  build: (ctx, p): readonly ModelPart[] => [{
    geometry: ctx.once(`captain-hat:${p.size}`, () => (p.size === 1 ? captainHatGeometry() : captainHatGeometry().scale(p.size, p.size, p.size))),
    material: lowPolyMaterial(ctx.sky), castShadow: true, receiveShadow: true, customDepthMaterial: swayDepthMaterial(),
  }],
});
