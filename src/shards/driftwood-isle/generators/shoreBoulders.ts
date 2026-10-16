import { CHUNK_HALF, ROAD_WIDTH } from '@wildshard/engine/core/config';
import { Rng } from '@wildshard/engine/core/rng';
import { readNativeTerrain } from '@wildshard/sdk/bake/terrain';
import { SEED, WORLD_DROP, SHORE_LEVEL } from '../data/landscapeRows';
import { WRECK_SITES } from '../data/wreckSites';
import { driftwoodGroundBytes } from './groundRows';
import type { BoulderSpec } from '../world/Boulders';

interface Ground { heightAt: (x: number, z: number) => number }
const inChunk = (x: number, z: number, margin: number): boolean => Math.abs(x) <= CHUNK_HALF - margin && Math.abs(z) <= CHUNK_HALF - margin;
const WRECK = WRECK_SITES.world;
/** The original shoreline rule, evaluated offline against the native terrain samples. */
export function scatterShore(seed: number, count: number, ground: Ground): BoulderSpec[] {
  const heightAt = ground.heightAt, waterLevel = (): number => SHORE_LEVEL - WORLD_DROP;
    const rng = new Rng(seed ^ 0x0b0c);
    const wl = waterLevel();
    const out: BoulderSpec[] = [];
    let tries = 0;
    while (out.length < count && tries++ < count * 60) {
      const x = rng.range(-CHUNK_HALF + 20, CHUNK_HALF - 20), z = rng.range(-CHUNK_HALF + 20, CHUNK_HALF - 20);
      if (!inChunk(x, z, 15)) continue;
      const h = heightAt(x, z) - wl;
      if (h < -2.2 || h > 2.4) continue;                                      // the surf / the beach band only
      if (Math.abs(x) < ROAD_WIDTH / 2 + 8 && Math.abs(z) > 150) continue;    // N/S pier corridors
      if (Math.abs(z) < ROAD_WIDTH / 2 + 8 && Math.abs(x) > 150) continue;    // E/W
      if (out.some((b) => Math.hypot(b.x - x, b.z - z) < (b.r + 2.5) * 1.6)) continue;
      const big = rng.next() < 0.3;
      const r = big ? rng.range(2.6, 4.6) : rng.range(0.9, 2.0);
      out.push({ x, z, r, rot: rng.range(0, Math.PI * 2), squash: rng.range(0.55, 0.85) });
      // a cluster: one or two smaller ones beside a big one
      if (big) for (let k = 0; k < rng.int(1, 3); k++) {
        const a = rng.range(0, Math.PI * 2), d = r + rng.range(0.8, 2.2);
        out.push({ x: x + Math.cos(a) * d, z: z + Math.sin(a) * d, r: rng.range(0.5, 1.2), rot: rng.range(0, Math.PI * 2), squash: rng.range(0.55, 0.8) });
      }
    }
    // the wreck brings its own reef rocks and needs its beach side (the breach, the ramp) clear
    return out.filter((b) => Math.hypot(b.x - WRECK.x, b.z - WRECK.z) > 16 + b.r);
}

/**
 * The authored island shoreline scatter; reused by both detail tiers without geometry payloads. With it, what the world
 * used to work out from each spec at load (G467): the shore boulder model's placements (yawed, leaned with the slope by
 * the terrain normal 1.5 m out, sunk to a third of their height), the legacy boxes of the rocks that collide (r > 0.9)
 * and the gull perches on the big rocks' tops (r > 1.8).
 */
export function shoreBoulderFacts(): { seed: number; count: number; specs: BoulderSpec[]; placements: ShorePlacement[]; boxes: ShoreBox[]; perches: [number, number, number][] } {
  const source = readNativeTerrain(driftwoodGroundBytes());
  const heightAt = (x: number, z: number): number => source.heightAt(x, z) - WORLD_DROP;
  const seed = SEED, count = 110, specs = scatterShore(seed, count, { heightAt });
  const placements = specs.map((b): ShorePlacement => {
    const y = heightAt(b.x, b.z), [nx, , nz] = source.normalAt(b.x, b.z, 1.5);
    return { x: b.x, y: y + b.r * (b.squash ?? 0.7) * 0.35, z: b.z, yaw: b.rot ?? 0, leanX: nz * 0.6, leanZ: -nx * 0.6, params: { r: b.r, squash: b.squash ?? 0.7 } };
  });
  const boxes = specs.filter(b => b.r > 0.9).map((b): ShoreBox => ({ x: b.x, z: b.z, hw: b.r * 0.8, hd: b.r * 0.8, rot: b.rot ?? 0, yTop: heightAt(b.x, b.z) + b.r * 1.2, yBottom: heightAt(b.x, b.z) - 2 }));
  const perches = specs.filter(b => b.r > 1.8).map((b): [number, number, number] => [b.x, heightAt(b.x, b.z) + b.r * (b.squash ?? 0.7) * 1.3, b.z]);
  return { seed, count, specs, placements, boxes, perches };
}
interface ShorePlacement { x: number; y: number; z: number; yaw: number; leanX: number; leanZ: number; params: { r: number; squash: number } }
interface ShoreBox { x: number; z: number; hw: number; hd: number; rot: number; yTop: number; yBottom: number }
