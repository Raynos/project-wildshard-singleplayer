// oxlint-disable-next-line import/no-nodejs-modules -- The plan builders lend the original committed terrain and navigation bytes.
import { readFileSync } from 'node:fs';
import type { NativeAssemblyPlan } from '@wildshard/format/nativeAssembly';
import type { ShardProduct } from '../../src/game/shardfile/shardProduct';
import storyPolicy from './pine-native-story.json' with { type: 'json' };
import keeper from '../../src/shards/driftwood-isle/data/nativeKeeper.json' with { type: 'json' };
import TERRAIN from '../../src/shards/pine-hollow/data/terrainBindings.json' with { type: 'json' };
import { need, readJson } from './headless-plan';
import { readPineNativeOracle } from './pine-headless';
import { readDriftwoodNativeOracle } from './driftwood-headless';
import { nalatiEliteRows } from './nalati-headless';
import { nalatiGroupInputs } from './nalati-group-inputs';
import { nalatiNativeAssembly } from './nalati-native-assembly';
import { nalatiNativeBoot } from './nalati-native-boot';
import { originalNalatiPhysics } from './nalati-physics-original';
import { parsePopulationKnockdownSource } from '@wildshard/sdk/nativePopulationRows';
import { strikeFromData } from '@wildshard/engine/ai/strikeRows';

/** A plan and the server-class files it names, as a shard's generator will emit them with `serverBlob`. */
export interface EmittedAssembly { readonly plan: NativeAssemblyPlan; readonly json: ReadonlyMap<string, unknown>; readonly binary: ReadonlyMap<string, Uint8Array> }

/** Pine Hollow's plan: the same inputs and install order as `pine-headless.ts`. */
export async function pineAssembly(product: ShardProduct): Promise<EmittedAssembly> {
  const constants = await readPineNativeOracle(), roster = await readJson<{ step: string }>(product, 'actors/roster.json');
  const owners = await readJson<{ kingHit: { radius: number } }>(product, 'data/physics.generated.json');
  const plan: NativeAssemblyPlan = { kind: 'native-assembly', level: { speed: 5, ground: { size: 500, height: 0 } },
    terrain: { kind: 'baked', file: 'server/terrain.bin', rows: constants.terrain }, navigation: { file: 'server/navmesh.bin' },
    bake: { rows: { section: 'world/physics' }, reader: { label: 'Pine', resolution: constants.terrain.res, size: constants.terrain.size, parked: true, rig: 'segments', shapes: [1, 2, 6, 9], provenance: 'piece' },
      ground: 'data/physics-ground.bin', colliders: ['data/physics-colliders.bin'], read: 'bake', owners: { file: 'data/physics.generated.json' }, pick: ['kingHit', 'shelterTrees'] },
    collision: { resolution: constants.terrain.res, provenance: { field: 'pineWorldOwner', step: 'pine.world-tags', fallback: 'wood' } },
    entries: { walk: constants.entries, fresh: { omit: ['edge'] } },
    features: [{ host: 'commands' }, { host: 'decisions' }, { host: 'day.keyed-sky' }, { host: 'collision' },
      { host: 'boss.ground', encounter: { file: 'combat/roaming.json', path: ['projection', 'encounter'] },
        binding: { population: roster.step, weakPoint: { radius: owners.kingHit.radius }, reward: { inventory: 'pack', grants: [{ item: 'amber-resin', count: 3 }] } } },
      { host: 'loadout' }, { host: 'combat.motion', speed: 7.2 },
      { host: 'item.ranged', kind: 'bolt', weapon: 'weapon.crossbow' }, { host: 'item.ranged', kind: 'cycle', weapon: 'weapon.lever' }, { host: 'item.ranged', kind: 'bow', weapon: 'weapon.longbow' },
      { host: 'ammunition', step: 'pine.ammunition', refill: 'iron' },
      { host: 'quest.composition', rows: { file: 'server/quest-policy.json' }, spots: { file: 'quests/native-spots.json' }, counters: { file: 'quests/achievements.json' },
        document: { file: 'quests/runtime.json' }, contracts: { file: 'quests/contracts.json' }, barter: true, director: true },
      { host: 'weather.program', program: { file: 'world/weather.json' } }, { host: 'population.environment', rows: { file: 'server/habitat.json' } },
      { host: 'population.shelter', rows: { file: 'actors/shelter.json' } }, { host: 'population.roster', rows: { file: 'actors/roster.json' } },
      { host: 'population.elites', file: 'actors/elites.json' }, { host: 'population.spawn-script', id: 'pine.night' }, { host: 'population.elites-ready' }] };
  return { plan, json: new Map<string, unknown>([['server/quest-policy.json', storyPolicy], ['server/habitat.json', constants.environment]]),
    binary: new Map([['server/terrain.bin', Uint8Array.from(readFileSync(TERRAIN.terrain))], ['server/navmesh.bin', Uint8Array.from(readFileSync(TERRAIN.navmesh))]]) };
}

/** Driftwood Isle's plan: the same inputs and install order as `driftwood-headless.ts`. */
export async function driftwoodAssembly(): Promise<EmittedAssembly> {
  const constants = await readDriftwoodNativeOracle(), quest = constants.nativeQuest;
  const plan: NativeAssemblyPlan = { kind: 'native-assembly', level: { speed: 5, ground: { size: 500, height: 0 } }, terrain: { kind: 'bake-ground' }, navigation: 'shard',
    bake: { rows: { file: 'server/physics.json' }, reader: { label: 'Driftwood', resolution: 256, size: 500, parked: false, rig: 'axis', shapes: [1, 2, 9], provenance: 'tagged' },
      ground: 'data/physics-ground.generated.bin', colliders: ['data/physics-colliders.bin'], read: 'solids', keep: ['actors', 'herds', 'habitat', 'captain'] },
    collision: { resolution: 256 }, entries: { walk: constants.entries },
    features: [{ host: 'day.toon', start: 0.16666666666666669, cycle: 2880, phases: { dusk: 'dusk' } }, { host: 'water.sea', id: 'sea' }, { host: 'collision', skipOnRestore: true }, { host: 'decisions' },
      { host: 'population.mixed', rows: { file: 'server/mixed-population.json' }, perch: { file: 'poses/monkey.json', path: ['program'] }, keeper: { file: 'server/keeper.json' },
        placement: { file: 'sim/enemy-placement.json' }, launch: 'coconut', sea: 'sea' },
      { host: 'quest.chapter', id: quest.reward.director, rows: { file: 'quests/chapter-director.json' }, wake: { file: 'quests/wake-boss.json' }, reward: quest.reward.channels, population: quest.acquisition.population },
      { host: 'commands' }, { host: 'population.reactions' }, { host: 'item.swept', policy: { file: 'server/swords.json' } },
      { host: 'quest.kill-steps', rows: { file: 'server/kill-steps.json' }, counters: { file: 'quests/achievements.json' } }, { host: 'quest.body-scripts' },
      { host: 'quest.composition', table: { file: 'quests/interaction-source.json', path: ['constants', 'interact'] }, rows: { file: 'server/quest-policy.json' }, spots: { file: 'server/quest-spots.json' }, readSpots: true,
        counters: { file: 'quests/achievements.json' }, nativeFeats: true, props: { file: 'server/quest-props.json' }, restoring: true },
      { host: 'population.settle' }, { host: 'population.poses', step: 'driftwood.poses' }] };
  return { plan, binary: new Map(), json: new Map<string, unknown>([['server/physics.json', constants.physics], ['server/mixed-population.json', constants.mixedPopulation], ['server/keeper.json', keeper],
    ['server/swords.json', constants.swords], ['server/kill-steps.json', constants.questKillSteps], ['server/quest-policy.json', quest], ['server/quest-spots.json', constants.nativeQuestSpots], ['server/quest-props.json', constants.questProps]]) };
}

/** Nalati Grasslands' plan: the same inputs and install order as `nalati-headless.ts`. */
export async function nalatiAssembly(product: ShardProduct): Promise<EmittedAssembly> {
  const [{ constants }, boot] = await Promise.all([nalatiNativeAssembly(), nalatiNativeBoot()]);
  const strike = (at: number): Parameters<typeof strikeFromData>[0] => need(constants.pageElites.strikes[at], 'Missing elite strikes').strike;
  const strikes = [strike(0), strike(1), strike(2)], [swipe, pounce, bite] = strikes.map(row => strikeFromData(row));
  const rows = nalatiEliteRows({ ...constants, nativeKnockdown: parsePopulationKnockdownSource(boot.riding) }, { swipe: need(swipe, 'swipe'), pounce: need(pounce, 'pounce'), bite: need(bite, 'bite') });
  const groups = nalatiGroupInputs(constants.groupRows, await product.json('actors/wildlife.json'));
  const plan: NativeAssemblyPlan = { kind: 'native-assembly', level: { speed: 5, authorCap: true, ground: { size: constants.nativeBake.size, height: 0 } }, terrain: { kind: 'shard-tile', resolution: 256, size: 500 }, navigation: 'shard',
    bake: { rows: { file: 'server/physics.json' }, reader: constants.nativeBake, ground: 'data/physics-ground.bin', colliders: ['data/physics-colliders-0.bin', 'data/physics-colliders-1.bin'], read: 'bake',
      owners: { file: 'sim/population-metadata.json' }, seal: { file: 'combat/room-entry.json', path: ['room'] } },
    collision: { resolution: constants.nativeBake.resolution }, entries: { walk: { lanes: 23, walk: 40, start: 249, maxTicks: 800 } },
    boot: { file: 'server/boot.json' }, field: { rows: { file: 'world/meadow.json' }, pond: 'data/geography-pond.bin' },
    features: [{ host: 'collision' }, { host: 'water.field' }, { host: 'day.declared', clock: { file: 'world/forest-weather.json', path: ['sky', 'clock'] } }, { host: 'riding.roster' },
      { host: 'riding.trample', id: 'nalati.trample', radius: 0.55, strength: 1, speedLimit: 30 }, { host: 'riding.environment', wind: { x: -0.8, z: 0.6, strength: 0.5 }, flatten: 0.85 },
      { host: 'weather.native', program: { file: 'world/weather.json' }, shelters: { file: 'server/shelters.json' }, rows: { file: 'server/weather.json' } }, { host: 'riding.groups', rows: { file: 'server/groups.json' } },
      { host: 'riding.elites', rows: { file: 'server/elites.json' }, strikes: { file: 'server/elite-strikes.json' }, projected: 2, conditions: { rules: { always: { rule: 0, phase: false, storm: false }, storm: { rule: 1, phase: true, storm: true }, night: { rule: 2, phase: true, storm: false }, dusk: { rule: 3, phase: true, storm: false } },
        phases: { dawn: 0, day: 0, golden: 0, dusk: 1, night: 2 }, storm: { calm: 0, storm: 1 } } },
      { host: 'riding.hunt', config: { file: 'server/population.json' } }, { host: 'riding.mounted', profile: { file: 'server/ride.json' } },
      { host: 'riding.taming', rows: { file: 'server/taming.json' }, poses: { file: 'sim/taming-poses.json', path: ['poses'] }, pose: { file: 'actors/species-looks.json', path: ['poses', 'horse'] } }, { host: 'riding.elites-ready' }] };
  return { plan, binary: new Map(), json: new Map<string, unknown>([['server/physics.json', originalNalatiPhysics()], ['server/boot.json', boot], ['server/shelters.json', constants.nativeShelters], ['server/weather.json', constants.nativeWeather],
    ['server/groups.json', groups], ['server/elites.json', rows], ['server/elite-strikes.json', strikes], ['server/population.json', constants.nativePopulation], ['server/ride.json', constants.nativeRide], ['server/taming.json', constants.nativeTaming]]) };
}
