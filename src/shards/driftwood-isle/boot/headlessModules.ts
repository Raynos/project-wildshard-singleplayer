import type { HeadlessAssemblyModules } from '@wildshard/sdk/headlessAssembly';
import { driftwoodBake as module0DriftwoodBake, driftwoodSpecs as module0DriftwoodSpecs, readEnemyPlacements as module0ReadEnemyPlacements, readKeeperRows as module0ReadKeeperRows } from '../sim/baked';
import { installIsland as module1InstallIsland } from '../sim/keeper';
import { installCaptain as module2InstallCaptain } from '../sim/captainEncounter';
import { installDriftwoodKills as module3InstallDriftwoodKills } from '../sim/kills';
import { createMonkeyAnimation as module4CreateMonkeyAnimation } from '../species/monkeyPolicy';
import { driftwoodSpots as module5DriftwoodSpots, installDriftwoodQuest as module5InstallDriftwoodQuest } from '../runtime/quest';
import { DRIFTWOOD_SEA as module6DRIFTWOOD_SEA, LOWERED_SEA as module6LOWERED_SEA } from '../world/sea';
import { DRIFTWOOD_DAY as module7DRIFTWOOD_DAY } from '../look/dayKeys';
import { parseAchievementCounterData as module8ParseAchievementCounterData } from '@wildshard/format/achievementCounters';
import { readNavmesh as module9ReadNavmesh } from '@wildshard/engine/physics/navmesh';
import { DirectorScriptStageLane as module10DirectorScriptStageLane, readDirectorProduct as module10ReadDirectorProduct } from '@wildshard/game/plugin/director';
import { DayCycle as module11DayCycle } from '@wildshard/engine/world/dayCycle';
import { waveHeight as module12WaveHeight } from '@wildshard/engine/world/waves';
import { bindHeadlessCommands as module13BindHeadlessCommands, installNativeCollision as module13InstallNativeCollision } from '@wildshard/sdk/headlessRuntime';
import { nativeDecisionAuthority as module14NativeDecisionAuthority } from '@wildshard/game/shardfile/borrowedDecisions';
import { installNativeItems as module15InstallNativeItems } from '@wildshard/game/plugin/nativeItems';
import { proveTerrainEntries as module16ProveTerrainEntries } from '@wildshard/game/plugin/mover';

/** Static trusted capabilities checked against the product at build time.
 * Only declared exports are lent; no runtime module string is loaded. */
export const headlessModules = {
  'src/shards/driftwood-isle/sim/baked': { driftwoodBake: module0DriftwoodBake, driftwoodSpecs: module0DriftwoodSpecs, readEnemyPlacements: module0ReadEnemyPlacements, readKeeperRows: module0ReadKeeperRows },
  'src/shards/driftwood-isle/sim/keeper': { installIsland: module1InstallIsland },
  'src/shards/driftwood-isle/sim/captainEncounter': { installCaptain: module2InstallCaptain },
  'src/shards/driftwood-isle/sim/kills': { installDriftwoodKills: module3InstallDriftwoodKills },
  'src/shards/driftwood-isle/species/monkeyPolicy': { createMonkeyAnimation: module4CreateMonkeyAnimation },
  'src/shards/driftwood-isle/runtime/quest': { driftwoodSpots: module5DriftwoodSpots, installDriftwoodQuest: module5InstallDriftwoodQuest },
  'src/shards/driftwood-isle/world/sea': { DRIFTWOOD_SEA: module6DRIFTWOOD_SEA, LOWERED_SEA: module6LOWERED_SEA },
  'src/shards/driftwood-isle/look/dayKeys': { DRIFTWOOD_DAY: module7DRIFTWOOD_DAY },
  '@wildshard/format/achievementCounters': { parseAchievementCounterData: module8ParseAchievementCounterData },
  '@wildshard/engine/physics/navmesh': { readNavmesh: module9ReadNavmesh },
  '@wildshard/game/plugin/director': { DirectorScriptStageLane: module10DirectorScriptStageLane, readDirectorProduct: module10ReadDirectorProduct },
  '@wildshard/engine/world/dayCycle': { DayCycle: module11DayCycle },
  '@wildshard/engine/world/waves': { waveHeight: module12WaveHeight },
  '@wildshard/sdk/headlessRuntime': { bindHeadlessCommands: module13BindHeadlessCommands, installNativeCollision: module13InstallNativeCollision },
  '@wildshard/game/shardfile/borrowedDecisions': { nativeDecisionAuthority: module14NativeDecisionAuthority },
  '@wildshard/game/plugin/nativeItems': { installNativeItems: module15InstallNativeItems },
  '@wildshard/game/plugin/mover': { proveTerrainEntries: module16ProveTerrainEntries },
} satisfies HeadlessAssemblyModules;
