// oxlint-disable-next-line import/no-nodejs-modules -- Exercise the actual shipped native physics owner, without a browser.
import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { loadRapier } from '../src/engine/physics/rapier';
import { createSimHost } from '../src/engine/sim';
import { snapshotSimHost, restoreSimHost } from '../src/engine/sim/snapshot';
import type { HuntGround, HuntBody } from '../src/engine/ai/hunt';
import { Rng } from '../src/engine/core/rng';
import { readSpeciesPrograms } from '../src/format/speciesPrograms';
import { installPopulationRoster } from '../src/game/population/roster';
import { HerdShelter } from '../src/game/population/shelter';
import { RespawnQueue } from '../src/game/population/respawn';
import { createNativeCreatureRoster } from '../src/game/shardfile/homeKeeper';
import { SIM_LEVEL } from './fixtures/sim-level/level';

const ground: HuntGround = {
  heightAt: () => 0, normalY: () => 1, waterLevel: () => -10, chunkHalf: 100,
  inChunk: () => true, trailDistance: () => 50, cabinMask: () => 0, streamAt: () => null,
  pond: () => null, sea: () => false, wetAt: () => false, trees: () => [], treeless: () => true, terrain: () => true,
};

test('native dormant bodies detach from physics and herds, then rematerialize without a draw or new identity', async () => {
  const rapier = await loadRapier(Uint8Array.from(readFileSync('public/assets/physics/rapier.wasm')));
  const host = createSimHost({ ...SIM_LEVEL, entities: [] }, { rapier }), rng = new Rng(17);
  const sample = SIM_LEVEL.entities[0]; if (sample === undefined) throw new Error('Missing native fixture body');
  const herd = { members: [] as HuntBody[] };
  const intake = createNativeCreatureRoster(host, { specs: [sample.spec], variants: new Map(), rng, spawnY: 0,
    hunted: 'every', hunt: { herds: [herd], addHerd: () => 0, adopt: () => undefined, forget: () => undefined } });
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
  const rows = { version: 1, step: 'marsh.roster', seed: 87, bodyCount: 1, limit: 8, scripted: 'sidestep', encounter: 'dusk.guard',
    poseKinds: [], fauna: [], spawn: { x: 0, z: 0 }, identities: [], ordinary: {},
    reserves: [{ kind: spec.kind, variant: spec.variant }], homes: [{ kind: spec.kind, variant: spec.variant, x: 8, z: 8, stream: 'marsh.guard' }] };
  const make = () => createSimHost({ ...SIM_LEVEL, entities: [] }, { rapier });
  const host = make();
  try {
    const ports = { population, bake: { actors: [home], parked: [reserved], herds: [] }, ground, spawnY: 10, nav: null };
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
    { kinds: ['heron'], bigTree: 5, reach: 20, homeHold: 2, clear: 1, spotR: 2, homeR: 4, wet: .4, dry: .2, heightBias: 1, coverBias: 2 });
  shelter.update(1, 1); expect(shelter.wanderGoal(0, 1)).toEqual({ x: 2, z: 0, r: 2 });
  const saved = shelter.snapshot(); shelter.restore(saved); expect(shelter.snapshot()).toEqual(saved);
  let draws = 0;
  const queue = new RespawnQueue({ heron: { delay: { min: 2, max: 2 }, night: true } }, { next: () => { draws++; return .25; } }, 10);
  const first = queue.add('heron', 'reed', 0, 20, 0, 0), second = queue.add('heron', 'white', 0, 25, 0, 0);
  expect(queue.take(3, 0, 0, 0)).toEqual([]); expect(queue.take(3, 20, 0, 1)).toEqual([]);
  expect(queue.take(3, 0, 0, 1)).toEqual([second, first]); expect(draws).toBe(2);
});

test('named population streams remain absent until a scheduled death consumes their first draw', () => {
  const names: string[] = [], authority = { stream: (name: string) => { names.push(name); return new Rng(31); } };
  const queue = new RespawnQueue({ heron: { delay: { min: 2, max: 2 } } }, { authority, name: 'spawn' }, 10);
  expect(names).toEqual([]); queue.take(3, 0, 0, 1); expect(names).toEqual([]);
  expect(queue.add('unknown', undefined, 0, 20, 0, 0)).toBeNull(); expect(names).toEqual([]);
  queue.add('heron', 'reed', 0, 20, 0, 0); expect(names).toEqual(['spawn']);
});
