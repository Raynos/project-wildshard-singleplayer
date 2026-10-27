import { readNativeTerrain } from '@wildshard/sdk/bake/terrain';
import { hashImmutableBytes } from '@wildshard/sdk/immutable';
import { OCEAN } from './worldSites';
import { TRAILS, WORLD_DROP } from './landscapeRows';
import { GROUND_LOOK } from './groundLook';
import { facetedGroundGlbs, type FacetedGroundField } from './facetedGround';
import { driftwoodGroundBytes } from './groundRows';
import publicInputs from '../data/publicInputs.json' with { type: 'json' };

/** The faceted ground (GR7: the `driftwood-faceted-ground` job's two GLBs and their hash-named public copies): the grid and
 *  the slab by product name, and their public URLs as aliases of those names. */
export interface DriftwoodFacetedGroundBank {
  readonly blobs: ReadonlyMap<string, Uint8Array>;
  readonly byUrl: Readonly<Record<string, string>>;
}

/** Distance to the nearest authored trail centreline, as the engine's terrain metadata measures it (one root of the
 *  smallest squared segment distance). */
function trailDistance(x: number, z: number): number {
  let d = Infinity;
  for (const poly of TRAILS) for (let i = 0; i < poly.length - 1; i++) {
    const a = poly[i], b = poly[i + 1];
    if (a === undefined || b === undefined) continue;
    const vx = b[0] - a[0], vz = b[1] - a[1], wx = x - a[0], wz = z - a[1], l2 = vx * vx + vz * vz;
    const t = l2 > 0 ? Math.min(1, Math.max(0, (wx * vx + wz * vz) / l2)) : 0;
    const dx = x - (a[0] + vx * t), dz = z - (a[1] + vz * t);
    d = Math.min(d, dx * dx + dz * dz);
  }
  return Math.sqrt(d);
}

/** the job's hash-named public copies' folder (their URLs are the blobs' aliases) */
const BAKED = publicInputs.baked;
let bank: DriftwoodFacetedGroundBank | undefined;
/** Built once per build process from the native ground (no file is read); every reader treats it as read-only. */
export function driftwoodFacetedGroundBank(): DriftwoodFacetedGroundBank { bank ??= buildFacetedGroundBank(); return bank; }

function buildFacetedGroundBank(): DriftwoodFacetedGroundBank {
  const native = readNativeTerrain(driftwoodGroundBytes());
  // the island's heights with its G164 datum, as the level's bound heightfield samples them; normals unshifted
  const field: FacetedGroundField = { heightAt: (x, z) => native.heightAt(x, z) - WORLD_DROP, normalAt: (x, z, eps) => native.normalAt(x, z, eps), trailDistance };
  const blobs = new Map<string, Uint8Array>(), byUrl: Record<string, string> = {};
  for (const [part, bytes] of Object.entries(facetedGroundGlbs(field, GROUND_LOOK, OCEAN.level))) {
    blobs.set(`world/ground/${part}.glb`, bytes);
    byUrl[`${BAKED}ground-${hashImmutableBytes(bytes)}.glb`] = `world/ground/${part}.glb`;
  }
  return { blobs, byUrl };
}
