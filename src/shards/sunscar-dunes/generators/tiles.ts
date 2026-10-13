import { Scene } from 'three';
import type { BakedTerrain, TerrainBakeSource } from '@wildshard/sdk/bake/terrain';
import { bake } from '@wildshard/sdk/bake';
import { signalHeightAt, signalTrailDistance } from './landscape';
import { signalManifestGround } from './manifestGround';
import { SAND_TINT } from '../data/duneField';

/** The manifest's own dune field (entry roads and graded trails included): the ground every Signal bake reads. */
export const signalDunesField = (): { heightAt: (x: number, z: number) => number; trailDistance: (x: number, z: number) => number } => ({ heightAt: signalHeightAt(), trailDistance: signalTrailDistance });

/**
 * SHARD-PLATFORM M3 (G227, "the shardfile is the bake"): Signal Dunes' code-built heightfield compiled into the shardfile's
 * 62.5 m terrain tiles (64 L0 + 16 L1 and the 257² critical collider; `@wildshard/sdk/bake/terrain`). The heights are the
 * manifest's own field (entry roads and graded trails included), so the tiles, the collider and the edge rows read exactly
 * the ground the runtime builds today. The vertex colours are the sand's drawn tint (data/duneField.ts SAND_TINT): each
 * vertex's stored f32 height against the exact f64 mean of its `ring` m ring (generators/manifestGround.ts) lerps the
 * sand toward the hollow or the crest, the same arithmetic the runtime once ran per tile, so the edge rows the grid's
 * seams read are the sand actually drawn. Baked through `bake(scene, identity)` (`generators/scene.ts`).
 */
export function signalTerrainSource(): TerrainBakeSource {
  const field = signalDunesField(), { means } = signalManifestGround(), t = SAND_TINT;
  const lerp = (a: number, b: number, k: number): number => a + (b - a) * k;
  return { heightAt: field.heightAt, family: 'pbr', colourAt: (x, z, h) => {
    const mean = means[Math.round((z + 250) * 256 / 500) * 257 + Math.round((x + 250) * 256 / 500)];
    if (mean === undefined) throw new Error(`Signal sand tint: (${String(x)}, ${String(z)}) is not a lattice vertex`);
    const rel = Math.max(-1, Math.min(1, (h - mean) / t.span)), [to, k] = rel < 0 ? [t.hollow, -rel * t.hollowGain] : [t.crest, rel * t.crestGain];
    return [lerp(t.sand[0], to[0], k), lerp(t.sand[1], to[1], k), lerp(t.sand[2], to[2], k)];
  } };
}

/** The terrain alone, through `bake` (an empty scene): `bake` sorts the rows into the product's canonical order. */
export function signalDunesTiles(): BakedTerrain {
  const baked = bake(new Scene(), { slug: 'sunscar-dunes' }, { terrain: signalTerrainSource() }).terrain;
  if (baked === null) throw new Error('Signal terrain did not bake');
  return baked;
}
