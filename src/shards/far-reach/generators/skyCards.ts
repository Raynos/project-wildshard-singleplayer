import { Vector3 } from 'three';
import { cardFloats, type CardFieldRow, type CardGroupRow, type CardRow } from '@wildshard/sdk/looks/cardField';
import { ISLES, SPANS } from '../data/layout';
import { SKY_ISLES } from '../data/skyIsles';
import { SUN_DIR } from '../look/sun';

/**
 * Build-time only (SHARD-PLATFORM M3): baked by scripts/bake-sky-world.mjs into data/skyCards.json; the client
 * (look/render.ts) builds the cards with `@wildshard/sdk/looks/cardField` and the programs in data/skyCardsLook.ts.
 *
 * - The cumulus field (E392): camera-facing painted puffs over the cloud sea, below the decks (the tops stay under the
 *   islands' rims, so a view across the archipelago never looks through a cloud), seeded: every load grows the same sky.
 *   Its per-instance attributes are `aAt` ([x, y, z, size]), `aCell` (the atlas cell) and `aFar` (a bank's fade stretch).
 * - The sun's glow (E392): a disc-and-bloom card, a wide faint gold card and a fan of light shafts at the painted sun.
 */

/** `spiral`: puffs laid on three log-spiral arms round the storm crown, under its deck (the H4 god-view targets). */
export const PUFFS = { spiral: { count: 0, x: 0, z: -190, y: [-12, 20], r: [24, 100] }, count: 380, ring: [10, 600], y: [-6, 18], size: [24, 62], fade: [520, 820], centre: [0, -100], cells: [4, 2], bankFade: 0.62 } as const;

/**
 * `order`: drawn after the cumulus puffs (-5; they write no depth), so the low sun burns through a cloud bank as mockups A
 * and D paint it, while the isles and the world (depth) still hide it (E399 round 6: from the spawn the crown's cloud bank
 * covered the whole disc).
 */
export const SUN_GLOW = { distance: 820, bloom: 230, wide: 900, shafts: 11, shaftLength: 620, shaftWidth: 26, order: -4 } as const;

/** Puffs wrapping every island's keel, low on its cone (E392: the mockups' islands rise out of the clouds). */
function keelPuffs(): [number, number, number, number][] {
  const out: [number, number, number, number][] = [];
  let a = 4243;
  const rnd = (): number => { a = (a * 16807) % 2147483647; return a / 2147483647; };
  for (const isle of [...ISLES, ...SKY_ISLES]) {
    const n = 5 + Math.round(isle.r / 4);
    for (let i = 0; i < n; i++) {
      const ang = (i / n) * Math.PI * 2 + rnd() * 0.6, r = isle.r * (0.35 + rnd() * 0.45), y = isle.y - isle.keel * (0.75 + rnd() * 0.3);
      out.push([isle.x + Math.cos(ang) * r, y, isle.z + Math.sin(ang) * r, isle.r * (0.4 + rnd() * 0.35)]);
    }
  }
  // cloud in the gaps the rope bridges cross, just under deck level (E410: mockup A's bridge runs over billowing lit
  // cumulus; ours crossed open air to a flat sea far below): puffs either side of each span's middle, their tops under it
  let c = 2203;
  const rndC = (): number => { c = (c * 16807) % 2147483647; return c / 2147483647; };
  for (const span of SPANS) {
    if (span.kind !== 'rope') continue;
    const len = Math.hypot(span.x1 - span.x0, span.z1 - span.z0), ux = (span.x1 - span.x0) / len, uz = (span.z1 - span.z0) / len;
    for (let i = 0; i < 6; i++) {
      const t = 0.15 + 0.7 * rndC(), side = (rndC() < 0.5 ? -1 : 1) * (5 + rndC() * 10), size = 7 + rndC() * 6;
      const deck = span.y + (span.y1 - span.y) * t;
      out.push([span.x0 + ux * len * t - uz * side, deck - 3 - size - rndC() * 4, span.z0 + uz * len * t + ux * side, size]);
    }
  }
  // a cumulus bank round the storm crown a little under its deck (E399 round 2, seat B: 'no cloud sea behind the stones';
  // from the arena the true sea, 52 m down, only shows past ~740 m): it reads as the sea just past the rim
  // its own random stream (round 9: sharing the keels' let every sky isle added or moved re-roll the whole bank; o4 put
  // lit puffs behind the stones next to the sun, D's glare 10.0 -> 12.6 % of the middle band)
  let b = 9137;
  const rndB = (): number => { b = (b * 16807) % 2147483647; return b / 2147483647; };
  const crown = ISLES.find((isle) => isle.id === 'crown');
  const to = new Vector3();
  if (crown !== undefined) for (let i = 0; i < 34; i++) {
    const ang = (i / 34) * Math.PI * 2 + rndB() * 0.15, r = crown.r + 14 + rndB() * 60;
    const x = crown.x + Math.cos(ang) * r, y = crown.y - 9 + rndB() * 5, z = crown.z + Math.sin(ang) * r, size = 14 + rndB() * 16;
    // only the sun disc stays clear, seen from the arena (E410: mockup D's stone gaps are full of lit cumulus tops; the
    // round-10 cone of ~32 deg toward the sun emptied D's whole view)
    to.set(x - crown.x, y - crown.y - 2.4, z - crown.z);
    if (to.angleTo(SUN_DIR) < Math.atan(size / to.length()) + (4 * Math.PI) / 180) continue;
    out.push([x, y, z, size]);
  }
  return out;
}

/**
 * The cumulus banks between and beyond the sky isles (E407 top-10 row 5: the mockups stack sunlit cloud at many depths
 * under and between their islands; ours sat in one painted sky): [x, y, z, size], seeded. Each clears every isle's rock
 * (a cloud never cuts an island) and the playable islands by `clear` metres (no bank in front of a player's face), and
 * leaves the sun disc open from the spawn and from the crown: no bank within its own angular size plus `sunGap` degrees
 * of the sun from either.
 */
export const BANKS = { count: 48, centre: [0, -110], ring: [170, 560], y: [-2, 34], size: [22, 44], clear: 90, sunGap: 5 } as const;
function cloudBanks(): [number, number, number, number][] {
  const out: [number, number, number, number][] = [];
  let a = 7717;
  const rnd = (): number => { a = (a * 16807) % 2147483647; return a / 2147483647; };
  const eyes = ISLES.filter((isle) => isle.id === 'sunrest' || isle.id === 'crown').map((isle) => new Vector3(isle.x, isle.y + 1.7, isle.z));
  const to = new Vector3(), gap = (BANKS.sunGap * Math.PI) / 180;
  for (let tries = 0; out.length < BANKS.count && tries < BANKS.count * 20; tries++) {
    const ang = rnd() * Math.PI * 2, r = BANKS.ring[0] + (BANKS.ring[1] - BANKS.ring[0]) * Math.sqrt(rnd());
    const x = BANKS.centre[0] + Math.cos(ang) * r, z = BANKS.centre[1] + Math.sin(ang) * r;
    // nearer ones lower (under the decks), the far ones up into the isles' band
    const y = BANKS.y[0] + (BANKS.y[1] - BANKS.y[0]) * (0.35 * rnd() + 0.65 * (r - BANKS.ring[0]) / (BANKS.ring[1] - BANKS.ring[0]));
    const size = BANKS.size[0] + (BANKS.size[1] - BANKS.size[0]) * rnd();
    if (ISLES.some((isle) => Math.hypot(x - isle.x, z - isle.z) < BANKS.clear + size)) continue;
    // a puff card spans 0.75 size either side and size up and down round its centre: clear of every isle's deck-to-keel column
    if ([...ISLES, ...SKY_ISLES].some((isle) => Math.hypot(x - isle.x, z - isle.z) < isle.r + size * 0.75 && y - size < isle.y + 4 && y + size > isle.y - isle.keel)) continue;
    if (eyes.some((eye) => { to.set(x, y, z).sub(eye); const d = to.length(); return to.angleTo(SUN_DIR) < Math.atan(size / d) + gap; })) continue;
    out.push([x, y, z, size]);
  }
  return out;
}

/** The cumulus field's per-instance attributes: the ring field, the spiral, the keel puffs, then the banks. */
function cumulusField(): CardFieldRow<'cumulus'> {
  const keels = keelPuffs(), banks = cloudBanks();
  let a = 9317 >>> 0;
  const rnd = (): number => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const ns = PUFFS.spiral.count, nk = keels.length, nb = banks.length, n = PUFFS.count + ns + nk + nb, at = new Float32Array(n * 4), cell = new Float32Array(n * 2);
  for (let i = 0; i < n; i++) {
    let ang = rnd() * Math.PI * 2, r = PUFFS.ring[0] + (PUFFS.ring[1] - PUFFS.ring[0]) * Math.sqrt(rnd());
    // clear of the maelstrom (look/cloudSea.ts MAELSTROM) so its spiral reads from above: pushed out past its rim
    for (let tries = 0; tries < 6 && Math.hypot(PUFFS.centre[0] + Math.cos(ang) * r - PUFFS.spiral.x, PUFFS.centre[1] + Math.sin(ang) * r - PUFFS.spiral.z) < 150; tries++) { ang = rnd() * Math.PI * 2; r = PUFFS.ring[0] + (PUFFS.ring[1] - PUFFS.ring[0]) * Math.sqrt(rnd()); }
    const size = PUFFS.size[0] + (PUFFS.size[1] - PUFFS.size[0]) * rnd() ** 1.3;
    // the puff's top (its centre + its height) stays under the decks: a tall one sat in front of every first-person view
    const y = Math.min(PUFFS.y[0] + (PUFFS.y[1] - PUFFS.y[0]) * rnd(), 30 - size);
    at.set([PUFFS.centre[0] + Math.cos(ang) * r, y, PUFFS.centre[1] + Math.sin(ang) * r, size], i * 4);
    const k = Math.floor(rnd() * PUFFS.cells[0] * PUFFS.cells[1]);
    cell.set([k % PUFFS.cells[0], Math.floor(k / PUFFS.cells[0])], i * 2);
  }
  for (let i = 0; i < ns; i++) {
    const k = PUFFS.count + i, f = i / ns, arm = i % 3, rr = PUFFS.spiral.r[0] + (PUFFS.spiral.r[1] - PUFFS.spiral.r[0]) * f;
    // on the disc's arms (look/cloudSea.ts maelstrom: 3 arms, wind = th + 2.6 log(r / eye + 1)), tight to them
    // (the disc lies in local x / y turned onto the ground, so its angle is the world angle mirrored: the log term's sign flips)
    const ang = arm * (Math.PI * 2 / 3) + 2.6 * Math.log(rr / 16 + 1) + (rnd() - 0.5) * 0.22;
    // a funnel: the eye sinks, the walls rise outward toward the crown's base (the H4 targets' maelstrom)
    at.set([PUFFS.spiral.x + Math.cos(ang) * rr, PUFFS.spiral.y[0] + (PUFFS.spiral.y[1] - PUFFS.spiral.y[0]) * Math.min(1, f * 1.4) ** 0.8 * (0.6 + 0.4 * rnd()), PUFFS.spiral.z + Math.sin(ang) * rr, 16 + rnd() * 18 + f * 20], k * 4);
    const c = Math.floor(rnd() * PUFFS.cells[0] * PUFFS.cells[1]); cell.set([c % PUFFS.cells[0], Math.floor(c / PUFFS.cells[0])], k * 2);
  }
  keels.forEach((k, i) => {
    const j = PUFFS.count + ns + i, c = Math.floor(rnd() * PUFFS.cells[0] * PUFFS.cells[1]);
    at.set([k[0], k[1], k[2], k[3]], j * 4); cell.set([c % PUFFS.cells[0], Math.floor(c / PUFFS.cells[0])], j * 2);
  });
  banks.forEach((k, i) => {
    const j = PUFFS.count + ns + nk + i, c = Math.floor(rnd() * PUFFS.cells[0] * PUFFS.cells[1]);
    at.set([k[0], k[1], k[2], k[3]], j * 4); cell.set([c % PUFFS.cells[0], Math.floor(c / PUFFS.cells[0])], j * 2);
  });
  // a bank's fade distance is stretched by its own reach (the far layers stay; the field thins out as before)
  const far = new Float32Array(n).fill(1); for (let i = 0; i < nb; i++) far[PUFFS.count + ns + nk + i] = PUFFS.bankFade;
  return { name: 'far.cumulus', order: -5, plane: [2, 2], program: 'cumulus',
    attributes: { aFar: { size: 1, float32: cardFloats(far) }, aAt: { size: 4, float32: cardFloats(at) }, aCell: { size: 2, float32: cardFloats(cell) } } };
}

/** The sun's cards: the disc and bloom, the wide gold air, then the shafts fanned downward, each with its slow pulse. */
function sunGlowCards(): CardGroupRow<'sunBloom' | 'sunWide' | 'sunShaft'> {
  const at = { uDist: SUN_GLOW.distance };
  const shafts: CardRow<'sunShaft'>[] = [];
  for (let i = 0; i < SUN_GLOW.shafts; i++) {
    const angle = Math.PI * (0.62 + 0.76 * (i / (SUN_GLOW.shafts - 1))) + Math.sin(i * 7.3) * 0.08;   // fanned downward
    shafts.push({ program: 'sunShaft', uniforms: { ...at, uSize: { v2: [SUN_GLOW.shaftWidth * (0.6 + 0.8 * ((i * 0.37) % 1)), SUN_GLOW.shaftLength * (0.6 + 0.5 * ((i * 0.53) % 1))] }, uAngle: angle, uPulse: 1 },
      pulse: { uniform: 'uPulse', base: 0.75, amp: 0.25, rate: 0.3, phase: i * 1.7 } });
  }
  return { name: 'far.sun-glow', order: SUN_GLOW.order, cards: [
    { program: 'sunBloom', uniforms: { ...at, uSize: { v2: [SUN_GLOW.bloom, SUN_GLOW.bloom] }, uAngle: 0 } },
    // a wide, faint gold over the sky round the sun (E399, the mockups' golden air toward the low sun)
    { program: 'sunWide', uniforms: { ...at, uSize: { v2: [SUN_GLOW.wide, SUN_GLOW.wide] }, uAngle: 0 } },
    ...shafts,
  ] };
}

/** The cards' rows: the cumulus field and the sun's glow. */
export function bakeSkyCards(): { cumulus: CardFieldRow<'cumulus'>; sunGlow: CardGroupRow<'sunBloom' | 'sunWide' | 'sunShaft'> } {
  return { cumulus: cumulusField(), sunGlow: sunGlowCards() };
}
