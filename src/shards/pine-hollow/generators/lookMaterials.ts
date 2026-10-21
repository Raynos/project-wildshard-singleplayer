import authored from '../data/lookGraphs.json' with { type: 'json' };
import { WATER_GRAPHS } from './waterGraphs';

/**
 * Every SF59 material graph Pine Hollow's runtime draws its own meshes in, by look.materials id: the authored graph JSON
 * (data/lookGraphs.json `runtime`: the cabin doors, roofs and stone, the hearth particles, the cave's shaft, the crags'
 * granite, the waterfall's spray, the Antler King fight's fog wall and fallen-lantern flames, the rain's curtain, splashes
 * and lens drops and the forest floor's undergrowth), then the water's (./waterGraphs.ts). runtime/index.ts compiles them
 * all before the streams build.
 */
export const PINE_GRAPHS: Readonly<Record<string, unknown>> = { ...authored.runtime, ...WATER_GRAPHS };

/**
 * The build's look.materials graphs (`src/sdk/bake/json.mjs` writes them to data/lookMaterials.generated.json): the
 * runtime's (above), then the authored views' (data/lookGraphs.json `views`: the keyed sky's dome and environment pass,
 * compiled by the keyed-sky render host (game looks/keyedSky.ts); the forest's, by the manifest's tree set (game models/treeSet.ts); the small wildlife's, by models/wildlife.ts).
 */
export function pineLookMaterials(): { readonly runtime: readonly string[]; readonly graphs: Readonly<Record<string, unknown>> } {
  return { runtime: Object.keys(PINE_GRAPHS), graphs: { ...PINE_GRAPHS, ...authored.views } };
}
