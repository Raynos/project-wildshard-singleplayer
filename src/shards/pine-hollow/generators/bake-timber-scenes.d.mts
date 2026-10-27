import type { questSites } from './questSites';
import type { TimberSceneCopy } from './timberScenes';

/** The quest sites (the hollow log's floor and mouths, the rifle) over the page's baked ground. */
export function pineQuestSites(): ReturnType<typeof questSites>;
/** The quest rides' GLBs (data/questRideModels.json rows) by product name. */
export function questRideGlbs(): [string, Uint8Array][];
/** The timber copies, the timbers library's geometry rows and every timber GLB by product name, built once per process
 *  (src/shards/pine-hollow/generators/bake-timber-scenes.mjs). */
export function pineTimberScenes(): Promise<{ copies: TimberSceneCopy[]; geometry: { id: string; file: string; attributes: Record<string, string> }[]; glbs: [string, Uint8Array][] }>;
