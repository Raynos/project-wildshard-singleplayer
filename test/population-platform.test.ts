import { fixtureNativeRoster } from './fixtures/native-roster';
import { ReturnProgram } from '../src/game/population/returnProgram';
import program from '../src/shards/pine-hollow/behaviour/life.generated.json' with { type: 'json' };
import { populationEnvironment } from '../src/game/population/environment';
import { flatPopulationEnvironment } from './fixtures/population-environment';
// oxlint-disable-next-line import/no-nodejs-modules -- Exercise the actual shipped native physics owner, without a browser.
import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { loadRapier } from '../src/engine/physics/rapier';
import { createSimHost } from '../src/engine/sim';
import { snapshotSimHost, restoreSimHost } from '../src/engine/sim/snapshot';
import { Rng, RngService } from '../src/engine/core/rng';
import { readSpeciesPrograms } from '../src/format/speciesPrograms';
import { installPopulationRoster } from '../src/game/population/roster';
import { installNativeHerdShelter, HerdShelter } from '../src/game/population/shelter';
import { installWeatherContinuation } from '../src/game/weather/continuation';
import { parseWeatherProgram } from '../src/format/weatherProgram';
import weatherRows from '../src/shards/pine-hollow/data/weather.json' with { type: 'json' };
import { RespawnQueue } from '../src/game/population/respawn';
import { createNativeCreatureRoster } from '../src/game/shardfile/homeKeeper';
import { SIM_LEVEL } from './fixtures/sim-level/level';

test('native dormant bodies detach from physics and herds, then rematerialize without a draw or new identity', async () => {
  const rapier = await loadRapier(Uint8Array.from(readFileSync('public/assets/physics/rapier.wasm')));
  const host = createSimHost({ ...SIM_LEVEL, entities: [] }, { rapier }), rng = new Rng(17);
  const sample = SIM_LEVEL.entities[0]; if (sample === undefined) throw new Error('Missing native fixture body');
  const { hunt, services } = fixtureNativeRoster(host, rng);
  hunt.addHerd(sample.spec.kind, 0, 0);
  const herd = hunt.herds[0]; if (herd === undefined) throw new Error('Missing herd');
  const intake = createNativeCreatureRoster(host, { specs: [sample.spec], variants: new Map(), rng, spawnY: 0,
    hunted: 'every', services });
  try {
    const id = intake.identities.allocate(), body: Parameters<typeof intake.arrive>[0] = intake.body(id, sample.spec.kind, sample.spec.variant, 0, { x: 4, z: 4 }, 0, [1, 1], { seed: .25, scale: 1 });
    const actor = intake.arrive(body), before = rng.snapshot();
    expect(intake.identities.identity(id)).toEqual({ id, kind: sample.spec.kind, variant: sample.spec.variant,
      group: 'herd:0', encounter: null, listed: true, state: 'materialized' });
    intake.identities.adoptAuxiliary({ id: 'marsh.sensor', actor: id, service: 'marsh.traps', handle: 42 });
    expect(() => intake.sleep(body)).toThrow('auxiliary');
    expect(body.actor).toBe(actor); expect(herd.members).toEqual([actor]); expect(host.entities.has(id)).toBe(true);
    intake.identities.releaseAuxiliary('marsh.sensor');
    intake.sleep(body);
    expect(body.actor).toBeNull(); expect(herd.members).toEqual([]); expect(host.entities.has(id)).toBe(false);
    expect(intake.identities.identity(id)?.state).toBe('dormant');
    const adopted = intake.arrive(body);
    expect(adopted).not.toBe(actor); expect(adopted.entityId).toBe(id); expect([adopted.seed, adopted.scale]).toEqual([.25, 1]);
    expect(herd.members).toEqual([adopted]); expect(rng.snapshot()).toEqual(before);
    intake.retire(body); expect(intake.identities.identity(id)?.state).toBe('retired');
    expect(() => intake.arrive(body)).toThrow('identity'); expect(host.entities.has(id)).toBe(false);
  } finally { host.dispose(); }
});

test('made-up salt-marsh roster reserves and adopts a body without draws and resumes its v3 wire', async () => {
  const rapier = await loadRapier(Uint8Array.from(readFileSync('public/assets/physics/rapier.wasm')));
  const sample = SIM_LEVEL.entities[0]; if (sample === undefined) throw new Error('Missing native fixture body');
  const spec = { ...sample.spec, kind: 'marsh-beast', variant: 'reed' }, rng = new Rng(87);
  const roll = (id: string) => {
    const scale = rng.range(1, 2); rng.next(); const seed = rng.next(); rng.next(); rng.next(); rng.next();
    return { id, kind: spec.kind, variant: spec.variant, spec, seed, scale, scripted: true };
  };
  const reserved = roll('creature:0'), home = roll('creature:1');
  const population = readSpeciesPrograms({ page: [], native: [{ id: spec.kind, kind: spec.kind, label: 'Marsh Beast',
    variants: [{ id: spec.variant, label: 'Reed', weight: 1, rarity: 'common', scale: [1, 2] }] }],
    hunt: { limit: 8, player: 'host', fight: {}, bands: { states: [], legacyKinds: [] }, hit: { namespace: 'marsh', tags: [] } } });
  const rows = { version: 1, environment: 'fixture.habitat', step: 'marsh.roster', seed: 87, bodyCount: 1, limit: 8, scripted: 'sidestep', encounter: 'dusk.guard',
    poseKinds: [], fauna: [], spawn: { x: 0, z: 0 }, identities: [], ordinary: {},
    reserves: [{ kind: spec.kind, variant: spec.variant }], homes: [{ kind: spec.kind, variant: spec.variant, x: 8, z: 8, stream: 'marsh.guard' }] };
  const make = () => { const native = createSimHost({ ...SIM_LEVEL, entities: [] }, { rapier }); flatPopulationEnvironment(native); return native; };
  const host = make();
  try {
    const ports = { population, bake: { actors: [home], parked: [reserved], herds: [] }, spawnY: 10, nav: null };
    const roster = installPopulationRoster(host, ports, rows);
    expect(roster.bodies().map(body => body.id)).toEqual(['creature:1']);
    const before = snapshotSimHost(host), own = before.adapters.find(adapter => adapter.id === 'marsh.roster');
    expect(own?.state).toMatchObject({ rng: rng.snapshot(), next: 2 });
    const actor = roster.adoptParked('creature:0', 6, 7, 0);
    expect(actor.entityId).toBe('creature:0'); expect(roster.bodies()).toHaveLength(1);
    expect(snapshotSimHost(host).adapters.find(adapter => adapter.id === 'marsh.roster')?.state).toEqual(own?.state);
    const saved = snapshotSimHost(host);
    let continued: ReturnType<typeof installPopulationRoster> | undefined;
    const restored = restoreSimHost({ ...SIM_LEVEL, entities: [] }, { rapier }, saved, native => {
      flatPopulationEnvironment(native);
      continued = installPopulationRoster(native, { ...ports, saved }, rows);
    });
    try {
      if (continued === undefined) throw new Error('Missing restored population');
      expect(snapshotSimHost(restored)).toEqual(saved);
      expect(continued.actor('creature:0')).not.toBeNull();
      const first = roster.spawn(spec.kind, 10, 10, 0, spec.variant), second = continued.spawn(spec.kind, 10, 10, 0, spec.variant);
      expect(first.entityId).toBe('creature:2'); expect(second.entityId).toBe(first.entityId);
      expect([second.seed, second.scale]).toEqual([first.seed, first.scale]);
    } finally { restored.dispose(); }
  } finally { host.dispose(); }
});

test('made-up marsh rows shelter a flock and return nocturnal bodies in reverse death order', () => {
  const herds = [{ kind: 'heron', cx: 4, cz: 0, members: [] }];
  const shelter = new HerdShelter({ herds }, [{ x: 0, z: 0, r: 1, height: 8, cover: 1 }],
    { kinds: ['heron'], bigTree: 5, reach: 20, homeHold: 2, clear: 1, spotR: 2, homeR: 4, wet: .4, dry: .2, heightBias: 1, coverBias: 2 }, ReturnProgram.page(program));
  shelter.update(1, 1); expect(shelter.wanderGoal(0, 1)).toEqual({ x: 2, z: 0, r: 2 });
  const saved = shelter.snapshot(); shelter.restore(saved); expect(shelter.snapshot()).toEqual(saved);
  const queue = new RespawnQueue({ heron: { delay: { min: 2, max: 2 }, night: true } }, 10);
  const first = queue.add('heron', 'reed', 0, 20, 0, 0, .25), second = queue.add('heron', 'white', 0, 25, 0, 0, .25);
  expect(queue.take(3, 0, 0, 0)).toEqual([]); expect(queue.take(3, 20, 0, 1)).toEqual([]);
  expect(queue.take(3, 0, 0, 1)).toEqual([second, first]);
});

test('population return facts leave named entropy with the owner and preserve absent streams until a declared death', () => {
  const authority = new RngService(31);
  const queue = new RespawnQueue({ heron: { delay: { min: 2, max: 2 } } }, 10);
  expect(authority.snapshot().streams).toEqual([]);
  queue.take(3, 0, 0, 1);
  expect(queue.accepts('unknown')).toBe(false);
  expect(authority.snapshot().streams).toEqual([]);
  if (queue.accepts('heron')) queue.add('heron', 'reed', 0, 20, 0, 0, authority.stream('spawn').next());
  expect(authority.snapshot().streams.map(row => row.name)).toEqual(['spawn']);
});


test('native shelter resolves its actual roster and weather without ports, preserving its v1 step and wire', async () => {
  const rapier = await loadRapier(Uint8Array.from(readFileSync('public/assets/physics/rapier.wasm')));
  const host = createSimHost({ ...SIM_LEVEL, entities: [] }, { rapier });
  flatPopulationEnvironment(host);
  const weather = parseWeatherProgram(weatherRows), step = weather.air?.step;
  if (step === undefined) throw new Error('Missing native weather cadence');
  const air = installWeatherContinuation(host, weather, { phase: 0 }, 'rain');
  const look = { kinds: ['marsh-beast'], bigTree: 5, reach: 20, homeHold: 3, clear: 1, spotR: 2, homeR: 6, wet: .3, dry: .1, heightBias: 0, coverBias: 0 };
  const rows = { environment: 'fixture.habitat', step: 'marsh.shelter', roster: 'marsh.roster', weather: step, herdLimit: 8, look, program };
  const shelter = installNativeHerdShelter(host, [[0,0,1,8,1]], rows);
  try {
    expect(() => shelter.snapshot()).toThrow('Missing native population service');
    const population = readSpeciesPrograms({ page: [], native: [], hunt: { limit: 8, player: 'host', fight: {}, bands: { states: [], legacyKinds: [] }, hit: { namespace: 'marsh', tags: [] } } });
    const roster = installPopulationRoster(host, { population, bake: { actors: [], parked: [], herds: [] }, spawnY: 0, nav: null },
      { version: 1, environment: 'fixture.habitat', step: rows.roster, seed: 71, bodyCount: 0, limit: 8,
        scripted: 'sidestep', encounter: 'marsh', poseKinds: [], spawn: { x: 0, z: 0 }, fauna: [], identities: [], ordinary: {}, reserves: [], homes: [] });
    roster.hunt.addHerd('marsh-beast', 4, 0);
    host.step();
    expect(populationEnvironment(host, rows.environment).wanderGoals[0]).toEqual(shelter.wanderGoal(0,air.rain));
    const before = shelter.snapshot();
    expect(before.version).toBe(1); expect(before.shelters).toHaveLength(1);
    shelter.restore(before); expect(shelter.snapshot()).toEqual(before);
    const ids = snapshotSimHost(host).adapters.map(row => row.id);
    expect(ids.indexOf(rows.step)).toBeLessThan(ids.indexOf(rows.roster));
  } finally { host.dispose(); }
});


test('projected sites preserve source ties, range admission, exact perch choices and shared RNG rollback', async () => {
  const { projectedSite } = await import('../src/game/population/projectedSites');
  const { default: returns } = await import('../src/shards/driftwood-isle/behaviour/returns.generated.json');
  const { selectCreatureSites } = await import('../src/game/plugin/brain');
  const guest = ReturnProgram.page(returns), rng = new Rng(317), original = new Rng(317);
  const points = Array.from({ length: 36 }, (_, i) => ({ x: i - 18, z: i % 7, occupied: i % 3 === 0 ? 1 : 0 }));
  for (const minimum of [0, 3, 8]) for (const maximum of [12, 30]) {
    const origin = { x: 2, z: 1 }, away = { x: -4, z: 3 };
    const expected = selectCreatureSites(points, { count: 1, origin, minDistance: minimum, maxDistance: maximum },
      (point, _i, distance) => Math.hypot(point.x - away.x, point.z - away.z) * .5 - distance * .3 - point.occupied * 30 + original.next() * 3)[0]?.index ?? null;
    expect(projectedSite(points, guest, { signal: 'perchScore', limit: 1024, origin, minimum, maximum, observations: {}, away }, rng)?.index ?? null).toBe(expected);
    expect(rng.snapshot()).toEqual(original.snapshot());
  }
  const before = rng.snapshot();
  const refused = Array.from({ length: 9 }, (_, i) => i < 8 ? { x: i + 1, z: 0, occupied: 0 } : { x: 9, z: 0 });
  expect(() => projectedSite(refused, guest,
    { signal: 'perchScore', limit: 1024, origin: { x: 0, z: 0 }, minimum: 0, maximum: 10, observations: {} }, rng)).toThrow();
  expect(rng.snapshot()).toEqual(before);
  const shelter = ReturnProgram.page(program), same = [{ x: -2, z: 0, height: 0, cover: 0 }, { x: 2, z: 0, height: 0, cover: 0 }];
  expect(projectedSite(same, shelter, { signal: 'shelterScore', limit: 16384, origin: { x: 0, z: 0 }, minimum: 2, maximum: 2,
    observations: { heightBias: 0, height: 0, coverBias: 0, cover: 0 } })?.index).toBe(0);
  expect(() => projectedSite(same, shelter, { signal: 'shelterScore', limit: 1, origin: { x: 0, z: 0 }, minimum: 0, maximum: 3,
    observations: {} })).toThrow('Invalid projected site');
});


test('return guests share one module per live owner and refuse declaration drift', async () => {
  const { Scope } = await import('../src/engine/app/scope');
  const owner = new Scope('fixture.projections');
  const first = ReturnProgram.page(program, owner);
  expect(ReturnProgram.page(structuredClone(program), owner)).toBe(first);
  for (const sourceHash of ['a'.repeat(64), 'b'.repeat(64)])
    expect(ReturnProgram.page({ ...program, script: { ...program.script, sourceHash } }, owner)).toBe(first);
  expect(() => ReturnProgram.page({ ...program, script: { ...program.script, params: { different: 1 } } }, owner)).toThrow('Shared return declaration changed');
  const secondOwner = new Scope('fixture.other-projections');
  expect(ReturnProgram.page(program, secondOwner)).not.toBe(first);
  owner.dispose(); secondOwner.dispose();
  expect(() => ReturnProgram.page(program, owner)).toThrow('Return owner disposed');
});
