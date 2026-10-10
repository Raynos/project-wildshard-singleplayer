/**
 * KurganField — the Wusun-period burial mounds in the east of the Sky Grassland's bowl (layout v2 "KURGAN FIELD"). The
 * domes themselves are terrain (B0's landscape adds `KURGANS`, so the grass grows on them: world); this places the models
 * that dress them (E306 / E315 M3, src/shards/nalati-grasslands/models/): a ring of kerb stones at every mound's foot
 * (doubled round the great one, a few fallen or robbed out), fieldstones in the grass, and the GREAT KURGAN's entrance in
 * its west flank (B13's door). All painted into the field's one mesh (src/shards/nalati-grasslands/world/painted.ts); with the balbals on
 * the crowns (./Balbals.ts) they are the Kurgan field set.
 *
 *   const { piece, entrance, balbalSpots } = buildKurganField(ctx);
 *   entrance → { x, y, z, facing }   // the threshold (floor centre at the doorway) + the yaw it faces — B13's door
 *   balbalSpots → where the crown balbals stand (Balbals builds them)
 *
 * No terrain carve is needed: the passage head stands proud of the flank and its floor sits on a timber platform.
 */
import { PaintKit } from './paint';
import { NalatiSet } from './painted';
import { KURGANS, GREAT_KURGAN, KURGAN_BALBALS } from './layout';
import { GREAT_KURGAN_DOOR } from '../layout';
import type { PoiCtx, PoiPiece } from './types';
import { kurganKerb } from '../models/kurganKerb';
import { fieldstone } from '../models/fieldstone';
import { kurganEntrance, DROMOS_DEPTH } from '../models/kurganEntrance';

export interface KurganEntrance { x: number; y: number; z: number; facing: number }

export interface KurganField { piece: PoiPiece; entrance: KurganEntrance; balbalSpots: { x: number; z: number; yaw: number; scale: number }[] }

export function buildKurganField(ctx: PoiCtx): KurganField {
  const steps = kurganFieldSteps(ctx);
  for (;;) { const step = steps.next(); if (step.done === true) return step.value; }
}

/** `buildKurganField` a part a step (SF67: one ~105 ms task at 4x CPU): a yield after each kurgan and before the merged
 *  mesh; the yields draw nothing, so the same field */
export function* kurganFieldSteps(ctx: PoiCtx): Generator<void, KurganField> {
  const { sky, ground } = ctx;
  const kit = new PaintKit(0x4b62);
  const rng = kit.rng;
  const set = new NalatiSet(kit, ctx);
  const great = GREAT_KURGAN;
  const D = GREAT_KURGAN_DOOR, fx = -Math.sin(D), fz = -Math.cos(D);           // the unit vector the door faces

  // ── kerb rings ──
  for (const k of KURGANS) {
    const rings = k.great === true ? [k.r + 0.2, k.r + 1.9] : [k.r + 0.1];
    for (const [ri, rr] of rings.entries()) {
      const n = Math.round((Math.PI * 2 * rr) / (ri === 0 ? 1.25 : 1.9));
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + rng.range(-0.02, 0.02);
        const sx = Math.cos(a), sz = Math.sin(a);
        // the great kurgan's kerb opens for the entrance
        if (k.great === true && sx * fx + sz * fz > Math.cos(0.16)) continue;
        if (rng.next() < 0.12) continue;                                          // robbed out
        const x = k.x + sx * (rr + rng.range(-0.15, 0.15)), z = k.z + sz * (rr + rng.range(-0.15, 0.15));
        const fallen = rng.next() < 0.08;
        const s = rng.range(0.34, 0.55) * (ri === 0 ? 1 : 0.85);
        set.paint(kurganKerb, { x, y: ground(x, z), z, yaw: a }, { s, fallen });
      }
    }
    // loose stones in the grass round it
    for (let i = 0; i < Math.round(k.r * 0.5); i++) {
      const a = rng.range(0, Math.PI * 2), d = k.r + rng.range(1, 7);
      const x = k.x + Math.cos(a) * d, z = k.z + Math.sin(a) * d, s = rng.range(0.15, 0.4);
      set.paint(fieldstone, { x, y: ground(x, z), z, yaw: 0 }, { s, squash: 0.55, rough: 0.22, lift: 0.1, look: 'kurgan' });
    }
    yield;
  }

  // ── the great kurgan's entrance ──
  // walk the door axis in from the foot; the portal front stands where the flank has risen ~0.35 m
  const at = (d: number) => ({ x: great.x + fx * d, z: great.z + fz * d });
  const foot = at(great.r + 1.2), footY = ground(foot.x, foot.z);
  let dFront = great.r;
  for (let d = great.r; d > great.r * 0.5; d -= 0.1) { const p = at(d); if (ground(p.x, p.z) - footY >= 0.35) { dFront = d; break; } }
  const front = at(dFront), back = at(dFront - DROMOS_DEPTH);
  const floorY = Math.max(ground(back.x, back.z), ground(front.x, front.z)) + 0.1;
  set.paint(kurganEntrance, { x: front.x, y: floorY, z: front.z, yaw: D }, { footY });

  // ── crown balbals: a pair on every small mound, side by side on its crown, facing east (the rising sun, as they did) —
  // since layout v2 cut the balbal circle these are all the shard's balbals (B11 wakes them) ──
  const balbalSpots: { x: number; z: number; yaw: number; scale: number }[] = [];
  KURGAN_BALBALS.map((i) => KURGANS[i]).filter((k) => k !== undefined).forEach((k, i) => {
    for (const side of [-1, 1]) {
      const yaw = Math.PI / 2 + ((i % 3) - 1) * 0.2 + side * 0.08;
      // side by side across the facing direction (east = −x), 0.75 m either side of the crown
      balbalSpots.push({ x: k.x + 0.3, z: k.z + side * 0.75, yaw, scale: 1.0 + ((i + (side > 0 ? 1 : 0)) % 3) * 0.06 });
    }
  });

  yield;
  const mesh = yield* kit.meshSteps(sky, { ground });
  mesh.name = 'nalati-kurgans';
  const entrance: KurganEntrance = { x: front.x, y: floorY, z: front.z, facing: D };
  return {
    piece: { name: 'kurgans', object: mesh, colliders: set.boxes, surface: 'wood', tris: mesh.geometry.getAttribute('position').count / 3, register: (o) => set.register({ ...o, object: mesh }) },
    entrance, balbalSpots,
  };
}
