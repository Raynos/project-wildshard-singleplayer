/**
 * Crags — the snow ring's two granite massifs (layout v2: the Crags in the east, the west massif with the leopard's cave;
 * the massifs themselves are the chunk def's terrain, and their rock is src/shards/nalati-grasslands/cragRock.ts): places the snow
 * leopard's (Aqbars, B12) models on the west massif (E306 / E315 M3, src/shards/nalati-grasslands/models/) — six crag
 * ledges jutting from its valley-facing flanks (his lookouts) and his cave at `CRAG_CAVE` — painted into one mesh: the
 * Crags set.
 *
 *   const crags = buildCrags(ctx);   // → { piece, ledges: { x, y, z, r }[], cave: { x, y, z, facing } }
 */
import { PaintKit, v3 } from './paint';
import { NalatiSet } from './painted';
import { CRAGS, WEST_CRAGS, CRAG_CAVE } from './layout';
import type { PoiCtx, PoiPiece } from './types';
import { cragLedge } from '../models/cragLedge';
import { leopardCave } from '../models/leopardCave';

export interface Ledge { x: number; y: number; z: number; r: number }

export function buildCrags(ctx: PoiCtx): { piece: PoiPiece; ledges: Ledge[]; cave: { x: number; y: number; z: number; facing: number } } {
  const { sky, ground } = ctx;
  const kit = new PaintKit(0xc4a6);
  const rng = kit.rng;
  const set = new NalatiSet(kit, ctx);
  const slopeAt = (x: number, z: number) => { const e = 1.5; return Math.hypot(ground(x + e, z) - ground(x - e, z), ground(x, z + e) - ground(x, z - e)) / (2 * e); };
  const downhill = (x: number, z: number) => { const e = 1.5; const gx = ground(x + e, z) - ground(x - e, z), gz = ground(x, z + e) - ground(x, z - e); const l = Math.hypot(gx, gz) || 1; return { x: -gx / l, z: -gz / l }; };
  const cave = CRAG_CAVE, cfx = -Math.sin(cave.rot), cfz = -Math.cos(cave.rot);

  const placed: { x: number; z: number; r: number }[] = [];
  const free = (x: number, z: number, r: number) => placed.every((p) => Math.hypot(p.x - x, p.z - z) > p.r + r) && Math.hypot(x - cave.x, z - cave.z) > 14 && x > -249 && z > -249;
  // (the outcrops that stood on the steep faces are src/shards/nalati-grasslands/cragRock.ts's now: fins on the crests, ribs against the
  //  faces, sunk into the rock — no block sits on a slope)

  // ── ledges: flat slabs jutting from moderate slopes on the west massif's valley-facing flanks (round Aqbars' cave) ──
  const ledges: Ledge[] = [];
  for (let tries = 0; tries < 500 && ledges.length < 6; tries++) {
    const a = rng.range(Math.PI * 0.45, Math.PI * 1.2), d = rng.range(28, 80);            // the N / NE / E flanks (+z / −x)
    const x = WEST_CRAGS.x + Math.cos(a) * d, z = WEST_CRAGS.z + Math.sin(a) * d;
    const gy = ground(x, z), sl = slopeAt(x, z);
    if (gy < 40 || gy > 70 || sl < 0.3 || sl > 1.2 || !free(x, z, 3.2)) continue;
    const dh = downhill(x, z), yaw = Math.atan2(dh.x, dh.z);
    const ux = x - dh.x * 1.6, uz = z - dh.z * 1.6;                                      // the uphill edge sits flush
    const top = Math.max(ground(ux, uz), gy + 0.9);
    const w = rng.range(4.2, 5.8), d2 = rng.range(3.0, 4.0);
    const px = x + dh.x * 0.6, pz = z + dh.z * 0.6;
    set.paint(cragLedge, { x: px, y: top, z: pz, yaw }, { w, d: d2, snowLine: CRAGS.snowLine });
    placed.push({ x: px, z: pz, r: 3.2 });
    ledges.push({ x: px, y: top, z: pz, r: Math.min(w, d2) / 2 - 0.3 });
  }

  // ── the ledge cave: at its mouth, 3 m out from where it meets the hill, its floor over the highest ground under it ──
  const O = { x: cave.x + cfx * 3.0, z: cave.z + cfz * 3.0 };                            // the mouth (lz = 0)
  const L = (lx: number, ly: number, lz: number) => v3(O.x - cfx * lz - cfz * lx, ly, O.z - cfz * lz + cfx * lx);
  let floorY = -Infinity;
  for (const lz of [0, 1, 2, 3]) for (const lx of [-1.6, 0, 1.6]) { const q = L(lx, 0, lz); floorY = Math.max(floorY, ground(q.x, q.z)); }
  floorY += 0.12;
  set.paint(leopardCave, { x: O.x, y: floorY, z: O.z, yaw: cave.rot }, { snowLine: CRAGS.snowLine });
  const porch = L(0, 0, -2.1);

  const mesh = kit.mesh(sky, { ground, aoH: 1.2 });
  mesh.name = 'nalati-crags';
  return {
    piece: { name: 'crags', object: mesh, colliders: set.boxes, surface: 'rock', tris: mesh.geometry.getAttribute('position').count / 3, register: (o) => set.register({ ...o, object: mesh }) },
    ledges, cave: { x: porch.x, y: floorY, z: porch.z, facing: cave.rot },
  };
}
