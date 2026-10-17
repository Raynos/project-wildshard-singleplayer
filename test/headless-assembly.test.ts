// oxlint-disable-next-line import/no-nodejs-modules -- The unit host uses the same native physics module as the resident.
import { readFileSync } from 'node:fs';
import { beforeAll, expect, test } from 'vitest';
import { checkedHeadlessAssembly, prepareHeadlessAssembly } from '../src/sdk/headlessAssembly';
import { emptyShardfile } from '../src/sdk/author';
import { createShardProduct } from '../src/game/shardfile/shardProduct';
import { createSimHost } from '../src/engine/sim';
import { loadRapier, type Rapier } from '../src/engine/physics/rapier';

const ref = (...path: readonly (string | number)[]) => ({ $ref: path });
const base = { version: 1, modules: {}, constants: {}, prepare: [], install: [],
  level: { speed: 5, lift: .1, ground: { size: 500, height: 0 } },
  ports: { ground: false, heightAt: { $fn: 0 } }, entries: { $fn: { lanes: 2, steps: 3 } } };
let rapier: Rapier;
beforeAll(async () => { rapier = await loadRapier(readFileSync('public/assets/physics/rapier.wasm')); });

test('retains static receivers, late owners, call order and independent restore bindings', async () => {
  const order: string[] = [], readers: (() => number)[] = [], sources: object[] = [];
  class Owner {
    readonly lanes = 2;
    static identity = 'first';
    static create(read: () => number, source: object): void { order.push(this.identity); readers.push(read); sources.push(source); }
  }
  const module = { Owner, later: (): { value: number } => { order.push('later'); return { value: readers.length }; } };
  const declaration = { ...base, modules: { 'src/game/assemblyFixture': ['Owner', 'later'] },
    prepare: [{ name: 'constructed', value: { $new: [ref('src/game/assemblyFixture', 'Owner')] } }],
    entries: { $fn: { lanes: ref('constructed', 'lanes'), steps: 3 } }, install: [
    { name: 'first', value: { $call: [ref('src/game/assemblyFixture', 'Owner', 'create'), { $fn: ref('later', 'value') }, ref('shard')] } },
    { name: 'later', value: { $call: [ref('src/game/assemblyFixture', 'later')] } },
  ] };
  const shard = emptyShardfile({ slug: 'assembly', name: 'Assembly', author: 'Test', revision: 1, seed: 1 });
  const product = createShardProduct({ slug: 'assembly', revision: 1, shardfile: shard, sections: new Map(),
    files: new Map([['sim/headless-assembly.json', { hash: 'assembly', url: 'assembly' }]]),
    read: () => Promise.resolve(new TextEncoder().encode(JSON.stringify(declaration))) });
  const plan = await prepareHeadlessAssembly({ shard: structuredClone(shard), product, assets: new Map(), rapier }, { 'src/game/assemblyFixture': module });
  const first = createSimHost(plan.level, { ...plan.ports, rapier }), restored = createSimHost(plan.level, { ...plan.ports, rapier });
  try {
    plan.install(first, { restoring: false, commands: () => [], emit: () => undefined });
    plan.install(restored, { restoring: true, commands: () => [], emit: () => undefined });
    expect(order).toEqual(['first', 'later', 'first', 'later']);
    expect(readers.map(read => read())).toEqual([1, 2]);
    for (const source of sources) expect(source).toBe(shard);
    expect(plan.proveEntries?.(first)).toEqual({ lanes: 2, steps: 3 });
  } finally { first.dispose(); restored.dispose(); }
});

test('refuses undeclared code, prototype traversal and binding collisions before installation', () => {
  const modules = { 'src/game/assemblyFixture': { install: (): void => undefined } };
  const declaration = { ...base, modules: { 'src/game/assemblyFixture': ['install'] } };
  expect(() => checkedHeadlessAssembly(declaration, modules)).not.toThrow();
  expect(() => checkedHeadlessAssembly({ ...declaration, modules: { 'https://example.com/code': [] } }, modules)).toThrow();
  expect(() => checkedHeadlessAssembly({ ...declaration, modules: { 'src/game/assemblyFixture': ['missing'] } }, modules)).toThrow();
  for (const path of [['src/game/assemblyFixture', 'missing'], ['host', '__proto__'], ['host', 'constructor', 'constructor']])
    expect(() => checkedHeadlessAssembly({ ...declaration, entries: ref(...path) }, modules)).toThrow();
  expect(() => checkedHeadlessAssembly({ ...declaration, install: [{ name: 'host', value: null }] }, modules)).toThrow('conflicts');
  expect(() => checkedHeadlessAssembly({ ...declaration, entries: { $eval: 'source' } }, modules)).toThrow();
});
