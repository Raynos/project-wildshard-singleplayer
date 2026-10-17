import { installEliteEncounters as eliteinstallEliteEncounters } from '@wildshard/game/shardfile/eliteEncounters';
import { pineEliteScripts as elitepineEliteScripts } from '../combat/eliteScripts';
import { Lane as eliteLane } from '../combat/lane';
import type { HeadlessAssemblyModules } from '@wildshard/sdk/headlessAssembly';
import { parsePineQuestRows as module0ParsePineQuestRows } from '../quest/rows';
import { PINE_GROUND_RES as module1PINE_GROUND_RES, pineBake as module1PineBake } from '../runtime/baked';
import { readNavmesh as module2ReadNavmesh } from '@wildshard/engine/physics/navmesh';
import { bakedSamplers as module3BakedSamplers, parseBakedTerrain as module3ParseBakedTerrain } from '@wildshard/engine/world/BakedTerrain';
import { parseNativeFirearmProfile as module4ParseNativeFirearmProfile, parseWeaponProfile as module4ParseWeaponProfile } from '@wildshard/format/weaponProfiles';
import { installNativeItems as module5InstallNativeItems, observeNativeCombatMotion as module5ObserveNativeCombatMotion, readItemInventory as module5ReadItemInventory } from '@wildshard/game/plugin/nativeItems';
import { bindNativeLoadout as module6BindNativeLoadout, weaponRow as module6WeaponRow } from '@wildshard/game/plugin/simulation';
import { readDirectorProduct as module7ReadDirectorProduct } from '@wildshard/game/plugin/director';
import { preparePopulationModule as module8PreparePopulationModule } from '../quest/waves';
import { installNativePopulationWaves as nativeInstallWaves } from '../quest/nativeWaves';
import { PINE_INTERACT as module9PINE_INTERACT, installHollowQuest as module9InstallHollowQuest, pineSpots as module9PineSpots } from '../runtime/quest';
import { parseContractCatalogue as module10ParseContractCatalogue } from '@wildshard/format/contracts';
import { parseAchievementCounterData as module11ParseAchievementCounterData } from '@wildshard/format/achievementCounters';
import { parseExchange as module12ParseExchange } from '@wildshard/game/loot/exchange';
import { parseWeatherProgram as module13ParseWeatherProgram } from '@wildshard/format/weatherProgram';
import { bindHeadlessCommands as module14BindHeadlessCommands, installNativeCollision as module14InstallNativeCollision } from '@wildshard/sdk/headlessRuntime';
import { nativeDecisionAuthority as module15NativeDecisionAuthority } from '@wildshard/game/shardfile/borrowedDecisions';
import { installPopulationRoster as module16InstallPopulationRoster } from '@wildshard/sdk/populationRoster';
import { pineHuntGround as populationGround } from '../runtime/herds';
import { installKingPoseKeeper as populationPose } from '../runtime/kingPoseKeeper';
import { installGroundBoss as module18InstallPineKing } from '@wildshard/game/boss/native';
import { DayCycle as module19DayCycle } from '@wildshard/engine/world/dayCycle';
import { PINE_DAY as module20PINE_DAY } from '../look/dayKeys';
import { NativeHeldAmmunition as module21NativeHeldAmmunition } from '@wildshard/game/loadout/nativeAmmunition';
import { installWeatherContinuation as module23InstallWeatherContinuation } from '@wildshard/game/plugin/weather';
import { installNativeHerdShelter as module24InstallNativeHerdShelter } from '@wildshard/sdk/populationShelter';
import { proveTerrainEntries as module25ProveTerrainEntries } from '@wildshard/game/plugin/mover';
import { isStandaloneEdgeWall as module26IsStandaloneEdgeWall } from '@wildshard/engine/physics/terrain';

/** Static trusted capabilities checked against the product at build time.
 * Only declared exports are lent; no runtime module string is loaded. */
export const headlessModules = {
  'src/shards/pine-hollow/quest/rows': { parsePineQuestRows: module0ParsePineQuestRows },
  'src/shards/pine-hollow/runtime/baked': { PINE_GROUND_RES: module1PINE_GROUND_RES, pineBake: module1PineBake },
  '@wildshard/engine/physics/navmesh': { readNavmesh: module2ReadNavmesh },
  '@wildshard/engine/world/BakedTerrain': { bakedSamplers: module3BakedSamplers, parseBakedTerrain: module3ParseBakedTerrain },
  '@wildshard/format/weaponProfiles': { parseNativeFirearmProfile: module4ParseNativeFirearmProfile, parseWeaponProfile: module4ParseWeaponProfile },
  '@wildshard/game/plugin/nativeItems': { installNativeItems: module5InstallNativeItems, observeNativeCombatMotion: module5ObserveNativeCombatMotion, readItemInventory: module5ReadItemInventory },
  '@wildshard/game/plugin/simulation': { bindNativeLoadout: module6BindNativeLoadout, weaponRow: module6WeaponRow },
  '@wildshard/game/plugin/director': { readDirectorProduct: module7ReadDirectorProduct },
  'src/shards/pine-hollow/quest/waves': { preparePopulationModule: module8PreparePopulationModule },
  'src/shards/pine-hollow/quest/nativeWaves': { installNativePopulationWaves: nativeInstallWaves },
  'src/shards/pine-hollow/runtime/quest': { PINE_INTERACT: module9PINE_INTERACT, installHollowQuest: module9InstallHollowQuest, pineSpots: module9PineSpots },
  '@wildshard/format/contracts': { parseContractCatalogue: module10ParseContractCatalogue },
  '@wildshard/format/achievementCounters': { parseAchievementCounterData: module11ParseAchievementCounterData },
  '@wildshard/game/loot/exchange': { parseExchange: module12ParseExchange },
  '@wildshard/format/weatherProgram': { parseWeatherProgram: module13ParseWeatherProgram },
  '@wildshard/sdk/headlessRuntime': { bindHeadlessCommands: module14BindHeadlessCommands, installNativeCollision: module14InstallNativeCollision },
  '@wildshard/game/shardfile/borrowedDecisions': { nativeDecisionAuthority: module15NativeDecisionAuthority },
  '@wildshard/sdk/populationRoster': { installPopulationRoster: module16InstallPopulationRoster },
  'src/shards/pine-hollow/runtime/herds': { pineHuntGround: populationGround },
  'src/shards/pine-hollow/runtime/kingPoseKeeper': { installKingPoseKeeper: populationPose },
  '@wildshard/game/boss/native': { installGroundBoss: module18InstallPineKing },
  '@wildshard/engine/world/dayCycle': { DayCycle: module19DayCycle },
  'src/shards/pine-hollow/look/dayKeys': { PINE_DAY: module20PINE_DAY },
  '@wildshard/game/loadout/nativeAmmunition': { NativeHeldAmmunition: module21NativeHeldAmmunition },
  '@wildshard/game/plugin/weather': { installWeatherContinuation: module23InstallWeatherContinuation },
  '@wildshard/sdk/populationShelter': { installNativeHerdShelter: module24InstallNativeHerdShelter },
  '@wildshard/game/plugin/mover': { proveTerrainEntries: module25ProveTerrainEntries },
  '@wildshard/engine/physics/terrain': { isStandaloneEdgeWall: module26IsStandaloneEdgeWall },
  '@wildshard/game/shardfile/eliteEncounters': { installEliteEncounters: eliteinstallEliteEncounters },
  'src/shards/pine-hollow/combat/eliteScripts': { pineEliteScripts: elitepineEliteScripts },
  'src/shards/pine-hollow/combat/lane': { Lane: eliteLane },
} satisfies HeadlessAssemblyModules;
