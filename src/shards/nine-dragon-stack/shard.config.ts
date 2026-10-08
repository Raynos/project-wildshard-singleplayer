import { NINE_DRAGON_RUNTIME_COST } from './data/runtimeCost';
import { emptyShardfile } from '@wildshard/sdk/author';
import { parseShardfile } from '@wildshard/sdk/shardfile';
import { ND_AUDIO } from './data/audio';

// The trusted runtime preserves today's fragment geometry; audio is selected by its declared section.
// G224 (Jake): Nine Dragon's four road-height decks each carry a portal to Lantern Square, and the square's one portal out
// sends you back to a deck (world/portalPlan.ts; the trusted runtime rides them, world/portalRide.ts). The format's
// portal-link entry kind (SF8c, src/game/shardfile/portalLink.ts) is not wired into the schema and the edge walk yet, so
// the four entries stay ordinary ground entries for now (the deck's end wall would block the ordinary walk, so its floor
// is not declared yet either); portalPlan.ts `portalLinks()` and entries.ts `portalFloorRows()` are the entries and the prop floors
// this file declares once the kind lands (their test runs the format's rules over them).
// oxlint-disable-next-line import/no-default-export -- The author CLI loads shard.config.ts as the project entry.
export default parseShardfile({ ...emptyShardfile({ slug: 'nine-dragon-stack', name: 'Nine Dragon Stack', author: 'Wildshard', revision: 1, seed: 0x9d2a }),
  accent: 'iris', runtime: { entry: 'runtime/index.ts', cost: NINE_DRAGON_RUNTIME_COST }, audio: ND_AUDIO, spawn: { x: 0.95, y: 125, z: 7.5, yaw: -12 * (Math.PI / 180) } });
