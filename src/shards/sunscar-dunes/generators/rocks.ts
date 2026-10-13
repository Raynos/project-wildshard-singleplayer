import { Group, IcosahedronGeometry, InstancedMesh, Matrix4, MeshStandardMaterial, Quaternion, Vector3, type BufferGeometry } from 'three';
import { Rng } from '@wildshard/sdk/random';
import { BASIN, BRAZIERS, CARAVAN, PLAY_HALF, RIDGES, SEED, SPAWN, TOWER, WELL } from '../data/layout';
import { signalDunesField } from './tiles';
import { bakePiece, signalPiece, type SignalPieceBake, boxDesc, type ColliderDesc } from './kinds';
import type { BakedPiece } from '@wildshard/sdk/bake';

/**
 * Build-time only (SHARD-PLATFORM SF72, SF67 fix 3 "bake the code-built worlds"): Signal Dunes' wind-cut rock field, baked
 * offline into a static GLB and its collider rows (`scripts/bake-signal-world.mjs` → `public/assets/sunscar-dunes/baked/
 * <sha256>.glb` + `data/rocks.json`). The client loads the bake (`world/baked.ts`) and builds no rock mesh; nothing here is
 * imported by the client. The shapes are the runtime builder's, unchanged: the ground is the manifest's own field.
 */

/** The rock counts (instanced: one draw each, never multi-draw); the shrubs and grass are `world/dressing.ts`. */
export const SCATTER = { boulders: 0, bigBoulder: 1.1 } as const; // E399: clean sand (the mockups show no loose rocks)
/** The sandstone colours, as the client's materials draw them (`world/baked.ts`). */
export const SANDSTONE = 0x8c4c2e, SANDSTONE_DARK = 0x6a3826;

export interface RockField { root: Group; colliders: ColliderDesc[]; ridges: InstancedMesh; boulders: InstancedMesh }

/**
 * A boulder: an icosahedron (detail 0 = 20 faces, 1 = 80) with every vertex pushed in/out by value noise, squashed
 * vertically; shared vertices move together so the rock stays watertight. The engine kit's `rock`, authored here so the
 * bake reads no engine module (G320); test/signal-world-authoring.test.ts keeps the two bit-equal.
 */
export function rock(r: number, detail: number, rng: Rng, squash = 0.7, rough = 0.28): BufferGeometry {
  const g = new IcosahedronGeometry(r, detail), pos = g.getAttribute('position'), seen = new Map<string, number>();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i), key = `${x.toFixed(3)},${y.toFixed(3)},${z.toFixed(3)}`;
    let k = seen.get(key);
    if (k === undefined) { k = 1 + rng.range(-rough, rough); seen.set(key, k); }
    pos.setXYZ(i, x * k, y * k * squash, z * k);
  }
  return g;
}

/** The places every scatter keeps clear of (metres). */
const KEEP_CLEAR: readonly { x: number; z: number; r: number }[] = [
  { x: SPAWN.x, z: SPAWN.z, r: 12 }, { x: TOWER.x, z: TOWER.z, r: 16 }, { x: CARAVAN.x, z: CARAVAN.z - 12, r: 26 }, { x: WELL.x, z: WELL.z, r: 12 },
  { x: BASIN.x, z: BASIN.z, r: BASIN.floor }, ...BRAZIERS.map((b) => ({ x: b.x, z: b.z, r: 6 })),
];
const clear = (x: number, z: number, pad: number): boolean => KEEP_CLEAR.every((c) => Math.hypot(x - c.x, z - c.z) > c.r + pad);

/**
 * Wind-cut sandstone: the yardang ridges (three overlapping rock lobes each, a box collider per lobe), scattered
 * boulders (the large ones collide). Each kind is one `InstancedMesh`.
 */
export function buildRocks(groundAt: (x: number, z: number) => number, trailDistance: (x: number, z: number) => number): RockField {
  const root = new Group(), colliders: ColliderDesc[] = [], rng = new Rng(SEED * 7 + 11);
  const stone = new MeshStandardMaterial({ color: SANDSTONE, roughness: 0.95, flatShading: true });
  const dark = new MeshStandardMaterial({ color: SANDSTONE_DARK, roughness: 0.95, flatShading: true });
  const m = new Matrix4(), q = new Quaternion(), s = new Vector3(), p = new Vector3(), up = new Vector3(0, 1, 0);
  const place = (mesh: InstancedMesh, i: number, x: number, y: number, z: number, yaw: number, sx: number, sy: number, sz: number): void => {
    q.setFromAxisAngle(up, yaw); m.compose(p.set(x, y, z), q, s.set(sx, sy, sz)); mesh.setMatrixAt(i, m);
  };
  // Ridges: three lobes along the wind, the middle one tallest; sunk so the sand drifts against them.
  const lobe: BufferGeometry = rock(1, 1, new Rng(SEED + 3), 0.55, 0.3);
  const ridges = new InstancedMesh(lobe, stone, RIDGES.length * 3);
  RIDGES.forEach((r, k) => {
    for (let j = 0; j < 3; j++) {
      const along = (j - 1) * r.len * 0.32, x = r.x + Math.sin(r.yaw) * along, z = r.z + Math.cos(r.yaw) * along;
      const h = r.h * (j === 1 ? 1 : 0.7), half = r.len * (j === 1 ? 0.3 : 0.24), w = Math.max(1.6, r.h * 0.7), y = groundAt(x, z) - 0.6;
      place(ridges, k * 3 + j, x, y, z, r.yaw + rng.range(-0.08, 0.08), w, h * 1.6, half);
      colliders.push(boxDesc({ x, z, hw: w * 0.75, hd: half * 0.8, rot: -r.yaw, yBottom: y - 1, yTop: y + h * 0.8 }, 'rock'));
    }
  });
  root.add(ridges);
  // Boulders: anywhere off the paths and the places, larger ones collide.
  const boulderGeo = rock(1, 0, new Rng(SEED + 5), 0.7, 0.32);
  const boulders = new InstancedMesh(boulderGeo, dark, SCATTER.boulders);
  let nb = 0;
  for (let tries = 0; nb < SCATTER.boulders && tries < SCATTER.boulders * 20; tries++) {
    const x = rng.range(-PLAY_HALF + 8, PLAY_HALF - 8), z = rng.range(-PLAY_HALF + 8, PLAY_HALF - 8);
    if (!clear(x, z, 4) || trailDistance(x, z) < 6) continue;
    const size = rng.chance(0.25) ? rng.range(1.2, 2.2) : rng.range(0.35, 0.9), y = groundAt(x, z) - size * 0.25, yaw = rng.range(0, Math.PI * 2);
    place(boulders, nb++, x, y, z, yaw, size, size * rng.range(0.7, 1.1), size * rng.range(0.8, 1.3));
    if (size > SCATTER.bigBoulder) colliders.push(boxDesc({ x, z, hw: size * 0.7, hd: size * 0.7, rot: -yaw, yBottom: y - size * 0.5, yTop: y + size * 0.6 }, 'rock'));
  }
  boulders.count = nb; root.add(boulders);
  return { root, colliders, ridges, boulders };
}

/**
 * The rock field baked on the manifest's own dune field (`signalDunesField`, the heights and trail distances the runtime
 * builder read): each non-empty instanced kind is one GLB node (`generators/kinds.ts`), and the colliders are the builder's
 * own boxes.
 */
export function signalRocksPiece(): BakedPiece<ColliderDesc> {
  const field = signalDunesField(), built = buildRocks(field.heightAt, field.trailDistance);
  return signalPiece('rocks', [['ridges', built.ridges], ['boulders', built.boulders]], built.colliders);
}
export const bakeSignalRocks = (): SignalPieceBake => bakePiece(signalRocksPiece());
