import { readNativeTerrain } from '@wildshard/sdk/bake/terrain';
import { hashImmutableBytes } from '@wildshard/sdk/immutable';
import publicInputs from '../data/publicInputs.json' with { type: 'json' };
import { OCEAN } from './worldSites';
import { WORLD_DROP } from './landscapeRows';
import { ISLAND_KNOBS } from './tiers';
import { inIslandChunk, oceanGridGlb, seaFloor, type OceanGround } from './oceanGrid';
import { driftwoodGroundBytes } from './groundRows';

/** The sea (GR7: the `driftwood-ocean` job's hash-named grids and floor): each tier's grid and the floor's heights by
 *  their page-file names (productPageFiles.ts), and the public URLs they had (oceanFiles.ts's `OCEAN_FILES`). */
export interface DriftwoodOceanBank {
  readonly files: { readonly phone: Uint8Array; readonly desktop: Uint8Array; readonly floor: Uint8Array };
  readonly urls: { readonly phone: string; readonly desktop: string; readonly floor: string };
}

let bank: DriftwoodOceanBank | undefined;
/** Built once per build process from the native ground (no file is read); every reader treats it as read-only. */
export function driftwoodOceanBank(): DriftwoodOceanBank { bank ??= buildOceanBank(); return bank; }

function buildOceanBank(): DriftwoodOceanBank {
  const native = readNativeTerrain(driftwoodGroundBytes());
  // the island's heights with its G164 datum, as the level's bound heightfield samples them
  const ground: OceanGround = { heightAt: (x, z) => native.heightAt(x, z) - WORLD_DROP, inChunk: inIslandChunk };
  const floor = seaFloor(ground);
  const files = { phone: oceanGridGlb(ground, ISLAND_KNOBS.phone.oceanCell, OCEAN.level, OCEAN.deepDepth),
    desktop: oceanGridGlb(ground, ISLAND_KNOBS.desktop.oceanCell, OCEAN.level, OCEAN.deepDepth),
    floor: new Uint8Array(floor.buffer, floor.byteOffset, floor.byteLength) };
  const url = (bytes: Uint8Array, extension: string): string => `${publicInputs.baked}ocean-${hashImmutableBytes(bytes)}.${extension}`;
  return { files, urls: { phone: url(files.phone, 'glb'), desktop: url(files.desktop, 'glb'), floor: url(files.floor, 'bin') } };
}
