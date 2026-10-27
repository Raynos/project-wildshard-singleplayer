import type { ProjectGenerationContext } from '@wildshard/sdk/projectGeneration';
import { ISLET_POOL, REST_URLS } from './restFiles';
import { restPoolGlbs } from './restScene';
import { isletGlb } from './isletScene';

/** A rest pool's file name (its public `/assets/far-reach/baked/rest-*.glb` basename). */
const fileOf = (url: string): string => url.slice(url.lastIndexOf('/') + 1);
/** GR5: one owned rest pool: the public URL the native library declared it under, its product name and its bytes. */
export interface SkyRestPool { readonly url: string; readonly name: string; readonly bytes: Uint8Array }

/** The six original rest pools (winch, three hovers, storm, book halo) and the islet pool, built from code with no file
 *  input and cached under the full author-program identity, so the product owns them instead of their public handoffs. */
export async function skyRestPoolProgram(ctx: Pick<ProjectGenerationContext, 'cached'>): Promise<readonly SkyRestPool[]> {
  const files = await ctx.cached({ id: 'rest-pools' }, inputs => {
    if (inputs.size > 0) throw new Error('Unexpected Sky rest-pool input');
    const glbs = restPoolGlbs();
    if (glbs.length !== REST_URLS.length) throw new Error('Sky rest-pool inventory differs');
    return new Map(REST_URLS.map((url, index): [string, Uint8Array] => {
      const bytes = glbs[index];
      if (bytes === undefined) throw new Error(`Missing Sky rest pool ${url}`);
      return [fileOf(url), bytes];
    }));
  });
  if (files.size !== REST_URLS.length) throw new Error('Sky rest-pool cache inventory differs');
  const islets = await ctx.cached({ id: 'islet-pool' }, inputs => {
    if (inputs.size > 0) throw new Error('Unexpected Sky islet-pool input');
    return new Map([[fileOf(ISLET_POOL.url), isletGlb()]]);
  });
  const islet = islets.get(fileOf(ISLET_POOL.url));
  if (islets.size !== 1 || islet === undefined || islet.byteLength === 0) throw new Error('Sky islet-pool cache inventory differs');
  return [...REST_URLS.map(url => {
    const bytes = files.get(fileOf(url));
    if (bytes === undefined || bytes.byteLength === 0) throw new Error(`Sky rest-pool cache misses ${url}`);
    return { url, name: `world/geometry/${fileOf(url)}`, bytes };
  }), { url: ISLET_POOL.url, name: `world/geometry/${fileOf(ISLET_POOL.url)}`, bytes: islet }];
}
