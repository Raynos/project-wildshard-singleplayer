// oxlint-disable-next-line import/no-nodejs-modules -- The native proof reads official immutable output bytes.
import { readFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Standalone execution produces products before the proof.
import { execFileSync } from 'node:child_process';
// oxlint-disable-next-line import/no-nodejs-modules -- Only an exact committed receipt skips production.
import { env, execPath } from 'node:process';
import * as v from 'valibot';
import { beforeAll, expect, test } from 'vitest';
import { loadRapier } from '../src/engine/physics/rapier';
import { createSimHost } from '../src/engine/sim';
import { snapshotSimHost, restoreSimHost } from '../src/engine/sim/snapshot';
import { outputDescriptor } from '../src/game/shardfile/outputDescriptor';
import { prepareRuntimeWorld } from '../src/game/plugin/simulation';
import { parseNativeRuntimePlan } from '../src/format/nativeRuntimePlan';
import { speciesBrains } from '../src/sdk/speciesBrains';
import { SIGNAL_SPECIES, SIGNAL_STRIKES, SIGNAL_MODULES } from '../src/shards/sunscar-dunes/data/brains';
import { MATRIARCH_DATA } from '../src/shards/sunscar-dunes/data/species/matriarch';
import { loadHeadlessProduct } from '../src/sdk/headlessProduct';

const savedPolicy = v.object({ phase: v.number(), fighting: v.boolean(), decision: v.string() });
const logical = v.object({ decision: v.object({ bindings: v.array(v.object({ failures: v.number(), slots: v.record(v.string(), v.union([v.number(), v.boolean()])) })) }) });
beforeAll(() => {
  if (env['WS_TEST_PRODUCTS_SHA'] !== env['VERCEL_GIT_COMMIT_SHA'] || env['WS_TEST_PRODUCTS_SHA'] === undefined)
    execFileSync(execPath, ['scripts/build-shardfiles.mjs', '--reuse'], { stdio: 'inherit' });
}, 120_000);
test('the Matriarch guest borrows each encounter body and resumes its grounded continuation', async () => {
  const product = await loadHeadlessProduct('out/sunscar-dunes'), declaration = parseNativeRuntimePlan(product.section('sim/runtime-plan'));
  const descriptor = outputDescriptor(product.shardfile); if (descriptor === undefined) throw new Error('Missing verified product');
  const assets = new Map(descriptor.index.files.map(file => [file.commons === true ? `commons:${file.hash}` : file.hash,
    Uint8Array.from(readFileSync(`out/sunscar-dunes/${file.path}`))]));
  const rapier = await loadRapier(Uint8Array.from(readFileSync('public/assets/physics/rapier.wasm')));
  const world = await prepareRuntimeWorld(product.shardfile, assets, declaration.baked, declaration.recipe, descriptor.sections);
  const host = createSimHost(world.level, { ...world.ports, rapier });
  let restored: ReturnType<typeof restoreSimHost> | undefined;
  const policy = (owner: typeof host) => {
    const slot = snapshotSimHost(owner).adapters.find(row => row.id === 'sunscar.homes');
    const keeper = v.parse(v.object({ boss: v.object({ policy: v.string() }) }), slot?.state);
    const wire: unknown = JSON.parse(keeper.boss.policy); if (typeof wire !== 'string') throw new Error('Missing owned guest continuation');
    return v.parse(savedPolicy, JSON.parse(wire));
  };
  try {
    const environment = world.install(host, { restoring: false, emit: () => undefined }); environment.keeper.settle();
    host.events.answer('damage.modify', request => request?.target === host.player.health ? null : request, host.scope);
    host.player.position.set(-14, 0.1, -141); environment.encounter.summon();
    for (let i = 0; i < 600; i++) host.step();
    const body = host.entities.get('sunscar.matriarch'); if (body === undefined) throw new Error('Encounter did not spawn its body');
    expect(policy(host)).toMatchObject({ phase: 0, fighting: true });
    expect(body.position.y).toBeGreaterThan(4);
    for (const [fraction, phase] of [[0.6, 1], [0.3, 2]] as const) {
      body.hp = body.maxHp * fraction;
      for (let i = 0; i < 600; i++) host.step();
      expect(host.entities.get('sunscar.matriarch')).toBe(body);
      expect(policy(host)).toMatchObject({ phase, fighting: true });
      const binding = v.parse(logical, JSON.parse(policy(host).decision)).decision.bindings[0];
      expect(binding?.failures, JSON.stringify({phase,at:body.position,binding})).toBe(0); expect(binding?.slots['step']).toBeGreaterThanOrEqual(phase * 10);
    }
    // The native capsule keeps its existing one-metre clearance while the flight pose lies low.
    expect(body.position.y).toBeLessThan(2);
    const saved = snapshotSimHost(host);
    restored = restoreSimHost(world.level, { ...world.ports, rapier }, saved, fresh => {
      world.install(fresh, { restoring: true, emit: () => undefined, snapshot: saved }).keeper.settle();
    });
    restored.events.answer('damage.modify', request => request?.target === restored?.player.health ? null : request, restored.scope);
    expect(policy(restored)).toEqual(policy(host));
    for (let i = 0; i < 30; i++) { host.step(); restored.step(); }
    expect(policy(restored)).toEqual(policy(host));
    expect(environment.encounter.boss.onPlayerDeath()).toBe(true);
    for (let i = 0; i < 600; i++) host.step();
    expect(host.entities.get('sunscar.matriarch')).not.toBe(body);
    expect(policy(host)).toMatchObject({ phase: 2, fighting: true });
  } finally { restored?.dispose(); host.dispose(); }
}, 120_000);

test('a spawned decision catalogue needs no held impulse port', () => {
  const brains = speciesBrains(SIGNAL_SPECIES, SIGNAL_STRIKES, SIGNAL_MODULES);
  expect(() => brains.catalogue([MATRIARCH_DATA], { decisions: { bind: () => { throw new Error('Catalogue must not allocate a body'); } } })).not.toThrow();
});
