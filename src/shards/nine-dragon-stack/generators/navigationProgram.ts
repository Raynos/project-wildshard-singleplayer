import { declareNavigation } from '@wildshard/sdk/bake/navigationAsset';
import type { ProjectGenerationContext } from '@wildshard/sdk/projectGeneration';

/** Original authored WSNM input, not the legacy producer's duplicate hash file. */
export const NINE_NAVIGATION_INPUT = 'assets/navigation-2a8083c33ed009f7f1fa122cbec44a2b83e2c457ad8f4dde012736f9e512ea08';

/** The same immutable file contract and public transport URL used by discovery. */
export interface NineNavigation extends Omit<ReturnType<typeof declareNavigation>, 'assets'> { readonly url: string }

/** Compute the original ordered navigation declaration from this invocation's owned bytes. */
export async function nineNavigation(ctx: Pick<ProjectGenerationContext, 'cached' | 'asset'>): Promise<NineNavigation> {
  const files = await ctx.cached({ id: 'navigation', inputs: [NINE_NAVIGATION_INPUT] }, inputs => {
    const bytes = inputs.get(NINE_NAVIGATION_INPUT);
    if (bytes === undefined) throw new Error('Missing Nine navigation source');
    return new Map([['navigation.bin', bytes]]);
  });
  const bytes = files.get('navigation.bin');
  if (bytes === undefined) throw new Error('Missing owned Nine navigation');
  const { assets, ...metadata } = declareNavigation(bytes);
  for (const [hash, owned] of assets) if (ctx.asset(owned) !== hash) throw new Error('Nine navigation publication differs');
  return { ...metadata, url: '/assets/baked/nine-dragon-stack/navmesh.bin' };
}
