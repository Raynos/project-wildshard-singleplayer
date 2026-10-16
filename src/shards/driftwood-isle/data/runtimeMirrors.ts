import { defineMirror } from '@wildshard/sdk/runtimeMirrors';
import { COVER_LOOKS } from './coverLook';
import { CREATURE_LOOKS } from './creatureLook';
import { FIREFLY_LOOK } from './fireflyLook';
import { GULL_GRAPH_LOOK } from './gullGraphLook';
import { ISLAND_LOOKS } from './islandLook';
import { OCEAN_DRY_SLOTS, OCEAN_LOOK, OCEAN_NO_DRY, SEA_RES } from './oceanLook';
import { POOL_LOOK, SHRINE_POOL_LOOK } from './poolLook';
import { REEF_LOOK } from './reefLook';
import { SMOKE_LOOK } from './smokeLook';
import { CASCADE_LOOKS } from './waterfallLook';

/** Every value runtime/const.ts copies, next to its source (P2a spec §2.3); a drift refuses. */
export const RUNTIME_MIRRORS = [
  defineMirror('CASCADE_LOOKS', CASCADE_LOOKS),
  defineMirror('SMOKE_LOOK', SMOKE_LOOK),
  defineMirror('FIREFLY_LOOK', FIREFLY_LOOK),
  defineMirror('REEF_LOOK', REEF_LOOK),
  defineMirror('POOL_LOOK', POOL_LOOK),
  defineMirror('SHRINE_POOL_LOOK', SHRINE_POOL_LOOK),
  defineMirror('OCEAN_LOOK', OCEAN_LOOK),
  defineMirror('OCEAN_DRY_SLOTS', OCEAN_DRY_SLOTS),
  defineMirror('OCEAN_NO_DRY', OCEAN_NO_DRY),
  defineMirror('SEA_RES', SEA_RES),
  defineMirror('GULL_GRAPH_LOOK', GULL_GRAPH_LOOK),
  defineMirror('CREATURE_LOOKS', CREATURE_LOOKS),
  defineMirror('COVER_LOOKS', COVER_LOOKS),
  defineMirror('ISLAND_LOOKS', ISLAND_LOOKS),
];
