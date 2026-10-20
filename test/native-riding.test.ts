import type { AnimalSim } from '@wildshard/engine/entities/AnimalSim';
import type { HuntBody } from '@wildshard/engine/ai/hunt';
// oxlint-disable-next-line import/no-nodejs-modules -- Real native capsule continuation uses the shipped physics bytes.
import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { zlibSync } from 'fflate';
import { createSimHost, type SimHost } from '@wildshard/engine/sim';
import { loadRapier } from '@wildshard/engine/physics/rapier';
import { restoreSimHost, snapshotSimHost } from '@wildshard/engine/sim/snapshot';
import { admitNativeHerds } from '@wildshard/game/shardfile/groupRuntime';
import { installMountedPlayer } from '@wildshard/game/riding/native';
import programs from '../src/shards/nalati-grasslands/behaviour/riding.generated.json' with { type: 'json' };
import { SIM_LEVEL } from './fixtures/sim-level/level';

const zero = btoa(String.fromCodePoint(...zlibSync(new Uint8Array(16))));
const rows = { step: 'orchard.saddle', herds: 'orchard.herds', kinds: ['boar'], adopted: { kind: 'boar', variant: 'boar' },
  mountable: ['boar:1'], speeds: { walk: 1, trot: 3, canter: 5, gallop: 8 }, pose: {},
  world: { res: 2, size: 32, water: -100, wet: zero, pond: zero }, thrownDamage: 7, thrownLabel: 'Thrown', program: programs.riding };
function install(host: SimHost) { admitNativeHerds(host, rows.herds, []); return installMountedPlayer(host, rows); }

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
  const { admitMountRoster, BondedMountRoster } = await import('@wildshard/game/riding/roster');
  const { installNativeTaming } = await import('@wildshard/game/riding/nativeTaming');
  const { SPECIES_POSES } = await import('../src/shards/nalati-grasslands/generators/speciesPoses');
  const { default: admission } = await import('../src/shards/nalati-grasslands/behaviour/admission.generated.json');
  const rapier = await loadRapier(Uint8Array.from(readFileSync('public/assets/physics/rapier.wasm')));
  const host = createSimHost({ ...SIM_LEVEL, entities: [], quests: [] }, { rapier });
  const sample = SIM_LEVEL.entities[0]; if (sample === undefined) throw new Error('Missing native fixture recipe');
  const random = new Rng(71), { hunt } = fixtureNativeRoster(host, random), retired = new Set<string>();
  const bodies: HuntBody[] = [], sight: (boolean | null | undefined)[] = [];
  admitNativeHerds(host, 'orchard.herds', []);
  admitMountRoster(host, 'orchard.actors', new NativeActors('creature', 64), random, hunt, bodies, sight, retired, []);
  const roster = new BondedMountRoster(host, { id: 'orchard.companions', services: 'orchard.actors', herds: 'orchard.herds', kind: 'boar', variant: 'boar', wildKinds: ['boar'], specs: [sample.spec], scale: [1, 1], spawnY: 10, program: admission });
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
  const { NativeManager, NativePopulationDriver, admitNativeManagerTokens } = await import('@wildshard/game/population/nativeManager');
  const { createNativeCreatureRoster } = await import('@wildshard/game/shardfile/homeKeeper');
  const { eliteBindings } = await import('@wildshard/game/shardfile/eliteEncounters');
  const { default: admission } = await import('../src/shards/nalati-grasslands/behaviour/admission.generated.json');
  const rapier = await loadRapier(Uint8Array.from(readFileSync('public/assets/physics/rapier.wasm')));
  const host = createSimHost({ ...SIM_LEVEL, entities: [], quests: [] }, { rapier }), random = new Rng(71);
  const sample = SIM_LEVEL.entities[0]; if (sample === undefined) throw new Error('Missing orchard actor');
  const { hunt, services } = fixtureNativeRoster(host, random);
  const intake = createNativeCreatureRoster(host, { specs: [sample.spec], variants: new Map(), rng: random, services, hunted: 'every', spawnY: 10 });
  const slot = intake.body('orchard.boar', sample.spec.kind, sample.spec.variant, -1, { x: 2, z: 3 }, 0, [1, 1]);
  const actor = intake.arrive(slot); intake.remember(slot);
  const manager = new NativeManager(host, hunt, random, { limit: 64, sightSlots: 1, initialSight: false });
  admitNativeManagerTokens(host, 'orchard.tokens', new WeakMap());
  const driver = new NativePopulationDriver(host, manager, hunt, random, [actor], new Map(), new Map(), eliteBindings(), [], [],
    { tokens: 'orchard.tokens', program: admission, packKind: 'boar', dogKind: 'collie', eliteKinds: [], dispatch: 'dispatch', dogDecision: 'dog' });
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
    deferred.retire(actor.entityId); expect(host.entities.size).toBe(0); expect(bodies).toEqual([]); expect(retired.has('creature:0')).toBe(true);
    expect(random.snapshot()).toEqual(control.snapshot());
    const next = deferred.roll(sample.spec.kind, sample.spec.variant, 2, 3, 0), parked = deferred.materialize(next, sample.spec.kind, -1, true);
    expect(parked.entityId).toBe('creature:1'); deferred.park(parked.entityId);
    expect(host.entities.get(parked.entityId)).toBe(parked); expect(absent.has(parked)).toBe(true); expect(parked.alive).toBe(false);
    expect(bodies).toEqual([]); expect(sight).toEqual([]); expect(() => deferred.park(parked.entityId)).toThrow();
  } finally { host.dispose(); }
});
