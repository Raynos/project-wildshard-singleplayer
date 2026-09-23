/**
 * glbCreatures — the generated creature GLBs (public/assets/nalati/models/, static hulls) skinned onto the procedural
 * species' skeletons, so the same bones, animations and AI drive them (AnimalFactory 'painterly' style, Nalati).
 *
 *   preloadCreatureGlbs();                                    // at factory construction: fetch the hulls early
 *   const s = skinCreatureGlb(kind, variantId, procGeometry);  // null → keep the procedural mesh (off / not loaded yet)
 *   s.geometry  (position, normal, uv, color, skinIndex, skinWeight; one group)   s.map (the atlas)
 *
 * How the hull is fitted to the rig (both are in animal space: +Z forward, +Y up, feet on y = 0):
 *   1. height: y scaled so the hull's top meets the procedural mesh's top;
 *   2. length: z mapped (scale + offset) so the hull's front and back leg columns (the vertices in the bottom 18 %,
 *      split front / back) land on the procedural legs' — the joints the walk cycle bends are where the legs are;
 *      x takes the mean of the y and z scales;
 *   3. weights: every hull vertex takes the inverse-square-distance blend of its 6 nearest procedural vertices'
 *      skin weights (the species author's own weighting, transferred), top 4 kept, normalised.
 * The hull's coat comes from the atlas; vertex colours are white (the per-animal tint still multiplies via `color`).
 * Which variants swap: only those whose coat the hull shows (the dun wild horse, the camp bay, the grey / tawny /
 * young wolves, Aqbars) — a hull can't be recoloured into a chestnut or a black horse.
 */
import * as THREE from 'three';
import { loadModelRaw, modelRawIfLoaded, modelsOn, type NalatiModelName } from '../world/nalati/glbPaint';

const HULL: Readonly<Record<string, NalatiModelName>> = {
  'horse:dun': 'horse-wild',
  'horse:camp-bay': 'horse-saddled',
  'wolf:grey': 'wolf',
  'wolf:tawny': 'wolf',
  'wolf:scout': 'wolf',
  'leopard:aqbars': 'snow-leopard',
};

/** the hull for (kind, variant) when the creature models are on, else null */
export function creatureHull(kind: string, variant: string): NalatiModelName | null {
  if (!modelsOn('creatures')) return null;
  return HULL[`${kind}:${variant}`] ?? null;
}

let preloaded = false;
export function preloadCreatureGlbs(): void {
  if (preloaded || !modelsOn('creatures')) return;
  preloaded = true;
  for (const n of new Set(Object.values(HULL))) loadModelRaw(n).catch((e: unknown) => { console.warn(`[nalati] creature ${n} failed`, e); });
}

export interface SkinnedHull { geometry: THREE.BufferGeometry; map: THREE.Texture | null }

/** leg-column centres (z) of the vertices in the bottom `frac` of the height: [front, back] */
function legColumns(pos: ArrayLike<number>, n: number, h: number, frac = 0.18): [number, number] | null {
  const zs: number[] = [];
  for (let i = 0; i < n; i++) if ((pos[i * 3 + 1] ?? 0) < h * frac) zs.push(pos[i * 3 + 2] ?? 0);
  if (zs.length < 8) return null;
  let lo = Infinity, hi = -Infinity;
  for (const z of zs) { lo = Math.min(lo, z); hi = Math.max(hi, z); }
  const mid = (lo + hi) / 2;
  let f = 0, nf = 0, b = 0, nb = 0;
  for (const z of zs) { if (z > mid) { f += z; nf++; } else { b += z; nb++; } }
  if (nf === 0 || nb === 0) return null;
  return [f / nf, b / nb];
}

const cache = new Map<string, SkinnedHull>();

/**
 * The hull for (kind, variant) skinned to `proc` (the procedural model's merged geometry: position + skinIndex +
 * skinWeight in the bind pose). Null when the models are off, the variant has no hull, or the hull hasn't loaded yet.
 */
export function skinCreatureGlb(kind: string, variant: string, proc: THREE.BufferGeometry): SkinnedHull | null {
  const name = creatureHull(kind, variant);
  if (name === null) return null;
  const key = `${kind}:${variant}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const raw = modelRawIfLoaded(name);
  if (raw === null) return null;
  if (!proc.hasAttribute('skinIndex') || !proc.hasAttribute('skinWeight')) return null;

  const pp = proc.getAttribute('position'), pi = proc.getAttribute('skinIndex'), pw = proc.getAttribute('skinWeight');
  const np = pp.count;
  const P = new Float32Array(np * 3);
  for (let i = 0; i < np; i++) { P[i * 3] = pp.getX(i); P[i * 3 + 1] = pp.getY(i); P[i * 3 + 2] = pp.getZ(i); }
  const g = raw.geometry.clone();
  const gp = g.getAttribute('position');
  const ng = gp.count;
  const G = gp.array;

  // ── 1–2: fit ──
  let hP = 0, hG = 0;
  for (let i = 0; i < np; i++) hP = Math.max(hP, P[i * 3 + 1] ?? 0);
  for (let i = 0; i < ng; i++) hG = Math.max(hG, G[i * 3 + 1] ?? 0);
  const sy = hG > 0 ? hP / hG : 1;
  const legsP = legColumns(P, np, hP), legsG0 = legColumns(G, ng, hG);
  let sz = sy, oz = 0;
  if (legsP && legsG0) {
    const spanG = legsG0[0] - legsG0[1], spanP = legsP[0] - legsP[1];
    if (spanG > 1e-3 && spanP > 1e-3) { sz = spanP / spanG; oz = legsP[0] - legsG0[0] * sz; }
  }
  const sx = (sy + sz) / 2;
  g.scale(sx, sy, sz);
  g.translate(0, 0, oz);
  g.computeVertexNormals();

  // ── 3: weights from the nearest procedural vertices (a uniform grid over the procedural mesh) ──
  const cell = Math.max(0.02, hP * 0.06);
  const grid = new Map<string, number[]>();
  const keyOf = (x: number, y: number, z: number) => `${Math.floor(x / cell)},${Math.floor(y / cell)},${Math.floor(z / cell)}`;
  for (let i = 0; i < np; i++) {
    const k = keyOf(P[i * 3] ?? 0, P[i * 3 + 1] ?? 0, P[i * 3 + 2] ?? 0);
    let l = grid.get(k); if (!l) { l = []; grid.set(k, l); } l.push(i);
  }
  const K = 6;
  const skinIndex = new Uint16Array(ng * 4), skinWeight = new Float32Array(ng * 4);
  const pos = g.getAttribute('position');
  const bestI = new Int32Array(K), bestD = new Float64Array(K);
  const acc = new Map<number, number>();
  for (let v = 0; v < ng; v++) {
    const x = pos.getX(v), y = pos.getY(v), z = pos.getZ(v);
    const cx = Math.floor(x / cell), cy = Math.floor(y / cell), cz = Math.floor(z / cell);
    bestD.fill(Infinity); bestI.fill(-1);
    for (let r = 1; r <= 12; r++) {
      for (let a = cx - r; a <= cx + r; a++) for (let b = cy - r; b <= cy + r; b++) for (let c = cz - r; c <= cz + r; c++) {
        // only the shell of the cube at radius r (the inside was searched at r − 1)
        if (r > 1 && Math.abs(a - cx) < r && Math.abs(b - cy) < r && Math.abs(c - cz) < r) continue;
        const l = grid.get(`${a},${b},${c}`);
        if (!l) continue;
        for (const i of l) {
          const d = ((P[i * 3] ?? 0) - x) ** 2 + ((P[i * 3 + 1] ?? 0) - y) ** 2 + ((P[i * 3 + 2] ?? 0) - z) ** 2;
          if (d >= (bestD[K - 1] ?? 0)) continue;
          let j = K - 1;
          while (j > 0 && (bestD[j - 1] ?? 0) > d) { bestD[j] = bestD[j - 1] ?? 0; bestI[j] = bestI[j - 1] ?? -1; j--; }
          bestD[j] = d; bestI[j] = i;
        }
      }
      if ((bestI[K - 1] ?? -1) >= 0 && (bestD[K - 1] ?? 0) < (r * cell) ** 2) break;
    }
    acc.clear();
    for (let j = 0; j < K; j++) {
      const i = bestI[j] ?? -1;
      if (i < 0) continue;
      const w = 1 / ((bestD[j] ?? 0) + 1e-6);
      for (let c = 0; c < 4; c++) {
        const bw = pw.getComponent(i, c);
        if (bw <= 0) continue;
        const bi = pi.getComponent(i, c);
        acc.set(bi, (acc.get(bi) ?? 0) + bw * w);
      }
    }
    const top = [...acc].sort((p, q) => q[1] - p[1]).slice(0, 4);
    const sum = top.reduce((s, t) => s + t[1], 0) || 1;
    top.forEach(([bi, bw], c) => { skinIndex[v * 4 + c] = bi; skinWeight[v * 4 + c] = bw / sum; });
    if (top.length === 0) skinWeight[v * 4] = 1; // bone 0 = body
  }
  g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(skinIndex, 4));
  g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(skinWeight, 4));
  g.setAttribute('color', new THREE.BufferAttribute(new Uint8Array(ng * 3).fill(255), 3, true));
  const count = g.index !== null ? g.index.count : ng;
  g.clearGroups(); g.addGroup(0, count, 0);
  g.computeBoundingBox();
  g.computeBoundingSphere();
  if (g.boundingSphere !== null) g.boundingSphere.radius += 0.6; // animated legs / neck never leave this (as the procedural)
  const out = { geometry: g, map: raw.map };
  cache.set(key, out);
  return out;
}
