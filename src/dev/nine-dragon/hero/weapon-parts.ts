// Copied from the hero lab (src/dev/nd-lab/hero/weapon-parts.ts, round-7-lab-hero) into the clean room.
// The Neon Jian and the Fei Zhua as geometry (lab P4 "hero", E169). Every builder writes Kit / KitX attributes with a
// viewmodel material class in `kind` (vm-material.ts VM.*), so the whole viewmodel is one program and one hull.
//
// Jian local frame (the same as the clean room's weapon.ts): the grip axis is +y, the blade runs up +y from the guard
// at y ≈ 0, its edges are ±x and its flats face ±z. The dragon guard faces up the blade (snout +y), its crown toward +x
// (the upper edge), so a viewer looking at the flat sees the head in profile, as on the weapon sheet (round-1 08).
// Fei Zhua local frame: +y runs from the elbow to the claw, +z is the back of the forearm (the top in first person).
import { Vector3 } from 'three';
import { E, type Kit } from '../kit';
import { type KitX, type XLook, curve } from './kitx';
import { VM } from './vm-material';

const v = (x: number, y: number, z: number): Vector3 => new Vector3(x, y, z);

export const LOOK = {
  brass: { wash: 0x9c7c3a, kind: VM.brass, line: 1 } as XLook,
  darkBrass: { wash: 0x76592a, kind: VM.darkBrass, line: 1 } as XLook,
  steel: { wash: 0x191c22, kind: VM.steel, line: 1 } as XLook,
  bevel: { wash: 0x3a424e, kind: VM.steel, line: 1 } as XLook,
  glow: { wash: 0xd9fbff, kind: VM.glow, emit: 4.2, line: 0 } as XLook,
  lacquer: { wash: 0x121317, kind: VM.lacquer, col: 0.011, line: 1 } as XLook,
  glove: { wash: 0x24252b, kind: VM.matte, line: 1 } as XLook,
  leather: { wash: 0x1d1c20, kind: VM.matte, line: 1 } as XLook,
  cloth: { wash: 0xe4ddcc, kind: VM.matte, row: 0.03, line: 1 } as XLook,
  sleeve: { wash: 0x2a2d38, kind: VM.matte, row: 0.05, line: 1 } as XLook,
  silk: { wash: 0xc22d1e, kind: VM.silk, line: 1 } as XLook,
  silkDark: { wash: 0x8e1d14, kind: VM.silk, line: 1 } as XLook,
  paper: { wash: 0xffffff, kind: VM.paper, line: 1 } as XLook,
  eye: { wash: 0xff5a3a, kind: VM.glow, emit: 2.5, line: 0 } as XLook,
  fang: { wash: 0xf2eee4, kind: VM.matte, line: 1 } as XLook,
} as const;

/** tunables of the jian (metres) */
export const JIAN = {
  /** blade root (just out of the dragon's jaws) and length */
  root: 0.05,
  len: 0.74,
  /** half width at the root and at the start of the tip */
  hw0: 0.024,
  hw1: 0.019,
  tip: 0.07,
  thick: 0.0055,
  /** the glowing edge band, as a share of the half width */
  glow: 0.2,
} as const;

/** the tip's local y */
export const TIP_Y = JIAN.root + JIAN.len;

/** the blade: a hexagonal section (edge, bevel shoulder, ridge), the neon edges on the outer bevel, the etched flats */
export function buildBlade(k: Kit): void {
  const { root, len, hw0, hw1, tip, thick } = JIAN;
  const yT = root + len - tip;
  const steps = 6;
  const st = (i: number): { y: number; hw: number } => {
    const t = i / steps;
    return { y: root + (yT - root) * t, hw: hw0 + (hw1 - hw0) * t };
  };
  const tipP = v(0, root + len, 0);
  for (let i = 0; i < steps; i++) {
    const a = st(i), b = st(i + 1);
    const h = b.y - a.y;
    for (const sz of [1, -1]) {
      for (const sx of [1, -1]) {
        // outer edge → glow boundary → shoulder → ridge
        const E0a = v(sx * a.hw, a.y, 0), E0b = v(sx * b.hw, b.y, 0);
        const Ga = v(sx * a.hw * (1 - JIAN.glow), a.y, sz * thick * 0.18), Gb = v(sx * b.hw * (1 - JIAN.glow), b.y, sz * thick * 0.18);
        const Sa = v(sx * a.hw * 0.62, a.y, sz * thick * 0.55), Sb = v(sx * b.hw * 0.62, b.y, sz * thick * 0.55);
        const Ra = v(0, a.y, sz * thick), Rb = v(0, b.y, sz * thick);
        // winding: the face normal must point out (+sz); flip the quad order with the side signs
        const q = (p0: Vector3, p1: Vector3, p2: Vector3, p3: Vector3, w: number, lk: XLook, edges: number): void => {
          if (sx * sz > 0) k.quad4(p1, p0, p3, p2, w, h, { ...lk, edges }, 0, a.y - root);
          else k.quad4(p0, p1, p2, p3, w, h, { ...lk, edges }, 0, a.y - root);
        };
        q(E0a, Ga, Gb, E0b, a.hw * JIAN.glow, LOOK.glow, E.none);
        q(Ga, Sa, Sb, Gb, a.hw * 0.2, LOOK.bevel, E.none);
        q(Sa, Ra, Rb, Sb, a.hw * 0.62, { ...LOOK.steel, row: sz > 0 ? 1 : 0 }, E.none);
      }
    }
  }
  // the tip: every ring point runs into the point
  const b = st(steps);
  for (const sz of [1, -1]) {
    for (const sx of [1, -1]) {
      const E0 = v(sx * b.hw, b.y, 0), G = v(sx * b.hw * (1 - JIAN.glow), b.y, sz * thick * 0.18);
      const S = v(sx * b.hw * 0.62, b.y, sz * thick * 0.55), R = v(0, b.y, sz * thick);
      const tri = (p0: Vector3, p1: Vector3, lk: XLook): void => {
        if (sx * sz > 0) k.tri(p1, p0, tipP, { ...lk, kind: lk.kind ?? 0 });
        else k.tri(p0, p1, tipP, { ...lk, kind: lk.kind ?? 0 });
      };
      tri(E0, G, LOOK.glow);
      tri(G, S, LOOK.bevel);
      tri(S, R, LOOK.steel);
    }
  }
}

/** the procedural dragon-head guard (the fallback when no TRELLIS head is loaded) */
export function buildGuardProcedural(x: KitX): void {
  const X = v(1, 0, 0), Y = v(0, 1, 0), Z = v(0, 0, 1);
  const B = LOOK.brass, D = LOOK.darkBrass;
  // skull, crown up (+x), a heavy brow; the snout forward (+y); the lower jaw hangs open below the blade
  x.ellipsoid(v(0.012, -0.004, 0), X, Y, Z, 0.026, 0.032, 0.022, B, (d) => 1 + 0.08 * Math.sin(d.x * 9 + d.y * 7) * Math.sin(d.z * 8));
  x.ellipsoid(v(0.024, 0.038, 0), X, Y, Z, 0.014, 0.032, 0.017, B, (d) => 1 + 0.1 * Math.max(0, d.x) * Math.sin(d.y * 14));
  x.ellipsoid(v(0.029, 0.066, 0), X, Y, Z, 0.012, 0.012, 0.016, D);
  x.ellipsoid(v(-0.024, 0.03, 0), X, Y, Z, 0.009, 0.03, 0.014, B);
  x.ellipsoid(v(-0.002, -0.012, 0), X, Y, Z, 0.022, 0.026, 0.02, D);
  for (const sz of [1, -1]) {
    // brow ridge and a glowing eye under it
    x.sweep(curve([v(0.03, 0.03, sz * 0.012), v(0.036, 0.012, sz * 0.017), v(0.034, -0.008, sz * 0.02)], 4), (t) => 0.006 * (1 - t * 0.6), 6, B, { capStart: true, capEnd: true });
    x.ellipsoid(v(0.026, 0.018, sz * 0.018), X, Y, Z, 0.004, 0.006, 0.003, LOOK.eye);
    // fangs, top and bottom
    for (const fy of [0.05, 0.03]) {
      x.sweep([v(0.014, fy, sz * 0.01), v(0.004, fy + 0.004, sz * 0.009)], (t) => 0.003 * (1 - t), 5, LOOK.fang, { capStart: true });
      x.sweep([v(-0.018, fy, sz * 0.009), v(-0.009, fy + 0.004, sz * 0.008)], (t) => 0.0026 * (1 - t), 5, LOOK.fang, { capStart: true });
    }
    // two antler horns swept back past the grip
    x.sweep(curve([v(0.034, 0.0, sz * 0.012), v(0.05, -0.03, sz * 0.02), v(0.058, -0.065, sz * 0.024), v(0.05, -0.1, sz * 0.022)], 5), (t) => 0.0055 * (1 - t * 0.85), 7, B, { capStart: true });
    x.sweep(curve([v(0.05, -0.035, sz * 0.02), v(0.066, -0.045, sz * 0.03), v(0.07, -0.06, sz * 0.03)], 3), (t) => 0.003 * (1 - t * 0.8), 6, B);
    // the mane: flame locks swept back and out, alternating light and dark brass
    for (let m = 0; m < 5; m++) {
      const y0 = 0.01 - m * 0.012;
      const xa = 0.02 - m * 0.012;
      const sp = 0.022 + m * 0.004;
      x.sweep(curve([v(xa, y0, sz * 0.014), v(xa + 0.004, y0 - 0.025, sz * sp), v(xa - 0.004, y0 - 0.05, sz * (sp + 0.012)), v(xa - 0.012, y0 - 0.068, sz * (sp + 0.006))], 4),
        (t) => 0.0075 * Math.sin(Math.PI * Math.min(1, t * 1.15 + 0.08)), 7, m % 2 === 0 ? B : D, { flat: 0.45, up: v(0, 0, 1), capStart: true });
    }
    // whiskers from the snout, curling back
    x.sweep(curve([v(0.02, 0.07, sz * 0.012), v(0.012, 0.06, sz * 0.03), v(0.0, 0.035, sz * 0.042), v(-0.004, 0.01, sz * 0.04), v(0.004, -0.004, sz * 0.034)], 4), (t) => 0.0022 * (1 - t * 0.7), 5, B);
  }
  // the socket ring the grip enters
  x.sweep([v(0, -0.028, 0), v(0, -0.04, 0)], () => 0.02, 14, D, { capEnd: true });
}

/** the blade clip: a brass sleeve over the blade's root with a point running up the blade (the target's ricasso cap) */
export function buildBladeClip(x: KitX): void {
  x.sweep(curve([v(0, 0.03, 0), v(0, 0.06, 0), v(0, 0.09, 0)], 4), (t) => 0.024 * (1 - t) ** 1.3 + 0.004, 10, LOOK.brass, { flat: 0.42, up: v(0, 0, 1), capStart: true });
}

/** grip, collar, silk band, ferrules and pommel (the grip's lacquer carries a diamond silk wrap); the grip runs to y −0.3 */
export function buildGrip(k: Kit, x: KitX): void {
  x.sweep([v(0, -0.036, 0), v(0, -0.052, 0)], () => 0.0185, 14, LOOK.silk);
  x.sweep([v(0, -0.052, 0), v(0, -0.06, 0)], () => 0.019, 14, LOOK.brass);
  x.sweep(curve([v(0, -0.06, 0), v(0, -0.18, 0), v(0, -0.3, 0)], 4), (t) => 0.0158 + 0.0014 * Math.sin(t * Math.PI), 14, LOOK.lacquer, { flat: 0.85 });
  // a brass band with a medallion a third of the way down (the target's gold ring on the grip)
  x.sweep([v(0, -0.1, 0), v(0, -0.108, 0)], () => 0.0182, 14, LOOK.brass);
  x.ellipsoid(v(0, -0.104, 0.017), v(1, 0, 0), v(0, 1, 0), v(0, 0, 1), 0.007, 0.007, 0.003, LOOK.brass);
  x.sweep([v(0, -0.3, 0), v(0, -0.314, 0)], () => 0.0182, 14, LOOK.brass);
  k.lathe(0, -0.352, 0, [[0.004, 0], [0.014, 0.006], [0.02, 0.018], [0.018, 0.03], [0.016, 0.038]], 12, LOOK.brass, true, 0);
}

/** the red silk tassel, hanging from its pivot (origin) down −y; swings as one pendulum */
export function buildTassel(x: KitX): void {
  // cord → a knot → a gold cap → a fat skirt of silk strands
  x.sweep([v(0, 0, 0), v(0, -0.03, 0)], () => 0.003, 6, LOOK.silkDark);
  x.ellipsoid(v(0, -0.038, 0), v(1, 0, 0), v(0, 1, 0), v(0, 0, 1), 0.01, 0.011, 0.01, LOOK.silk);
  x.sweep([v(0, -0.048, 0), v(0, -0.06, 0)], (t) => 0.009 + 0.003 * t, 10, LOOK.brass);
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    const r0 = 0.01, r1 = 0.018 + (i % 3) * 0.003;
    const len = 0.1 + (i % 4) * 0.009;
    x.sweep(curve([v(Math.cos(a) * r0, -0.06, Math.sin(a) * r0), v(Math.cos(a) * r1, -0.06 - len * 0.5, Math.sin(a) * r1), v(Math.cos(a) * (r1 + 0.003), -0.06 - len, Math.sin(a) * (r1 + 0.003))], 3),
      (t) => 0.0052 * (1 - t * 0.4), 5, i % 2 === 0 ? LOOK.silk : LOOK.silkDark);
  }
}

/** the fu talisman (gamboge paper, red kai 鎮邪) on a short cord from its pivot (origin), hanging down −y */
export function buildTalisman(x: KitX): void {
  x.sweep(curve([v(0, 0, 0), v(0.002, -0.014, 0), v(0, -0.026, 0)], 3), () => 0.0016, 5, LOOK.silkDark);
  x.ellipsoid(v(0, -0.028, 0), v(1, 0, 0), v(0, 1, 0), v(0, 0, 1), 0.004, 0.004, 0.004, LOOK.silk);
  x.card(v(0, -0.085, 0), v(1, 0, 0), v(0, 1, 0), 0.04, 0.11, LOOK.paper);
}

/** the gloved right fist round the lower grip (grip axis = y; knuckles toward +z = the viewer's side of the flat) */
export function buildGripHand(x: KitX): void {
  const G = LOOK.glove;
  const o = -0.1;
  x.ellipsoid(v(-0.018, -0.13 + o, -0.004), v(1, 0, 0), v(0, 1, 0), v(0, 0, 1), 0.026, 0.055, 0.028, G);
  for (let i = 0; i < 4; i++) {
    const y = -0.092 - i * 0.023 + o;
    const r = 0.0104 - i * 0.0006;
    // each finger curls round the front of the grip: base on the palm side (-x), over +z, tip back at +x
    x.sweep(curve([v(-0.022, y, 0.012), v(-0.004, y - 0.002, 0.028), v(0.019, y - 0.004, 0.019), v(0.026, y - 0.004, 0.0)], 3), () => r, 7, G, { capEnd: true });
    x.ellipsoid(v(-0.004, y - 0.002, 0.028), v(1, 0, 0), v(0, 1, 0), v(0, 0, 1), r * 1.12, r * 1.05, r, G);
  }
  x.sweep(curve([v(-0.032, -0.1 + o, -0.012), v(-0.022, -0.078 + o, 0.004), v(0.0, -0.073 + o, 0.021), v(0.013, -0.079 + o, 0.025)], 3), (t) => 0.0115 * (1 - t * 0.25), 7, G, { capEnd: true });
}

/** the right forearm from the wrist (0) to the elbow (1) along +y; the Viewmodel scales it in y per frame */
export function buildRightForearm(x: KitX): void {
  x.sweep([v(0, 0, 0), v(0, 0.07, 0)], (t) => 0.029 + 0.006 * t, 12, LOOK.glove);
  x.sweep([v(0, 0.07, 0), v(0, 0.11, 0)], () => 0.041, 12, LOOK.silk);
  x.sweep([v(0, 0.11, 0), v(0, 0.55, 0), v(0, 1, 0)], (t) => 0.046 + 0.03 * t, 12, LOOK.sleeve);
}

/**
 * The three talons of the Fei Zhua around a brass hub (hub at the origin, flight axis +y, the back of the hand +z).
 * Each is a thick brass crescent — a cat's claw, not a wire — rising off the hub, arching forward and hooking down at
 * the point. `spread` 0 = folded (a fan of three over the fist, round-6 A), 1 = open (a three-way grapple in flight).
 */
export function buildClaw(x: KitX, spread: number): void {
  x.sweep([v(0, -0.03, 0), v(0, 0.014, 0)], (t) => 0.026 - t * 0.004, 14, LOOK.darkBrass, { capStart: true });
  x.ellipsoid(v(0, 0.016, 0), v(1, 0, 0), v(0, 1, 0), v(0, 0, 1), 0.024, 0.013, 0.024, LOOK.brass);
  for (let i = -1; i <= 1; i++) {
    // folded: fanned from the top (+z) round toward the eye's side (+x); open: three-way at 120°
    const phi = i * (0.75 + spread * 1.34) + (1 - spread) * 0.75;
    const rd = v(Math.sin(phi), 0, Math.cos(phi));
    const side = v(Math.cos(phi), 0, -Math.sin(phi));
    const k = i === 0 ? 1.08 : 0.95;
    const w = 1 + spread * 0.45;
    const at = (r: number, y: number): Vector3 => rd.clone().multiplyScalar(r * w).setY(y * k);
    // a true arc (a cat's claw): leaves the hub heading up-and-forward, turns 115° forward and down to the point
    const R = 0.08 * (1 + spread * 0.25);
    const C = { r: 0.02 - R * Math.SQRT1_2, y: R * Math.SQRT1_2 };
    const ctrl: Vector3[] = [];
    for (let j = 0; j <= 10; j++) {
      const th = ((-45 + (j / 10) * 118) * Math.PI) / 180;
      ctrl.push(at(C.r + R * Math.cos(th), C.y + R * Math.sin(th)));
    }
    const path = curve(ctrl, 2);
    x.sweep(path, (t) => 0.02 * (1 - t) ** 1.05 + 0.0008, 10, LOOK.brass, { flat: 0.5, up: side, capStart: true });
    // the knuckle ring where the talon leaves the hub
    x.sweep([at(0.02, 0.012), at(0.034, 0.022)], () => 0.0145, 10, LOOK.darkBrass, { capStart: true, capEnd: true });
  }
}

/** the Fei Zhua gauntlet on the left forearm; local +y runs from the elbow (-0.62) to the claw hub (0.0) */
export function buildGauntlet(k: Kit, x: KitX): void {
  // the cloth-wrapped forearm (cream wraps, ruled at every turn) from the elbow to the gauntlet's cuff
  x.sweep(curve([v(0, -0.72, -0.004), v(0, -0.44, -0.002), v(0, -0.15, 0)], 4), (t) => 0.058 - 0.01 * t, 14, LOOK.cloth);
  // a doubled braided cord spiralling over the cloth (two strands a third of a turn apart)
  const clothR = (y: number): number => 0.058 - 0.01 * ((y + 0.72) / 0.57);
  for (const ph of [0, 0.3]) {
    const helix: Vector3[] = [];
    for (let i = 0; i <= 80; i++) {
      const t = i / 80;
      const y = -0.56 + t * 0.4;
      const rc = clothR(y) + 0.0048;
      const a = (t * 3.0 + ph) * Math.PI * 2;
      helix.push(v(Math.cos(a) * rc, y, Math.sin(a) * rc));
    }
    x.sweep(helix, () => 0.0062, 6, ph === 0 ? LOOK.silk : LOOK.silkDark);
  }
  // the cord's end: a knot on the underside and a red tassel hanging from it
  x.ellipsoid(v(0.0, -0.19, -0.056), v(1, 0, 0), v(0, 1, 0), v(0, 0, 1), 0.009, 0.009, 0.009, LOOK.silk);
  x.sweep(curve([v(0.0, -0.19, -0.062), v(0.004, -0.2, -0.09), v(0.006, -0.205, -0.12)], 3), () => 0.003, 5, LOOK.silkDark);
  x.sweep([v(0.006, -0.205, -0.118), v(0.006, -0.205, -0.132)], (t) => 0.007 + 0.003 * t, 8, LOOK.brass);
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    x.sweep(curve([v(0.006 + Math.cos(a) * 0.007, -0.205 + Math.sin(a) * 0.007, -0.132), v(0.006 + Math.cos(a) * 0.011, -0.205 + Math.sin(a) * 0.011, -0.18), v(0.006 + Math.cos(a) * 0.012, -0.205 + Math.sin(a) * 0.012, -0.215)], 2), (t) => 0.0038 * (1 - t * 0.4), 4, i % 2 === 0 ? LOOK.silk : LOOK.silkDark);
  }
  // the gauntlet: a black leather cuff under four narrow brass bands, brass straps with buckles, a dragon crest
  x.sweep([v(0, -0.165, 0), v(0, -0.02, 0)], (t) => 0.061 - 0.008 * t, 16, LOOK.leather, { capEnd: true });
  const bands = [-0.155, -0.118, -0.081, -0.044];
  bands.forEach((y, i) => {
    const r = 0.063 - i * 0.002;
    k.lathe(0, y, 0, [[r - 0.004, 0], [r, 0.003], [r + 0.0015, 0.008], [r, 0.013], [r - 0.004, 0.016]], 20, { ...LOOK.brass, edges: E.none }, false, 0);
  });
  // lengthwise brass straps with a buckle each, on the top and on both flanks
  for (const ang of [0, 1.35, -1.35, 2.5]) {
    const n = v(Math.sin(ang), 0, Math.cos(ang));
    const t = v(Math.cos(ang), 0, -Math.sin(ang));
    k.boxAxes(n.clone().multiplyScalar(0.064).setY(-0.095), t, v(0, 1, 0), n, 0.007, 0.068, 0.0025, { ...LOOK.darkBrass, edges: E.all, line: 1.1 });
    k.boxAxes(n.clone().multiplyScalar(0.067).setY(-0.1), t, v(0, 1, 0), n, 0.011, 0.009, 0.003, { ...LOOK.brass, edges: E.all, line: 1.1 });
  }
  // the crest: a small brass dragon relief on the back of the wrist
  x.ellipsoid(v(0, -0.07, 0.066), v(1, 0, 0), v(0, 1, 0), v(0, 0, 1), 0.014, 0.024, 0.008, LOOK.brass);
  for (const sx of [1, -1]) x.sweep(curve([v(sx * 0.006, -0.06, 0.071), v(sx * 0.016, -0.085, 0.074), v(sx * 0.018, -0.112, 0.07)], 3), (t) => 0.0035 * (1 - t * 0.7), 5, LOOK.brass);
  // the launcher collar at the front
  k.lathe(0, -0.03, 0, [[0.054, 0], [0.058, 0.008], [0.05, 0.026], [0.032, 0.034]], 18, { ...LOOK.darkBrass, edges: E.none }, false, 0);
}

/** the left glove's fist, under the launcher (knuckles forward +y, back of the hand +z) */
export function buildLeftFist(x: KitX): void {
  const G = LOOK.glove;
  x.ellipsoid(v(0, -0.02, -0.046), v(1, 0, 0), v(0, 1, 0), v(0, 0, 1), 0.03, 0.028, 0.022, G);
  for (let i = 0; i < 4; i++) {
    const xx = -0.024 + i * 0.016;
    x.sweep(curve([v(xx, 0.02, -0.036), v(xx, 0.032, -0.052), v(xx, 0.018, -0.068), v(xx * 0.9, -0.002, -0.066)], 3), () => 0.0088, 7, G, { capEnd: true });
  }
  x.sweep(curve([v(-0.034, -0.01, -0.054), v(-0.03, 0.012, -0.07), v(-0.012, 0.022, -0.074)], 3), (t) => 0.01 * (1 - 0.2 * t), 7, G, { capEnd: true });
}
