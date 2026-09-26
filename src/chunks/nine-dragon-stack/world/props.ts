// Small props, all ruled: people (brush-dark coats), mahjong tables, stools, scooters, the dragon hooks (the only gold in
// reach, reserved for the grapple), laundry, pipes; plus the instanced lantern and air-con kit pieces.
import { Vector3 } from 'three';
import type { Ctx } from './ctx';
import { E, K, Kit, type Look } from './kit';
import { MIN, METAL, type Rng } from '../util';

const rot = (ox: number, oz: number, r: number): [number, number] => [ox * Math.cos(r) + oz * Math.sin(r), -ox * Math.sin(r) + oz * Math.cos(r)];

const COATS = [0x2a2c31, 0x33363e, 0x3b3f4a, 0x283044, 0x4a4336, 0x5a3a33, 0x3e4a44, 0x6b6f78, 0x2d2a2a, 0x8a8f96] as const;
const SKIN = 0xc9a58a;

/** a figure, brush-round (living things are never ruled): standing, seated at a table, or cooking */
export function person(k: Kit, rng: Rng, x: number, y: number, z: number, r: number, pose: 'stand' | 'sit' | 'cook' = 'stand', umbrella = false): void {
  const coat: Look = { wash: rng.pick(COATS), line: 0 };
  const trousers: Look = { wash: rng.chance(0.5) ? 0x24262b : 0x3a3d45, line: 0 };
  const skin: Look = { wash: SKIN, line: 0 };
  const hair: Look = { wash: rng.chance(0.3) ? 0x8f9097 : 0x1b1b1e, line: 0 };
  const P = (ox: number, oy: number, oz: number): Vector3 => { const [dx, dz] = rot(ox, oz, r); return new Vector3(x + dx, y + oy, z + dz); };
  const limb = (a: Vector3, b: Vector3, r0: number, r1: number, lk: Look): void => { k.limb(a, b, r0, r1, 7, lk, E.none, true); };
  const s = rng.range(0.93, 1.06);
  const head = (hy: number, hz: number, hat: number): void => {
    const c = P(0, hy, hz);
    limb(P(0, hy - 0.17, hz), P(0, hy - 0.08, hz), 0.045, 0.045, skin);
    k.lathe(c.x, c.y - 0.1, c.z, [[0.02, 0], [0.07, 0.015], [0.1, 0.06], [0.105, 0.11], [0.09, 0.16], [0.05, 0.195], [0.01, 0.205]], 8, skin, false, 0);
    if (hat < 0.25) k.cyl(c.x, c.y + 0.06, c.z, 0.3, 0.02, 0.14, 10, { wash: 0xb89a62, line: 0.8, accent: true }, { edges: E.v0 });
    else if (hat < 0.45) k.cyl(c.x, c.y + 0.05, c.z, 0.11, 0.1, 0.07, 8, { wash: 0x2a2c31, line: 0 });
    else k.lathe(c.x, c.y + 0.02, c.z, [[0.108, 0], [0.1, 0.05], [0.07, 0.085], [0.02, 0.1]], 8, pose === 'cook' ? { wash: 0xeeeae0, line: 0 } : hair, false, 0);
  };
  if (pose === 'sit') {
    for (const sx of [-1, 1]) {
      limb(P(sx * 0.09, 0.47, -0.02), P(sx * 0.1, 0.47, 0.38), 0.075, 0.062, trousers);
      limb(P(sx * 0.1, 0.47, 0.38), P(sx * 0.1, 0.04, 0.4), 0.058, 0.05, trousers);
      limb(P(sx * 0.2, s, 0), P(sx * 0.22, 0.8 * s, 0.22), 0.055, 0.05, coat);
      limb(P(sx * 0.22, 0.8 * s, 0.22), P(sx * 0.12, 0.76 * s, 0.42), 0.05, 0.04, coat);
    }
    limb(P(0, 0.44, -0.02), P(0, 1.02 * s, 0.03), 0.18, 0.165, coat);
    head(1.24 * s, 0.05, rng.next());
    return;
  }
  const lean = pose === 'cook' ? 0.06 : 0;
  for (const sx of [-1, 1]) {
    limb(P(sx * 0.09, 0.86 * s, 0), P(sx * 0.1, 0.06, 0.02), 0.075, 0.055, trousers);
    k.box(P(sx * 0.1, 0, 0.06).x, y, P(sx * 0.1, 0, 0.06).z, 0.1, 0.07, 0.22, { wash: 0x17181b, line: 0 }, { rotY: r });
  }
  const longCoat = rng.chance(0.45);
  limb(P(0, longCoat ? 0.5 : 0.8, 0), P(0, 1.4 * s, lean), longCoat ? 0.21 : 0.19, 0.17, coat);
  if (pose === 'cook') {
    k.quad(P(-0.18, 0.62, 0.2), new Vector3(Math.cos(r), 0, -Math.sin(r)), new Vector3(0, 1, 0), 0.36, 0.62, { wash: 0xe9e5da, line: 0 });
    for (const sx of [-1, 1]) {
      limb(P(sx * 0.21, 1.36 * s, lean), P(sx * 0.2, 1.1 * s, 0.22), 0.055, 0.048, coat);
      limb(P(sx * 0.2, 1.1 * s, 0.22), P(sx * 0.12, 1.08 * s, 0.45), 0.048, 0.04, coat);
    }
  } else {
    const swing = rng.range(-0.12, 0.12);
    for (const sx of [-1, 1]) {
      limb(P(sx * 0.21, 1.36 * s, 0), P(sx * 0.25, 0.94 * s, swing * sx), 0.055, 0.045, coat);
      limb(P(sx * 0.25, 0.94 * s, swing * sx), P(sx * 0.25, 0.86 * s, swing * sx), 0.035, 0.03, skin);
    }
  }
  head(1.62 * s, lean, pose === 'cook' ? 0.9 : rng.next());
  if (umbrella) {
    const [dx, dz] = rot(0.26, 0.08, r);
    k.beam(new Vector3(x + dx, y + 1.0, z + dz), new Vector3(x + dx, y + 2.1, z + dz), 0.025, 0.025, { wash: 0x1c1c1f, line: 0.4 });
    k.cyl(x + dx, y + 1.98, z + dz, 0.64, 0.03, 0.3, 12, { wash: rng.pick([0xb8321f, 0x1d1f25, 0xc9502a, 0x2e5fa3, 0xb8321f, 0xd9a441]), kind: K.cloth, row: 0, col: 0.2, line: 1, accent: true }, { edges: E.sides | E.v0 });
  }
}

export function stool(k: Kit, x: number, y: number, z: number, wash: number): void {
  k.cyl(x, y, z, 0.17, 0.15, 0.45, 8, { wash, line: 0.8, accent: true });
}

/** a mahjong table: green felt, ivory tile walls, four stools */
export function mahjong(k: Kit, rng: Rng, x: number, y: number, z: number, r: number, players: number): void {
  k.box(x, y + 0.72, z, 0.96, 0.06, 0.96, { wash: 0x5a3a26, line: 1, accent: true }, { rotY: r, top: { wash: 0x2f6a4c, line: 1, accent: true } });
  for (const [lx, lz] of [[-0.4, -0.4], [0.4, -0.4], [0.4, 0.4], [-0.4, 0.4]] as const) {
    const [dx, dz] = rot(lx, lz, r);
    k.box(x + dx, y, z + dz, 0.06, 0.72, 0.06, { wash: 0x3d2a1e, line: 0.6 }, { rotY: r });
  }
  const tile: Look = { wash: 0xefe8d6, line: 0.6, accent: true };
  for (let side = 0; side < 4; side++) {
    const a = r + (side * Math.PI) / 2;
    const [dx, dz] = rot(0, 0.3, a);
    k.box(x + dx, y + 0.75, z + dz, 0.56, 0.035, 0.05, tile, { rotY: a });
    const [ex, ez] = rot(rng.range(-0.15, 0.15), 0.1, a);
    k.box(x + ex, y + 0.75, z + ez, 0.08, 0.02, 0.06, tile, { rotY: a + rng.range(-0.5, 0.5) });
  }
  const stoolCol = rng.pick([0xb8352a, 0x2f5f9a, 0xb8352a, 0x3c7a5a]);
  for (let side = 0; side < 4; side++) {
    const a = r + (side * Math.PI) / 2;
    const [dx, dz] = rot(0, -0.75, a);
    stool(k, x + dx, y, z + dz, stoolCol);
    if (side < players) person(k, rng, x + dx, y, z + dz, a, 'sit');
  }
}

export function scooter(k: Kit, x: number, y: number, z: number, r: number, wash: number): void {
  const [fx, fz] = rot(0, 0.62, r), [bx, bz] = rot(0, -0.6, r);
  k.cyl(x + fx, y + 0.24, z + fz, 0.24, 0.24, 0.1, 10, { wash: 0x1a1b1f, line: 0.8 }, { edges: E.rims });
  k.cyl(x + bx, y + 0.24, z + bz, 0.24, 0.24, 0.1, 10, { wash: 0x1a1b1f, line: 0.8 }, { edges: E.rims });
  k.box(x, y + 0.3, z, 0.36, 0.34, 1.1, { wash, line: 1, accent: true }, { rotY: r });
  k.box(x + bx * 0.6, y + 0.64, z + bz * 0.6, 0.32, 0.12, 0.62, { wash: 0x1d1e22, line: 1 }, { rotY: r });
  const [hx, hz] = rot(0, 0.55, r);
  k.box(x + hx, y + 0.6, z + hz, 0.3, 0.5, 0.16, { wash, line: 1, accent: true }, { rotY: r });
  k.box(x + hx, y + 1.1, z + hz, 0.62, 0.05, 0.05, { wash: 0x1d1e22, line: 0.8 }, { rotY: r });
}

/** the instanced paper lantern: ribbed red body (emissive), gold caps, a tassel; hangs from its top at y = 0 */
export function lanternKit(): Kit {
  const k = new Kit();
  const prof: [number, number][] = [];
  for (let i = 0; i <= 8; i++) {
    const t = i / 8;
    const y = -0.62 + t * 0.52;
    prof.push([0.06 + Math.sin(t * Math.PI) * 0.26, y]);
  }
  k.lathe(0, 0, 0, prof, 10, { wash: 0xff5236, emit: 1.35, line: 0.7, accent: true }, true, 0);
  const cap: Look = { wash: METAL.gold, line: 0.8, accent: true };
  k.cyl(0, -0.1, 0, 0.1, 0.1, 0.06, 8, cap);
  k.cyl(0, -0.68, 0, 0.1, 0.1, 0.06, 8, cap);
  k.box(0, -0.98, 0, 0.05, 0.3, 0.05, { wash: 0xc2301f, line: 0.5, accent: true });
  k.box(0, -0.04, 0, 0.012, 0.08, 0.012, { wash: 0x222222, line: 0.3 });
  return k;
}

/** the instanced air-con box, backed against a wall facing +z */
export function acKit(): Kit {
  const k = new Kit();
  k.box(0, 0, 0.17, 0.82, 0.56, 0.34, { wash: 0xb7bbc0, line: 1 }, { sides: 1 | 2 | 8 });
  k.quad(new Vector3(-0.41, 0, 0.34), new Vector3(1, 0, 0), new Vector3(0, 1, 0), 0.82, 0.56, { wash: 0xaeb2b8, kind: K.panel, line: 1 });
  k.cyl(0.14, 0.28, 0.345, 0.17, 0.17, 0.005, 12, { wash: 0x7d828a, line: 0.8 }, { edges: E.rims });
  k.box(-0.3, -0.12, 0.2, 0.05, 0.12, 0.05, { wash: 0x55595f, line: 0.5 });
  k.box(0.3, -0.12, 0.2, 0.05, 0.12, 0.05, { wash: 0x55595f, line: 0.5 });
  return k;
}

/**
 * A brass dragon hook (飛爪 anchor): a bracket out from a wall along `out`, a snarling head, a hanging ring. Gold is
 * reserved for these (the grapple's Runner Vision). Returns the ring's centre, registered as a hook.
 */
export function dragonHook(k: Kit, ctx: Ctx, base: Vector3, out: Vector3, reach = 0.9): Vector3 {
  const brass: Look = { wash: METAL.gold, line: 1.1, gloss: true, gold: true, accent: true };
  const o = out.clone().setY(0).normalize();
  const side = new Vector3(-o.z, 0, o.x);
  const tip = base.clone().addScaledVector(o, reach);
  k.beam(base, tip, 0.1, 0.12, brass);
  k.beam(base.clone().add(new Vector3(0, -0.5, 0)), tip.clone().addScaledVector(o, -0.25), 0.06, 0.06, brass);
  // head: skull, snout, jaw, two swept horns
  const head = tip.clone().addScaledVector(o, 0.12);
  k.boxAxes(head.clone().add(new Vector3(0, 0.08, 0)), side, new Vector3(0, 1, 0), o, 0.13, 0.13, 0.16, brass);
  k.boxAxes(head.clone().addScaledVector(o, 0.24).add(new Vector3(0, 0.06, 0)), side, new Vector3(0, 1, 0), o, 0.08, 0.07, 0.12, brass);
  k.boxAxes(head.clone().addScaledVector(o, 0.2).add(new Vector3(0, -0.07, 0)), side, new Vector3(0, 1, 0), o, 0.07, 0.03, 0.12, brass);
  for (const sgn of [-1, 1]) {
    const h0 = head.clone().addScaledVector(side, 0.09 * sgn).add(new Vector3(0, 0.18, 0));
    k.beam(h0, h0.clone().addScaledVector(o, -0.32).add(new Vector3(0, 0.2, 0)).addScaledVector(side, 0.08 * sgn), 0.035, 0.035, brass);
  }
  // the ring the claw bites
  const ringC = head.clone().addScaledVector(o, 0.3).add(new Vector3(0, -0.28, 0));
  const R = 0.16;
  for (let i = 0; i < 10; i++) {
    const a0 = (i / 10) * Math.PI * 2, a1 = ((i + 1) / 10) * Math.PI * 2;
    const p0 = ringC.clone().addScaledVector(o, Math.cos(a0) * R).add(new Vector3(0, Math.sin(a0) * R, 0));
    const p1 = ringC.clone().addScaledVector(o, Math.cos(a1) * R).add(new Vector3(0, Math.sin(a1) * R, 0));
    k.beam(p0, p1, 0.035, 0.035, brass);
  }
  ctx.hooks.push(ringC.clone());
  return ringC;
}

const CLOTHES = [0xeceae2, 0x6f9ccf, 0xc23b22, 0xd9a441, 0xe8dfc9, 0x2e5fa3, 0x7fbf9a, 0xeceae2, 0x8a6a3a] as const;
/** a laundry line: a sagging wire with shirts and sheets pegged on */
export function laundry(k: Kit, rng: Rng, a: Vector3, b: Vector3): void {
  const n = 6;
  const sag = a.distanceTo(b) * 0.06;
  const at = (t: number): Vector3 => a.clone().lerp(b, t).add(new Vector3(0, -sag * 4 * t * (1 - t), 0));
  for (let i = 0; i < n; i++) k.beam(at(i / n), at((i + 1) / n), 0.015, 0.015, { wash: 0x2a2c31, line: 0.4 });
  const d = new Vector3().subVectors(b, a).setY(0).normalize();
  const up = new Vector3(0, 1, 0);
  let t = rng.range(0.05, 0.15);
  while (t < 0.9) {
    const w = rng.range(0.4, 1.0), h = rng.range(0.5, 1.1);
    const p = at(t);
    k.quad(p.clone().add(new Vector3(0, -h, 0)), d, up, w, h, { wash: rng.pick(CLOTHES), kind: K.cloth, row: rng.chance(0.3) ? 1 : 0, col: 0.12, line: 0.7, accent: true });
    t += (w + rng.range(0.1, 0.3)) / a.distanceTo(b);
  }
}

/** a street lamp: a pole with a hooded warm lamp */
export function lamp(k: Kit, x: number, y: number, z: number, h: number): void {
  k.beam(new Vector3(x, y, z), new Vector3(x, y + h, z), 0.1, 0.1, { wash: 0x2a2c31, line: 1 });
  k.box(x, y + h - 0.1, z, 0.34, 0.3, 0.34, { wash: 0xffd9a0, emit: 1.8, line: 1, accent: true });
  k.box(x, y + h + 0.2, z, 0.5, 0.08, 0.5, { wash: MIN.malachite, line: 1, accent: true });
}
