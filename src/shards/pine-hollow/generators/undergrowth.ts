/**
 * The forest floor's undergrowth shapes (G285: an offline bake). Build-time only: `src/shards/pine-hollow/generators/bake-pine-undergrowth.mjs`
 * runs `bakePineUndergrowth` and writes each kind's geometry (the fern rosette, the shrub's crossed quads, the litter,
 * pebble and moss quads, the reed clump) to `../data/undergrowth.json`; the page builds them from it
 * (../world/undergrowth.ts `UNDER_SHAPES`) and never runs this. test/shards/pine-hollow/undergrowth-bake.test.ts is the
 * stale gate. Each shape's stream is the level seed's (1337, the page's engine SEED while the floor builds) + 606 / 607 / 608.
 */
import { Rng } from '@wildshard/engine/core/rng';
import type { UnderShape, UnderShapes } from '../world/undergrowthKit';

/** Pine Hollow's level seed (manifest.ts `seed`): the page's engine SEED while the undergrowth builds */
export const PINE_SEED = 1337;

/** a shape's arrays as the page's Float32 attributes will hold them (f32-exact numbers) */
function blocks(verts: number[], norms: number[], uvs: number[], idx: number[]): UnderShape {
  const f32 = (a: number[]): number[] => a.map((v) => Math.fround(v));
  return { position: f32(verts), normal: f32(norms), uv: f32(uvs), index: idx };
}

function upNormal(x: number, z: number, out: number[]): void {
  const rl = Math.hypot(x, z) || 1;
  const nx = (x / rl) * 0.45, nz = (z / rl) * 0.45;
  const nl = Math.hypot(nx, 1, nz);
  out.push(nx / nl, 1 / nl, nz / nl);
}

/** Rosette of 9 arched frond quads (4 rows each), pivot at the crown. Unit ≈ 0.9 m frond length. */
function buildFernGeometry(): UnderShape {
  const rng = new Rng(PINE_SEED + 606);
  const verts: number[] = [], norms: number[] = [], uvs: number[] = [], idx: number[] = [];
  const rows = 5;
  const fronds = 9;
  for (let f = 0; f < fronds; f++) {
    const inner = f >= 6;
    const yaw = (f / (inner ? 3 : 6)) * Math.PI * 2 + rng.range(-0.3, 0.3) + (inner ? 0.5 : 0);
    const len = (inner ? 0.62 : 0.9) * rng.range(0.85, 1.15);
    const width = len * 0.42;
    const tiltUp = inner ? rng.range(0.9, 1.2) : rng.range(0.35, 0.6);   // radians above horizontal at the base
    const droop = rng.range(0.9, 1.4);
    const cy = Math.cos(yaw), sy = Math.sin(yaw);
    const base = verts.length / 3;
    for (let r = 0; r < rows; r++) {
      const t = r / (rows - 1);
      // arch: leaves the crown at tiltUp, bends over with droop
      const ang = tiltUp - droop * t * t;
      // integrate a little along the curve for the profile
      let px = 0, py = 0.05;
      const steps = 6;
      for (let s = 0; s < steps; s++) { const tt = (t * s) / steps; const a = tiltUp - droop * tt * tt; px += Math.cos(a) * (len * t) / steps; py += Math.sin(a) * (len * t) / steps; }
      void ang;
      for (let c = 0; c < 2; c++) {
        const lx = (c - 0.5) * width * Math.sin(Math.min(1, t * 1.6 + 0.15) * Math.PI * 0.5 + 0.2);
        const x = px * cy - lx * sy, z = px * sy + lx * cy;
        verts.push(x, py, z);
        upNormal(x, z, norms);
        uvs.push(c, t);
      }
    }
    for (let r = 0; r < rows - 1; r++) { const a = base + r * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
  }
  return blocks(verts, norms, uvs, idx);
}

/** 4 crossed quads, 0.95 m wide, 0.75 m tall. */
function buildShrubGeometry(): UnderShape {
  const rng = new Rng(PINE_SEED + 607);
  const verts: number[] = [], norms: number[] = [], uvs: number[] = [], idx: number[] = [];
  for (let q = 0; q < 4; q++) {
    const yaw = (q / 4) * Math.PI + rng.range(-0.2, 0.2);
    const cy = Math.cos(yaw), sy = Math.sin(yaw);
    const w = 0.95 * rng.range(0.85, 1.15), h = 0.75 * rng.range(0.85, 1.15);
    const base = verts.length / 3;
    for (let r = 0; r < 3; r++) {
      const t = r / 2;
      for (let c = 0; c < 2; c++) {
        const lx = (c - 0.5) * w, lz = rng.range(-0.02, 0.02) + t * t * 0.08;
        const x = lx * cy - lz * sy, z = lx * sy + lz * cy;
        verts.push(x, t * h, z); upNormal(x, z, norms); uvs.push(c, t);
      }
    }
    for (let r = 0; r < 2; r++) { const a = base + r * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
  }
  return blocks(verts, norms, uvs, idx);
}

/** One flat quad of `size` metres lying on the ground (pivot centre). */
function buildLitterGeometry(size: number): UnderShape {
  const h = size / 2;
  const verts = [-h, 0, -h, h, 0, -h, -h, 0, h, h, 0, h];
  const norms = [0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0];
  const uvs = [0, 1, 1, 1, 0, 0, 1, 0];
  return blocks(verts, norms, uvs, [0, 2, 1, 1, 2, 3]);
}

/** Reed / sedge clump: 3 crossed narrow quads, 1 m tall (scaled 0.8–1.2 per instance). */
function buildReedGeometry(): UnderShape {
  const rng = new Rng(PINE_SEED + 608);
  const verts: number[] = [], norms: number[] = [], uvs: number[] = [], idx: number[] = [];
  for (let q = 0; q < 3; q++) {
    const yaw = (q / 3) * Math.PI + rng.range(-0.2, 0.2);
    const cy = Math.cos(yaw), sy = Math.sin(yaw);
    const w = 0.3 * rng.range(0.85, 1.15), bend = rng.range(0.05, 0.12);
    const base = verts.length / 3;
    for (let r = 0; r < 4; r++) {
      const t = r / 3;
      for (let c = 0; c < 2; c++) {
        const lx = (c - 0.5) * w, lz = bend * t * t;
        const x = lx * cy - lz * sy, z = lx * sy + lz * cy;
        verts.push(x, t, z); upNormal(x, z, norms); uvs.push(c, t);
      }
    }
    for (let r = 0; r < 3; r++) { const a = base + r * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
  }
  return blocks(verts, norms, uvs, idx);
}

/** every kind's shape, as the page's Undergrowth built them */
export function bakePineUndergrowth(): UnderShapes {
  return {
    ferns: buildFernGeometry(), shrubs: buildShrubGeometry(), litter: buildLitterGeometry(1.4), stones: buildLitterGeometry(0.9),
    moss: buildLitterGeometry(1.0), reeds: buildReedGeometry(),
  };
}
