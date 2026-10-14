/**
 * Pine Hollow's rain, the static half (SHARD-PLATFORM W2 C2): the crowns' cover map and the puddles in the ground's low
 * spots, baked offline by `bake-pine-rain.mjs` over the page's own ground and forest (the level selected, its terrain
 * grid installed and its trees planted, as scripts/bake-chunk.mjs does). The page's rain system
 * (runtime/looks/rainFx.ts) reads them back from `public/assets/pine-hollow/baked/rain[.phone].bin`; the roofs' channel
 * of the cover map stays on the page (the cabins' decks and the cave are the page's own).
 */
import * as THREE from 'three';
import { PineSeedStream as Rng } from './seedStream';

/** The ground the puddles read: the page's Heightfield after its bake is installed. */
export interface RainGround {
  heightAt: (x: number, z: number) => number;
  normalAt: (x: number, z: number, eps?: number) => readonly [number, number, number];
  splatAt: (x: number, z: number) => readonly number[];
  trailDistance: (x: number, z: number) => number;
  cabinMask: (x: number, z: number) => number;
  pondMask: (x: number, z: number) => number;
  streamAt: (x: number, z: number) => number | null;
  inChunk: (x: number, z: number, margin?: number) => boolean;
}

/** A count per device tier. */
interface TierCount { readonly phone: number; readonly desktop: number }
/** The puddles' sizes (data/weatherLook.ts `PINE_RAIN.puddles`): spots per tier, the disc's sides and its rings (radius, depth). */
export interface PuddleLook { readonly trail: TierCount; readonly open: TierCount; readonly seg: number; readonly rings: readonly (readonly [number, number])[] }

/** A planted tree, as the cover reads it. */
export interface RainTree { readonly x: number; readonly z: number; readonly height: number }

/** The crowns' cover (the map's R byte per texel, 0 … 255, row-major over z then x), from the forest's trees. */
export function crownCover(trees: readonly RainTree[], N: number, half: number): Float32Array {
  const cell = (2 * half) / N, cov = new Float32Array(N * N), out = new Float32Array(N * N);
  for (const t of trees) {
    const r = Math.max(1.6, 0.16 * t.height + 0.8), i0 = (t.x + half) / cell, j0 = (t.z + half) / cell, rc = r / cell;
    for (let j = Math.max(0, Math.floor(j0 - rc)); j <= Math.min(N - 1, Math.ceil(j0 + rc)); j++) {
      for (let i = Math.max(0, Math.floor(i0 - rc)); i <= Math.min(N - 1, Math.ceil(i0 + rc)); i++) {
        const q = Math.hypot(i + 0.5 - i0, j + 0.5 - j0) / rc;
        if (q >= 1) continue;
        const k = j * N + i;
        cov[k] = Math.min(1, (cov[k] ?? 0) + 0.85 * (1 - q * q));
      }
    }
  }
  for (let k = 0; k < N * N; k++) out[k] = Math.round((cov[k] ?? 0) * 255);
  return out;
}

/**
 * The merged puddle discs of one tier: the low spots on or beside the roads and trails, then the open meadows' dips (little
 * crown over them), each an irregular draped disc (deep centre, the water's edge, a wet dark rim, fading out) with the
 * water program's `aWater` (depth, 0, 0, murk 45 / m) and world x/z as its uv, normals from its triangles.
 */
export function puddleGeometry(g: RainGround, o: { seed: number; phone: boolean; look: PuddleLook; half: number; coverAt: (x: number, z: number) => number }): THREE.BufferGeometry {
  const pl = o.look, H = o.half;
  const rng = new Rng(o.seed ^ 0x9dd1), want = o.phone ? pl.trail.phone : pl.trail.desktop;
  const spots: { x: number; z: number; r: number }[] = [];
  // the low spots on or beside the roads and trails: a point a few cm under the ground 2 m round it
  for (let tries = 0; tries < 30000 && spots.length < want; tries++) {
    const x = rng.range(-H, H), z = rng.range(-H, H);
    if (!g.inChunk(x, z, 12) || g.trailDistance(x, z) > 2.4) continue;
    if (g.cabinMask(x, z) > 0 || g.pondMask(x, z) > 0.01 || g.streamAt(x, z) !== null) continue;
    const h = g.heightAt(x, z);
    const m = (g.heightAt(x + 2, z) + g.heightAt(x - 2, z) + g.heightAt(x, z + 2) + g.heightAt(x, z - 2)) / 4;
    if (h - m > -0.006 && rng.next() > 0.1) continue; // mostly concave spots, a few anywhere on the track
    if (spots.some((s) => (s.x - x) ** 2 + (s.z - z) ** 2 < 49)) continue;
    spots.push({ x, z, r: rng.range(0.6, 1.5) });
  }
  const trailSpots = spots.length;
  // the meadows' low spots too: open, flat, not rock, the dips; their own random stream, appended after the trails'
  const rx = new Rng(o.seed ^ 0x51ab), wantOff = o.phone ? pl.open.phone : pl.open.desktop;
  for (let tries = 0; tries < 40000 && spots.length < trailSpots + wantOff; tries++) {
    const x = rx.range(-H, H), z = rx.range(-H, H);
    if (!g.inChunk(x, z, 12) || g.trailDistance(x, z) <= 2.4 || o.coverAt(x, z) > 0.45) continue;
    if (g.cabinMask(x, z) > 0 || g.pondMask(x, z) > 0.01 || g.streamAt(x, z) !== null) continue;
    if ((g.splatAt(x, z)[2] ?? 0) > 0.15 || g.normalAt(x, z, 1.5)[1] < 0.975) continue;
    const h = g.heightAt(x, z);
    const m = (g.heightAt(x + 2.5, z) + g.heightAt(x - 2.5, z) + g.heightAt(x, z + 2.5) + g.heightAt(x, z - 2.5)) / 4;
    if (h - m > -0.012) continue; // only the dips: water pools, it does not sit on a rise
    if (spots.some((s) => (s.x - x) ** 2 + (s.z - z) ** 2 < 100)) continue;
    spots.push({ x, z, r: rx.range(0.8, 2.0) });
  }
  const RINGS = pl.rings, SEG = pl.seg;
  const pos: number[] = [], uv: number[] = [], aw: number[] = [], idx: number[] = [];
  for (const s of spots) {
    const base = pos.length / 3, ph = rng.range(0, 6.283), ph2 = rng.range(0, 6.283), stretch = rng.range(1, 1.7), rot = rng.range(0, Math.PI);
    const cr = Math.cos(rot), sr = Math.sin(rot);
    for (let r = 0; r < RINGS.length; r++) {
      const ring = RINGS[r] ?? [0, 0];
      const n = r === 0 ? 1 : SEG;
      for (let k = 0; k < n; k++) {
        const a = (k / SEG) * Math.PI * 2;
        const wob = 1 + 0.16 * Math.sin(a * 3 + ph) + 0.1 * Math.sin(a * 5 + ph2);
        const lx = Math.cos(a) * ring[0] * s.r * wob * stretch, lz = Math.sin(a) * ring[0] * s.r * wob;
        const x = s.x + lx * cr - lz * sr, z = s.z + lx * sr + lz * cr;
        pos.push(x, g.heightAt(x, z) + 0.035, z);
        uv.push(x, z);
        aw.push(ring[1], 0, 0, 45); // murky: 45 / m
      }
    }
    // the centre fan, then quads between rings
    for (let k = 0; k < SEG; k++) idx.push(base, base + 1 + ((k + 1) % SEG), base + 1 + k);
    for (let r = 1; r + 1 < RINGS.length; r++) {
      const a0 = base + 1 + (r - 1) * SEG, b0 = a0 + SEG;
      for (let k = 0; k < SEG; k++) {
        const k1 = (k + 1) % SEG;
        idx.push(a0 + k, a0 + k1, b0 + k, a0 + k1, b0 + k1, b0 + k);
      }
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setAttribute('aWater', new THREE.Float32BufferAttribute(aw, 4));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return geo;
}
