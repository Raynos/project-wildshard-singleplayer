import type { HeadlessAssemblyModules } from '@wildshard/sdk/headlessAssembly';
import { parseWeatherProgram as m0parseWeatherProgram } from '@wildshard/format/weatherProgram';
import { prepareNalatiRaidDirector as m1prepareNalatiRaidDirector } from '../runtime/raidDirector';
import { nalatiBake as m2nalatiBake, NALATI_GROUND_RES as m2NALATI_GROUND_RES, NALATI_GROUND_SIZE as m2NALATI_GROUND_SIZE } from '../runtime/baked';
import { nalatiTerrainGrid as m3nalatiTerrainGrid, nalatiWorldQueries as m3nalatiWorldQueries, nalatiDayClock as m3nalatiDayClock, nalatiBootClock as m3nalatiBootClock, installNalatiRoster as m3installNalatiRoster, nalatiGrassView as m3nalatiGrassView, installNalatiTrample as m3installNalatiTrample, installNalatiWeather as m3installNalatiWeather, nalatiLightningGround as m3nalatiLightningGround } from '../runtime/headless';
import { bakedSamplers as m4bakedSamplers } from '@wildshard/engine/world/BakedTerrain';
import { readNavmesh as m5readNavmesh } from '@wildshard/engine/physics/navmesh';
import { installNativeCollision as m6installNativeCollision } from '@wildshard/sdk/headlessRuntime';
import { nalatiEliteBindings as m7nalatiEliteBindings, installNalatiElites as m7installNalatiElites } from '../runtime/headlessElites';
import { nalatiHeadlessEnv as m8nalatiHeadlessEnv, installNalatiGroups as m8installNalatiGroups } from '../runtime/groups';
import { nalatiTamingOf as m9nalatiTamingOf, installNalatiTaming as m9installNalatiTaming } from '../runtime/headlessTaming';
import { installNalatiCreatures as m10installNalatiCreatures } from '../runtime/headlessCreatures';
import { nalatiWetAt as m11nalatiWetAt } from '../wet';
import { installNalatiMountedPlayer as m12installNalatiMountedPlayer } from '../runtime/headlessMounted';
import { TERRAIN as m13TERRAIN } from '../world/terrain';
import { clamp as m14clamp } from '@wildshard/engine/core/noise';
import { proveTerrainEntries as m15proveTerrainEntries } from '@wildshard/game/plugin/mover';

/** Trusted static imports; every capability matches the admitted assembly. */
export const headlessModules = {
  '@wildshard/format/weatherProgram': { parseWeatherProgram: m0parseWeatherProgram },
  'src/shards/nalati-grasslands/runtime/raidDirector': { prepareNalatiRaidDirector: m1prepareNalatiRaidDirector },
  'src/shards/nalati-grasslands/runtime/baked': { nalatiBake: m2nalatiBake, NALATI_GROUND_RES: m2NALATI_GROUND_RES, NALATI_GROUND_SIZE: m2NALATI_GROUND_SIZE },
  'src/shards/nalati-grasslands/runtime/headless': { nalatiTerrainGrid: m3nalatiTerrainGrid, nalatiWorldQueries: m3nalatiWorldQueries, nalatiDayClock: m3nalatiDayClock, nalatiBootClock: m3nalatiBootClock, installNalatiRoster: m3installNalatiRoster, nalatiGrassView: m3nalatiGrassView, installNalatiTrample: m3installNalatiTrample, installNalatiWeather: m3installNalatiWeather, nalatiLightningGround: m3nalatiLightningGround },
  '@wildshard/engine/world/BakedTerrain': { bakedSamplers: m4bakedSamplers },
  '@wildshard/engine/physics/navmesh': { readNavmesh: m5readNavmesh },
  '@wildshard/sdk/headlessRuntime': { installNativeCollision: m6installNativeCollision },
  'src/shards/nalati-grasslands/runtime/headlessElites': { nalatiEliteBindings: m7nalatiEliteBindings, installNalatiElites: m7installNalatiElites },
  'src/shards/nalati-grasslands/runtime/groups': { nalatiHeadlessEnv: m8nalatiHeadlessEnv, installNalatiGroups: m8installNalatiGroups },
  'src/shards/nalati-grasslands/runtime/headlessTaming': { nalatiTamingOf: m9nalatiTamingOf, installNalatiTaming: m9installNalatiTaming },
  'src/shards/nalati-grasslands/runtime/headlessCreatures': { installNalatiCreatures: m10installNalatiCreatures },
  'src/shards/nalati-grasslands/wet': { nalatiWetAt: m11nalatiWetAt },
  'src/shards/nalati-grasslands/runtime/headlessMounted': { installNalatiMountedPlayer: m12installNalatiMountedPlayer },
  'src/shards/nalati-grasslands/world/terrain': { TERRAIN: m13TERRAIN },
  '@wildshard/engine/core/noise': { clamp: m14clamp },
  '@wildshard/game/plugin/mover': { proveTerrainEntries: m15proveTerrainEntries },
} satisfies HeadlessAssemblyModules;
