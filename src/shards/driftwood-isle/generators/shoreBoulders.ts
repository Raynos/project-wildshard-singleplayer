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

/** The authored island shoreline scatter; reused by both detail tiers without geometry payloads. */
export function shoreBoulderFacts(): { seed: number; count: number; specs: BoulderSpec[] } {
  const source = readNativeTerrain(driftwoodGroundBytes());
  const heightAt = (x: number, z: number): number => source.heightAt(x, z) - WORLD_DROP;
  const seed = SEED, count = 110;
  return { seed, count, specs: scatterShore(seed, count, { heightAt }) };
}
