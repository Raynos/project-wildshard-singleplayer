/**
 * Yurt — a Kazakh felt yurt (kiiz üi) painted into a PaintKit (B5, look pass N7). Built to the mockups
 * (style-B master frame, taming-3, concept-1):
 *   - the BASE: the felt skirt rolled up for summer so the wooden lattice (kerege) shows — diagonal slats on the dark
 *     interior — or, on some yurts, a woven reed screen (shi) with its red diamond pattern;
 *   - the WALL: white felt draped over the lattice heads (soft vertical folds, a belly, a panel overlap half way up,
 *     grubbier toward the ground), a wide red-orange ornament band (a stepped ram's-horn repeat) under the eave, two
 *     rope bands, and woven tassel ropes hanging down the wall;
 *   - the ROOF: felt over the roof poles (uyk) — it sags between them, so every rib reads — with a narrower band low
 *     on the dome, rope straps down the ribs and three guy ropes pegged to the ground;
 *   - the CROWN: the shangyrak ring with its crossed arches, the square smoke flap (tündik) pulled half back, its ropes;
 *   - the DOOR: a carved, painted double door in a frame with a scrolled pediment, iron ring pulls, the felt door
 *     curtain rolled up above it; optionally a stove flue out of the crown.
 *
 *   const top = addYurt(kit, { x, y, z, rot, r: 3 }, colliders);   // rot: the way the door faces (0 = −z / south)
 *
 * Built in local space (door at −z) then placed with one matrix. ~9 k triangles for r = 3. Colliders: an octagon.
 */
import * as THREE from 'three';
import { type PaintKit, M, lathe, pole, v3, revolve, revolveUV } from './paint';
import type { ColliderDesc } from '../registry';
import { prism, type Box } from './solid';

export interface YurtSpec {
  x: number; y: number; z: number;
  /** door facing (0 = −z / south) */
  rot: number;
  /** wall radius (m), 2.4–3.6 */
  r: number;
  /** a stove pipe out of the crown (smoke comes from it) */
  flue?: boolean;
  /** an older, greyer felt */
  old?: boolean;
  /** 0..2 — band colourway */
  palette?: number;
  /** the base: 'lattice' (skirt rolled up, kerege showing), 'reed' (a woven shi screen), 'felt' (closed) */
  base?: 'lattice' | 'reed' | 'felt';
  /** guy ropes pegged out (default true) */
  guys?: boolean;
}

export interface YurtTop {
  /** the crown ring's centre (world) */
  crown: THREE.Vector3;
  /** the flue's mouth (world), when it has one */
  flue: THREE.Vector3 | null;
  /** total height above y */
  height: number;
}

export const YURT_C = {
  felt: new THREE.Color('#f2e9d6'),
  feltWarm: new THREE.Color('#ede0c6'),
  feltDirty: new THREE.Color('#c9b99c'),
  feltOld: new THREE.Color('#ddd0b6'),
  feltRoof: new THREE.Color('#ebe1cb'),
  red: new THREE.Color('#b52c1a'),
  redDark: new THREE.Color('#5e1d12'),
  orange: new THREE.Color('#dd7a2a'),
  gold: new THREE.Color('#e2b04e'),
  cream: new THREE.Color('#f6e9c8'),
  wood: new THREE.Color('#9a6436'),
  woodLight: new THREE.Color('#b98450'),
  woodDark: new THREE.Color('#4e331f'),
  interior: new THREE.Color('#2b1f18'),
  door: new THREE.Color('#bd4f24'),
  doorGold: new THREE.Color('#e7b44f'),
  rope: new THREE.Color('#6d4a2b'),
  ropeRed: new THREE.Color('#a52a1a'),
  reed: new THREE.Color('#d8c49a'),
  iron: new THREE.Color('#3b3a3a'),
};

export function addYurt(kit: PaintKit, s: YurtSpec, colliders: Box[]): YurtTop {
  const R = s.r, wallH = 1.55 + (R - 3) * 0.12, rise = R * 0.52, eaveR = R + 0.22;
  const mat = M(s.x, s.y, s.z, s.rot);
  const rng = kit.rng;
  const felt = s.old === true ? YURT_C.feltOld : YURT_C.felt;
  const pal = s.palette ?? 0;
  const base = s.base ?? 'lattice';
  const add = (g: THREE.BufferGeometry, c: THREE.Color | ((p: THREE.Vector3, n: THREE.Vector3) => THREE.Color), o: { flat?: boolean; brush?: number; jitter?: number; foot?: number; uv?: boolean } = {}) => {
    kit.add(g, c, { ...o, matrix: mat });
  };
  const doorHalf = 0.62 / R;                                                  // the door's half-angle round the wall
  const nearDoor = (th: number, pad = 0) => { const d = Math.abs(((th - Math.PI) % (Math.PI * 2) + Math.PI * 3) % (Math.PI * 2) - Math.PI); return d < doorHalf + pad; };
  const baseH = base === 'felt' ? 0 : 0.44;

  // ── the base ──
  if (base !== 'felt') {
    // the dark interior seen through the lattice
    add(lathe([[R - 0.1, -0.2], [R - 0.1, baseH + 0.05]], 40), YURT_C.interior, { brush: 0.02 });
    if (base === 'lattice') {
      const n = Math.round((Math.PI * 2 * R) / 0.3);
      for (let i = 0; i < n; i++) {
        const t0 = (i / n) * Math.PI * 2, dt = ((Math.PI * 2) / n) * 1.9;
        if (nearDoor(t0, 0.12) || nearDoor(t0 + dt, 0.12)) continue;
        for (const dir of [1, -1]) {
          const a0 = dir > 0 ? t0 : t0 + dt, a1 = dir > 0 ? t0 + dt : t0;
          add(pole(v3(Math.sin(a0) * (R + 0.01), -0.05, Math.cos(a0) * (R + 0.01)), v3(Math.sin(a1) * (R + 0.01), baseH + 0.04, Math.cos(a1) * (R + 0.01)), 0.018, 0.018, 3), rng.next() < 0.3 ? YURT_C.woodLight : YURT_C.wood, { jitter: 0.08 });
        }
      }
    } else {
      // woven reed screen: vertical reeds with a red / dark diamond pattern wrapped in wool
      add(lathe([[R + 0.02, -0.05], [R + 0.02, baseH + 0.04]], Math.round((Math.PI * 2 * R) / 0.05)), (p) => {
        const a = Math.atan2(p.x, p.z) + Math.PI, u = (a * R) / 0.3, v = p.y / baseH;
        const d = Math.abs((((u % 1) + 1) % 1) - 0.5) * 2 + Math.abs(v - 0.5) * 2;
        return d < 0.45 ? YURT_C.red : d < 0.6 ? YURT_C.redDark : d > 1.25 ? YURT_C.orange : YURT_C.reed;
      }, { brush: 0.04 });
    }
    // the rolled-up felt skirt, a fat soft roll just above the base
    add(new THREE.TorusGeometry(R + 0.05, 0.075, 4, 48).rotateX(Math.PI / 2).translate(0, baseH + 0.06, 0), YURT_C.feltWarm, { brush: 0.08 });
  }

  // ── wall: felt draped over the lattice heads — soft folds, a belly, the panel overlap, grubbier low down ──
  const folds = Math.round(R * 5);
  const wallFn = (th: number, t: number): [number, number] => {
    const y = baseH + (wallH - baseH) * t;
    const fold = 0.018 * Math.cos(th * folds + Math.sin(th * 3) * 0.6) * (0.35 + 0.65 * t);
    const belly = 0.035 * Math.sin(Math.PI * Math.min(1, t * 1.1));
    const overlap = t > 0.5 ? 0.012 : 0;
    return [R + 0.03 + fold + belly + overlap, y];
  };
  const seams = 8;
  // the wall carries the painted felt tile (src/world/nalatiTextures.ts 'felt'): white felt with its two ornament bands —
  // one under the eave, one round the middle — v 0..1 over the wall so there is exactly one set; the vertex colour
  // only shades it (grubbier toward the ground, the panel seams, a warmer or cooler felt per yurt)
  const tint = [new THREE.Color(1, 1, 1), new THREE.Color(1.02, 0.97, 0.92), new THREE.Color(0.97, 0.97, 1)][pal % 3] ?? new THREE.Color(1, 1, 1);
  const dirt = new THREE.Color(0.78, 0.72, 0.62);
  const wallW = Math.PI * 2 * (R + 0.04), reps = Math.max(4, Math.round(wallW / 1.9));
  add(revolveUV(wallFn, 96, 7, reps), (p) => {
    const a = Math.atan2(p.x, p.z) + Math.PI, t = (p.y - baseH) / (wallH - baseH);
    const c = tint.clone().multiply(new THREE.Color(1, 1, 1).lerp(dirt, Math.max(0, 0.35 - t) * 1.2));
    if (s.old === true) c.multiplyScalar(0.92);
    const seam = Math.abs((((a / (Math.PI * 2)) * seams) % 1) - 0.5);
    if (seam > 0.485) c.multiplyScalar(0.88);
    return c;
  }, { brush: 0.04, uv: true });
  const bandY0 = wallH - (wallH - baseH) * 0.14;
  // rope bands round the wall
  for (const ry of [baseH + 0.32, bandY0 - 0.06]) add(new THREE.TorusGeometry(R + 0.08, 0.024, 3, 48).rotateX(Math.PI / 2).translate(0, ry, 0), YURT_C.rope);
  // woven tassel ropes hanging from the band down the wall
  const nT = Math.max(6, Math.round(R * 2.6));
  for (let i = 0; i < nT; i++) {
    const a = ((i + 0.5) / nT) * Math.PI * 2;
    if (nearDoor(a, 0.2)) continue;
    const rr = R + 0.1, sa = Math.sin(a), ca = Math.cos(a);
    const yTop = bandY0 + 0.02, yEnd = baseH + 0.5 + rng.range(-0.05, 0.08);
    add(new THREE.BoxGeometry(0.05, yTop - yEnd, 0.012).translate(0, (yTop + yEnd) / 2, 0).rotateY(a).translate(sa * rr, 0, ca * rr), (p) => (Math.floor(p.y * 9) % 2 === 0 ? YURT_C.ropeRed : YURT_C.orange), { flat: true, brush: 0.03 });
    add(new THREE.ConeGeometry(0.045, 0.2, 5).translate(0, yEnd - 0.08, 0).rotateY(a).translate(sa * (rr + 0.01), 0, ca * (rr + 0.01)), YURT_C.red, { brush: 0.05 });
  }

  // ── roof: felt over the uyk — it sags between the poles ──
  const crownR = Math.max(0.5, R * 0.18), crownY = wallH + rise;
  const ribs = Math.round((Math.PI * 2 * R) / 0.42);
  const roofY = (t: number) => wallH - 0.1 + rise * (t + 0.2 * Math.sin(Math.PI * t) * (1 - t * 0.35));
  const roofR = (t: number) => eaveR + (crownR + 0.06 - eaveR) * t;
  const sag = (th: number, t: number) => 0.045 * Math.sin((th * ribs) / 2) ** 2 * Math.sin(Math.PI * Math.min(1, t * 1.05)) ** 0.7;
  add(revolve((th, t) => [roofR(t), roofY(t) - sag(th, t)], ribs * 2, 9), (p) => {
    const t = (p.y - (wallH - 0.1)) / rise;
    return YURT_C.feltRoof.clone().lerp(YURT_C.feltDirty, Math.max(0, 0.25 - t) * 0.6 + Math.max(0, t - 0.8) * 0.5);
  }, { brush: 0.06 });
  // the eave's thickness: the felt edge turning under
  add(lathe([[eaveR - 0.1, wallH - 0.2], [eaveR + 0.015, wallH - 0.14], [eaveR + 0.01, wallH - 0.08]], 72), felt, {});
  // roof band: the felt tile's middle ornament band, low on the dome (it rides the ribs, 2 cm proud)
  {
    const t0 = 0.05, t1 = 0.21, rMid = roofR((t0 + t1) / 2);
    const g = revolveUV((_th, t) => { const tt = t0 + (t1 - t0) * t; return [roofR(tt) + 0.02, roofY(tt) + 0.035]; }, 72, 3, Math.max(4, Math.round((Math.PI * 2 * rMid) / 1.9)));
    const uv = g.getAttribute('uv');
    for (let i = 0; i < uv.count; i++) uv.setY(i, 0.375 + uv.getY(i) * 0.25);   // the tile's middle band, image rows 0.37–0.62
    add(g, tint, { brush: 0.03, jitter: 0.02, uv: true });
  }
  // rope straps down every 4th rib, from the crown to the eave
  for (let k = 0; k < ribs; k += 4) {
    const a = (k / ribs) * Math.PI * 2, sa = Math.sin(a), ca = Math.cos(a);
    for (let i = 0; i < 3; i++) {
      const t0 = 0.22 + (i / 3) * 0.76, t1 = 0.22 + ((i + 1) / 3) * 0.76;
      add(pole(v3(sa * (roofR(t0) + 0.03), roofY(t0) + 0.04, ca * (roofR(t0) + 0.03)), v3(sa * (roofR(t1) + 0.03), roofY(t1) + 0.04, ca * (roofR(t1) + 0.03)), 0.02, 0.02, 4), YURT_C.redDark);
    }
  }
  // guy ropes: from the eave out to pegs in the ground
  if (s.guys !== false) {
    for (let g = 0; g < 3; g++) {
      const a = Math.PI / 3 + (g / 3) * Math.PI * 2 + rng.range(-0.2, 0.2);
      if (nearDoor(a, 0.5)) continue;
      const sa = Math.sin(a), ca = Math.cos(a);
      const e = v3(sa * (eaveR + 0.02), wallH - 0.05, ca * (eaveR + 0.02)), peg = v3(sa * (R + 1.7), 0.05, ca * (R + 1.7));
      add(pole(e, peg, 0.012, 0.012, 3), YURT_C.rope);
      add(new THREE.CylinderGeometry(0.03, 0.02, 0.35, 5).rotateZ(0.3).rotateY(a).translate(peg.x, 0.1, peg.z), YURT_C.woodDark);
    }
  }

  // ── crown: shangyrak ring, crossed arches, the square tündik flap pulled half back, its ropes ──
  add(new THREE.TorusGeometry(crownR, 0.085, 7, 24).rotateX(Math.PI / 2).translate(0, crownY + 0.02, 0), YURT_C.wood);
  for (const yaw of [0, Math.PI / 2]) add(new THREE.TorusGeometry(crownR, 0.035, 4, 12, Math.PI).rotateY(yaw).scale(1, 0.5, 1).translate(0, crownY + 0.02, 0), YURT_C.woodDark);
  add(new THREE.CircleGeometry(crownR - 0.05, 16).rotateX(-Math.PI / 2).translate(0, crownY - 0.03, 0), YURT_C.interior);
  {
    // a square felt flap draped over the back of the crown, sagging over the ring, its edges bound in red
    const w = crownR * 2 + 0.55, g = new THREE.BoxGeometry(w, 0.05, w * 0.72, 8, 1, 6);
    const p = g.getAttribute('position');
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), z = p.getZ(i), d = Math.hypot(x, z * 1.2) / (w * 0.5);
      p.setY(i, p.getY(i) + 0.12 - d * d * 0.28 - Math.max(0, Math.abs(x) - crownR) * 0.35);
    }
    g.computeVertexNormals();
    const fz = crownR * 0.62;
    add(g.translate(0, crownY + 0.08, fz), (q) => (Math.abs(q.x) > w / 2 - 0.08 || q.z > fz + w * 0.36 - 0.08 ? YURT_C.red : YURT_C.feltRoof), { brush: 0.05 });
    for (const sx of [-1, 1]) {
      const c0 = v3(sx * (w / 2 - 0.05), crownY - 0.02, fz + w * 0.3), c1 = v3(sx * roofR(0.35) * 0.72, roofY(0.35) + 0.05, roofR(0.35) * 0.72);
      add(pole(c0, c1, 0.012, 0.012, 3), YURT_C.rope);
    }
  }

  // ── door (at −z): pediment, frame, carved double door, ring pulls, threshold, rolled curtain ──
  const dz = -(R + 0.08), dW = 0.98, dH = 1.34;
  add(new THREE.BoxGeometry(dW + 0.24, dH + 0.16, 0.14).translate(0, dH / 2 + 0.03, dz + 0.02), YURT_C.woodDark, { flat: true });
  // the pediment: a scrolled board over the lintel, painted
  {
    const g = new THREE.CylinderGeometry(0.62, 0.62, 0.08, 20, 1, false, -Math.PI / 2 + 0.5, Math.PI - 1.0).rotateX(-Math.PI / 2).scale(1, 0.42, 1);
    add(g.translate(0, dH + 0.1, dz - 0.03), (p) => (p.y > dH + 0.3 ? YURT_C.gold : YURT_C.red), { flat: true });
    add(new THREE.BoxGeometry(dW + 0.34, 0.07, 0.1).translate(0, dH + 0.14, dz - 0.05), YURT_C.doorGold, { flat: true });
  }
  for (const sx of [-1, 1]) {
    const lx = (sx * dW) / 4;
    add(new THREE.BoxGeometry(dW / 2 - 0.02, dH, 0.07).translate(lx, dH / 2 + 0.04, dz - 0.05), YURT_C.door, { flat: true, brush: 0.05 });
    for (const [py, ph] of [[1.0, 0.44], [0.42, 0.52]] as const) {
      add(new THREE.BoxGeometry(dW / 2 - 0.14, ph, 0.02).translate(lx, py, dz - 0.09), YURT_C.doorGold, { flat: true });
      add(new THREE.BoxGeometry(dW / 2 - 0.22, ph - 0.08, 0.02).translate(lx, py, dz - 0.1), YURT_C.red, { flat: true });
      // the carved ram's-horn boss in each panel
      add(new THREE.TorusGeometry(0.07, 0.016, 4, 10, Math.PI * 1.5).rotateZ(sx > 0 ? 0 : Math.PI / 2).translate(lx, py, dz - 0.115), YURT_C.doorGold);
    }
    add(new THREE.TorusGeometry(0.04, 0.01, 4, 10).translate(sx * 0.07, 0.72, dz - 0.1), YURT_C.iron);
  }
  add(new THREE.BoxGeometry(dW + 0.34, 0.12, 0.36).translate(0, 0.02, dz - 0.1), YURT_C.woodDark, { flat: true });
  add(new THREE.CylinderGeometry(0.1, 0.1, dW + 0.26, 10).rotateZ(Math.PI / 2).translate(0, dH + 0.34, dz - 0.1), felt, {});
  for (const sx of [-0.34, 0, 0.34]) add(new THREE.CylinderGeometry(0.106, 0.106, 0.1, 10).rotateZ(Math.PI / 2).translate(sx, dH + 0.34, dz - 0.1), YURT_C.red);

  // ── flue ──
  let flue: THREE.Vector3 | null = null;
  if (s.flue === true) {
    const fx = crownR * 0.35, fz = -crownR * 0.3, top = crownY + 0.95;
    add(new THREE.CylinderGeometry(0.085, 0.085, top - (crownY - 0.6), 8).translate(fx, (top + crownY - 0.6) / 2, fz), YURT_C.iron);
    add(new THREE.CylinderGeometry(0.16, 0.1, 0.1, 8).translate(fx, top + 0.1, fz), YURT_C.iron);
    flue = v3(fx, top + 0.2, fz).applyMatrix4(mat);
  }

  // colliders: the solid is `yurtSolid` (the felt wall + the roof); the two crossed squares stay as data (the weather's yurts)
  for (const extra of [0, Math.PI / 4]) {
    colliders.push({ x: s.x, z: s.z, hw: R * 0.93, hd: R * 0.93, rot: -(s.rot + extra), yBottom: s.y - 1, yTop: s.y + wallH + rise * 0.6, ghost: true });
  }
  return { crown: v3(0, crownY, 0).applyMatrix4(mat), flue, height: crownY };
}

/**
 * A yurt's collision (NALATI-MERGE P1): the felt wall as a 16-sided prism of radius R from under the turf to the eave,
 * and the roof as a frustum from the eave (R + 0.22) up to the crown ring — the drawn shape, not the old crossed
 * squares whose corners stood 30 % of R out from the wall. `height`: the drawn crown (`YurtTop.height`).
 */
export function yurtSolid(s: YurtSpec, height: number): ColliderDesc[] {
  const R = s.r, wallH = 1.55 + (R - 3) * 0.12;
  return [
    prism(s.x, s.z, s.y - 1, s.y + wallH, R + 0.02, 16, s.rot, 'felt'),
    prism(s.x, s.z, s.y + wallH, s.y + Math.max(wallH + 0.3, height), R + 0.22, 16, s.rot, 'felt', R * 0.22),
  ];
}
