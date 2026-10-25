import type { ProjectGenerationContext } from '@wildshard/sdk/projectGeneration';
import { emptyShardfile } from '@wildshard/sdk/author';
import { portalEntryRows } from './portalEntries';
import { portalFloorRows } from './portalFloors';
import { headlessConstants } from './headless';

/** Preserve the original fresh static portal capsule proof before the product receives its evidence. */
export function nineEntryProof(ctx: Pick<ProjectGenerationContext, 'proveStaticPortalEntries'>): ReturnType<ProjectGenerationContext['proveStaticPortalEntries']> {
  const base = emptyShardfile({ slug: 'nine-dragon-stack', name: 'Nine Dragon Stack', author: 'Wildshard', revision: 1, seed: 0x9d2a });
  return ctx.proveStaticPortalEntries({ ...base, entryways: portalEntryRows(), props: { version: 1, family: 'pbr', tiles: [], panels: [], models: [], far: null, textures: [], colliders: portalFloorRows() } }, headlessConstants['pieces']);
}
