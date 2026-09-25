/**
 * Cairn — the Wind Cairn (Jel Ata the Storm Titan's threshold, B14): an ovoo-style heap of fieldstones, a bundle of
 * weathered poles lashed together at the top and bristling out of it, and cloth strips everywhere — white and sky-blue
 * (the khadag colours) with red, yellow and green among them — tied up the poles and hung along four lines that run
 * from the pole-heads to stakes round the heap. A few horned ram skulls and offering stones on the pile. All the cloth
 * goes into `ctx.flutter` (it streams with the wind; in the storm it will whip).
 *
 *   const { piece, tieSpot } = buildCairn(ctx);   // tieSpot: where a rider stops to TIE A CLOTH STRIP (B14)
 */
import * as THREE from 'three';
import { PaintKit, M, pole, v3, blob } from './paint';
import { WIND_CAIRN } from './layout';
import type { ColliderDesc } from '../registry';
import { supportHull, type Box } from './solid';
import type { PoiCtx, PoiPiece } from './types';

const C = {
  stone: new THREE.Color('#9d978b'),
  stoneLight: new THREE.Color('#b8b1a1'),
  stoneDark: new THREE.Color('#7f7a71'),
  lichen: new THREE.Color('#bfa75a'),
  pole: new THREE.Color('#9b8f7c'),
  poleDark: new THREE.Color('#6d604e'),
  bone: new THREE.Color('#e8dfca'),
  horn: new THREE.Color('#b9a37a'),
  rope: new THREE.Color('#5f4a33'),
};
const STRIPS = ['#f4f1e8', '#f4f1e8', '#8cc2ea', '#4f93d6', '#f4f1e8', '#8cc2ea', '#d8402b', '#e7c23a', '#4f9a52'];

export function buildCairn(ctx: PoiCtx): { piece: PoiPiece; tieSpot: THREE.Vector3 } {
  const { sky, ground, flutter } = ctx;
  const kit = new PaintKit(0xca19);
  const rng = kit.rng;
  const colliders: Box[] = [];
  const descs: ColliderDesc[] = [];
  const cx = WIND_CAIRN.x, cz = WIND_CAIRN.z, gy = ground(cx, cz);
  const R = 2.9, Hh = 2.4;
  const stone = { top: { color: C.lichen, threshold: 0.55, amount: 0.45 }, brush: 0.12 };

  // ── the heap: stones in rough rings, smaller toward the top ──
  for (let ring = 0; ring < 6; ring++) {
    const t = ring / 5, rr = R * (1 - t * 0.85), yy = gy + Hh * t ** 0.9 * 0.92;
    const n = Math.max(3, Math.round(rr * 6));
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + ring * 0.6 + rng.range(-0.15, 0.15);
      const s = rng.range(0.26, 0.42) * (1 - t * 0.3);
      const x = cx + Math.cos(a) * rr, z = cz + Math.sin(a) * rr;
      const col = rng.next() < 0.3 ? C.stoneLight : rng.next() < 0.5 ? C.stoneDark : C.stone;
      kit.add(blob(s, rng, 1, rng.range(0.6, 0.85), 0.25), col, { ...stone, matrix: M(x, Math.max(yy, ground(x, z)) + s * 0.25, z, rng.range(0, 6)) });
    }
  }
  // a core so there are no holes between the stones
  const core = new THREE.SphereGeometry(R * 0.95, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, Hh / R * 0.9, 1);
  // P1: the heap collides as the hull of its core dome (the stones sit on it)
  descs.push(supportHull(core, M(cx, gy - 0.1, cz), 'stone'));
  kit.add(core, C.stone, { matrix: M(cx, gy - 0.1, cz), brush: 0.2 });

  // ── the pole bundle: 7 poles lashed at ~4 m, splaying out of the heap ──
  const lash = v3(cx, gy + 4.6, cz);
  const heads: THREE.Vector3[] = [];
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2 + rng.range(-0.2, 0.2);
    const foot = v3(cx + Math.cos(a) * 0.55, gy + Hh * 0.55, cz + Math.sin(a) * 0.55);
    const dir = lash.clone().sub(foot).normalize();
    const head = lash.clone().add(dir.clone().multiplyScalar(rng.range(0.6, 1.5))).add(v3(-Math.cos(a) * 0.1, 0, -Math.sin(a) * 0.1));
    kit.add(pole(foot, head, 0.1, 0.05, 7), rng.next() < 0.5 ? C.pole : C.poleDark, { jitter: 0.1 });
    heads.push(head);
    // strips tied up the pole
    for (let k = 0; k < 7; k++) {
      const u = 0.3 + k * 0.1 + rng.range(-0.03, 0.03);
      const p = foot.clone().lerp(head, u);
      flutter.strip(p, rng.range(0.7, 1.2), rng.range(0.12, 0.18), rng.pick(STRIPS));
    }
  }
  kit.add(new THREE.CylinderGeometry(0.18, 0.18, 0.35, 10).translate(lash.x, lash.y, lash.z), C.rope);
  // the tallest pole carries a long streamer of blue silk
  const crown = lash.clone().add(v3(0, 1.4, 0));
  kit.add(pole(lash.clone().add(v3(0, -0.6, 0)), crown, 0.05, 0.03, 6), C.pole);
  flutter.streamer(crown, 4.2, 0.3, '#4f93d6', { droop: 0.4, taper: 0.4 });
  flutter.streamer(crown.clone().add(v3(0, -0.25, 0)), 3.4, 0.24, '#f4f1e8', { droop: 0.45, taper: 0.4 });

  // ── four strip lines from the pole heads to stakes ──
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + 0.5 + rng.range(-0.15, 0.15);
    const sx = cx + Math.cos(a) * 7.5, sz = cz + Math.sin(a) * 7.5, sy = ground(sx, sz);
    const stakeTop = v3(sx, sy + 1.3, sz);
    kit.add(pole(v3(sx, sy - 0.3, sz), stakeTop, 0.06, 0.05, 6), C.poleDark);
    kit.add(blob(0.3, rng, 1, 0.7), C.stone, { ...stone, matrix: M(sx + 0.2, sy + 0.05, sz, rng.range(0, 6)) });
    const from = heads[(i * 2) % heads.length] ?? lash;
    const n = 18;
    for (let k = 0; k <= n; k++) {
      const t = k / n;
      const p = from.clone().lerp(stakeTop, t);
      p.y -= Math.sin(Math.PI * t) * 0.7;                                       // the line sags
      if (k > 0 && k < n) flutter.strip(p, rng.range(0.5, 0.8), rng.range(0.11, 0.15), rng.pick(STRIPS));
      if (k < n) {
        const q = from.clone().lerp(stakeTop, (k + 1) / n); q.y -= Math.sin(Math.PI * ((k + 1) / n)) * 0.7;
        kit.add(pole(p, q, 0.012, 0.012, 3), C.rope, { brush: 0 });
      }
    }
    colliders.push({ x: sx, z: sz, hw: 0.15, hd: 0.15, rot: 0, yBottom: sy - 1, yTop: sy + 1.3 });
  }

  // ── ram skulls and offerings on the heap ──
  for (let i = 0; i < 3; i++) {
    const a = rng.range(0, Math.PI * 2), rr = R * rng.range(0.35, 0.6);
    const x = cx + Math.cos(a) * rr, z = cz + Math.sin(a) * rr, y = gy + Hh * (1 - rr / R) * 0.9 + 0.2;
    const m = M(x, y, z, a + Math.PI / 2, 1, 1, 1, -0.3);
    kit.add(new THREE.SphereGeometry(0.13, 10, 8).scale(0.8, 0.75, 1.3), C.bone, { matrix: m });
    for (const s of [-1, 1]) kit.add(new THREE.TorusGeometry(0.1, 0.035, 5, 10, Math.PI * 1.5).rotateY(Math.PI / 2).translate(s * 0.11, 0.02, -0.05), C.horn, { matrix: m });
  }

  const mesh = kit.mesh(sky, { ground });
  mesh.name = 'nalati-cairn';
  const tieSpot = v3(cx + 3.6, gy, cz);
  return { piece: { name: 'cairn', object: mesh, colliders, surface: 'wood', descs, tris: mesh.geometry.getAttribute('position').count / 3 }, tieSpot };
}
