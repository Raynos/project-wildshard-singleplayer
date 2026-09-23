/**
 * EagleRock — the granite tor on the west rim (map-01 "EAGLE ROCK", the Tianjie-terrace view): B0's knoll carries
 * a broad tor of weathered, horizontally-jointed granite — layers of rounded, lichened blocks, each layer twisted on
 * the one below, narrowing to a summit block whose flat top is the terrace at `EAGLE_ROCK.top` — with boulders round
 * its foot. A scramble of granite slabs steps up round its flank from the south foot (less than one turn, 0.3 m
 * risers) to the summit, where a railed timber viewing deck looks north over the valley and a blue flag flies.
 *
 *   const rock = buildEagleRock(ctx);   // PoiPiece: platforms = the scramble (one function) + the summit
 */
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { PaintKit, M, pole, v3, blob, mergeVerticesByPos } from './paint';
import { Noise2D } from '../../core/noise';
import { EAGLE_ROCK } from './layout';
import type { Collider } from '../../player/Player';
import type { Platform, PoiCtx, PoiPiece } from './types';

const C = {
  granite: new THREE.Color('#9d8f7b'),
  graniteWarm: new THREE.Color('#b9a88c'),
  graniteDark: new THREE.Color('#766b5e'),
  lichen: new THREE.Color('#b4a860'),
  moss: new THREE.Color('#8c9c4c'),
  wood: new THREE.Color('#8e6a45'),
  woodGrey: new THREE.Color('#857866'),
};

/** a weathered granite block: a rounded box, its surface pushed about by noise; smooth-shaded */
export function graniteBlock(w: number, h: number, d: number, seed: number, rough = 0.18, segs = 3): THREE.BufferGeometry {
  const r = Math.min(h * 0.28, Math.min(w, d) * 0.2, 0.9);
  const g = mergeVerticesByPos(new RoundedBoxGeometry(w, h, d, segs, r));
  const n = new Noise2D(seed);
  const pos = g.getAttribute('position');
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const k = n.get(x * 0.35 + y * 0.2, z * 0.35 - y * 0.25) * 0.7 + n.get(x * 1.1, z * 1.1 + y) * 0.3;
    const s = 1 + k * rough * (Math.min(w, d) > 4 ? 0.6 : 1);
    pos.setXYZ(i, x * s, y + k * rough * h * 0.3, z * s);
  }
  g.computeVertexNormals();
  return g;
}

export function buildEagleRock(ctx: PoiCtx): PoiPiece {
  const { sky, ground, flutter } = ctx;
  const kit = new PaintKit(0xea61);
  const rng = kit.rng;
  const colliders: Collider[] = [];
  const platforms: Platform[] = [];
  const cx = EAGLE_ROCK.x, cz = EAGLE_ROCK.z, top = EAGLE_ROCK.top;
  let base = Infinity;
  for (let k = 0; k < 12; k++) { const a = (k / 12) * Math.PI * 2; base = Math.min(base, ground(cx + Math.cos(a) * 9, cz + Math.sin(a) * 9)); }
  const H = Math.max(6, top - base);
  const stone = { top: { color: C.moss, threshold: 0.72, amount: 0.55 }, brush: 0.16 };
  /** the tor's radius at height y above its base: broad at the foot, a narrower summit block */
  const R0 = 13.5, R1 = 4.8;
  const radiusAt = (t: number) => R0 + (R1 - R0) * t ** 0.8;

  // ── the mass: jointed layers, each 3–5 rounded blocks round the core, each layer twisted on the one below ──
  const layerH = 3.2, nLayers = Math.max(2, Math.round((H + 1.5) / layerH));
  const lh = (H + 1.5) / nLayers;
  let y = base - 1.5, twist = rng.range(0, Math.PI);
  for (let i = 0; i < nLayers; i++) {
    const t = (i + 0.5) / nLayers, R = radiusAt(t), last = i === nLayers - 1;
    const hb = last ? top - y : lh * rng.range(0.9, 1.1);
    twist += rng.range(0.3, 0.9);
    const nb = last ? 1 : R > 8 ? 5 : R > 6 ? 4 : 3;
    for (let b = 0; b < nb; b++) {
      const a = twist + (b / nb) * Math.PI * 2 + rng.range(-0.2, 0.2);
      const off = last ? 0 : R * rng.range(0.3, 0.5);
      const bw = last ? R * 2 : R * rng.range(1.05, 1.3), bd = last ? R * 1.7 : R * rng.range(0.8, 1.05);
      const bx = cx + Math.cos(a) * off, bz = cz + Math.sin(a) * off, byaw = a + rng.range(-0.3, 0.3);
      const col = rng.next() < 0.4 ? C.graniteDark : rng.next() < 0.5 ? C.granite : C.graniteWarm;
      kit.add(graniteBlock(bw, hb * rng.range(0.85, 1.15) + 0.45, bd, 0x70 + i * 8 + b, 0.32), (_p, nn) => (nn.y > 0.65 ? C.graniteWarm : col), { ...stone, matrix: M(bx, y + hb / 2 - 0.15, bz, byaw, 1, 1, 1, rng.range(-0.04, 0.04), rng.range(-0.04, 0.04)) });
    }
    // the layer as an octagon of colliders (a hair inside the blocks)
    for (const ex of [0, Math.PI / 4]) colliders.push({ x: cx, z: cz, hw: R * 0.86, hd: R * 0.86, rot: ex, yBottom: base - 4, yTop: y + hb });
    y += hb;
  }
  // foot boulders (not on the path's first steps)
  for (let i = 0; i < 18; i++) {
    const a = rng.range(0, Math.PI * 2), r = rng.range(R0 + 1, R0 + 7);
    if (Math.abs(((a - Math.PI * 1.5) % (Math.PI * 2) + Math.PI * 3) % (Math.PI * 2) - Math.PI) < 0.5) continue;
    const x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r, s = rng.range(0.5, 1.9), g = ground(x, z);
    kit.add(blob(s, rng, 2, 0.6, 0.25), C.graniteDark, { ...stone, matrix: M(x, g + s * 0.12, z, rng.range(0, 6)) });
    if (s > 0.9) colliders.push({ x, z, hw: s * 0.75, hd: s * 0.75, rot: 0, yBottom: g - 1, yTop: g + s * 0.5 });
  }

  // ── the scramble: granite slabs stepping round the tor from its south foot to the summit (< one turn) ──
  const a0 = -Math.PI / 2 - 0.5;                                   // start: south (−z), a little east
  const y0 = ground(cx + Math.cos(a0) * (R0 + 1.4), cz + Math.sin(a0) * (R0 + 1.4));
  const climb = top - y0, RISER = 0.3, nSteps = Math.ceil(climb / RISER), riser = climb / nSteps;
  const sweep = Math.PI * 1.7, da = sweep / nSteps, W = 1.9;                // clockwise seen from above: west then north
  const slabs: { a: number; y: number; rIn: number }[] = [];
  for (let s = 1; s <= nSteps; s++) {
    const a = a0 - s * da, sy = y0 + s * riser, t = Math.min(1, Math.max(0, (sy - base) / H));
    const rIn = radiusAt(t) * 0.86 + 0.15;
    slabs.push({ a, y: sy, rIn });
    const rc = rIn + W / 2, x = cx + Math.cos(a) * rc, z = cz + Math.sin(a) * rc;
    const len = Math.max(0.9, (rIn + W) * da + 0.25);
    const g = graniteBlock(W + 0.5, 0.7, len, 0x400 + s, 0.08, 1);
    kit.add(g, (_p, nn) => (nn.y > 0.6 ? C.graniteWarm : C.graniteDark), { top: { color: C.lichen, threshold: 0.7, amount: 0.25 }, brush: 0.1, matrix: M(x, sy - 0.35, z, -a) });
  }
  platforms.push((x, z) => {
    const dx = x - cx, dz = z - cz, r = Math.hypot(dx, dz);
    const a = Math.atan2(dz, dx);
    // steps run clockwise from a0: how far along the sweep is this angle?
    let u = a0 - a; u = ((u % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
    const k = Math.floor(u / da);
    const sl = slabs[k];
    if (!sl || r < sl.rIn - 0.2 || r > sl.rIn + W + 0.1) return undefined;
    return sl.y;
  });
  // the summit: a flat terrace over the top block; a railed viewing deck on its north edge, a flag
  const rTop = radiusAt(1) * 0.8;
  platforms.push((x, z) => (Math.hypot(x - cx, z - cz) <= rTop ? top : undefined));
  {
    const dz = cz + rTop - 1.4;
    kit.add(new THREE.BoxGeometry(4.4, 0.14, 2.4), C.wood, { matrix: M(cx, top + 0.03, dz), flat: true });
    for (let i = 0; i <= 4; i++) kit.add(pole(v3(cx - 2.2 + i * 1.1, top - 0.1, dz + 1.15), v3(cx - 2.2 + i * 1.1, top + 1.1, dz + 1.15), 0.055, 0.05, 6), C.woodGrey);
    kit.add(pole(v3(cx - 2.3, top + 1.05, dz + 1.15), v3(cx + 2.3, top + 1.05, dz + 1.15), 0.045, 0.045, 5), C.woodGrey);
    colliders.push({ x: cx, z: dz + 1.2, hw: 2.3, hd: 0.1, rot: 0, yBottom: top - 0.5, yTop: top + 1.1 });
    const fp = v3(cx - 1.8, top, cz - 0.8);
    kit.add(pole(fp, fp.clone().add(v3(0, 4.2, 0)), 0.06, 0.045, 6), C.woodGrey);
    kit.add(blob(0.45, rng, 1, 0.7), C.graniteDark, { matrix: M(fp.x, top + 0.1, fp.z) });
    flutter.flag(fp.clone().add(v3(0, 4.1, 0)), 0.7, 1.3, '#2f6fb3', { droop: 0.2 });
    flutter.streamer(fp.clone().add(v3(0, 3.3, 0)), 1.8, 0.1, '#f2ece0');
    colliders.push({ x: fp.x, z: fp.z, hw: 0.3, hd: 0.3, rot: 0, yBottom: top - 1, yTop: top + 4 });
  }

  const mesh = kit.mesh(sky, { ground, aoH: 1.4 });
  mesh.name = 'nalati-eagle-rock';
  return { name: 'eagleRock', object: mesh, colliders, platforms, tris: mesh.geometry.getAttribute('position').count / 3 };
}
