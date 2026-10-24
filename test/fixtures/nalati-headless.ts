import type { NativeEliteKernelLoans } from '../../src/engine/ai/eliteKernels';
import type ecology from '../../src/shards/nalati-grasslands/data/ecology.generated.json';
import type { headlessAssembly } from '../../src/shards/nalati-grasslands/generators/nativeGroups';
import type { buildEliteEntryPageRows } from '../../src/shards/nalati-grasslands/generators/eliteEntryRows';
import type { EliteCoreDef, EliteCoreRule } from '../../src/game/eliteSystem';
import type { NativePopulationBootRows, NativePopulationConfig } from '../../src/game/riding/nativePopulation';
import type { NativeTamingRows } from '../../src/game/riding/nativeTaming';
import { bakedSamplers } from '@wildshard/engine/world/BakedTerrain';
import { readNavmesh } from '@wildshard/engine/physics/navmesh';
import { clamp } from '@wildshard/engine/core/noise';
import { proveTerrainEntries } from '@wildshard/game/plugin/mover';
import { installMountedPlayer } from '@wildshard/game/riding/native';
import { installNativeTaming } from '@wildshard/game/riding/nativeTaming';
import { installNativeGroupRows } from '@wildshard/game/shardfile/groupRuntime';
import { NativeWildEnvironment } from '@wildshard/game/population/nativeManager';
import { NativePopulationField } from '@wildshard/game/population/environment';
import { installNativeBootRoster } from '@wildshard/game/riding/nativePopulation';
import { installNativePopulationHunt } from '@wildshard/game/riding/nativePopulation';
import { installWeatherContinuation } from '@wildshard/game/weather/continuation';
import { nativeWeatherBundle } from '@wildshard/game/weather/reactions';
import { DayCycle } from '@wildshard/engine/world/dayCycle';
import { installTrampleTrail } from '@wildshard/game/systems/looks/trample';
import { createNativeBakeReader } from '@wildshard/game/population/nativeBake';
import { installNativeCollision } from '@wildshard/game/population/nativeBake';
import physicsRows from '../../src/shards/nalati-grasslands/data/physics.generated.json' with { type: 'json' };
import { StrikeRunner } from '@wildshard/engine/ai/strikes';
import { strikeFromData } from '@wildshard/engine/ai/strikeRows';
import { ReturnProgram } from '@wildshard/game/population/returnProgram';
import { decodeTerrainTile } from '@wildshard/format/terrainTileBytes';
import { EliteCore } from '@wildshard/game/eliteSystem';
import { memoryElitePersistence } from '@wildshard/game/eliteSystem';
import { NativeEliteRoster } from '@wildshard/engine/ai/eliteRoster';
import { nativeEliteBindings } from '@wildshard/engine/ai/eliteRoster';
import { trustedLevel } from '../../src/game/plugin/simulation';
import type { PrepareHeadlessRuntime } from '../../src/sdk/headlessRuntime';
import { need, readJson, prepareReturns } from './headless-plan';
export const prepareHeadlessRuntime: PrepareHeadlessRuntime = async (preparation) => {
    const { product, assets } = preparation, shard = product.shardfile;
    const { constants } = await product.json<{
        constants: Omit<typeof headlessAssembly.constants, 'nativePopulation' | 'nativeRide' | 'nativeTaming' | 'pageWildlife' | 'pageGroups' | 'groupAdmission'> & {
            pageElites: Omit<ReturnType<typeof buildEliteEntryPageRows>, "profiles"> & {
                profiles: {
                    id: string;
                    value: typeof ecology.keeperElites[number];
                }[];
            };
            eliteDefs: Record<'aqbars' | 'kokbori' | 'argymaq', EliteCoreDef>;
            nativePopulation: NativePopulationConfig;
            nativeRide: unknown;
            nativeTaming: Omit<NativeTamingRows, "programs" | "poses" | "poseProgram" | "rest">;
        };
    }>('sim/headless-assembly.json');
    const lendReturns = await prepareReturns(preparation);
    const tamingPoses = await (readJson<{
        poses: NativeTamingRows["poses"];
        horse: unknown;
    }>(product, "sim/taming-poses.json"));
    const wx = await (readJson(product, "world/weather.json", false));
    const airRows = await ((nativeWeatherBundle)(wx, constants["nativeShelters"]));
    const physicsGround = await ((product["file"])("data/physics-ground.bin"));
    const physicsColliders0 = await ((product["file"])("data/physics-colliders-0.bin"));
    const physicsColliders1 = await ((product["file"])("data/physics-colliders-1.bin"));
    const bakeReader = await ((createNativeBakeReader)(physicsRows, constants["nativeBake"], { "file": "data/physics-ground.bin", "bytes": physicsGround }, [{ "file": "data/physics-colliders-0.bin", "bytes": physicsColliders0 }, { "file": "data/physics-colliders-1.bin", "bytes": physicsColliders1 }]));
    const bakeMetadata = await (product.json<{
        trees: readonly (readonly [
            number,
            number,
            number
        ])[];
        tops: readonly number[];
        ledges: NativeEliteKernelLoans["ledges"];
        marmots: unknown;
    }>("sim/population-metadata.json"));
    const bake = await (Object.assign({}, bakeMetadata, (bakeReader["read"])()));
    const boot = await (readJson<NativePopulationBootRows & {
        riding: NativeTamingRows["programs"] & {
            riding: unknown;
        };
        rest: NativeTamingRows["rest"];
        mountable: readonly string[];
    }>(product, "sim/headless-boot.json"));
    const grid = await ((decodeTerrainTile)(((need(shard.terrain, "Missing terrain")["sampling"] === undefined) ? undefined : (assets["get"])(need(need(shard.terrain, "Missing terrain").sampling, "Missing sampling").file)), { "resolution": 256, "size": 500, "seed": shard["identity"]["seed"] }));
    const samplers = await ((bakedSamplers)(grid));
    const heightAt = await (samplers["heightAt"]);
    const populationPond = await ((product["file"])("data/geography-pond.bin"));
    const populationField = await (new (NativePopulationField)(grid, constants["nativeField"], bake["trees"], bake["tops"], { "file": "data/geography-pond.bin", "bytes": populationPond }));
    const queries = await (populationField["queries"]);
    const nav = await ((readNavmesh)(((shard["navigation"] === null) ? undefined : (assets["get"])(need(shard.navigation, "Missing navigation").file)), "Nalati headless needs its admitted navigation asset", () => (0)));
    const heightAtEntry = heightAt;
    const level = trustedLevel(shard, { at: { x: shard.spawn.x, y: Math.max(shard.spawn.y, heightAtEntry(shard.spawn.x, shard.spawn.z) + 0.1), z: shard.spawn.z }, yaw: shard.spawn.yaw, speed: (clamp)(shard["authorCaps"]["speed"], 0, 5) }, { "size": constants["nativeBake"]["size"], "height": 0 });
    const ports = { ground: false as const, heightAt: heightAtEntry };
    return { level, ports, proveEntries: (arg1_0) => ((proveTerrainEntries)(arg1_0["physics"], shard["entryways"], heightAt, { "lanes": 23, "walk": 40, "start": 249, "maxTicks": 800 })), install: (host, context) => {
            lendReturns(host);
            (installNativeCollision)(host, bake, { "resolution": constants["nativeBake"]["resolution"] });
            (host["useWater"])({ "surfaceAt": queries["surfaceAt"] });
            const clock = (host["useDayClock"])(new (DayCycle)(constants["nativeDayClock"]));
            const bindings = (nativeEliteBindings)();
            const roster = (installNativeBootRoster)(host, { "boot": boot, "bake": bake, "spawnY": shard["spawn"]["y"], "clock": { "phase": clock["dayPhase"], "storm": false }, "elites": bindings, "field": populationField });
            const bodies = roster["bodies"];
            const grass = populationField["grass"];
            (installTrampleTrail)(host, grass["trample"], { "id": "nalati.trample", "radius": 0.55, "strength": 1, "speedLimit": 30 });
            const env = new (NativeWildEnvironment)(grass["field"], grass["trample"], { "wind": { "x": -0.8, "z": 0.6, "strength": 0.5 }, "flatten": 0.85 }, (ReturnProgram["native"])(host, boot["admission"]));
            (installWeatherContinuation)(host, { "program": airRows, "clock": clock, "env": env, "bake": bake, "rows": constants["nativeWeather"] });
            const groups = ((installNativeGroupRows)(host, constants["groupRows"], grid, env));
            const strikeContacts = new (StrikeRunner)();
            const nativeEliteStrikes = { "swipe": (strikeFromData)(need(constants.pageElites.strikes[0], "Missing elite strikes")["strike"]), "pounce": (strikeFromData)(need(constants.pageElites.strikes[1], "Missing elite strikes")["strike"]), "bite": (strikeFromData)(need(constants.pageElites.strikes[2], "Missing elite strikes")["strike"]) };
            const eliteRuleProgram = (ReturnProgram["native"])(host, boot["admission"]);
            const eliteRuleCodes = new (Map)([["always", { "rule": 0, "phase": false, "storm": false }], ["storm", { "rule": 1, "phase": true, "storm": true }], ["night", { "rule": 2, "phase": true, "storm": false }], ["dusk", { "rule": 3, "phase": true, "storm": false }]]);
            const elitePhaseCodes = new (Map)([["dawn", 0], ["day", 0], ["golden", 0], ["dusk", 1], ["night", 2]]);
            const eliteStormCodes = new (Map)([[false, 0], [true, 1]]);
            const eliteCore = new EliteCore({ player: host.player, condition: (rule: EliteCoreRule) => {
                    const code = need(eliteRuleCodes.get(rule), 'Missing elite rule');
                    const result = eliteRuleProgram.project('eliteRule', { rule: code.rule, phase: code.phase ? (elitePhaseCodes.get(clock.dayPhase) ?? 0) : 0, storm: code.storm ? need(eliteStormCodes.get(env.storm), 'Missing storm code') : 0 });
                    return result['accept'] === 1;
                } }, {}, host.level.id, memoryElitePersistence());
            const elites = new (NativeEliteRoster)({ "step": "nalati.elites", "version": 1, "wire": { "detached": "argDetached" }, "rows": [{ "def": constants["eliteDefs"]["aqbars"], "snapshot": "aqbars", "member": { "kind": "leopard", "variant": "aqbars", "source": "boot", "yaw": 0, "memory": { "low": 0.3 } } }, { "def": constants["eliteDefs"]["kokbori"], "snapshot": "kokbori", "member": { "kind": "kokbori", "variant": "kokbori", "source": "spawn", "yaw": 3.141592653589793 }, "pack": { "offset": [-6, 4], "variants": ["grey", "tawny", "grey", "dark", "scout"], "kind": "wolf", "idPrefix": "creature:" } }, { "def": constants["eliteDefs"]["argymaq"], "snapshot": "argymaq", "member": { "kind": "argymaq", "variant": "stallion", "source": "herd", "yaw": 0 }, "continuation": { "borrowed": { "group": 1, "role": "guard" }, "detachable": true } }], "roles": ["native", "native", "borrowed"], "kernels": [{ "id": need(constants.pageElites.profiles[0], "Missing elite profiles")["value"]["def"]["id"], "profile": { "pattern": "pouncer", "spec": need(constants.pageElites.profiles[0], "Missing elite profiles")["value"]["spec"] }, "lair": { "x": need(constants.pageElites.profiles[0], "Missing elite profiles")["value"]["def"]["lair"]["x"], "z": need(constants.pageElites.profiles[0], "Missing elite profiles")["value"]["def"]["lair"]["z"] }, "awareRadius": need(constants.pageElites.profiles[0], "Missing elite profiles")["value"]["def"]["awareR"], "contacts": [{ "amount": 14, "strike": nativeEliteStrikes["swipe"]["id"] }], "fallbackStrike": nativeEliteStrikes["pounce"]["id"], "knockdown": constants["nativeKnockdown"] }, { "id": need(constants.pageElites.profiles[1], "Missing elite profiles")["value"]["def"]["id"], "profile": { "pattern": "howler", "spec": need(constants.pageElites.profiles[1], "Missing elite profiles")["value"]["spec"] }, "lair": { "x": need(constants.pageElites.profiles[1], "Missing elite profiles")["value"]["def"]["lair"]["x"], "z": need(constants.pageElites.profiles[1], "Missing elite profiles")["value"]["def"]["lair"]["z"] }, "awareRadius": need(constants.pageElites.profiles[1], "Missing elite profiles")["value"]["def"]["awareR"], "contacts": [], "fallbackStrike": nativeEliteStrikes["bite"]["id"], "knockdown": constants["nativeKnockdown"] }], "projections": { "argymaq": { "signal": "argymaqTick", "states": { "display": 1, "charge": 2, "beaten": 3 }, "bondedState": "bonded", "brokenState": "beaten", "adoption": { "variant": "tulpar", "scale": 1.3 } } } }, { "host": host, "core": eliteCore, "bindings": bindings, "kernel": { "contacts": strikeContacts, "strikes": [nativeEliteStrikes["swipe"], nativeEliteStrikes["pounce"], nativeEliteStrikes["bite"]], "terrain": samplers, "environment": env, "ledges": bake["ledges"] }, "groups": groups });
            (elites["bindProjected"])(2, (ReturnProgram["native"])(host, boot["admission"]), eliteCore);
            (elites["install"])();
            const creatures = (installNativePopulationHunt)(host, Object.assign({}, { "boot": boot, "elites": bindings, "bodies": bodies, "herds": roster["herds"], "nav": nav, "stream": roster["stream"], "wildStream": roster["wildStream"], "bake": bake, "spawnY": shard["spawn"]["y"], "config": constants["nativePopulation"], "field": populationField }, ((context["snapshot"] === undefined) ? {} : { "snapshot": context["snapshot"] })));
            (installMountedPlayer)(host, Object.assign({}, constants["nativeRide"], { "world": constants["nativeField"]["world"], "mountable": (boot["mountable"]["concat"])((creatures["bondedHorseIds"])()), "program": boot["riding"]["riding"] }), { "file": "data/geography-pond.bin", "bytes": populationPond });
            const taming = (installNativeTaming)(host, { commands: () => context.commands().map(command => command.kind === "script" ? command : command.kind === "player" ? { kind: "player", ...(command.steer === undefined ? {} : { steer: command.steer }) } : { kind: "action" }) }, Object.assign({}, constants["nativeTaming"], { "programs": boot["riding"], "rest": boot["rest"], "poses": tamingPoses["poses"], "poseProgram": tamingPoses["horse"] }));
            ((elites["bindPopulation"])(creatures), (elites["bindBond"])(taming), ((!context["restoring"]) ? (elites["initialize"])() : undefined));
        } };
};
