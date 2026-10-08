// SF51-p (G184, E435): the lantern lifts. From a road-height landing deck (world/entries.ts) a bronze lattice cage on
// chains rides a shaft of red-lantern timber frames up to a winch house level with Lantern Square's street, in RIDE
// seconds: one action rides it (behaviour/lift.as, four SF30 mover rows a lift in data/movers.ts, run in the fixed step:
// the cage, its gates, the deck door and the street door). The frames and the chain links are instanced sets
// (models/lift.ts, one draw each for every lift); the paper lanterns hang in the fragment's own lantern batch; the
// footing, the deck pavilion and the winch house are boxes in the `entries` kit (merged with the fabric, no new draw).
// Behind pause ▸ Settings ▸ Debug ▸ Nine Dragon entries (`nineDragonEntries`, default off) with the decks.
import { Matrix4, Vector3 } from 'three';
import { SURF } from '../look/paint';
import type { Ctx } from './ctx';
import { K, Kit, type Look } from './kit';
import { placeSet } from './props3d';
import { hipRoof } from './square';
import { ALONG, CAGE, CAGE_H, CHAIN_X, FRAME_STEP, LIFTS, LINK, POST, ROAD_GATE, frameXZ, liftBottom, liftYaw } from './liftPlan';

// ── the look: the shard's lacquered timber, bronze, stone and green glazed tiles ──
const LACQUER: Look = { wash: 0x7e2419, line: 1, accent: true, gloss: true, surf: SURF.lacquer };
const LACQUER_DK: Look = { wash: 0x46160f, line: 1, accent: true, surf: SURF.lacquer };
const TIMBER: Look = { wash: 0x3d2a1e, line: 1, accent: true, surf: SURF.wood };
const BRONZE: Look = { wash: 0x9a6a32, line: 1, accent: true, gloss: true };
const BRONZE_DK: Look = { wash: 0x5a3c1c, line: 1, accent: true, gloss: true };
const GOLD: Look = { wash: 0xd9b25a, line: 1, accent: true, gloss: true };
const IRON: Look = { wash: 0x2a2826, line: 0, accent: true, gloss: true };
const STONE: Look = { wash: 0x626469, kind: K.stone, line: 1, wet: 0.55, surf: SURF.concrete };
const LAMP: Look = { wash: 0xffdca6, emit: 1.4, line: 0, accent: true };

/** the bronze lattice cage in its own frame (floor top at y = 0, open faces ±z): corner posts, lattice sides, roof */
export function cageKit(): Kit {
  const k = new Kit(), w = CAGE - 0.05;
  k.box(0, -0.3, 0, 2 * w, 0.3, 2 * w, BRONZE_DK, { top: { ...BRONZE_DK, kind: K.panel } });
  k.box(0, CAGE_H, 0, 2 * w + 0.1, 0.3, 2 * w + 0.1, BRONZE);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) k.box(sx * w, 0, sz * w, 0.14, CAGE_H, 0.14, BRONZE);
  for (const sx of [-1, 1]) {
    const x = sx * w;
    // the brass rail at the waist, the lattice's bottom and top rails
    for (const y of [0.05, 1.0, CAGE_H - 0.2]) k.box(x, y, 0, 0.08, 0.1, 2 * w, y === 1.0 ? GOLD : BRONZE);
    // the lattice: upright bars and a diamond band between the waist rail and the top
    for (let i = 1; i < 10; i++) k.box(x, 0, -w + (2 * w * i) / 10, 0.05, CAGE_H, 0.05, BRONZE_DK);
    for (let i = 0; i < 5; i++) {
      const z0 = -w + (2 * w * i) / 5, z1 = -w + (2 * w * (i + 1)) / 5;
      k.beam(new Vector3(x, 1.1, z0), new Vector3(x, 2.3, z1), 0.05, 0.05, BRONZE);
      k.beam(new Vector3(x, 2.3, z0), new Vector3(x, 1.1, z1), 0.05, 0.05, BRONZE);
    }
  }
  // the gates' tracks across the two open faces (a lintel and a sill), the roof lamp, the chain shackles
  for (const sz of [-1, 1]) { k.box(0, CAGE_H - 0.18, sz * w, 2 * w, 0.18, 0.08, GOLD); k.box(0, 0, sz * w, 2 * w, 0.04, 0.1, GOLD); }
  k.box(0, CAGE_H - 0.12, 0, 0.6, 0.12, 0.6, LAMP);
  for (const sx of [-1, 1]) { k.box(sx * CHAIN_X, CAGE_H - 0.1, 0, 0.3, 0.5, 0.16, BRONZE_DK); k.box(sx * (CHAIN_X - 0.1), CAGE_H + 0.1, 0, 0.3, 0.12, 0.3, BRONZE_DK); }
  return k;
}

/**
 * SF8c: the stationary road gate in its own frame (feet at y = 0, across x, its road face toward −z): a lacquered
 * lattice gate across the socket's inner line, end posts on the parapets, three rails and bronze bars, a gold top band.
 * Shown only while its mover collides (the cage is away from the deck).
 */
export function roadGateKit(): Kit {
  const k = new Kit(), w = ROAD_GATE.width / 2, d = ROAD_GATE.depth, h = ROAD_GATE.height;
  for (const sx of [-1, 1]) k.box(sx * (w - 0.15), 0, 0, 0.3, h + 0.2, d + 0.1, LACQUER);
  for (const y of [0.1, 1.05, h - 0.2]) k.box(0, y, 0, 2 * w - 0.3, y === 0.1 ? 0.14 : 0.18, d, y === 1.05 ? LACQUER : LACQUER_DK);
  for (let i = 1; i < 16; i++) k.box(-w + 0.15 + ((2 * w - 0.3) * i) / 16, 0.24, 0, 0.05, h - 0.44, 0.05, BRONZE_DK);
  k.box(0, h - 0.02, 0, 2 * w - 0.3, 0.06, d + 0.04, GOLD);
  return k;
}

/** one timber frame of the shaft in its own frame (origin at the shaft's centre, at the frame's foot) */
export function frameKit(): Kit {
  const k = new Kit(), s = FRAME_STEP;
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) k.box(sx * POST, 0, sz * POST, 0.26, s, 0.26, LACQUER, { top: null, bottom: null });
  // the ring beam at the frame's head, and a timber girt on the two side faces at mid height
  for (const sz of [-1, 1]) k.box(0, s - 0.3, sz * POST, 2 * POST + 0.3, 0.3, 0.22, LACQUER_DK);
  for (const sx of [-1, 1]) k.box(sx * POST, s - 0.3, 0, 0.22, 0.3, 2 * POST + 0.3, LACQUER_DK);
  for (const sx of [-1, 1]) {
    k.box(sx * POST, s / 2, 0, 0.16, 0.18, 2 * POST, TIMBER);
    // a cross brace on each side face, outside the cage's travel
    k.beam(new Vector3(sx * (POST + 0.05), 0.3, -POST), new Vector3(sx * (POST + 0.05), s - 0.4, POST), 0.12, 0.1, TIMBER, new Vector3(1, 0, 0));
  }
  // the lantern arms over the deck and street faces' outer corners
  for (const sz of [-1, 1]) k.box(sz * (POST + 0.35), s - 0.55, sz * (POST + 0.35), 0.6, 0.08, 0.08, GOLD, { rotY: Math.PI / 4 });
  return k;
}

/** one chain link in its own frame (centred, its long axis up, its plane x / y): a stadium of four iron bars */
export function chainLinkKit(): Kit {
  const k = new Kit(), h = LINK * 1.3, w = 0.2, t = 0.04;
  for (const sx of [-1, 1]) k.box(sx * (w / 2 - t / 2), -h / 2, 0, t, h, t, IRON, { top: null, bottom: null });
  for (const sy of [-1, 1]) k.box(0, sy * (h / 2 - t / 2) - t / 2, 0, w, t, t, IRON, { sides: 15 });
  return k;
}

/** the lifts' static look into the `entries` kit, their frames and chains as instanced sets, their lanterns hung */
export function buildLifts(ctx: Ctx): void {
  const k = ctx.kit('entries');
  for (const l of LIFTS) {
    const yaw = liftYaw(l), c = liftBottom(l);
    const at = (a: number, cr: number): [number, number] => frameXZ(l, ALONG + a, l.across + cr);
    const put = (a: number, cr: number, y: number, sa: number, sc: number, sy: number, look: Look, opt: { top?: Look | null } = {}): void => {
      const [x, z] = at(a, cr); k.box(x, y, z, l.ix === 0 ? sc : sa, sy, l.ix === 0 ? sa : sc, look, opt);
    };
    // the footing behind the cage at the deck: stone, from under the deck to a lintel's height
    put(CAGE + 0.35, 0, -1.2, 0.6, 2 * CAGE + 0.8, 4.6, STONE);
    put(0, 0, -1.4, 2 * CAGE, 2 * CAGE, 0.2, STONE);
    // the deck pavilion round the door: two red columns, a lintel with a gold band, a green double roof
    for (const s of [-1, 1]) {
      put(-CAGE - 1.25, s * (CAGE + 0.4), 0, 0.5, 0.5, 4.2, LACQUER);
      ctx.lantern(...xyz(at(-CAGE - 1.75, s * (CAGE + 0.4)), 3.9), 1.1);
    }
    put(-CAGE - 1.25, 0, 3.9, 0.6, 2 * CAGE + 1.6, 0.5, LACQUER_DK);
    put(-CAGE - 1.56, 0, 4.0, 0.04, 2 * CAGE + 1.2, 0.18, GOLD);
    {
      const [x, z] = at(-CAGE - 0.85, 0), w = 2 * CAGE + 2.6, d = 2.8;
      hipRoof(ctx, k, x, 4.4, z, l.ix === 0 ? w : d, l.ix === 0 ? d : w, 0.9, 0.5, 0x2f5a3f, null);
      hipRoof(ctx, k, x, 5.5, z, l.ix === 0 ? w - 1 : d - 0.8, l.ix === 0 ? d - 0.8 : w - 1, 0.8, 0.4, 0x2f5a3f, null);
    }
    // the winch house at the top: corner posts on the shaft, its back wall, side panels, the drum and a green roof
    const t = l.top;
    for (const sa of [-1, 1]) for (const sc of [-1, 1]) put(sa * POST, sc * POST, t - 0.6, 0.3, 0.3, 5.4, LACQUER);
    put(-CAGE - 0.4, 0, t, 0.4, 2 * CAGE + 0.8, 3.4, LACQUER_DK);
    put(-CAGE - 0.62, 0, t + 1.6, 0.04, 2 * CAGE, 0.2, GOLD);
    for (const sc of [-1, 1]) put(0, sc * (POST + 0.05), t + 2.9, 2 * POST, 0.12, 1.2, TIMBER);
    put(0, 0, t + 3.7, 0.9, 2 * POST + 0.8, 0.9, TIMBER);
    for (const sc of [-1, 1]) put(0, sc * (POST + 0.5), t + 3.55, 1.3, 0.2, 1.3, BRONZE);
    put(-CAGE - 1.2, 0, t - 0.6, 1.4, 2 * POST + 1.0, 0.6, LACQUER_DK, { top: { ...TIMBER, kind: K.flag } });
    {
      const [x, z] = at(0, 0), w = 2 * POST + 1.6;
      hipRoof(ctx, k, x, t + 4.8, z, w, w, 1.6, 0.6, 0x2f5a3f, null);
    }
    ctx.lantern(...xyz(at(CAGE + 0.9, -POST - 0.6), t + 3.2), 1.2);
    ctx.lantern(...xyz(at(CAGE + 0.9, POST + 0.6), t + 3.2), 1.2);
    // the shaft: a timber frame every FRAME_STEP metres to the winch house, a red lantern on every frame's outer corner
    // (alternating deck and street faces), the two chains from the drum down to the pit
    const turn = new Matrix4().makeRotationY(yaw);
    for (let y = 0, i = 0; y < t - 0.5; y += FRAME_STEP, i++) {
      placeSet('lift-frame', () => frameKit().build(), turn.clone().setPosition(c.x, y, c.z));
      const face = i % 2 === 0 ? -1 : 1;
      ctx.lantern(...xyz(at(face * (POST + 0.6), face * (POST + 0.6)), y + FRAME_STEP - 0.6), 0.9);
    }
    for (const sx of [-1, 1]) {
      const [x, z] = at(0, sx * CHAIN_X);
      for (let y = LINK, i = 0; y < t + 3.6; y += LINK, i++) {
        const m = new Matrix4().makeRotationY(yaw + (i % 2 === 0 ? 0 : Math.PI / 2)).setPosition(x, y, z);
        placeSet('lift-chain', () => chainLinkKit().build(), m);
      }
    }
  }
}

/** a world x / z and a height as lantern arguments */
function xyz([x, z]: [number, number], y: number): [number, number, number] { return [x, y, z]; }
