import { horsePlayground } from '../src/shards/nalati-grasslands/playground/registration';
import { GRAPPLE_PLAYGROUND } from '../src/shards/nine-dragon-stack/playground/registration';
// E307: the feature playgrounds — which shard lists which, and the two dev levels' geometry against the verbs they are for:
// every grapple zip is inside the Fei Zhua's reach, lands on its pad (the PAST side of the ring, never short in the pit)
// and flies clear of every other box; the horse track's bends are wider than a gallop's turn and inside the field.
import { afterAll, describe, expect, it } from 'vitest';
import { registerPlayground, PLAYGROUND_CARDS, asPlaygroundId, playgroundsFor } from '../src/engine/practice/playground/catalog';
import { hookCourseHooks, hookCoursePad, hookCoursePadLabelAt, type HookCourseHook as CourseHook, type HookCoursePad as CoursePad } from '@wildshard/sdk/tools/hookCourse';
import { GRAPPLE_COURSE } from '../src/shards/nine-dragon-stack/data/grappleCourse';
import { FIELD, HORSE_START, JUMPS, LAP_M, OVAL, POST_OFF, RIDER_START, ovalLine } from '../src/shards/nalati-grasslands/playground/horseCourse';
import { practiceRoom } from '../src/engine/core/practiceRoom';
import { placesWithDiscovery } from '../src/engine/quest/view';
import { Flags } from '../src/engine/world/interact/flags';

const unregister = registerPlayground('nine-dragon-stack', GRAPPLE_PLAYGROUND);
afterAll(unregister);
const unregisterHorse = registerPlayground('nalati-grasslands', horsePlayground(null));
afterAll(unregisterHorse);

describe('the Explore hub lists each shard its own playgrounds', () => {
  it('Nine Dragon: the grapple course; Nalati: the horse track; Driftwood and Pine Hollow: none (Jake)', () => {
    expect(playgroundsFor('nine-dragon-stack').map((c) => c.id)).toEqual(['grapple']);
    expect(playgroundsFor('nalati-grasslands').map((c) => c.id)).toEqual(['horse']);
    expect(playgroundsFor('driftwood-isle')).toEqual([]);
    expect(playgroundsFor('pine-hollow')).toEqual([]);
  });
  it('a card id reads back; anything else is null', () => {
    for (const c of PLAYGROUND_CARDS) expect(asPlaygroundId(c.id)).toBe(c.id);
    expect(asPlaygroundId('arena')).toBeNull();
    expect(asPlaygroundId(undefined)).toBeNull();
  });
});

// ── the grapple: Traversal.ts's numbers ──
const { column: COLUMN, pads: PADS, ringUp: RING_UP, room: ROOM } = GRAPPLE_COURSE;
const HOOKS = hookCourseHooks(GRAPPLE_COURSE);
const coursePad = (id: string): CoursePad => hookCoursePad(GRAPPLE_COURSE, id);
const padLabelAt = (p: CoursePad): { x: number; z: number } => hookCoursePadLabelAt(GRAPPLE_COURSE, p);
const MIN_RANGE = 2.5, MAX_RANGE = 38, EYE = 1.6, FOOT = 0.4, BODY = 1.8, RADIUS = 0.38;
const PAST = [-1.6, -2.4, -3.2, -4.2], NEAR = [1.2, 2, 2.8, 4, 6], SIDES = [0, -2, 2, -4, 4];
const RUN = ['start', 'p1', 'p2', 'base', 'l1', 'l2', 'top'];

interface Box { x0: number; x1: number; y0: number; y1: number; z0: number; z1: number; id: string }
/** every solid box of the course: pad slabs, their pillars, the tower's column (as GrapplePlayground builds them) */
const boxes: Box[] = [];
for (const p of PADS) {
  boxes.push({ id: p.id, x0: p.x - p.w / 2, x1: p.x + p.w / 2, y0: p.top - 1, y1: p.top, z0: p.z - p.d / 2, z1: p.z + p.d / 2 });
  if (p.kind !== 'finish') { const s = Math.min(2, Math.min(p.w, p.d) * 0.4) / 2; boxes.push({ id: `${p.id}:pillar`, x0: p.x - s, x1: p.x + s, y0: 0, y1: p.top - 1, z0: p.z - s, z1: p.z + s }); }
}
const top = coursePad('top');
boxes.push({ id: 'column', x0: COLUMN.x - COLUMN.w / 2, x1: COLUMN.x + COLUMN.w / 2, y0: 0, y1: top.top - 1, z0: COLUMN.z - COLUMN.d / 2, z1: COLUMN.z + COLUMN.d / 2 });

const inside = (p: CoursePad, x: number, z: number, margin = 0): boolean => Math.abs(x - p.x) <= p.w / 2 - margin && Math.abs(z - p.z) <= p.d / 2 - margin;
/** the highest pad floor under (x, z) between `from` and `from − 12` (Traversal's floorBelow probe) */
const floorBelow = (x: number, z: number, from: number): number | undefined => {
  let best: number | undefined;
  for (const b of boxes) if (x >= b.x0 && x <= b.x1 && z >= b.z0 && z <= b.z1 && b.y1 <= from && b.y1 >= from - 12) best = best === undefined ? b.y1 : Math.max(best, b.y1);
  return best;
};
/** the segment a→b against a box inflated by r (slab test) */
const hits = (a: number[], b: number[], box: Box, r: number): boolean => {
  let t0 = 0, t1 = 1;
  const lo = [box.x0 - r, box.y0, box.z0 - r], hi = [box.x1 + r, box.y1, box.z1 + r];
  for (let k = 0; k < 3; k++) {
    const d = (b[k] ?? 0) - (a[k] ?? 0), s = a[k] ?? 0, l = lo[k] ?? 0, h = hi[k] ?? 0;
    if (Math.abs(d) < 1e-9) { if (s < l || s > h) return false; continue; }
    let u = (l - s) / d, v = (h - s) / d;
    if (u > v) [u, v] = [v, u];
    t0 = Math.max(t0, u); t1 = Math.min(t1, v);
    if (t0 > t1) return false;
  }
  return true;
};
/** where the player stands on `p` to throw at `h`: the pad's point nearest the ring, a step in from the edge */
const standFor = (p: CoursePad, h: CourseHook): [number, number] => [
  Math.max(p.x - p.w / 2 + 1, Math.min(p.x + p.w / 2 - 1, h.x)), Math.max(p.z - p.d / 2 + 1, Math.min(p.z + p.d / 2 - 1, h.z)),
];

describe('the grapple course (data/grappleCourse.ts) against the Fei Zhua (Traversal.ts)', () => {
  it('the run is START → P1 → P2 → BASE → L1 → L2 → the top, one hook on each next pad', () => {
    for (let i = 0; i + 1 < RUN.length; i++) {
      const from = coursePad(RUN[i] ?? ''), to = RUN[i + 1];
      expect(from.next, from.id).toBe(to);
      expect(HOOKS.filter((h) => h.pad === to).length, `${to}'s hook`).toBe(1);
    }
  });

  it.each(RUN.slice(0, -1).map((id, i) => [id, RUN[i + 1] ?? ''] as const))('%s → %s: in reach, lands on the pad past the ring, flies clear', (fromId, toId) => {
    const from = coursePad(fromId), to = coursePad(toId);
    const h = HOOKS.find((k) => k.pad === toId);
    if (h === undefined) throw new Error(`no hook on ${toId}`);
    const [sx, sz] = standFor(from, h);
    const eye = [sx, from.top + EYE, sz];
    const d = Math.hypot(h.x - sx, h.y - (from.top + EYE), h.z - sz);
    expect(d, 'reach from the near edge').toBeGreaterThanOrEqual(MIN_RANGE);
    expect(d, 'reach from the near edge').toBeLessThanOrEqual(MAX_RANGE);
    // the landing: no floor on the player's side of the ring (probes toward the player), one on the pad past it
    const tx = sx - h.x, tz = sz - h.z, tl = Math.hypot(tx, tz), ux = tx / tl, uz = tz / tl;
    for (const back of NEAR) for (const side of SIDES) {
      const x = h.x + ux * back - uz * side, z = h.z + uz * back + ux * side;
      const f = floorBelow(x, z, h.y + 2);
      expect(f === undefined || f < h.y - 9 || f > h.y + 1.8, `no landing short of ${toId} at back ${back} side ${side} (floor ${f})`).toBe(true);
    }
    const land = PAST.map((back) => [h.x + ux * back, h.z + uz * back] as const).find(([x, z]) => inside(to, x, z, FOOT));
    expect(land, `a landing on ${toId} past its ring`).toBeDefined();
    if (land === undefined) return;
    // the zip: the feet fly straight to the approach point over the landing (≤ 1.6 m up, under the ring); the body from
    // the feet to the crown must clear every box but the pad it lands on (its lip within the capsule's step)
    const approach = [land[0], to.top + Math.min(1.6, RING_UP - 0.12 - 0.2), land[1]];
    for (const up of [0.45, 0.9, BODY - 0.3]) {
      const a = [sx, from.top + up, sz], b = [approach[0] ?? 0, (approach[1] ?? 0) + up, approach[2] ?? 0];
      for (const box of boxes) {
        if (box.id === fromId || box.id === toId) continue;
        expect(hits(a, b, box, RADIUS), `${fromId} → ${toId} clear of ${box.id} (body +${up} m)`).toBe(false);
      }
    }
    // over the landing pad's lip: the feet cross its edge above its floor less a step (the capsule rides up the rest)
    const lipT = (() => {
      const ex = Math.abs(sx - to.x) > to.w / 2 ? to.x + Math.sign(sx - to.x) * to.w / 2 : null;
      const ez = Math.abs(sz - to.z) > to.d / 2 ? to.z + Math.sign(sz - to.z) * to.d / 2 : null;
      const ts = [ex === null ? 0 : (ex - sx) / ((approach[0] ?? 0) - sx), ez === null ? 0 : (ez - sz) / ((approach[2] ?? 0) - sz)];
      return Math.max(...ts);
    })();
    const feetAtLip = from.top + ((approach[1] ?? 0) - from.top) * lipT;
    expect(feetAtLip, `${toId}'s lip`).toBeGreaterThan(to.top - 0.35);
    void eye;
  });

  it('the range line: each pad has a hook back onto START and one of its own, at the distance its label says', () => {
    const start = coursePad('start');
    for (const p of PADS.filter((q) => q.kind === 'range')) {
      expect(HOOKS.some((h) => h.pad === p.id), p.id).toBe(true);
      const gap = start.x - start.w / 2 - (p.x + p.w / 2);
      expect(`${gap} M`).toBe(p.label);
    }
    expect(HOOKS.some((h) => h.pad === 'start')).toBe(true);
  });

  it('everything is inside the room, under its ceiling', () => {
    for (const b of boxes) {
      expect(b.x0 > ROOM.x0 && b.x1 < ROOM.x1 && b.z0 > ROOM.z0 && b.z1 < ROOM.z1, b.id).toBe(true);
      expect(b.y1 + 4, b.id).toBeLessThan(ROOM.height);
    }
  });

  it('the pads\' names on the full map stand clear of each other (E353: L1 sat on FINISH)', () => {
    // a phone's MAP tab fits the 104 × 148 m room at ~2.3 CSS px a metre; a 6-letter 10 px label is ~36 px wide
    const named = PADS.filter((p) => p.kind !== 'range').map((p) => Object.assign(padLabelAt(p), { id: p.id }));
    for (const [i, a] of named.entries()) for (const b of named.slice(i + 1)) {
      expect(Math.hypot(a.x - b.x, a.z - b.z), `${a.id} / ${b.id}`).toBeGreaterThanOrEqual(16);
    }
    for (const n of named) expect(n.x > ROOM.x0 && n.x < ROOM.x1 && n.z > ROOM.z0 && n.z < ROOM.z1, n.id).toBe(true);
  });
});

describe('the horse field (horseCourse.ts) against Mount.ts', () => {
  it('the bends are wider than a gallop turns (0.62 rad/s at 13 m/s: ~21 m) and the lap is a real ride', () => {
    expect(OVAL.radius - OVAL.width / 2).toBeGreaterThan(13 / 0.62);
    expect(LAP_M).toBeGreaterThan(400);
    const line = ovalLine(4);
    const len = line.slice(1).reduce((s, p, i) => s + Math.hypot(p[0] - (line[i]?.[0] ?? 0), p[1] - (line[i]?.[1] ?? 0)), 0);
    expect(Math.abs(len - LAP_M) / LAP_M).toBeLessThan(0.01);
    expect(line[0]).toEqual(line[line.length - 1]);
  });
  it('the track, its posts and the jump lane are inside the walls with room to spare', () => {
    const reach = OVAL.halfLen + OVAL.radius + POST_OFF;
    expect(reach + 8).toBeLessThan(FIELD.x1);
    expect(OVAL.radius + POST_OFF + 8).toBeLessThan(FIELD.z1);
    for (const j of JUMPS) {
      expect(Math.abs(j.x)).toBeLessThan(OVAL.halfLen);
      expect(j.h).toBeGreaterThanOrEqual(0.8); // Mount's jump ray looks at 0.7 m: a lower rail is walked into, not jumped
      expect(j.h).toBeLessThanOrEqual(1.3);    // the arc clears 1.5 m
    }
  });
  it('the horse waits on the track short of the line, and you stand within its mount prompt (3.3 m from the eye)', () => {
    expect(HORSE_START.x).toBeLessThan(0);
    expect(HORSE_START.z).toBe(OVAL.radius);
    expect(Math.hypot(RIDER_START.x - HORSE_START.x, EYE, RIDER_START.z - HORSE_START.z)).toBeLessThan(3.3);
  });
});

describe('a practice room hangs over the shard: its x / z is no place on it', () => {
  it('no place is discovered (nor its flag saved) from the arena or a playground', () => {
    const flags = new Flags('chunk://test/e307', false);
    const toasts: string[] = [];
    const places = placesWithDiscovery([{ id: 'horse-plains', label: 'HORSE PLAINS', x: 65, z: 36, r: 24 }], flags, (t) => { toasts.push(t); }, () => []);
    practiceRoom.open = true;
    places.update(65, 36);
    expect(flags.has('seen:horse-plains')).toBe(false);
    practiceRoom.open = false;
    places.update(65, 36);
    expect(flags.has('seen:horse-plains')).toBe(true);
    expect(toasts).toEqual(['Discovered · HORSE PLAINS']);
  });
});
