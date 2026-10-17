import * as THREE from 'three';
import type { BoxSpec as Collider } from '@wildshard/engine/physics/box';
import type { Material } from '@wildshard/engine/physics/surface';
import type { ColliderDesc } from '@wildshard/engine/world/registry';

/** Shipping chamber dungeon declaration, shared by the native chamber and arena row. */
export const DUNGEON = { x: -40, y: 140, z: -95 };

/** Shipping chamber ch declaration, shared by the native chamber and arena row. */
export const CH = 10;

/** Shipping chamber dromos end declaration, shared by the native chamber and arena row. */
export const DROMOS_END = 22.5;

/** Shipping chamber dromos spawn declaration, shared by the native chamber and arena row. */
export const DROMOS_SPAWN = { x: 0, z: 20.3, yaw: 0 };

/** Shipping chamber checkpoint declaration, shared by the native chamber and arena row. */
export const CHECKPOINT = { x: 0, z: 15.5, yaw: 0 };

/** Shipping chamber coffin declaration, shared by the native chamber and arena row. */
export const COFFIN = { x: 0, z: -0.6, plinthH: 0.45, len: 3.2, wid: 1.3, h: 0.85 };

/** Shipping chamber pedestal declaration, shared by the native chamber and arena row. */
export const PEDESTAL = { x: 0, z: -8.3, h: 0.95 };

/** Shipping chamber niches declaration, shared by the native chamber and arena row. */
export const NICHES = [
  { x: -CH + 0.2, z: 4.6, yaw: Math.PI / 2 }, { x: CH - 0.2, z: 4.6, yaw: -Math.PI / 2 },
  { x: -CH + 0.2, z: -4.2, yaw: Math.PI / 2 }, { x: CH - 0.2, z: -4.2, yaw: -Math.PI / 2 },
];

/** Shipping chamber streams declaration, shared by the native chamber and arena row. */
export const STREAMS: { x: number; z: number }[] = [
  { x: -5.2, z: 3.4 }, { x: 4.8, z: 4.6 }, { x: -3.6, z: -5.0 }, { x: 5.6, z: -3.2 },
  { x: -7.0, z: -0.6 }, { x: 1.8, z: 6.6 }, { x: 7.2, z: 1.2 }, { x: -1.6, z: -6.8 },
];

/** Fixed chamber dimensions shared by the offline fabric and live encounter attachments. */
export const FABRIC = {
  STATIC_TRIANGLES: 111316, SAND_N: 40, WALL_H: 5.3, BEAM_Y: 5.45, PLANK_Y: 5.95,
  DW: 1.5, DH: 3.0, DOOR_W: 1.35, DOOR_H: 2.9,
  BRAZIERS: [{ x: -6.6, z: 6.6 }, { x: 6.6, z: 6.6 }, { x: -6.6, z: -6.4 }, { x: 6.6, z: -6.4 }],
  FALLEN: [
    { a: { x: -7.4, z: -2.8 }, b: { x: -3.8, z: -0.4 }, r: 0.32 },
    { a: { x: 3.6, z: 2.2 }, b: { x: 7.2, z: 4.4 }, r: 0.3 },
  ],
};

/** Shipping static interior collision, constructed once offline with the fabric dimensions. */
function chamberCollision(): { boxes: Collider[]; descs: ColliderDesc[] } {
  const { WALL_H, BEAM_Y, PLANK_Y, DW, DH, DOOR_W, BRAZIERS, FALLEN } = FABRIC;
  const boxes: Collider[] = [];
  const Y0 = DUNGEON.y, box = (lx: number, lz: number, hw: number, hd: number, y0: number, y1: number) => boxes.push({ x: DUNGEON.x + lx, z: DUNGEON.z + lz, hw, hd, rot: 0, yBottom: Y0 + y0, yTop: Y0 + y1 });
  // chamber walls (the north one split round the door, east / west round the niches' backs)
  box(0, -CH - 0.2, CH + 0.5, 0.35, -1, WALL_H + 1);
  box(-(CH + DOOR_W + 0.35) / 2 - 0.0, CH + 0.2, (CH - DOOR_W - 0.35) / 2, 0.35, -1, WALL_H + 1);
  box((CH + DOOR_W + 0.35) / 2, CH + 0.2, (CH - DOOR_W - 0.35) / 2, 0.35, -1, WALL_H + 1);
  for (const sx of [-1, 1]) {
    box(sx * (CH + 0.2), 0, 0.35, CH + 0.5, 3.6, WALL_H + 1);                      // above the niches
    const cuts = NICHES.filter((n) => Math.sign(n.x) === sx).map((n) => n.z).sort((a, b) => a - b);
    let z0 = -CH;
    for (const cz of cuts) { const a = z0, b = cz - 1.15; box(sx * (CH + 0.2), (a + b) / 2, 0.35, (b - a) / 2, -1, 3.7); z0 = cz + 1.15; }
    box(sx * (CH + 0.2), (z0 + CH) / 2, 0.35, (CH - z0) / 2, -1, 3.7);
    for (const cz of cuts) box(sx * (CH + 1.3), cz, 0.3, 1.3, -1, 3.8);          // niche backs
  }
  // the dromos walls and its far end
  for (const sx of [-1, 1]) box(sx * (DW + 0.2), (CH + DROMOS_END) / 2, 0.3, (DROMOS_END - CH) / 2 + 0.3, -1, DH + 1);
  box(0, DROMOS_END + 0.5, DW + 0.5, 0.3, -1, DH + 1);
  // the coffin (the plinth is a platform), the pedestal, the braziers
  box(COFFIN.x, COFFIN.z, COFFIN.wid / 2 + 0.05, COFFIN.len / 2 + 0.05, COFFIN.plinthH - 0.3, COFFIN.plinthH + COFFIN.h);
  box(PEDESTAL.x, PEDESTAL.z, 0.6, 0.5, -0.5, PEDESTAL.h);
  for (const b of BRAZIERS) box(b.x, b.z, 0.45, 0.45, -0.5, 1.3);
  // floor + ceiling slabs: arrows stick in them (the player is never pushed: it stands above / below them)
  box(0, 0, CH + 0.5, CH + 0.5, -1.2, 0);
  box(0, (CH + DROMOS_END) / 2, DW + 0.5, (DROMOS_END - CH) / 2 + 0.5, -1.2, 0);
  // the ceiling, minus the looter's hole (arrows loosed up through it fly out)
  box(0, -CH / 2 - 1.2, CH, CH / 2 - 1.2, BEAM_Y - 0.2, PLANK_Y + 0.5);
  box(0, CH / 2 + 0.8, CH, CH / 2 - 0.8, BEAM_Y - 0.2, PLANK_Y + 0.5);
  box(-CH / 2 - 1, COFFIN.z, CH / 2 - 1, 1.6, BEAM_Y - 0.2, PLANK_Y + 0.5);
  box(CH / 2 + 1.3, COFFIN.z, CH / 2 - 1.3, 1.6, BEAM_Y - 0.2, PLANK_Y + 0.5);
  const at = (lx: number, lz: number) => ({ x: DUNGEON.x + lx, z: DUNGEON.z + lz });
  const surfaceOf = (c: Collider): Material | undefined =>
    BRAZIERS.some((b) => Math.abs(DUNGEON.x + b.x - c.x) < 0.01 && Math.abs(DUNGEON.z + b.z - c.z) < 0.01) ? 'metal'
      : Math.abs(DUNGEON.x + PEDESTAL.x - c.x) < 0.01 && Math.abs(DUNGEON.z + PEDESTAL.z - c.z) < 0.01 ? 'stone' : undefined;
  // Retain the original boxDesc arithmetic as authoring-only numeric rows.
  const descs: ColliderDesc[] = boxes.map((c): ColliderDesc => {
    const surface = surfaceOf(c);
    return { kind: 'box', x: c.x, y: (c.yTop + c.yBottom) / 2, z: c.z, hx: c.hw,
      hy: Math.max(0.005, (c.yTop - c.yBottom) / 2), hz: c.hd, yaw: -c.rot,
      ...(surface === undefined ? {} : { surface }) };
  });
  const cf = at(COFFIN.x, COFFIN.z), pd = at(PEDESTAL.x, PEDESTAL.z);
  descs.push({ kind: 'box', x: cf.x, y: Y0 + COFFIN.plinthH / 2, z: cf.z, hx: COFFIN.wid / 2 + 0.65, hy: COFFIN.plinthH / 2, hz: COFFIN.len / 2 + 0.6, surface: 'wood' });
  descs.push({ kind: 'box', x: cf.x, y: Y0 + 0.11, z: cf.z, hx: COFFIN.wid / 2 + 0.95, hy: 0.11, hz: COFFIN.len / 2 + 0.9, surface: 'wood' });   // a step onto it (≤ 0.35)
  descs.push({ kind: 'box', x: pd.x, y: Y0 + 0.09, z: pd.z, hx: 0.8, hy: 0.09, hz: 0.7, surface: 'stone' });
  const up = new THREE.Vector3(0, 1, 0), axis = new THREE.Vector3(), q = new THREE.Quaternion();
  for (const f of FALLEN) {
    const dx = f.b.x - f.a.x, dz = f.b.z - f.a.z, len = Math.hypot(dx, dz), c = at((f.a.x + f.b.x) / 2, (f.a.z + f.b.z) / 2);
    q.setFromUnitVectors(up, axis.set(dx / len, 0, dz / len));
    descs.push({ kind: 'capsule', x: c.x, y: Y0 + f.r, z: c.z, halfHeight: Math.max(0.05, len / 2 - f.r), radius: f.r, rot: { x: q.x, y: q.y, z: q.z, w: q.w }, surface: 'wood' });
  }
  return { boxes, descs };
}

/** Fixed collision alongside the authored frame; the seal and sand remain live. */
export const COLLISION = chamberCollision();
