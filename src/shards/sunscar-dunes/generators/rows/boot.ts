import REST_POOLS from '../../data/restPools.generated.json' with { type: 'json' };
import { SAND_FILES } from './sand';
import { BAKED_PIECES, BAKED_URLS, DUNE_HD, DUNE_MESHES, DUNE_RIGS, DUNE_HD_URLS, DUNE_MESH_URLS, DUNE_RIG_URLS, PAINTED_STAGES, PAINTED_URLS } from './files';

/** The existing ordered painted sky, sand, model and rig inventory. */
const sources = {
  sky: PAINTED_STAGES.map(key => PAINTED_URLS[key]), baked: [], terrain: Object.values(SAND_FILES), trees: [], physics: [], cabins: [],
  props: [...DUNE_MESHES.map(key => DUNE_MESH_URLS[key]), ...DUNE_HD.map(key => DUNE_HD_URLS[key]), ...BAKED_PIECES.map(key => BAKED_URLS[key]), ...DUNE_RIGS.map(key => DUNE_RIG_URLS[key]), ...REST_POOLS.map(pool => pool.url)],
  art: [], music: [], sfx: [],
};
/** Both tiers intentionally share the same declared source URLs. */
export const BOOT_SOURCES = { tiers: { phone: sources, desktop: sources } };
/** The original flattened inventory uses the phone image source. */
export const BOOT_FILES = { sources: BOOT_SOURCES, tier: 'phone', tex: 'img' } as const;
/** Owned pools, rigs and world pieces are preloaded by their admitted scene library, not retired public URLs. */
export function signalOwnedBoot(poolUrls: readonly string[] = []): { files: typeof BOOT_FILES; sources: typeof BOOT_SOURCES } {
  const rigs = new Set([...Object.values(DUNE_RIG_URLS), ...Object.values(BAKED_URLS), ...poolUrls]);
  const owned = { ...sources, terrain: sources.terrain.filter(url => url !== SAND_FILES.skirt), props: sources.props.filter(url => !rigs.has(url)) };
  const boot = { tiers: { phone: owned, desktop: owned } };
  return { sources: boot, files: { ...BOOT_FILES, sources: boot } };
}
/** The learned grade remains the only late read. */
export const LATE_READS = ['/assets/lut/sunscar-dunes.bin'];
