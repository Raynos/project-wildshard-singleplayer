import { emptyShardfile } from '@wildshard/sdk/author';
import { parseShardfile } from '@wildshard/sdk/shardfile';
import { AUDIO } from './data/audio';
import { ENTRY_RAMPS } from './world/ramps';

// Legacy trusted runtime retains today's geometry/spawn; SF29 binds only its audio.
// SF49-g (G99 / G102): every entry meets the road over the cloud sea's void (no ground below y = 0 anywhere at an edge), so
// each is a socket with a declared landing (SHARDFILE.md `socketOverWater`, its only below-road socket kind): four plank
// road landings, top y = 0, across each socket's full 8 m shard-side edge, from which the switchback ramps climb to the
// islands (world/ramps.ts; world/entries.ts installs the same boxes behind the farReachEntries row).
const base = emptyShardfile({ slug: 'far-reach', name: 'Sky Reach', author: 'Wildshard', revision: 1, seed: 6417 });
// oxlint-disable-next-line import/no-default-export -- The author CLI loads shard.config.ts as the project entry.
export default parseShardfile({ ...base, accent: 'pink', runtime: { entry: 'runtime/index.ts' }, audio: AUDIO,
  entryways: base.entryways.map(({ edge, at, width }) => ({ edge, at, width, kind: 'socketOverWater' as const })),
  props: { version: 1, family: 'toon', tiles: [], panels: [], models: [], far: null, textures: [],
    colliders: ENTRY_RAMPS.map((entry) => ({ id: `landing.${entry.edge}`, panel: null, initialActive: true, shapes: [{ ...entry.landing }] })) } });
