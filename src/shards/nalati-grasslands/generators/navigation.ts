import { declareNavigation } from '@wildshard/sdk/bake/navigationAsset';
import type { ProjectGenerationContext } from '@wildshard/sdk/projectGeneration';
import type { Shardfile } from '@wildshard/sdk/shardfile';
import source from '../data/navigationSource.json' with { type: 'json' };

const HASH = '223ce1ab45d736c5fb526308cb86bc6d61bdeb482ac886a7d47306fd5a8c41b5';
/** Tracked native source consumed by the product and boot metadata publishers. */
export const NALATI_NAVIGATION_INPUT = `assets/navigation-${HASH}`;
/** Original public native navigation URL used by discovery. */
export const NALATI_NAVIGATION_URL = source.url;

/** Explicit spatial fields consumed by the source-built product header. */
export interface NalatiNavigationRows {
  navigation: ReturnType<typeof declareNavigation>['navigation'];
  files: Shardfile['files'];
  critical: Shardfile['critical'];
}

/** Admit the original WSNM source without resampling, reordering or a world bake. */
export function nalatiNavigationSource(bytes: Uint8Array): ReturnType<typeof declareNavigation> {
  const rows = declareNavigation(bytes);
  if (rows.navigation.file !== HASH) throw new Error('Nalati navigation source identity differs');
  return rows;
}

/** Product-owned navigation preserves the original charged file and publishes its immutable bytes.
 * The cache reads only the tracked project-relative source; no generated metadata or copied asset is read. */
export async function nalatiNavigationProgram(ctx: Pick<ProjectGenerationContext, 'cached' | 'asset'>): Promise<NalatiNavigationRows> {
  const files = await ctx.cached({ id: 'navigation', inputs: [NALATI_NAVIGATION_INPUT] }, inputs => {
    const bytes = inputs.get(NALATI_NAVIGATION_INPUT);
    if (bytes === undefined || bytes.length === 0) throw new Error('Missing Nalati navigation source');
    return new Map([['navigation.bin', bytes]]);
  });
  const bytes = files.get('navigation.bin');
  if (bytes === undefined) throw new Error('Missing owned Nalati navigation bytes');
  const { assets, ...rows } = nalatiNavigationSource(bytes);
  for (const [hash, file] of assets) if (ctx.asset(file) !== hash) throw new Error('Owned Nalati navigation identity differs');
  return rows;
}
