import { navigationSourceRows } from '@wildshard/sdk/bake/navigationAsset';
import { hashImmutableBytes } from '@wildshard/sdk/immutable';
import type { ProjectGenerationContext } from '@wildshard/sdk/projectGeneration';

export const SKY_NAVIGATION_HASH = '97a29a22f3827e4103059929276b2e6a6831f50bd5fc3b121abc11252f774f26';
export const SKY_NAVIGATION_INPUT = `assets/navigation-${SKY_NAVIGATION_HASH}`;
export interface SkyNavigationRows {
  readonly navigation: ReturnType<typeof navigationSourceRows>['navigation'];
  readonly url: string;
  readonly files: ReturnType<typeof navigationSourceRows>['files'];
  readonly critical: ReturnType<typeof navigationSourceRows>['critical'];
}

/** Decode and charge the exact original immutable stream, with no file or runtime authority. */
export function skyNavigationRows(bytes: Uint8Array): SkyNavigationRows {
  if (hashImmutableBytes(bytes) !== SKY_NAVIGATION_HASH) throw new Error('Sky navigation original hash differs');
  return navigationSourceRows(bytes, 'far-reach');
}

/** Exact original source bank; cache results are detached and re-admitted before publication. */
export async function skyNavigationProgram(ctx: Pick<ProjectGenerationContext, 'cached'>): Promise<{ rows: SkyNavigationRows; assets: Map<string, Uint8Array> }> {
  const files = await ctx.cached({ id: 'navigation', inputs: [SKY_NAVIGATION_INPUT] }, inputs => {
    const bytes = inputs.get(SKY_NAVIGATION_INPUT);
    if (inputs.size !== 1 || bytes === undefined || bytes.byteLength === 0) throw new Error('Sky navigation input inventory differs');
    skyNavigationRows(bytes);
    return Promise.resolve(new Map([['navigation.bin', Uint8Array.from(bytes)]]));
  });
  const bytes = files.get('navigation.bin');
  if (files.size !== 1 || bytes === undefined || bytes.byteLength === 0) throw new Error('Sky navigation cache inventory differs');
  const rows = skyNavigationRows(bytes);
  return { rows, assets: new Map([[rows.navigation.file, Uint8Array.from(bytes)]]) };
}

