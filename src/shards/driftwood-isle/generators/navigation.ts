import { navigationSourceRows } from '@wildshard/sdk/bake/navigationAsset';
import { hashImmutableBytes } from '@wildshard/sdk/immutable';
import type { ProjectGenerationContext } from '@wildshard/sdk/projectGeneration';

export const DRIFTWOOD_NAVIGATION_HASH = 'c5185248a44d1f5c20c129e6bc25785ff6c1a81206f19f162d32cfe77131b464';
export const DRIFTWOOD_NAVIGATION_INPUT = `assets/navigation-${DRIFTWOOD_NAVIGATION_HASH}`;

/** Decode the original immutable WSNM stream; no resampling, reordered tile or transformed byte. */
export function driftwoodNavigationRows(bytes: Uint8Array): ReturnType<typeof navigationSourceRows> {
  if (hashImmutableBytes(bytes) !== DRIFTWOOD_NAVIGATION_HASH) throw new Error('Driftwood navigation original hash differs');
  return navigationSourceRows(bytes, 'driftwood-isle');
}

/** Native cached bytes enter the declaration, discovery and product from this one authored input. */
export async function driftwoodNavigation(ctx: Pick<ProjectGenerationContext, 'cached' | 'asset'>): Promise<ReturnType<typeof driftwoodNavigationRows>> {
  const files = await ctx.cached({ id: 'navigation', native: true, inputs: [DRIFTWOOD_NAVIGATION_INPUT] }, inputs => {
    const bytes = inputs.get(DRIFTWOOD_NAVIGATION_INPUT);
    if (inputs.size !== 1 || bytes === undefined) throw new Error('Missing Driftwood navigation input');
    driftwoodNavigationRows(bytes);
    return Promise.resolve(new Map([['navigation.bin', bytes]]));
  });
  const bytes = files.get('navigation.bin');
  if (files.size !== 1 || bytes === undefined) throw new Error('Invalid Driftwood navigation cache inventory');
  const rows = driftwoodNavigationRows(bytes);
  ctx.asset(bytes);
  return rows;
}
