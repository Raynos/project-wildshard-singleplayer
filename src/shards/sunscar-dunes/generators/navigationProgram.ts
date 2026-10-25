import { declareNavigation } from '@wildshard/sdk/bake/navigationAsset';
import type { ProjectGenerationContext } from '@wildshard/sdk/projectGeneration';

/** Original authored WSNM input; the duplicate generated hash file is never an input. */
export const SIGNAL_NAVIGATION_INPUT = 'assets/navigation-9922f620591f1a29bd42ace6bce7829eb54604f977dfb86ae3b18b383b06fbb6';
export interface SignalNavigation extends Omit<ReturnType<typeof declareNavigation>, 'assets'> { readonly url: string }

/** Declare and publish the same immutable navigation bytes through the source invocation. */
export async function signalNavigation(ctx: Pick<ProjectGenerationContext, 'cached' | 'asset'>): Promise<SignalNavigation> {
  const files = await ctx.cached({ id: 'navigation', inputs: [SIGNAL_NAVIGATION_INPUT] }, inputs => {
    const bytes = inputs.get(SIGNAL_NAVIGATION_INPUT);
    if (inputs.size !== 1 || bytes === undefined) throw new Error('Missing original navigation input');
    return new Map([['navigation.bin', bytes]]);
  });
  const bytes = files.get('navigation.bin');
  if (files.size !== 1 || bytes === undefined) throw new Error('Navigation cache inventory differs');
  const { assets, ...metadata } = declareNavigation(bytes);
  for (const [hash, owned] of assets) if (ctx.asset(owned) !== hash) throw new Error('Navigation publication differs');
  return { ...metadata, url: '/assets/baked/sunscar-dunes/navmesh.bin' };
}
