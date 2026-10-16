// oxlint-disable-next-line import/no-nodejs-modules -- The native proof reads the official immutable product.
import { readFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Standalone test invocation runs the official producer.
import { execFileSync } from 'node:child_process';
// oxlint-disable-next-line import/no-nodejs-modules -- Only the exact output receipt skips production.
import { env, execPath } from 'node:process';
import * as v from 'valibot';
import { beforeAll, expect, test } from 'vitest';
import { loadRapier } from '../src/engine/physics/rapier';
import { snapshotSimHost } from '../src/engine/sim/snapshot';
import { outputDescriptor } from '../src/game/shardfile/outputDescriptor';
import { loadHeadlessProduct } from '../src/sdk/headlessProduct';
import { createTrustedHeadlessResident } from '../src/sdk/headlessRuntime';

const policySchema = v.object({ phase: v.number(), fighting: v.boolean(), decision: v.string(), strike: v.object({ clock: v.number(), currentId: v.nullable(v.string()) }) });
const logicalSchema = v.object({ decision: v.object({ tick: v.number(), bindings: v.array(v.object({ slots: v.record(v.string(), v.union([v.number(), v.boolean()])), failures: v.number() })) }) });
beforeAll(() => {
  if (env['WS_TEST_PRODUCTS_SHA'] !== env['VERCEL_GIT_COMMIT_SHA'] || env['WS_TEST_PRODUCTS_SHA'] === undefined)
    execFileSync(execPath, ['scripts/build-shardfiles.mjs', '--reuse'], { stdio: 'inherit' });
}, 120_000);
test('the published Roc guest drives the retained native body through phases and logical restore', async () => {
  const product = await loadHeadlessProduct('out/far-reach');
  const rapier = await loadRapier(Uint8Array.from(readFileSync('public/assets/physics/rapier.wasm')));
  const descriptor = outputDescriptor(product.shardfile); if (descriptor === undefined) throw new Error('Missing admitted output');
  const assets = new Map(descriptor.index.files.map(file => [file.commons === true ? `commons:${file.hash}` : file.hash,
    Uint8Array.from(readFileSync(`out/far-reach/${file.path}`))]));
  const preparation = { product, shard: product.shardfile, assets, rapier };
  const resident = await createTrustedHeadlessResident(preparation);
  let resumed: Awaited<ReturnType<typeof createTrustedHeadlessResident>> | undefined;
  const policy = (owner: typeof resident) => {
    const slot = snapshotSimHost(owner.host).adapters.find(row => row.id === 'far.flock');
    const keeper = v.parse(v.object({ homes: v.array(v.object({ id: v.string(), policy: v.nullable(v.string()) })) }), slot?.state);
    const saved = keeper.homes.find(row => row.id === 'far.roc')?.policy;
    if (saved === undefined || saved === null) throw new Error('Roc must retain its original policy save slot');
    const wire: unknown = JSON.parse(saved); if (typeof wire !== 'string') throw new Error('Roc logical policy must be a string');
    return v.parse(policySchema, JSON.parse(wire));
  };
  try {
    const host = resident.host, body = host.entities.get('far.roc');
    if (body === undefined) throw new Error('Roc must use its admitted native body');
    host.events.answer('damage.modify', request => request?.target === host.player.health ? null : request, host.scope);
    host.player.position.set(0, 44.3, -184);
    for (let i = 0; i < 500; i++) resident.step([]);
    expect(host.entities.get('far.roc')).toBe(body); expect(policy(resident)).toMatchObject({ phase: 0, fighting: true });
    expect(body.mem['rocLean']).toBe(0);
    expect(v.parse(logicalSchema, JSON.parse(policy(resident).decision)).decision.bindings[0]?.failures).toBe(0);
    for (const [hp, phase] of [[0.6, 1], [0.3, 2]] as const) {
      body.hp = body.maxHp * hp;
      for (let i = 0; i < 360; i++) resident.step([]);
      expect(host.entities.get('far.roc')).toBe(body); expect(policy(resident)).toMatchObject({ phase, fighting: true });
      const logical = v.parse(logicalSchema, JSON.parse(policy(resident).decision));
      expect(logical.decision.bindings[0]?.failures).toBe(0);
      expect(logical.decision.bindings[0]?.slots['step']).toBeGreaterThanOrEqual(phase * 10);
    }
    const saved = snapshotSimHost(host), before = policy(resident);
    resumed = await createTrustedHeadlessResident(preparation, undefined, saved);
    expect(policy(resumed)).toEqual(before);
    expect(resumed.host.entities.size).toBe(host.entities.size);
    for (let i = 0; i < 30; i++) { resident.step([]); resumed.step([]); }
    expect(policy(resumed)).toEqual(policy(resident));
  } finally { resumed?.dispose(); resident.dispose(); }
}, 120_000);
