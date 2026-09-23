/**
 * KurganField — the Wusun-period burial mounds on the SE plateau (map-01 "KURGAN FIELD"). The domes themselves are
 * terrain (B0's landscape adds `KURGANS`, so the grass grows on them); this dresses them: a kerb ring of set stones
 * at every mound's foot (doubled round the great one, a few stones fallen or missing), loose stones in the grass,
 * and the GREAT KURGAN's entrance — a timber-framed dromos head in its NW flank: two massive larch posts and a double
 * lintel, flaring log wing-walls, a turf hood that carries the mound's line out over the passage, a raised timber
 * threshold, and a pitch-dark passage 2 m in (sealed for now; B13 builds what's beyond).
 *
 *   const { piece, entrance, balbalSpots } = buildKurganField(ctx);
 *   entrance → { x, y, z, facing }   // the threshold (floor centre at the doorway) + the yaw it faces — B13's door
 *   balbalSpots → where the crown balbals stand (Balbals builds them)
 *
 * No terrain carve is needed: the passage head stands proud of the flank and its floor sits on a timber platform.
 * (If B0 later cuts a notch for a longer dromos, set `DROMOS_DEPTH` here and the back wall moves in.)
 */
import * as THREE from 'three';
import { PaintKit, M, pole, v3, blob } from './paint';
import { KURGANS, GREAT_KURGAN, GREAT_KURGAN_DOOR, KURGAN_BALBALS } from './layout';
import type { Collider } from '../../player/Player';
import type { Platform, PoiCtx, PoiPiece } from './types';

const C = {
  kerb: new THREE.Color('#948f86'),
  kerbDark: new THREE.Color('#77736c'),
  lichen: new THREE.Color('#b9a45a'),
  larch: new THREE.Color('#7a5a3c'),
  larchOld: new THREE.Color('#6d6152'),
  turf: new THREE.Color('#7f9b46'),
  turfDark: new THREE.Color('#5f7a36'),
  earth: new THREE.Color('#6a5438'),
  dark: new THREE.Color('#0d0a08'),
};

/** how far the dark passage goes in behind the portal (m) */
const DROMOS_DEPTH = 2.2;

export interface KurganEntrance { x: number; y: number; z: number; facing: number }

export function buildKurganField(ctx: PoiCtx): { piece: PoiPiece; entrance: KurganEntrance; balbalSpots: { x: number; z: number; yaw: number; scale: number }[] } {
  const { sky, ground } = ctx;
  const kit = new PaintKit(0x4b62);
  const rng = kit.rng;
  const colliders: Collider[] = [];
  const platforms: Platform[] = [];
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
        const g = blob(s, rng, 1, fallen ? 0.45 : rng.range(0.9, 1.35), 0.2);
        kit.add(g, rng.next() < 0.4 ? C.kerbDark : C.kerb, { matrix: M(x, ground(x, z) + s * (fallen ? 0.2 : 0.45), z, a + rng.range(-0.3, 0.3), 1, 1, 1, fallen ? 1.2 : rng.range(-0.1, 0.1)), top: { color: C.lichen, threshold: 0.5, amount: 0.5 }, brush: 0.1 });
      }
    }
    // loose stones in the grass round it
    for (let i = 0; i < Math.round(k.r * 0.5); i++) {
      const a = rng.range(0, Math.PI * 2), d = k.r + rng.range(1, 7);
      const x = k.x + Math.cos(a) * d, z = k.z + Math.sin(a) * d, s = rng.range(0.15, 0.4);
      kit.add(blob(s, rng, 1, 0.55), C.kerbDark, { matrix: M(x, ground(x, z) + s * 0.1, z, rng.range(0, 6)), top: { color: C.lichen, threshold: 0.5, amount: 0.4 } });
    }
  }

  // ── the great kurgan's entrance ──
  // walk the door axis in from the foot; the portal front stands where the flank has risen ~0.35 m
  const at = (d: number) => ({ x: great.x + fx * d, z: great.z + fz * d });
  const foot = at(great.r + 1.2), footY = ground(foot.x, foot.z);
  let dFront = great.r;
  for (let d = great.r; d > great.r * 0.5; d -= 0.1) { const p = at(d); if (ground(p.x, p.z) - footY >= 0.35) { dFront = d; break; } }
  const front = at(dFront), back = at(dFront - DROMOS_DEPTH);
  const floorY = Math.max(ground(back.x, back.z), ground(front.x, front.z)) + 0.1;
  const openH = 2.35, lintelY = floorY + openH, cw = 2.5;                                    // clear width of the doorway
  // local frame: origin at the portal front on the axis, +z pointing INTO the mound, +x across
  const yawIn = Math.atan2(-fx, -fz);                                                      // local +z → world (−fx, −fz)
  const L = (lx: number, ly: number, lz: number) => v3(front.x - fx * lz - fz * lx, ly, front.z - fz * lz + fx * lx);
  const Lm = (lx: number, ly: number, lz: number, sx = 1, sy = 1, sz = 1, pitch = 0) => { const p = L(lx, ly, lz); return M(p.x, p.y, p.z, yawIn, sx, sy, sz, pitch); };
  // posts + double lintel (larch, weathered grey at the top)
  for (const sx of [-1, 1]) {
    kit.add(pole(L(sx * (cw / 2 + 0.22), footY - 0.6, 0.1), L(sx * (cw / 2 + 0.2), lintelY + 0.55, 0.12), 0.25, 0.21, 9), C.larch, { foot: 0.7 });
    kit.add(pole(L(sx * (cw / 2 + 0.25), footY - 0.6, 0.9), L(sx * (cw / 2 + 0.22), lintelY + 0.3, 0.9), 0.2, 0.18, 8), C.larchOld);
    const jp = L(sx * (cw / 2 + 0.22), 0, 0.5);
    colliders.push({ x: jp.x, z: jp.z, hw: 0.3, hd: 0.8, rot: -yawIn, yBottom: footY - 1, yTop: lintelY + 0.6 });
  }
  kit.add(pole(L(-cw / 2 - 0.9, lintelY + 0.22, 0.05), L(cw / 2 + 0.9, lintelY + 0.24, 0.05), 0.27, 0.25, 9), C.larchOld);
  kit.add(pole(L(-cw / 2 - 1.1, lintelY + 0.7, 0.35), L(cw / 2 + 1.1, lintelY + 0.68, 0.35), 0.25, 0.24, 9), C.larch);
  // flaring wing walls: stacked logs from the posts out and down to the foot, stones banked against them
  for (const sx of [-1, 1]) {
    for (let r = 0; r < 7; r++) {
      const y = footY - 0.1 + r * 0.42, lenOut = 3.4 - r * 0.42;
      if (lenOut < 0.5 || y > lintelY + 0.4) break;
      const a = L(sx * (cw / 2 + 0.5), y, 0.3), b = L(sx * (cw / 2 + 0.5 + lenOut * 0.72), y + rng.range(-0.05, 0.05), -lenOut * 0.7);
      kit.add(pole(a, b, 0.2, 0.18, 7), r % 2 === 0 ? C.larch : C.larchOld, { jitter: 0.08 });
    }
    for (let i = 0; i < 6; i++) {
      const p = L(sx * (cw / 2 + rng.range(1.4, 3.4)), 0, rng.range(-2.4, -0.2));
      kit.add(blob(rng.range(0.3, 0.6), rng, 1, 0.7), C.kerb, { matrix: M(p.x, ground(p.x, p.z) + 0.05, p.z, rng.range(0, 6)), top: { color: C.lichen, threshold: 0.5, amount: 0.4 } });
    }
    const wc = L(sx * (cw / 2 + 1.7), 0, -1.0);
    colliders.push({ x: wc.x, z: wc.z, hw: 0.35, hd: 1.6, rot: -(yawIn + sx * 0.7), yBottom: footY - 1, yTop: footY + 1.6 });
  }
  // the passage: dark log walls, a log ceiling, the black back — fading to nothing
  const dep = DROMOS_DEPTH;
  const darkBy = (lz: number, base: THREE.Color) => base.clone().lerp(C.dark, Math.min(1, 0.35 + lz / dep * 0.8));
  for (const sx of [-1, 1]) for (let r = 0; r < 6; r++) {
    const y = floorY + 0.2 + r * 0.4;
    kit.add(pole(L(sx * (cw / 2 + 0.05), y, 0.4), L(sx * (cw / 2 + 0.05), y, dep + 0.1), 0.19, 0.19, 6), darkBy(dep * 0.6, C.larch));
  }
  for (let i = 0; i < 6; i++) kit.add(pole(L(-cw / 2 - 0.3, lintelY + 0.05, 0.5 + i * 0.36), L(cw / 2 + 0.3, lintelY + 0.05, 0.5 + i * 0.36), 0.17, 0.17, 6), darkBy(0.5 + i * 0.36, C.larchOld));
  kit.add(new THREE.BoxGeometry(cw + 0.6, openH + 0.4, 0.3), C.dark, { matrix: Lm(0, floorY + openH / 2, dep + 0.1), brush: 0.02, flat: true });
  kit.add(new THREE.BoxGeometry(cw, 0.08, dep), C.dark.clone().lerp(C.larch, 0.25), { matrix: Lm(0, floorY - 0.04, dep / 2 + 0.2), flat: true });
  // raised timber threshold + steps down to the grass
  kit.add(new THREE.BoxGeometry(cw + 0.5, 0.26, 0.55), C.larchOld, { matrix: Lm(0, floorY - 0.13, 0.15), flat: true });
  const rise = floorY - footY, nSteps = Math.max(0, Math.ceil(rise / 0.34) - 1);
  for (let i = 1; i <= nSteps; i++) {
    const y = floorY - (rise * i) / (nSteps + 1);
    kit.add(new THREE.BoxGeometry(cw - 0.2, 0.2, 0.55), C.larch, { matrix: Lm(0, y - 0.1, -0.2 - i * 0.5), flat: true });
  }
  // turf hood over the passage, carrying the mound's line out to the lintel
  {
    const len = 7.5, segZ = 10, g = new THREE.BoxGeometry(cw + 3.6, 1, len, 10, 1, segZ);
    const pos = g.getAttribute('position');
    for (let i = 0; i < pos.count; i++) {
      const lz = pos.getZ(i) + len / 2, t = lz / len;                            // 0 at the lintel → 1 deep in the mound
      const up = pos.getY(i) > 0;
      const p = L(0, 0, lz), gy = ground(p.x, p.z);
      const topY = lintelY + 1.05 - t * 1.2 + Math.sin(Math.PI * t) * 0.25;           // sinks under the mound behind
      const across = pos.getX(i) / ((cw + 3.6) / 2);
      // the underside arches over the passage (so the hood's front face never closes the doorway)
      const drop = up ? topY - (1 - Math.cos(across * 1.35)) * 1.6 : Math.abs(pos.getX(i)) < cw / 2 + 0.6 ? lintelY + 0.3 : gy - 0.6;
      pos.setXYZ(i, pos.getX(i) * (up ? 0.85 : 1.1), drop, lz - 0.2);
    }
    g.computeVertexNormals();
    kit.add(g, (_p, n) => (n.y > 0.35 ? C.turf : C.turfDark), { matrix: Lm(0, 0, 0), brush: 0.12 });
    // the hood's top is walkable (so you can climb the mound over the entrance), in 4 slices
    for (let s = 0; s < 4; s++) {
      const lz0 = s * (len / 4), lzc = lz0 + len / 8, pc = L(0, 0, lzc);
      const tc = lzc / len, yTop = lintelY + 1.05 - tc * 1.2 + Math.sin(Math.PI * tc) * 0.25 - 0.25;
      const top = Math.max(yTop, ground(pc.x, pc.z));
      // over the passage it only blocks above the lintel; either side of it, all the way down
      colliders.push({ x: pc.x, z: pc.z, hw: cw / 2 + 1.2, hd: len / 8, rot: -yawIn, yBottom: lintelY - 0.1, yTop: top });
      for (const sx of [-1, 1]) { const q = L(sx * (cw / 2 + 0.75), 0, lzc); colliders.push({ x: q.x, z: q.z, hw: 0.55, hd: len / 8, rot: -yawIn, yBottom: footY - 1, yTop: top }); }
    }
    platforms.push((x, z) => {
      const dx = x - front.x, dz = z - front.z, lz = -(dx * fx + dz * fz), lx = dx * fz - dz * fx;
      if (lz < 0.4 || lz > len - 0.2 || Math.abs(lx) > cw / 2 + 1.1) return undefined;
      const t = lz / len;
      return lintelY + 1.05 - t * 1.2 + Math.sin(Math.PI * t) * 0.25 - (1 - Math.cos((lx / ((cw + 3.6) / 2)) * 1.35)) * 1.6;
    });
  }
  // the passage floor + threshold + steps are walkable; the back wall stops you
  platforms.push((x, z) => {
    const dx = x - front.x, dz = z - front.z, lz = -(dx * fx + dz * fz), lx = dx * fz - dz * fx;
    if (Math.abs(lx) > cw / 2) return undefined;
    if (lz >= -0.15 && lz <= dep) return floorY;
    if (lz < -0.15 && lz > -0.2 - (nSteps + 0.5) * 0.5) { const i = Math.ceil((-0.2 - lz) / 0.5 - 0.5); return floorY - (rise * Math.max(1, i)) / (nSteps + 1); }
    return undefined;
  });
  { const bw = L(0, 0, dep + 0.1); colliders.push({ x: bw.x, z: bw.z, hw: cw / 2 + 0.3, hd: 0.3, rot: -yawIn, yBottom: floorY - 2, yTop: lintelY + 2 }); }

  // ── crown balbals: stood on three mounds, facing east (the rising sun, as they did) ──
  const balbalSpots = KURGAN_BALBALS.map((i) => KURGANS[i]).filter((k) => k !== undefined).map((k, i) => ({ x: k.x + 0.5, z: k.z - 0.3, yaw: Math.PI / 2 + (i - 1) * 0.25, scale: 1.05 + i * 0.05 }));

  const mesh = kit.mesh(sky, { ground });
  mesh.name = 'nalati-kurgans';
  const entrance: KurganEntrance = { x: front.x, y: floorY, z: front.z, facing: D };
  return { piece: { name: 'kurgans', object: mesh, colliders, platforms, tris: mesh.geometry.getAttribute('position').count / 3 }, entrance, balbalSpots };
}
