// The movers' bodies (models/movers.ts): the monorail train, the cargo drone and the Well's gondola cabin, each its own
// mesh the world moves (build.ts `update`). The runtime half of the towers and the Well's crossings
// (../generators/towers.ts, well-bridges.ts lay those out at build time, baked: ./layoutBake.ts).
import { Vector3 } from 'three';
import { E, K, Kit, type Look } from '../world/kit';
import { SURF } from '../look/paint';

/** the train (its own mesh; main.ts slides it along x) */
export function trainKit(): Kit {
  const k = new Kit();
  const cars = 4, carL = 13;
  for (let i = 0; i < cars; i++) {
    const x = i * (carL + 0.6);
    k.box(x, -4.1, 0, carL, 2.9, 2.7, { wash: 0x6a717c, line: 1.2 }, { top: { wash: 0x565c66, line: 1 } });
    k.box(x, -3.1, 0, carL - 0.8, 0.9, 2.74, { wash: 0xffd9a0, emit: 0.3, kind: K.facade, row: 0.9, col: 1.4, seed: 7 + i, line: 1, accent: true });
    k.box(x, -4.05, 0, carL + 0.02, 0.28, 2.76, { wash: 0xc23b22, line: 1, accent: true });
    k.box(x, -1.2, 0, 2.2, 0.6, 1.4, { wash: 0x5c626c, line: 1 });
  }
  k.box(-carL / 2 - 0.05, -3.4, 0, 0.1, 0.35, 1.8, { wash: 0xfff6e0, emit: 4, line: 0.6, accent: true });
  return k;
}

/** a cargo drone (its own mesh; main.ts flies it): body, rotor arms, a slung crate, blinking beacons */
export function droneKit(): Kit {
  const k = new Kit();
  k.box(0, 0, 0, 1.6, 0.5, 1.6, { wash: 0x2a2c31, line: 1 });
  for (const [dx, dz] of [[1.3, 1.3], [-1.3, 1.3], [1.3, -1.3], [-1.3, -1.3]] as const) {
    k.beam(new Vector3(0, 0.3, 0), new Vector3(dx, 0.4, dz), 0.12, 0.12, { wash: 0x2a2c31, line: 0.8 });
    k.cyl(dx, 0.42, dz, 0.75, 0.75, 0.04, 12, { wash: 0x55595f, line: 1 });
  }
  k.beam(new Vector3(0, 0, 0), new Vector3(0, -1.6, 0), 0.03, 0.03, { wash: 0x2a2c31, line: 0.5 });
  k.box(0, -2.6, 0, 1.3, 1.0, 1.0, { wash: 0xd9a441, line: 1, accent: true });
  return k;
}

/**
 * The gondola's cabin (its origin on the cable; the mover slides it along x): a red lacquer body with a band of lit
 * windows and gilt trim, a hip roof, the hanger and the grip riding the cable on two wheels, a lamp at each end.
 */
export function gondolaCabin(): Kit {
  const k = new Kit();
  const RED: Look = { wash: 0xb32a1b, line: 1.1, accent: true, gloss: true, surf: SURF.lacquer };
  const RED_P: Look = { wash: 0xa82619, kind: K.panel, line: 1, accent: true, surf: SURF.lacquer };
  const RED_DK: Look = { wash: 0x6e1a10, line: 1, accent: true };
  const GOLD: Look = { wash: 0xd9b25a, line: 1, accent: true, gloss: true };
  const GLASS: Look = { wash: 0xffdca6, emit: 1.2, kind: K.facade, row: 1.0, col: 0.6, seed: 5, line: 1, accent: true };
  const W = 2.9, D = 2.1, y0 = -4.35;
  k.box(0, y0, 0, W - 0.1, 0.14, D - 0.1, RED_DK);
  k.box(0, y0 + 0.14, 0, W, 0.92, D, RED_P);
  k.box(0, y0 + 1.06, 0, W - 0.06, 1.0, D - 0.06, GLASS);
  // mullions round the window band, a sill and a head trim in gilt
  for (let i = 0; i <= 4; i++) for (const s of [-1, 1]) k.box(-W / 2 + (W * i) / 4, y0 + 1.06, s * (D / 2 - 0.02), 0.09, 1.0, 0.06, RED);
  for (let i = 0; i <= 3; i++) for (const s of [-1, 1]) k.box(s * (W / 2 - 0.02), y0 + 1.06, -D / 2 + (D * i) / 3, 0.06, 1.0, 0.09, RED);
  k.box(0, y0 + 1.02, 0, W + 0.06, 0.06, D + 0.06, GOLD);
  k.box(0, y0 + 2.06, 0, W, 0.3, D, RED);
  k.box(0, y0 + 2.08, 0, W + 0.06, 0.05, D + 0.06, GOLD);
  // the hip roof (four slopes to a short ridge), a ridge cap
  const e = y0 + 2.36, r = e + 0.5;
  const A = new Vector3(-W / 2 - 0.14, e, D / 2 + 0.14), B = new Vector3(W / 2 + 0.14, e, D / 2 + 0.14), C = new Vector3(W / 2 + 0.14, e, -D / 2 - 0.14), Dd = new Vector3(-W / 2 - 0.14, e, -D / 2 - 0.14);
  const R0 = new Vector3(-0.5, r, 0), R1 = new Vector3(0.5, r, 0);
  const roof: Look = { wash: 0x7e1f14, kind: K.tiles, line: 1, accent: true };
  k.quad4(A, B, R1, R0, W, 1.2, roof, 0, 0, E.v0);
  k.quad4(C, Dd, R0, R1, W, 1.2, roof, 0, 0, E.v0);
  k.tri(Dd, A, R0, roof);
  k.tri(B, C, R1, roof);
  k.quad4(Dd, C, B, A, W, D, RED_DK);
  k.box(0, r - 0.05, 0, 1.2, 0.12, 0.16, GOLD);
  // the hanger (a yoke over the roof), the grip on the cable, its two wheels
  k.box(0, r, 0, 0.14, -0.5 - r, 0.14, { wash: 0x2a2c31, line: 1 });
  k.beam(new Vector3(-0.9, e + 0.02, 0), new Vector3(0, r + 0.5, 0), 0.08, 0.08, { wash: 0x2a2c31, line: 1 });
  k.beam(new Vector3(0.9, e + 0.02, 0), new Vector3(0, r + 0.5, 0), 0.08, 0.08, { wash: 0x2a2c31, line: 1 });
  k.box(0, -0.5, 0, 1.4, 0.34, 0.34, { wash: 0x3a3d44, line: 1 });
  for (const x of [-0.45, 0.45]) k.cyl(x, -0.15, 0, 0.2, 0.2, 0.12, 10, { wash: 0x55595f, line: 1 });
  // lamps at both ends and a destination plate on each side
  for (const s of [-1, 1]) {
    k.box(s * (W / 2 + 0.04), y0 + 0.55, 0, 0.08, 0.18, 0.34, { wash: 0xffe6b0, emit: 2.2, line: 0.5, accent: true });
    k.box(0, y0 + 0.4, s * (D / 2 + 0.03), 1.1, 0.26, 0.04, GOLD);
  }
  return k;
}
