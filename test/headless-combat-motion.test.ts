// oxlint-disable-next-line import/no-nodejs-modules -- Exercise the shipped native physics owner.
import { readFileSync } from 'node:fs';
import { beforeAll, expect, test } from 'vitest';
import { checkedHeadlessAssembly, prepareHeadlessAssembly } from '../src/sdk/headlessAssembly';
import { emptyShardfile } from '../src/sdk/author';
import { createShardProduct } from '../src/game/shardfile/shardProduct';
import { createSimHost, type SimPlayerMotionSample } from '../src/engine/sim';
import { snapshotSimHost } from '../src/engine/sim/snapshot';
import { loadRapier, type Rapier } from '../src/engine/physics/rapier';
import { createNativeCombatFrame, installNativeItems } from '../src/game/plugin/nativeItems';
import { HEADLESS_ASSEMBLY_JSON_SCHEMA } from '../src/format/namedJsonContracts';
import { validateNamedJsonSchema } from '../src/game/shardfile/customSchema';
import { parseItems } from '../src/format/items';
import items from '../src/shards/pine-hollow/data/items.generated.json' with { type: 'json' };
import { SIM_LEVEL } from './fixtures/sim-level/level';

const native = { $native: { kind: 'combat.motion', speed: 7.2 } };
const base = { version: 1, modules: {}, constants: {}, prepare: [], install: [{ name: 'motion', value: native }],
  level: { speed: 5, lift: .1, ground: { size: 500, height: 0 } },
  ports: { ground: false, heightAt: { $fn: 0 } }, entries: { $fn: { lanes: 2, steps: 3 } } };
let rapier: Rapier;
beforeAll(async () => { rapier = await loadRapier(readFileSync('public/assets/physics/rapier.wasm')); });
function plan() {
  const shard = emptyShardfile({ slug: 'combat-motion', name: 'Motion', author: 'Test', revision: 1, seed: 1 });
  const product = createShardProduct({ slug: shard.identity.slug, revision: 1, shardfile: shard, sections: new Map(),
    files: new Map([['sim/headless-assembly.json', { hash: 'assembly', url: 'assembly' }]]),
    read: () => Promise.resolve(new TextEncoder().encode(JSON.stringify(base))) });
  return prepareHeadlessAssembly({ shard, product, assets: new Map(), rapier }, {});
}

test('motion is one strict positive-speed installation, never a nested expression or owner selector', () => {
  const encode = (value: unknown): Uint8Array => new TextEncoder().encode(JSON.stringify(value));
  expect(checkedHeadlessAssembly(base, {}).install).toEqual(base.install);
  expect(validateNamedJsonSchema(HEADLESS_ASSEMBLY_JSON_SCHEMA, encode(base))).toEqual(base);
  const badRows = [
    ...[0, -1, Infinity, Number.NaN, '7.2'].map(speed => ({ $native: { kind: 'combat.motion', speed } })),
    { $native: { kind: 'combat.motion', speed: 7.2, owner: 'combat' } },
    { $native: { kind: 'combat.motion' } }, { $native: 'combat.motion', speed: 7.2 },
    { nested: native }, { $fn: native },
  ];
  for (const value of badRows) {
    const source = { ...base, install: [{ name: 'motion', value }] };
    expect(() => checkedHeadlessAssembly(source, {})).toThrow();
    expect(() => validateNamedJsonSchema(HEADLESS_ASSEMBLY_JSON_SCHEMA, encode(source))).toThrow();
  }
  for (const source of [
    { ...base, prepare: base.install, install: [] }, { ...base, constants: { hidden: native } },
    { ...base, install: [...base.install, { name: 'second', value: native }] },
  ]) expect(() => checkedHeadlessAssembly(source, {})).toThrow();
});

test('the concrete frame receives the original motion factor before gameplay and adds no saved owner', async () => {
  const prepared = await plan(), host = createSimHost(prepared.level, { rapier }), frame = createNativeCombatFrame();
  const context = { combat: frame, restoring: false, commands: () => [], emit: () => undefined };
  const sample = { velocityX: 3, velocityZ: 4, grounded: true, swimming: false, hover: false };
  try {
    const saved = snapshotSimHost(host);
    prepared.install(host, context);
    expect(snapshotSimHost(host)).toEqual(saved);
    host.usePlayerDriver({ input: () => true, step: () => undefined, motionSample: () => sample });
    const observed: (number | null)[] = [];
    host.onStep('motion.read', () => { observed.push(frame.speedFactor); });
    const states: SimPlayerMotionSample[] = [sample,
      { ...sample, hover: true }, { ...sample, grounded: false }, { ...sample, grounded: false, swimming: true }];
    for (const value of states) { Object.assign(sample, value); host.step(); }
    expect(observed).toEqual([5 / 7.2, 0, 0, 5 / 7.2]);
    expect(() => prepared.install(host, context)).toThrow('one owned active host');
  } finally { host.dispose(); }
  expect(() => prepared.install(host, context)).toThrow('owner has ended');
});

test('missing combat refuses before registering; delegated motion without a sample still refuses firing', async () => {
  const prepared = await plan(), host = createSimHost(SIM_LEVEL, { rapier }), frame = createNativeCombatFrame();
  try {
    const saved = snapshotSimHost(host);
    expect(() => prepared.install(host, { restoring: false, commands: () => [], emit: () => undefined })).toThrow('requires its combat frame');
    expect(snapshotSimHost(host)).toEqual(saved);
    prepared.install(host, { combat: frame, restoring: false, commands: () => [], emit: () => undefined });
    host.usePlayerDriver({ input: () => true, step: () => undefined });
    host.step(); expect(frame.speedFactor).toBeNull();
    const weapon = parseItems(items).rows.find(row => row.id === 'weapon.lever');
    if (weapon?.kind !== 'weapon' || weapon.ranged === undefined || weapon.profile === undefined) throw new Error('Missing fixture lever');
    installNativeItems(host, frame, { kind: 'cycle', policy: weapon.ranged, profile: weapon.profile });
    const hp = host.entities.get('boar:1')?.hp;
    frame.live.add(weapon.ranged.slot); frame.attacks.push('boar:1');
    expect(() => host.step()).toThrow('authoritative player sample');
    expect(host.entities.get('boar:1')?.hp).toBe(hp);
  } finally { host.dispose(); }
});
