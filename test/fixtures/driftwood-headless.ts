import keeperFixture from '../../src/shards/driftwood-isle/data/nativeKeeper.json' with { type: 'json' };
import { canonicalNativeOracleInput, fencedNativeOracle } from './native-oracle';
import { driftwoodNativeInputs } from '../../src/shards/driftwood-isle/generators/nativeServer';
import type { NativeQuestCompositionInput } from '@wildshard/game/quest/nativeComposition';
import type { MixedPopulationInput } from '@wildshard/game/population/mixedRoster';
import { installMixedPopulation } from '@wildshard/game/population/mixedRoster';
import { installNativeChapterDirector } from '@wildshard/game/quest/nativeChapter';
import { installQuestKillSteps } from '@wildshard/game/quest/killSteps';
import { readNativeQuestSpots } from '@wildshard/game/quest/nativeComposition';
import { installNativeQuestComposition } from '@wildshard/game/quest/nativeComposition';
import { declaredWaterBody } from '@wildshard/engine/world/water/declared';
import { dayClock } from '@wildshard/game/looks/dayClock';
import { TOON_DAY_PRESET } from '@wildshard/format/toonLook';
import { parseAchievementCounterData } from '@wildshard/format/achievementCounters';
import { readNavmesh } from '@wildshard/engine/physics/navmesh';
import { parseChapterDirector, parseChapterWake } from '@wildshard/format/chapterDirector';
import { readDirectorProduct } from '@wildshard/game/plugin/director';
import { DayCycle } from '@wildshard/engine/world/dayCycle';
import { waveHeight } from '@wildshard/engine/world/waves';
import { bindHeadlessCommands } from '@wildshard/sdk/headlessRuntime';
import { headlessSpecCatalogue } from '@wildshard/game/population/specCatalogue';
import { installNativeCollision } from '@wildshard/game/population/nativeBake';
import { nativeBakeGround } from '@wildshard/game/population/nativeBake';
import { createNativeBakeReader } from '@wildshard/game/population/nativeBake';
import { nativeDecisionAuthority } from '@wildshard/game/shardfile/borrowedDecisions';
import { installNativeItems } from '@wildshard/game/plugin/nativeItems';
import { proveTerrainEntries } from '@wildshard/game/plugin/mover';
import { terrainTileHeight } from '@wildshard/format/terrainTileBytes';
import { trustedLevel } from '../../src/game/plugin/simulation';
import type { PrepareHeadlessRuntime } from '../../src/sdk/headlessRuntime';
import { need, readJson } from './headless-plan';
import { installBodyScripts, prepareReturns } from '@wildshard/game/shardfile/nativeRuntimeLoans';
/** The generator's typed native facts, in the canonical key order the oracle pins. */
export function driftwoodNativeOracleInputs() { return canonicalNativeOracleInput(driftwoodNativeInputs()); }
/** Fresh source child and typed parent must agree before native installation. */
export function readDriftwoodNativeOracle(): Promise<ReturnType<typeof driftwoodNativeOracleInputs>> {
  return fencedNativeOracle({ id: 'driftwood-native-oracle', script: 'test/fixtures/driftwood-native-oracle.mjs',
    inputs: ['src/engine', 'src/format', 'src/game', 'src/sdk', 'src/commons',
      'src/shards/driftwood-isle', 'test/fixtures', 'package.json', 'pnpm-lock.yaml',
      'scripts/native-recorder-cache.mjs', 'scripts/bake-input-hashes.mjs'], transformTypes: true }, driftwoodNativeOracleInputs);
}
/** Direct native calls retain every Driftwood gameplay recorder and continuation. */
export const prepareHeadlessRuntime: PrepareHeadlessRuntime = async (preparation) => {
    const { product, assets } = preparation, shard = product.shardfile;
    // Both independent admissions must finish before product reads or native
    // installation. Overlap their existing async preparation, as the other
    // native factories do, without changing either full-source comparison.
    const [lendReturns, constants] = await Promise.all([
      prepareReturns(preparation), readDriftwoodNativeOracle(),
    ]);
    const dayStyle = product.section('look/toon').sky.day;
    const nativeSea = structuredClone(need(product.shardfile.water.find(row => row.id === "sea" && row.kind === "sea"), "Driftwood requires its admitted sea"));
    const interaction = await product.json<{ constants: { interact: NativeQuestCompositionInput["table"]; interactSpots: NativeQuestCompositionInput["spots"]["rows"] } }>("quests/interaction-source.json");
    const chapterDirector = parseChapterDirector(await product.json('quests/chapter-director.json'));
    const wake = parseChapterWake(await product.json('quests/wake-boss.json'));
    const countersJson = await (readJson(product, "quests/achievements.json"));
    const counters = await ((parseAchievementCounterData)(countersJson));
    const nativeFeats = counters.feats.filter(row => row.kind === undefined);
    const nativeCounters = parseAchievementCounterData({ ...counters, feats: nativeFeats,
        flags: nativeFeats.map(feat => counters.flags.find(row => row.id === feat.id) ?? { id: feat.id, method: 'count', value: { constant: 0 } }), write: 'each' });
    const species = await ((product["section"])("actors/species-programs"));
    await ((need)(species["program"], "Driftwood requires its admitted species program"));
    const fauna = await new Map(species.native.map(row => [row.kind, row] as const));
    const placementJson = await (readJson<MixedPopulationInput["placement"]>(product, "sim/enemy-placement.json", false));
    const placement = await (placementJson);
    const monkeyJson = await (readJson<{
        program: unknown;
    }>(product, "poses/monkey.json", true));
    const keeper = keeperFixture;
    const launch = await ((need)(need(shard.items.launches, "Missing launch rows")["coconut"], "Driftwood requires its admitted coconut launch"));
    const navigation = await ((need)((assets["get"])(need(shard.navigation, "Missing navigation").file), "Driftwood requires its admitted navigation asset"));
    const director = await ((readDirectorProduct)(product));
    const physicsGround = await ((product["file"])("data/physics-ground.generated.bin"));
    const physicsColliders = await ((product["file"])("data/physics-colliders.bin"));
    const bakeReader = await ((createNativeBakeReader)(constants["physics"], { "label": "Driftwood", "resolution": 256, "size": 500, "parked": false, "rig": "axis", "shapes": [1, 2, 9], "provenance": "tagged" }, { "file": "data/physics-ground.generated.bin", "bytes": physicsGround }, [{ "file": "data/physics-colliders.bin", "bytes": physicsColliders }]));
    const ground = await ((nativeBakeGround)(constants["physics"]["ground"], 256, 500, "Driftwood", { "file": "data/physics-ground.generated.bin", "bytes": physicsGround }));
    const bake = await ({ "actors": constants["physics"]["actors"], "herds": constants["physics"]["herds"], "habitat": constants["physics"]["habitat"], "captain": constants["physics"]["captain"], "ground": ground, "solids": (constants["physics"]["solids"]["map"])((arg1_0) => ((bakeReader["solid"])(arg1_0))) });
    const specs = headlessSpecCatalogue([...constants.physics.actors.map(actor => actor.spec), constants.physics.captain.spec]);
    const heightAt = await ((arg1_0: number, arg1_1: number) => ((terrainTileHeight)({ "resolution": 256, "x": -250, "z": -250, "size": 500, "heights": ground["heights"] }, arg1_0, arg1_1, { "layout": "column-major", "boundary": "clamp" })));
    const nav = await ((readNavmesh)(navigation, "Driftwood declared navigation does not parse", () => (0)));
    const spots = await ((readNativeQuestSpots)(constants["nativeQuestSpots"]));
    const heightAtEntry = heightAt;
    const level = trustedLevel(shard, { at: { x: shard.spawn.x, y: Math.max(shard.spawn.y, heightAtEntry(shard.spawn.x, shard.spawn.z) + 0.1), z: shard.spawn.z }, yaw: shard.spawn.yaw, speed: 5 }, { "size": 500, "height": 0 });
    const ports = { ground: false as const, heightAt: heightAtEntry };
    return { level, ports, proveEntries: (arg1_0) => ((proveTerrainEntries)(arg1_0["physics"], shard["entryways"], heightAt, constants["entries"])), install: (host, context) => {
            lendReturns(host);
            const dayLook = (dayClock)(TOON_DAY_PRESET, dayStyle, { "dusk": "dusk" });
            const clock = new (DayCycle)(Object.assign({}, dayLook["spec"], { "start": 0.16666666666666669 }));
            (clock["cycle"] = 2880);
            (host["useDayClock"])(clock);
            const sea = (declaredWaterBody)(nativeSea);
            (host["useWater"])({ "surfaceAt": sea["restAt"], "bob": (arg1_0: number, arg1_1: number) => ((waveHeight)(arg1_0, arg1_1, host["clock"]["now"])) });
            ((!context["restoring"]) ? (installNativeCollision)(host, bake, { "resolution": 256 }) : undefined);
            (nativeDecisionAuthority)(shard, assets, host);
            const island = (installMixedPopulation)(host, { "perchProgram": monkeyJson["program"], "rows": constants["mixedPopulation"], "reserved": bake["captain"], "placement": placement, "keeper": keeper, "fauna": fauna, "launch": launch, "population": species, "bake": { "ground": bake["ground"], "actors": bake["actors"], "herds": bake["herds"], "habitat": bake["habitat"] }, "specs": specs, "seed": shard["identity"]["seed"], "waterLevel": sea["level"], "spawnY": shard["spawn"]["y"], "nav": nav }, context["snapshot"]);
            (installNativeChapterDirector)(host, director, { "id": constants["nativeQuest"]["reward"]["director"], "rows": chapterDirector, "reward": constants["nativeQuest"]["reward"]["channels"], "wake": { "population": constants["nativeQuest"]["acquisition"]["population"], "encounter": wake.encounter, "placement": { "pool": { "x": bake["captain"]["pool"]["x"], "z": bake["captain"]["pool"]["z"] }, "arena": bake["captain"]["arena"] }, "cues": wake.cues.map(({ id, operation }) => ({ id, operation })) } }, context["restoring"]);
            const input = (bindHeadlessCommands)(context, host);
            const combat = (need)(context["combat"], "Driftwood requires its native combat frame");
            (host["events"]["answer"])("item.reaction", (arg1_0) => ((((arg1_0["kind"] === "alarm") ? (island["alarm"])() : (island["staggered"])(arg1_0["actor"], arg1_0["strength"], arg1_0["running"])), arg1_0)), host["scope"]);
            (installNativeItems)(host, combat, { "kind": "swept", "items": shard["items"]["rows"], "policy": constants["swords"] });
            (installQuestKillSteps)(host, constants["questKillSteps"], counters["feats"], island["bodies"], input["ledger"]["fact"]);
            installBodyScripts(host, context, preparation);
            (installNativeQuestComposition)(host, { "source": shard, "table": interaction.constants.interact, "spots": spots, "counters": nativeCounters, "props": constants["questProps"], "restoring": context["restoring"], "rows": constants["nativeQuest"] });
            (island["settle"])();
            (host["onStep"])("driftwood.poses", island["publishPoses"], undefined, "afterBodies");
        } };
};
