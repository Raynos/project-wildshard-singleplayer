import {admission,admissionNative,lendNalatiAdmission,lendNalatiPasture} from './fixtures/nalati-return-modules';

import { PackBrain as FixturePack, type PackPrey } from '@wildshard/engine/ai/pack';
import { AnimalSim } from '@wildshard/engine/entities/AnimalSim';
import type { HuntBody } from '@wildshard/engine/ai/hunt';
// oxlint-disable-next-line import/no-nodejs-modules -- Real native capsule continuation uses the shipped physics bytes.
import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { zlibSync } from 'fflate';
import { Vector3 } from 'three';
import { createSimHost, type SimHost } from '@wildshard/engine/sim';
import { loadRapier } from '@wildshard/engine/physics/rapier';
import { restoreSimHost, snapshotSimHost, serializeSimSnapshot } from '@wildshard/engine/sim/snapshot';
import { NativeGroupCollection as FixtureNativeGroups, nativeGroupCollection as fixtureGroup, nativeHerdCollection } from '@wildshard/game/shardfile/groupRuntime';
import { Rng as FixtureRandom } from '@wildshard/engine/core/rng';
import { nativeGroupBrain as fixtureBrain } from '@wildshard/format/groupBrains';
import fixtureBrains from '../src/shards/nalati-grasslands/data/brains.json' with { type: 'json' };
import { installMountedPlayer } from '@wildshard/game/riding/native';
import programs from '../src/shards/nalati-grasslands/behaviour/riding.generated.json' with { type: 'json' };
import { SIM_LEVEL } from './fixtures/sim-level/level';

const zero = btoa(String.fromCodePoint(...zlibSync(new Uint8Array(16))));
const rows = { step: 'orchard.saddle', herds: 'orchard.herds', kinds: ['boar'], adopted: { kind: 'boar', variant: 'boar' },
  mountable: ['boar:1'], speeds: { walk: 1, trot: 3, canter: 5, gallop: 8 }, pose: {},
  world: { res: 2, size: 32, water: -100, wet: zero, pond: zero }, thrownDamage: 7, thrownLabel: 'Thrown', program: programs.riding };
// These riding-only fixtures need a dormant, real group owner, without adding
// host entities, random streams or a step participant to the original test.
function herdService(host: SimHost, id: string, group = `fixture:${id}`, tokens?: ConstructorParameters<typeof FixtureNativeGroups>[9]): FixtureNativeGroups {
  const spec = fixtureBrain({ ...fixtureBrains.pack, id: 'fixture.pack', home: [0, 0], members: ['fixture.actor'] });
  if (spec.kind !== 'pack') throw new Error('Missing dormant fixture pack');
  const sample = SIM_LEVEL.entities[0]; if (sample === undefined) throw new Error('Missing dormant group member');
  const actor = new AnimalSim(sample.spec, sample.seed, sample.scale, 'fixture.group.actor', { heightAt: () => 0, random: () => .5, now: () => 0 });
  const random = new FixtureRandom(17), pack = new FixturePack<AnimalSim>([actor], 0, 0, spec, {
    sharedRng: () => random, environment: () => ({ playerFwdX: 0, playerFwdZ: -1, playerMounted: false, playerHealth01: 1, grassHeightAt: () => 0 }),
    visibility: () => 1, hearing: () => 10, downwind: () => false, inBounds: () => true, normalY: () => 1, register: () => undefined, bite: () => undefined,
  });
  return new FixtureNativeGroups(host, [pack], [], new Map<string, AnimalSim>(), new Map<string, PackPrey>(), new WeakMap<PackPrey, string>(), [],
    new WeakMap<AnimalSim, FixturePack<AnimalSim>>(), { id: group, herds: id, firstRaid: 0 }, tokens);
}
function install(host: SimHost) { lendNalatiPasture(host.scope); herdService(host, rows.herds); return installMountedPlayer(host, rows); }

test('G478 orchard native fixture owns and restores its actual mounted capsule', async () => {
  const rapier = await loadRapier(Uint8Array.from(readFileSync('public/assets/physics/rapier.wasm')));
  const level = { ...SIM_LEVEL, quests: [] }, host = createSimHost(level, { rapier }), mounted = install(host);
  let restored: SimHost | undefined;
  try {
    expect(mounted.mount('foreign')).toBe(false);
    expect(mounted.mount('boar:1')).toBe(true);
    expect(host.modes.current()).toBe('ride');
    const command = { moveX: 0, moveZ: 0, yaw: 0, commandVersion: 1 as const, steer: { keyX: 0, keyY: 1, stickX: 0, stickY: 0 } };
    for (let tick = 0; tick < 30; tick++) host.step(command);
    const snapshot = snapshotSimHost(host);
    restored = restoreSimHost(level, { rapier }, snapshot, fresh => { install(fresh); });
    for (let tick = 0; tick < 12; tick++) {
      host.step(command); restored.step(command);
      expect(restored.player.position.distanceTo(host.player.position)).toBeLessThan(1e-6);
    }
    expect(mounted.body.speed).toBeGreaterThan(0);
    mounted.dismount(); expect(host.modes.current()).toBe('foot');
    mounted.removeMountable('boar:1'); expect(mounted.mountables).toEqual([]);
    mounted.addMountable('boar:1'); expect(mounted.mountables.map(actor => actor.entityId)).toEqual(['boar:1']);
  } finally { restored?.dispose(); host.dispose(); }
});

test('G478 orchard fixture owns companion allocation, retirement and native taming inputs', async () => {
  const { fixtureNativeRoster } = await import('./fixtures/native-roster');
  const { Rng } = await import('@wildshard/engine/core/rng');
  const { NativeActors } = await import('../src/game/population/actors');
  const { BondedMountRoster } = await import('@wildshard/game/riding/roster');
  const { installNativeTaming } = await import('@wildshard/game/riding/nativeTaming');
  const { SPECIES_POSES } = await import('../src/shards/nalati-grasslands/generators/speciesPoses');
  const rapier = await loadRapier(Uint8Array.from(readFileSync('public/assets/physics/rapier.wasm')));
  const host = createSimHost({ ...SIM_LEVEL, entities: [], quests: [] }, { rapier });
  const sample = SIM_LEVEL.entities[0]; if (sample === undefined) throw new Error('Missing native fixture recipe');
  const random = new Rng(71), { hunt } = fixtureNativeRoster(host, random), retired = new Set<string>();
  const bodies: HuntBody[] = [], sight: (boolean | null | undefined)[] = [];
  herdService(host, 'orchard.herds');
  const service = { host, id: 'orchard.actors', identities: new NativeActors<HuntBody>('creature', 64), random, hunt, bodies, sight, retired, flocks: [] };
  const companionRows: ConstructorParameters<typeof BondedMountRoster>[1] = { id: 'orchard.companions', services: service.id, herds: 'orchard.herds', kind: 'boar', variant: 'boar', wildKinds: ['boar'], specs: [sample.spec], scale: [1, 1], spawnY: 10, program: admission };
  lendNalatiAdmission(host.scope);
  const roster = new BondedMountRoster(host, companionRows, service);
  expect(() => new BondedMountRoster(host, companionRows, service)).toThrow('Duplicate bonded mount roster');
  expect(() => new BondedMountRoster(host, { ...companionRows, id: 'orchard.other' }, { ...service })).toThrow('Duplicate mount roster owner');
  expect(() => new BondedMountRoster(host, { ...companionRows, id: 'orchard.other', services: 'foreign.actors' }, service)).toThrow('Invalid mount roster owners');
  expect(() => new BondedMountRoster(host, { ...companionRows, id: 'orchard.other' }, { ...service, sight: [false] })).toThrow('Invalid mount roster owners');
  const foreign = createSimHost({ ...SIM_LEVEL, entities: [], quests: [] }, { rapier });
  try { expect(() => new BondedMountRoster(foreign, companionRows, service)).toThrow('Invalid mount roster owners'); } finally { foreign.dispose(); }
  lendNalatiPasture(host.scope);
  const mounted = installMountedPlayer(host, { ...rows, mountable: [] });
  const taming = installNativeTaming(host, { commands: () => [] }, { step: 'orchard.taming', herds: 'orchard.herds', roster: 'orchard.companions', kinds: [], programs,
    binding: { upgradeKind: 'silver', bonds: ['ordinary', 'silver'], names: ['Juniper', 'Silver'], offset: [1, 2], fields: { upgraded: 'argymaq', horseUpgraded: 'horseArgymaq', candidateUpgraded: 'argymaq' },
      labels: { mount: 'Ride', breaking: 'Tame', trust: 'Trust', start: 'Start', thrown: 'Thrown', bonded: ['Bonded', 'Upgraded'] } },
    poses: [], poseProgram: SPECIES_POSES.horse, presentation: { alive: 'alive', smooth: [], decay: [], graze: { target: 'graze', rate: 1, speed: .3 }, base: { bone: 'body', target: 'base' }, wind: { x: 'wx', z: 'wz', strength: 'wind' } },
    inputs: { offer: 'orchard.offer', lean: 'orchard.lean', pitch: 'orchard.pitch', mount: 'orchard.mount' }, rest: { x: 0, z: 0, face: { x: 1, z: 0 } }, rail: { x: 0, z: 0 }, eye: 1.6, impactRange: 4, scareRange: 20, scareSeconds: 3, thrownLabel: 'Thrown' });
  try {
    const actor = roster.spawn(2, 3, 0, false), before = random.snapshot();
    expect(actor.entityId).toBe('creature:0'); expect(bodies).toEqual([actor]); expect(sight).toEqual([false]);
    expect(() => roster.spawn(4, 3, 0, false)).toThrow(); expect(random.snapshot()).toEqual(before);
    mounted.addMountable(actor.entityId); expect(mounted.mount(actor.entityId)).toBe(true);
    taming.update(.1); host.step({ moveX: 0, moveZ: 0, yaw: 0, commandVersion: 1, steer: { keyX: 0, keyY: 1, stickX: 0, stickY: 0 } });
    mounted.dismount(); mounted.removeMountable(actor.entityId); roster.retire(actor.entityId);
    expect(host.entities.has(actor.entityId)).toBe(false); expect(bodies).toEqual([]); expect(sight).toEqual([]); expect(retired.has(actor.entityId)).toBe(true);
    expect(random.snapshot()).toEqual(before); expect(roster.spawn(2, 3, 0, true).entityId).toBe('creature:1');
  } finally { host.dispose(); }
});

test('orchard native manager drives the admitted roster at ten Hz across body frames', async () => {
  const { fixtureNativeRoster } = await import('./fixtures/native-roster');
  const { Rng } = await import('@wildshard/engine/core/rng');
  const { NativeManager, NativePopulationDriver } = await import('@wildshard/game/population/nativeManager');
  const { createNativeCreatureRoster } = await import('@wildshard/game/shardfile/homeKeeper');
  const { nativeEliteBindings: eliteBindings } = await import('@wildshard/engine/ai/eliteRoster');
  const rapier = await loadRapier(Uint8Array.from(readFileSync('public/assets/physics/rapier.wasm')));
  const host = createSimHost({ ...SIM_LEVEL, entities: [], quests: [] }, { rapier }), random = new Rng(71);
  const sample = SIM_LEVEL.entities[0]; if (sample === undefined) throw new Error('Missing orchard actor');
  const { hunt, services } = fixtureNativeRoster(host, random);
  const intake = createNativeCreatureRoster(host, { specs: [sample.spec], variants: new Map(), rng: random, services, hunted: 'every', spawnY: 10 });
  const slot = intake.body('orchard.boar', sample.spec.kind, sample.spec.variant, -1, { x: 2, z: 3 }, 0, [1, 1]);
  const actor = intake.arrive(slot); intake.remember(slot);
  const manager = new NativeManager(host, hunt, random, { limit: 64, sightSlots: 1, initialSight: false });
  const groups = herdService(host, 'unused.herds', 'fixture.driver', { id: 'orchard.tokens', owners: new WeakMap() });
  lendNalatiAdmission(host.scope);
  const makeDriver = (id = 'orchard.tokens', ownerHost = host): InstanceType<typeof NativePopulationDriver> => new NativePopulationDriver(ownerHost, manager, hunt, random, [actor], new Map(), new Map(), eliteBindings(), [], [],
    { tokens: id, program: admission, packKind: 'boar', dogKind: 'collie', eliteKinds: [], dispatch: 'dispatch' }, groups);
  expect(() => makeDriver('foreign.tokens')).toThrow('Missing native manager tokens');
  const foreign = createSimHost({ ...SIM_LEVEL, entities: [], quests: [] }, { rapier });
  try { expect(groups.owns(foreign)).toBe(false); expect(() => makeDriver('orchard.tokens', foreign)).toThrow('Missing native manager tokens'); }
  finally { foreign.dispose(); }
  const driver = makeDriver();
  host.onStep('orchard.population', dt => { driver.update(dt); });
  try {
    actor.setMotion(1, 3, 1);
    for (let i = 0; i < 3; i++) host.step({ moveX: 0, moveZ: 0, yaw: 0 });
    const decision = actor.mem['groupThinkAt'];
    expect(decision).toBeGreaterThanOrEqual(0); expect(actor.speed).toBeLessThan(.1);
    for (let i = 0; i < 2; i++) host.step({ moveX: 0, moveZ: 0, yaw: 0 });
    expect(actor.mem['groupThinkAt']).toBe(decision);
    driver.restore(2.5); expect(driver.snapshot()).toBe(2.5);
    expect(() => driver.restore(-1)).toThrow(); expect(() => driver.admit(actor)).toThrow();
  } finally { host.dispose(); }
});

test('orchard deferred actors share allocator, stream and native retirement ownership', async () => {
  const { fixtureNativeRoster } = await import('./fixtures/native-roster');
  const { Rng } = await import('@wildshard/engine/core/rng');
  const { createNativeCreatureRoster, NativeDeferredRoster } = await import('@wildshard/game/shardfile/homeKeeper');
  const rapier = await loadRapier(Uint8Array.from(readFileSync('public/assets/physics/rapier.wasm')));
  const host = createSimHost({ ...SIM_LEVEL, entities: [], quests: [] }, { rapier }), random = new Rng(71), control = new Rng(71);
  const sample = SIM_LEVEL.entities[0]; if (sample === undefined) throw new Error('Missing orchard actor');
  const { hunt, services } = fixtureNativeRoster(host, random), bodies: HuntBody[] = [], sight: (boolean | null | undefined)[] = [];
  const retired = new Set<string>(), absent = new Set<AnimalSim>();
  const intake = createNativeCreatureRoster(host, { specs: [sample.spec], variants: new Map([[sample.spec.kind, [{ id: sample.spec.variant, scale: [1, 2] as const }]]]), rng: random, services, hunted: 'every', spawnY: 10 });
  const profile = { limit: 64, spawnY: 10, motorKinds: ['boar'], retiredY: -9999 };
  const deferred = new NativeDeferredRoster(host, intake, hunt, random, bodies, sight, retired, absent, profile);
  try {
    expect(() => new NativeDeferredRoster(host, { ...intake }, hunt, random, bodies, sight, retired, absent, profile)).toThrow('owners');
    const saved = deferred.roll(sample.spec.kind, sample.spec.variant, 2, 3, 0), scale = control.range(1, 2); control.next(); const seed = control.next();
    expect(saved).toMatchObject({ id: 'creature:0', scale, seed }); expect(saved.adopted).toEqual(control.snapshot());
    const actor = deferred.materialize(saved, sample.spec.kind, -1, true); control.next(); control.next(); control.next();
    expect(random.snapshot()).toEqual(control.snapshot()); expect(bodies).toEqual([actor]); expect(sight).toEqual([false]);
    expect(() => deferred.materialize(saved, sample.spec.kind, -1, true)).toThrow('Invalid');
    deferred.release(actor.entityId, 'retire'); expect(host.entities.size).toBe(0); expect(bodies).toEqual([]); expect(retired.has('creature:0')).toBe(true);
    expect(random.snapshot()).toEqual(control.snapshot());
    const next = deferred.roll(sample.spec.kind, sample.spec.variant, 2, 3, 0), parked = deferred.materialize(next, sample.spec.kind, -1, true);
    expect(parked.entityId).toBe('creature:1'); deferred.release(parked.entityId, 'park');
    expect(host.entities.get(parked.entityId)).toBe(parked); expect(absent.has(parked)).toBe(true); expect(parked.alive).toBe(false);
    expect(bodies).toEqual([]); expect(sight).toEqual([]); expect(() => deferred.release(parked.entityId, 'park')).toThrow();
  } finally { host.dispose(); }
});

test('orchard wildlife frame continues real foragers and tramples through numeric rows', async () => {
  const { ForagerPopulation } = await import('@wildshard/engine/ai/ambientForager');
  const { ForagerPopulationSchema } = await import('@wildshard/format/ambientLife');
  const { NativeWildlifeFrame, NativeWildEnvironment } = await import('@wildshard/game/population/nativeManager');
  const { GrassField } = await import('@wildshard/game/systems/looks/grassField');
  const { TrampleField } = await import('@wildshard/game/systems/looks/trample');
  const { default: foragerRow } = await import('../src/shards/nalati-grasslands/creatures/marmotForager.json');
  const { overrideTerrain } = await import('./fake/terrain');
  const v = await import('valibot');
  const rapier = await loadRapier(Uint8Array.from(readFileSync('public/assets/physics/rapier.wasm')));
  const host = createSimHost({ ...SIM_LEVEL, quests: [] }, { rapier });
  host.scope.onDispose(overrideTerrain({ heightAt: () => 0, normalAt: () => [0, 1, 0], waterLevel: () => -100 }));
  const native = host.entities.get('boar:1'); if (native === undefined) throw new Error('Missing orchard body');
  const actor: HuntBody = Object.assign(native, { hidden: false, sampleTerrain: () => undefined }); actor.speed = 3;
  const population = new ForagerPopulation(v.parse(ForagerPopulationSchema, { ...foragerRow, id: 'orchard.foragers', count: 4, place: { ...foragerRow.place, size: [2, 2] } }), 41);
  population.colonies([{ x: 5, z: 5 }]);
  const trample = new TrampleField(), wolves: HuntBody[] = [], signals: string[] = [];
  const frame = new NativeWildlifeFrame(host, admissionNative(host), [actor], [], wolves, [], [], [], population, trample,
    { speed: 'speed', alert: 'whistle', range: 'scare', packRadius: 20, scareSeconds: 6, scareRadius: 60, foragerRunSpeed: 5,
      trample: { kinds: { boar: .5 }, minSpeed: .6, range: 80, fullSpeed: 6 }, knockdown: { speed: 7, min: .4, max: 1.5, seconds: .28 } });
  const field = new GrassField({ seed: 9, half: 16, heightAt: () => 0, normalAt: () => [0, 1, 0], splatAt: () => [1, 0, 0, 0], trailDistance: () => Infinity, cabinMask: () => 0, pondMask: () => 0, waterLevel: () => -100, paint: () => false, layout: null });
  const environment = new NativeWildEnvironment(field, trample, { wind: { x: 1, z: 0, strength: .3 }, flatten: .5 }, admissionNative(host));
  expect(() => environment.onEvent('scare', 0, 0)).toThrow('Unbound'); environment.bind(host, frame);
  host.events.on('creature.signal', event => { signals.push(event.name); }, host.scope);
  host.onStep('orchard.wildlife', dt => { trample.update(dt, host.player.position); frame.update(dt, false); });
  try {
    for (let i = 0; i < 12; i++) host.step({ moveX: 0, moveZ: 0, yaw: 0 });
    const saved = frame.snapshot(); expect(saved.wild.at).toBeGreaterThan(0); expect(population.rows.length).toBeGreaterThan(0);
    expect(trample.amountAt(actor.position.x, actor.position.z)).toBeGreaterThan(0);
    const standing = environment.grassStandingAt(actor.position.x, actor.position.z);
    expect(environment.grassHeightAt(actor.position.x, actor.position.z)).toBeLessThan(standing);
    environment.onEvent('scare', 3, 4); host.step({ moveX: 0, moveZ: 0, yaw: 0 }); expect(signals).toEqual(['scare']);
    frame.update(.1, true); frame.restore(saved); expect(frame.snapshot()).toEqual(saved);
  } finally { host.dispose(); }
});


test('orchard group collection forks native packs and owns real crowd prey identities', async () => {
  const { PackBrain } = await import('@wildshard/engine/ai/pack');
  const { FlockBrain } = await import('@wildshard/engine/ai/flock');
  const { NativeGroupCollection, nativeGroupCollection } = await import('@wildshard/game/shardfile/groupRuntime');
  const { nativeGroupBrain } = await import('@wildshard/format/groupBrains');
  const { default: brains } = await import('../src/shards/nalati-grasslands/data/brains.json');
  const rapier = await loadRapier(Uint8Array.from(readFileSync('public/assets/physics/rapier.wasm')));
  const host = createSimHost({ ...SIM_LEVEL, quests: [] }, { rapier });
  const first = host.entities.get('boar:1'), recipe = SIM_LEVEL.entities[0]; if (first === undefined || recipe === undefined) throw new Error('Missing native pack fixture');
  const second = host.spawn({ ...recipe, id: 'orchard.boar' }), ids = new WeakMap<PackPrey, string>(), prey = new Map<string, PackPrey>();
  const spec = nativeGroupBrain({ ...brains.pack, id: 'orchard.pack', home: [0, 0], members: [first.entityId] }); if (spec.kind !== 'pack') throw new Error('Missing native pack preset');
  const source = new PackBrain([first], 0, 0, spec, { sharedRng: () => host.rng.stream('ai'),
    environment: () => ({ playerFwdX: 0, playerFwdZ: -1, playerMounted: false, playerHealth01: 1, grassHeightAt: () => 0 }),
    visibility: () => 1, hearing: () => 10, downwind: () => false, inBounds: () => true, normalY: () => 1,
    register: () => undefined, bite: () => undefined, preyIdentity: actor => ids.get(actor) ?? '', resolvePrey: id => prey.get(id) ?? null });
  source.initialize();
  const packs = [source], wolves = [first], actors = new Map([[first.entityId, first]]), packOf = new WeakMap<AnimalSim, typeof source>();
  const collection = new NativeGroupCollection(host, packs, [], actors, prey, ids, wolves, packOf, { id: 'orchard.groups', firstRaid: 14 });
  const flock = new FlockBrain({ heightAt: () => 0, normalY: () => 1, inBounds: () => true, wetAt: () => false,
    playerCrouched: () => false, grassHeightAt: () => .2, trample: () => undefined, centre: () => undefined },
    { x: 2, z: 3, count: 2, seed: 9, range: 25, runSpeed: 6, walkSpeed: 1.2, grazeStep: .3, bleatCue: 'deer.call' }); flock.initialize();
  try {
    expect(nativeGroupCollection(host, 'orchard.groups')).toBe(collection); expect(collection.firstRaid).toBe(14);
    const before = source.snapshot(), next = collection.addPack([second], 3, 4);
    expect(packs).toEqual([source, next]); expect(next.members).toEqual([second]); expect(actors.get(second.entityId)).toBe(second);
    expect(packOf.get(second)).toBe(next); expect(wolves).toEqual([first, second]); expect(source.snapshot()).toBe(before);
    const target = collection.bindFlocks([flock], 'orchard:')[0]?.[0]; if (target === undefined) throw new Error('Missing native crowd prey');
    expect(ids.get(target)).toBe('orchard:0:0'); expect(prey.get('orchard:0:0')).toBe(target);
    target.applyDamage(1, target.position, target.position); expect(target.alive).toBe(false); expect(flock.alive).toBe(1);
    expect(() => collection.bindFlocks([flock], 'orchard:')).toThrow();
  } finally { host.dispose(); }
});

test('orchard fixture installs the complete native population through data rows', async () => {
  const { fixtureNativeRoster } = await import('./fixtures/native-roster');
  const { Rng } = await import('@wildshard/engine/core/rng');
  const { PackBrain } = await import('@wildshard/engine/ai/pack');
  const { nativeGroupBrain } = await import('@wildshard/format/groupBrains');
  const { NativeGroupCollection } = await import('@wildshard/game/shardfile/groupRuntime');
  const { NativeWildEnvironment } = await import('@wildshard/game/population/nativeManager');
  const { installNativePopulation, nativePopulationOf } = await import('@wildshard/game/riding/nativePopulation');
  const { nativeEliteBindings: eliteBindings } = await import('@wildshard/engine/ai/eliteRoster');
  const { GrassField } = await import('@wildshard/game/systems/looks/grassField');
  const { TrampleField } = await import('@wildshard/game/systems/looks/trample');
  const { ForagerPopulation } = await import('@wildshard/engine/ai/ambientForager');
  const { ForagerPopulationSchema } = await import('@wildshard/format/ambientLife');
  const { BOAR } = await import('@wildshard/game/systems/species/boar');
  const { default: brains } = await import('../src/shards/nalati-grasslands/data/brains.json');
  const { default: pasture } = await import('../src/shards/nalati-grasslands/behaviour/pasture.generated.json');
  const { default: foragerRow } = await import('../src/shards/nalati-grasslands/creatures/marmotForager.json');
  const v = await import('valibot');
  const rapier = await loadRapier(Uint8Array.from(readFileSync('public/assets/physics/rapier.wasm')));
  const sample = SIM_LEVEL.entities[0]; if (sample === undefined) throw new Error('Missing native orchard actor');
  const host = createSimHost({ ...SIM_LEVEL, entities: [{ ...sample, id: 'creature:0' }], quests: [] }, { rapier });
  const actor = host.entities.get('creature:0'); if (actor === undefined) throw new Error('Missing orchard actor');
  const random = new Rng(71), { hunt } = fixtureNativeRoster(host, random), ids = new WeakMap<PackPrey, string>(), prey = new Map<string, PackPrey>();
  const spec = nativeGroupBrain({ ...brains.pack, id: 'orchard.pack', home: [0, 0], members: [actor.entityId] }); if (spec.kind !== 'pack') throw new Error('Missing pack preset');
  const pack = new PackBrain([actor], 0, 0, spec, { sharedRng: () => host.rng.stream('ai'),
    environment: () => ({ playerFwdX: 0, playerFwdZ: -1, playerMounted: false, playerHealth01: 1, grassHeightAt: () => 0 }),
    visibility: () => 1, hearing: () => 10, downwind: () => false, inBounds: () => true, normalY: () => 1, register: () => undefined, bite: () => undefined,
    preyIdentity: target => ids.get(target) ?? '', resolvePrey: id => prey.get(id) ?? null }); pack.initialize();
  const field = new GrassField({ seed: 9, half: 16, heightAt: () => 0, normalAt: () => [0, 1, 0], splatAt: () => [1, 0, 0, 0], trailDistance: () => Infinity,
    cabinMask: () => 0, pondMask: () => 0, waterLevel: () => -100, paint: () => false, layout: null });
  const environment = new NativeWildEnvironment(field, new TrampleField(), { wind: { x: 1, z: 0, strength: .3 }, flatten: .5 }, admissionNative(host));
  new NativeGroupCollection(host, [pack], [], new Map([[actor.entityId, actor]]), prey, ids, [actor], new WeakMap(), { id: 'orchard.groups', firstRaid: 14, environment }, { id: 'orchard.tokens', owners: new WeakMap() });
  herdService(host, 'orchard.herds');
  const foragers = new ForagerPopulation(v.parse(ForagerPopulationSchema, { ...foragerRow, id: 'orchard.foragers', count: 4, place: { ...foragerRow.place, size: [2, 2] } }), 41); foragers.colonies([{ x: 5, z: 5 }]);
  const checkpoint = random.snapshot(); random.next(); random.next(); random.next(); const stream = random.snapshot(); random.restore(checkpoint);
  lendNalatiPasture(host.scope);
  const owner = installNativePopulation(host, hunt, random, { boot: { admission, pasture, streamSeed: 71, species: { boar: { kind: BOAR.kind, variants: BOAR.variants } }, recipes: [sample.spec] },
    config: { step: 'orchard.population', raidStep: 'orchard.raid', groups: 'orchard.groups', herds: 'orchard.herds', tokens: 'orchard.tokens', preyPrefix: 'orchard:',
      packKind: 'boar', dogKind: 'collie', eliteKinds: ['silver-boar'], motorKinds: ['boar'], retiredY: -9999, variants: [], flocks: [], forager: { row: foragers.row, seed: 41 },
      frame: { speed: 'speed', alert: 'whistle', range: 'scare', packRadius: 20, scareSeconds: 6, scareRadius: 60, foragerRunSpeed: 5,
        trample: { kinds: { boar: .5 }, minSpeed: .6, range: 80, fullSpeed: 6 }, knockdown: { speed: 7, min: .4, max: 1.5, seconds: .28 } },
      driver: { dispatch: 'dispatch' }, companion: { id: 'orchard.companion', kind: 'boar', variant: 'boar', wildKinds: ['boar'] }, shepherdOffset: [2, 3], raidVariants: ['boar'] },
    bodies: [{ actor, boot: { id: actor.entityId, seed: actor.seed, adopted: { x: actor.position.x, z: actor.position.z, stream: checkpoint } } }], herds: [], stream, wildStream: new Rng(3).snapshot(),
    bake: { actors: [{ spec: sample.spec }], marmots: foragers.snapshot() }, spawnY: 10, elites: eliteBindings() });
  try {
    expect(nativePopulationOf(host)).toBe(owner); expect(owner.bodies).toEqual([actor]);
    for (let i = 0; i < 12; i++) host.step({ moveX: 0, moveZ: 0, yaw: 0 });
    expect(owner.marmots.rows).toHaveLength(2); expect(owner.raid.raids).toBe(0); expect(host.adapters.has('orchard.population')).toBe(true);
    const { bondedMountRoster } = await import('@wildshard/game/riding/roster');
    const companions = bondedMountRoster(host, 'orchard.companion');
    expect(owner.bondedHorseIds()).toEqual([]);
    const bound = companions.spawn(2, 3, 0, false);
    expect(bound.entityId).toBe('creature:1'); expect(owner.bondedHorseIds()).toEqual([bound.entityId]);
    companions.retire(bound.entityId); expect(owner.bondedHorseIds()).toEqual([]);
    expect(owner.bodies).toEqual([actor]); expect(host.entities.has(bound.entityId)).toBe(false);
    expect(() => owner.spawnElite('foreign', 0, 0, 0, 'boar')).toThrow('Foreign');
  } finally { host.dispose(); }
});

test('native herd service keeps both id namespaces and retires with its real group owner', async () => {
  const rapier = await loadRapier(readFileSync('public/assets/physics/rapier.wasm'));
  const host = createSimHost({ ...SIM_LEVEL, entities: [], quests: [] }, { rapier });
  try {
    const before = host.rng.snapshot(), tokens: NonNullable<ConstructorParameters<typeof FixtureNativeGroups>[9]> = { id: 'orchard.same', owners: new WeakMap() }, owner = herdService(host, 'orchard.same', 'orchard.same', tokens);
    expect(owner.owns(host)).toBe(true); expect(owner.tokens?.owners).toBe(tokens.owners);
    expect(() => herdService(host, 'other.herds', 'other.group', tokens)).toThrow('Duplicate native manager token owners');
    expect(() => fixtureGroup(host, 'other.group')).toThrow('Missing native group collection');
    expect(fixtureGroup(host, 'orchard.same')).toBe(owner);
    expect(nativeHerdCollection(host, 'orchard.same')).toBe(owner);
    expect(nativeHerdCollection(host, 'orchard.same').herds).toBe(owner.herds);
    expect(nativeHerdCollection(host, 'orchard.same').wind).toEqual({ x: 0, z: 0, strength: 0 });
    expect(() => herdService(host, 'orchard.same', 'orchard.other')).toThrow('Invalid native herd collection');
    expect(() => fixtureGroup(host, 'orchard.other')).toThrow('Missing native group collection');
    expect(host.rng.snapshot()).toEqual(before); expect(host.entities.size).toBe(0);
  } finally { host.dispose(); }
  expect(() => fixtureGroup(host, 'orchard.same')).toThrow('Missing native group collection');
  expect(() => nativeHerdCollection(host, 'orchard.same')).toThrow('Missing native herd collection');
});


test('v2 thrown dismount uses the original mounted capsule once, without a second ejection', async () => {
  const { applyV2WorldActions } = await import('../src/game/shardfile/worldActionsV2');
  const rapier = await loadRapier(Uint8Array.from(readFileSync('public/assets/physics/rapier.wasm')));
  const level = { ...SIM_LEVEL, quests: [] }, host = createSimHost(level, { rapier }), direct = createSimHost(level, { rapier });
  try {
    const mounted = install(host), original = install(direct);
    expect(mounted.mount('boar:1')).toBe(true); expect(original.mount('boar:1')).toBe(true);
    const action = { binding: 'rider', target: 'player.mount', kind: 'dismount' as const, thrown: true };
    applyV2WorldActions([action,action], [{ binding: 'rider',target: 'player.mount',scope: host.scope,kind: 'mount',owner: mounted }]);
    original.dismount(true);
    expect(mounted.mounted).toBe(false);expect(host.modes.current()).toBe('foot');
    expect(snapshotSimHost(host)).toEqual(snapshotSimHost(direct));
    expect(host.playerImpulse.toArray()).toEqual(direct.playerImpulse.toArray());
    const command = { moveX: 0,moveZ: 0,yaw: 0,commandVersion: 1 as const };
    for (let step = 0; step < 6; step++) { host.step(command);direct.step(command);expect(snapshotSimHost(host)).toEqual(snapshotSimHost(direct)); }
  } finally { host.dispose();direct.dispose(); }
});


test('native shared cadence retains the original driver noise, terrain, dodge and restore order', async () => {
  const { fixtureNativeRoster } = await import('./fixtures/native-roster');
  const { NativeManager, NativePopulationDriver } = await import('@wildshard/game/population/nativeManager');
  const { OriginalNativePopulationDriver } = await import('./fixtures/original-native-driver');
  const { createNativeCreatureRoster } = await import('@wildshard/game/shardfile/homeKeeper');
  const { nativeEliteBindings } = await import('@wildshard/engine/ai/eliteRoster');
  const rapier = await loadRapier(Uint8Array.from(readFileSync('public/assets/physics/rapier.wasm')));
  const sample = SIM_LEVEL.entities[0]; if (sample === undefined) throw new Error('Missing original driver actor');
  const make = (Driver: typeof NativePopulationDriver | typeof OriginalNativePopulationDriver) => {
    const host = createSimHost({ ...SIM_LEVEL, entities: [], quests: [] }, { rapier }), random = new FixtureRandom(71);
    lendNalatiAdmission(host.scope);
    const { hunt, services } = fixtureNativeRoster(host, random);
    const intake = createNativeCreatureRoster(host, { specs: [sample.spec], variants: new Map(), rng: random, services, hunted: 'every', spawnY: 10 });
    const slot = intake.body('orchard.boar', sample.spec.kind, sample.spec.variant, -1, { x: 2, z: 3 }, 0, [1, 1]);
    const actor = intake.arrive(slot); intake.remember(slot);
    const terrain: number[] = []; actor.sampleTerrain = () => { terrain.push(host.state.tick); };
    const manager = new NativeManager(host, hunt, random, { limit: 64, sightSlots: 1, initialSight: true });
    const groups = herdService(host, 'unused.herds', 'fixture.driver', { id: 'orchard.tokens', owners: new WeakMap() });
    const driver = new Driver(host, manager, hunt, random, [actor], new Map(), new Map(), nativeEliteBindings(), [], [],
      { tokens: 'orchard.tokens', program: admission, packKind: 'boar', dogKind: 'collie', eliteKinds: [], dispatch: 'dispatch' }, groups);
    host.onStep('orchard.population', dt => { driver.update(dt); });
    return { host, actor, manager, driver, random, terrain };
  };
  const actual = make(NativePopulationDriver), original = make(OriginalNativePopulationDriver);
  let dodgeSeen = false;
  try {
    for (let frame = 0; frame < 240; frame++) {
      for (const world of [actual, original]) {
        if (frame === 20 || frame === 25) Object.assign(world.actor, { hidden: frame === 20 });
        if (frame === 40 || frame === 45) world.actor.harnessHold = frame === 40;
        if (frame === 60) world.actor.stagger(new Vector3(1, 0, 0), .2);
        if (frame === 90 || frame === 95) world.actor.alive = frame === 95;
        if (frame === 120) world.driver.restore(0);
        world.host.step({ moveX: frame % 20 < 10 ? .4 : -.4, moveZ: .2, yaw: .3, ...(frame === 10 || frame === 130 ? { dodge: true } : {}) });
      }
      const capture = (world: ReturnType<typeof make>) => ({
        common: world.manager.snapshot([world.actor.entityId], [world.actor.entityId]), driver: world.driver.snapshot(),
        actor: snapshotSimHost(world.host).entities, terrain: world.terrain, stream: world.random.snapshot(),
      });
      expect(capture(actual), `original driver frame ${String(frame)}`).toEqual(capture(original));
      dodgeSeen ||= original.driver.snapshot() > 0;
    }
    expect(actual.terrain.length).toBeGreaterThan(10);
    expect(dodgeSeen).toBe(true);
    expect(actual.manager.noise.prev.y).toBe(0);
  } finally { actual.host.dispose(); original.host.dispose(); }
});

test('raw riding pond retains inline native capsule, effects and save continuation',async()=>{
  const rapier=await loadRapier(Uint8Array.from(readFileSync('public/assets/physics/rapier.wasm'))),hosts=[false,true].map(raw=>{
    const host=createSimHost({...SIM_LEVEL,quests:[]},{rapier});lendNalatiPasture(host.scope);herdService(host,rows.herds);
    const block={file:'world/riding-pond.bin',bytes:zlibSync(new Uint8Array(16))};
    const profile=raw?{...rows,world:{...rows.world,pond:{type:'f32',count:4,data:{file:block.file}}}}:rows;
    const mounted=installMountedPlayer(host,profile,raw?block:undefined);expect(mounted.mount('boar:1')).toBe(true);return {host,mounted};
  });
  const original=hosts[0],raw=hosts[1];if(original===undefined||raw===undefined)throw new Error('Missing native comparison');
  try{
    const command={moveX:0,moveZ:0,yaw:0,commandVersion:1 as const,steer:{keyX:0,keyY:1,stickX:0,stickY:0}};
    for(let tick=0;tick<90;tick++){for(const f of hosts)f.host.step(command);expect(serializeSimSnapshot(snapshotSimHost(raw.host))).toBe(serializeSimSnapshot(snapshotSimHost(original.host)));}
    expect(raw.mounted.body.speed).toBeGreaterThan(0);raw.mounted.dismount();original.mounted.dismount();
    expect(serializeSimSnapshot(snapshotSimHost(raw.host))).toBe(serializeSimSnapshot(snapshotSimHost(original.host)));
  }finally{for(const f of hosts)f.host.dispose();}
});

test('malformed raw riding ponds refuse before mode, capsule or save ownership changes',async()=>{
  const rapier=await loadRapier(Uint8Array.from(readFileSync('public/assets/physics/rapier.wasm'))),host=createSimHost({...SIM_LEVEL,quests:[]},{rapier});
  try{
    herdService(host,rows.herds);const before=serializeSimSnapshot(snapshotSimHost(host)),file='world/riding-pond.bin';
    const profile={...rows,world:{...rows.world,pond:{type:'f32',count:4,data:{file}}}};
    for(const block of [undefined,{file:'other.bin',bytes:zlibSync(new Uint8Array(16))},{file,bytes:zlibSync(new Uint8Array(20))}]){
      expect(()=>installMountedPlayer(host,profile,block)).toThrow();expect(serializeSimSnapshot(snapshotSimHost(host))).toBe(before);expect(host.modes.current()).toBe('foot');
    }
  }finally{host.dispose();}
});
