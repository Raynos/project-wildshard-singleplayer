import * as v from 'valibot';
import type { InferOutput } from 'valibot';
import { PopulationEnvironmentSchema, type PopulationEnvironmentRows } from '../../src/format/populationEnvironment';
import * as layout from '../../src/shards/pine-hollow/generators/layout';
import { pineGeographyRows } from '../../src/shards/pine-hollow/generators/geographyRows';
import { pinePhysics } from '../../src/shards/pine-hollow/generators/physics';
import { canonicalNativeOracleInput, fencedNativeOracle } from './native-oracle';
// oxlint-disable-next-line import/no-nodejs-modules -- The direct native proof lends the original committed terrain/nav inputs, as its recorder does.
import { readFileSync } from 'node:fs';
import TERRAIN from '../../src/shards/pine-hollow/data/terrainBindings.json' with {type:'json'};
import ENTRIES from '../../src/shards/pine-hollow/data/entryWalk.json' with {type:'json'};
import type {PinePhysicsOwnersSchema} from '../../src/shards/pine-hollow/generators/sections';
import type {NativeQuestCompositionInput} from './native-hosts/quest/nativeComposition';
import { installNativeSpawnScript } from '@wildshard/game/population/spawnScript';
import { readSpawnScript } from '@wildshard/game/population/spawnScript';
import { readNavmesh } from '@wildshard/engine/physics/navmesh';
import { bakedSamplers } from '@wildshard/engine/world/BakedTerrain';
import { parseBakedTerrain } from '@wildshard/engine/world/BakedTerrain';
import { parseNativeFirearmProfile } from '@wildshard/format/weaponProfiles';
import { parseWeaponProfile } from '@wildshard/format/weaponProfiles';
import { installNativeItems } from '@wildshard/game/plugin/nativeItems';
import { bindNativeLoadout } from '@wildshard/game/plugin/simulation';
import { weaponRow } from '@wildshard/game/plugin/simulation';
import { readDirectorProduct } from '@wildshard/game/plugin/director';
import { installNativeQuestComposition } from './native-hosts/quest/nativeComposition';
import { ownContractCatalogue } from '../../src/game/quest/contracts';
import { parseAchievementCounterData } from '@wildshard/format/achievementCounters';
import { parseBarterEconomy } from '@wildshard/format/lootEconomy';
import { parseWeatherProgram } from '@wildshard/format/weatherProgram';
import { bindHeadlessCommands } from '@wildshard/sdk/headlessRuntime';
import { installNativeCollision } from '@wildshard/game/population/nativeBake';
import { createNativeBakeReader } from '@wildshard/game/population/nativeBake';
import { nativeDecisionAuthority } from '@wildshard/game/shardfile/borrowedDecisions';
import { installPopulationRoster } from '@wildshard/game/population/roster';
import { installPopulationEnvironment } from '@wildshard/game/population/environment';
import { installGroundBoss } from './native-hosts/boss/native';
import { DayCycle } from '@wildshard/engine/world/dayCycle';
import { keyedSkyDaySpec } from '@wildshard/game/looks/keyedSkyClock';
import { installNativeHeldAmmunition } from './native-hosts/loadout/nativeAmmunition';
import { installWeatherContinuation } from '@wildshard/game/weather/continuation';
import { installNativeHerdShelter } from '@wildshard/game/population/shelter';
import { proveTerrainEntries } from '@wildshard/game/plugin/mover';
import { installNativeEliteFeature } from '@wildshard/game/quest/eliteFeature';
import { readEliteFeature } from '@wildshard/game/quest/eliteFeature';
import { trustedLevel } from '../../src/game/plugin/simulation';
import type { PrepareHeadlessRuntime } from '../../src/sdk/headlessRuntime';
import { need, readJson, fresh, installCombatMotion, coalesce, prepareReturns } from './headless-plan';
/** G872 proof-only facts: preserve the original independent entry budget and
 * every habitat field. The production bake/worker never reads this oracle. */
export function pineNativeOracleInputs(): { terrain: typeof TERRAIN; entries: typeof ENTRIES; environment: PopulationEnvironmentRows } {
  const ground = pineGeographyRows().ground, physics = pinePhysics();
  return canonicalNativeOracleInput({ terrain: TERRAIN, entries: ENTRIES, environment: v.parse(PopulationEnvironmentSchema, {
    id: 'pine.habitat', seed: 1337, chunkHalf: 250, normalEpsilon: .6,
    sampling: 'bilinear', water: layout.POND.level, sea: false,
    trails: [layout.S_ROAD, layout.N_ROAD, layout.W_ROAD, layout.E_ROAD,
      ...Object.entries(layout.SPURS).map(([id, path]) => id === 'den' ? layout.DEN_TRAIL : id === 'lookout' ? layout.LOOKOUT_TRAIL : path)],
    cabins: layout.CABIN_SITES.map(({ x, z }) => ({ x, z })),
    pond: { x: layout.POND.x, z: layout.POND.z, r: layout.POND.r }, trees: physics.trees,
    stream: ground.bodies.find(body => body.kind === 'stream') ?? null,
  }) });
}
/** Fresh source child and typed parent must agree before native installation. */
export function readPineNativeOracle(): Promise<ReturnType<typeof pineNativeOracleInputs>> {
  return fencedNativeOracle({ id: 'pine-native-oracle', script: 'test/fixtures/pine-native-oracle.mjs',
    inputs: ['src/engine', 'src/format', 'src/game', 'src/sdk', 'src/commons',
      'src/shards/pine-hollow', 'test/fixtures', 'package.json', 'pnpm-lock.yaml',
      'scripts/native-recorder-cache.mjs', 'scripts/bake-input-hashes.mjs'], transformTypes: true }, pineNativeOracleInputs);
}
/** Explicit proof-only inputs outside the product's hashed runtime inventory. */
export function pineHeadlessAssets(assets: ReadonlyMap<string, Uint8Array>): Map<string, Uint8Array> {
  const supplied = new Map(assets);
  for (const file of [TERRAIN.terrain, TERRAIN.navmesh]) supplied.set(file, Uint8Array.from(readFileSync(file)));
  return supplied;
}
/** Direct calls preserve the Pine gameplay recorder without executable JSON selectors. */
export const prepareHeadlessRuntime: PrepareHeadlessRuntime = async preparation => {
const { product, assets, rapier } = preparation, shard = product.shardfile;
const lendReturns = await prepareReturns(preparation);
const constants = await readPineNativeOracle();
const storyPolicy = await readJson<NativeQuestCompositionInput["rows"]>(product,"quests/native-story.json");
const storySpots = await readJson<NativeQuestCompositionInput["spots"]>(product,"quests/native-spots.json");
const bossView = await product.json<{projection:{encounter:{profile:unknown}}}>("combat/roaming.json");
const bowRow = await (weaponRow(shard,"weapon.longbow"));
await (parseWeaponProfile(bowRow.profile));
const crossbowRow = await (weaponRow(shard,"weapon.crossbow"));
await (parseNativeFirearmProfile(crossbowRow.profile,"bolt"));
const leverRow = await (weaponRow(shard,"weapon.lever"));
await (parseNativeFirearmProfile(leverRow.profile,"lever"));
const countersJson = await readJson(product,"quests/achievements.json");
const counters = await (parseAchievementCounterData(countersJson));
const barter = await (parseBarterEconomy(need(product.shardfile.rows.loot[0],"Missing barter row").economy));
const trades = await (barter.exchange);
const contracts = await product.json<NonNullable<NativeQuestCompositionInput["contracts"]>>("quests/contracts.json");
const content = await product.section<Required<Pick<NativeQuestCompositionInput,"table"|"steps"|"deaths"|"readings"|"lead">>>("custom/questRuntime");
const director = await (readDirectorProduct(product));
const nightRows = await (readSpawnScript(product,"pine.night"));
const shelterRows = await readJson(product,"actors/shelter.json");
const rosterRows = await readJson<{step:string}>(product,"actors/roster.json");
const physicsOwners = await readJson<InferOutput<typeof PinePhysicsOwnersSchema>>(product,"data/physics.generated.json");
const physicsRows = product.section("world/physics");
const physicsGround = await product.file("data/physics-ground.bin");
const physicsColliders = await product.file("data/physics-colliders.bin");
const bakeReader = await (createNativeBakeReader(physicsRows,{label: "Pine",resolution: constants.terrain.res,size: constants.terrain.size,parked: true,rig: "segments",shapes: [1,2,6,9],provenance: "piece"},{file: "data/physics-ground.bin",bytes: physicsGround},[{file: "data/physics-colliders.bin",bytes: physicsColliders}]));
const bake = await (Object.assign({},{kingHit: physicsOwners.kingHit,shelterTrees: physicsOwners.shelterTrees},bakeReader.read()));
const grid = await (need(parseBakedTerrain(need(assets.get(constants.terrain.terrain),"Pine requires its baked terrain grid"),constants.terrain),"Pine requires its baked terrain grid"));
const nav = await (readNavmesh(assets.get(constants.terrain.navmesh),"Pine requires its baked navmesh",()=>(0)));
const samplers = await (bakedSamplers(grid));
const heightAt = await (samplers.heightAt);
const wx = await readJson(product,"world/weather.json",false);
const weather = await (parseWeatherProgram(wx));
const eliteRows = await (readEliteFeature(product,"actors/elites.json"));
const heightAtEntry = heightAt;
const level = trustedLevel(shard, {at:{x:shard.spawn.x,y:Math.max(shard.spawn.y,heightAtEntry(shard.spawn.x,shard.spawn.z)+0.1),z:shard.spawn.z},yaw:shard.spawn.yaw,speed:5},{size: 500,height: 0});
const ports = {ground:false as const,heightAt:heightAtEntry};
return {level,ports,proveEntries:()=>(fresh(level,ports,rapier,(freshHost)=>(installNativeCollision(freshHost,bake,{resolution: constants.terrain.res,provenance: {field: "pineWorldOwner",step: "pine.world-tags",fallback: "wood"},omit: ["edge"]})),(freshHost)=>(proveTerrainEntries(freshHost.physics,shard.entryways,heightAt,constants.entries)))), install:(host,context)=>{
lendReturns(host);
bindHeadlessCommands(context,host);
const combat = need(context.combat,"Pine requires its native combat frame");
nativeDecisionAuthority(shard,assets,host);
const population = product.section("actors/species-programs");
const day = host.useDayClock(new DayCycle(keyedSkyDaySpec(product.section("look/keyed-sky"))));
installNativeCollision(host,bake,{resolution: constants.terrain.res,provenance: {field: "pineWorldOwner",step: "pine.world-tags",fallback: "wood"}});
const decisionProgram = need(population.program,"Pine requires its King decision programme");
const king = installGroundBoss(host,bossView.projection.encounter,bossView.projection.encounter.profile,decisionProgram,{population: rosterRows.step,weakPoint: {radius: bake.kingHit.radius},reward: {inventory: "pack",grants: [{item: "amber-resin",count: 3}]}});
const policy = need(shard.items.loadout.native,"Missing native loadout");
const equipmentInput = need(policy.input,"Missing native equipment input policy");
let quest: ReturnType<typeof installNativeQuestComposition> | undefined;
bindNativeLoadout(host,policy,{flags: host.flags,frame: combat,locked: ()=>((king.locked()||(quest?quest.riding():false)||(quest?quest.talking():false))),step: {id: equipmentInput.step,phase: equipmentInput.phase,pick: ()=>(coalesce(combat.scripts.get(equipmentInput.command),((quest?quest.takePickup():false)?1:null)))}});
installCombatMotion(host,context,7.2);
installNativeItems(host,combat,{kind: "bolt",policy: need(crossbowRow.ranged,"Missing native ranged policy"),profile: need(crossbowRow.profile,"Missing native ranged profile")});
installNativeItems(host,combat,{kind: "cycle",policy: need(leverRow.ranged,"Missing native ranged policy"),profile: need(leverRow.profile,"Missing native ranged profile")});
const longbowRow = weaponRow(shard,"weapon.longbow");
installNativeItems(host,combat,{kind: "bow",policy: need(longbowRow.ranged,"Missing native ranged policy"),profile: need(longbowRow.profile,"Missing native ranged profile")});
const ammunition = installNativeHeldAmmunition(host,product.section("held/loadout"),shard.items);
host.onStep("pine.ammunition",()=>(ammunition.update()),undefined,"afterBodies");
host.events.on("player.died",()=>(ammunition.loadKind("iron")),host.scope);
quest = installNativeQuestComposition(host,{source: product.shardfile,table: content.table,rows: storyPolicy,spots: storySpots,counters: counters,steps: content.steps,deaths: content.deaths,readings: content.readings,contracts: ownContractCatalogue(contracts,host.scope),trades: trades,lead: content.lead,director: director});
installWeatherContinuation(host,weather,day,undefined,combat);
installPopulationEnvironment(host,grid,constants.environment);
installNativeHerdShelter(host,bake.shelterTrees,shelterRows);
installPopulationRoster(host,{population: population,bake: bake,nav: nav,spawnY: shard.spawn.y,saved: context.snapshot},rosterRows);
const elites = installNativeEliteFeature(host,day,eliteRows);
installNativeSpawnScript(host,day,nightRows);
elites.initialize();
}};
};
