import {admissionNative,admission} from './fixtures/nalati-return-modules';
import { expect, test } from 'vitest';
import { checkedHeadlessAssembly, prepareHeadlessAssembly } from '../src/sdk/headlessAssembly';
import { emptyShardfile } from '../src/sdk/author';
import { createShardProduct } from '../src/game/shardfile/shardProduct';
import { EliteCore, memoryElitePersistence, type EliteCoreScript, type EliteCoreRule } from '../src/game/eliteSystem';
import { ReturnProgram } from '../src/game/population/returnProgram';
import { NativeEliteRoster, nativeEliteBindings } from '../src/engine/ai/eliteRoster';
import type { AnimalSim } from '../src/engine/entities/AnimalSim';
import type { Rapier } from '../src/engine/physics/rapier';
import { legacyDouble } from './fake/FakeGame';
import { nativeKernelOwners } from './fixtures/nativeEliteKernelOwners';
import { nativeEliteCore } from './fixtures/nativeEliteCore';
import assembly from '../src/shards/nalati-grasslands/data/headlessAssembly.json' with { type: 'json' };

const ref = (...path: readonly (string | number)[]) => ({ $ref: path });

test('actual native condition rows reuse the original AS owner and preserve every phase/storm gate', async () => {
  const state = { phase: 'day', storm: false }, reads: string[] = [], clock = { get dayPhase() { reads.push('phase'); return state.phase; } }, env = { get storm() { reads.push('storm'); return state.storm; } }, captured: EliteCore<EliteCoreScript<AnimalSim>>[] = [];
  const module = { clock, env, boot: { admission }, capture: (core: EliteCore<EliteCoreScript<AnimalSim>>) => { captured.push(core); } };
  const names = new Set(['eliteRuleProgram', 'eliteRuleCodes', 'elitePhaseCodes', 'eliteStormCodes', 'eliteCore']);
  const declaration = { version: 1, modules: {
    '@wildshard/game/eliteSystem': ['EliteCore', 'memoryElitePersistence'],
    '@wildshard/game/population/returnProgram': ['ReturnProgram'], 'src/game/conditionFixture': ['clock', 'env', 'boot', 'capture'],
  }, constants: {}, prepare: [], install: [
    ...['clock', 'env', 'boot'].map(name => ({ name, value: ref('src/game/conditionFixture', name) })),
    ...assembly.install.filter(row => names.has(row.name)),
    { name: 'capture', value: { $call: [ref('src/game/conditionFixture', 'capture'), ref('eliteCore')] } },
  ], level: { speed: 5, lift: .1, ground: { size: 500, height: 0 } }, ports: { ground: false, heightAt: { $fn: 0 } }, entries: { $fn: { lanes: 0, steps: 0 } } };
  const modules = { '@wildshard/game/eliteSystem': { EliteCore, memoryElitePersistence }, '@wildshard/game/population/returnProgram': { ReturnProgram }, 'src/game/conditionFixture': module };
  expect(checkedHeadlessAssembly(declaration, modules).install).toHaveLength(9);
  const shard = emptyShardfile({ slug: 'quarry', name: 'Quarry', author: 'Test', revision: 1, seed: 1 });
  const product = createShardProduct({ slug: 'quarry', revision: 1, shardfile: shard, sections: new Map(),
    files: new Map([['sim/headless-assembly.json', { hash: 'rows', url: 'rows' }]]), read: () => Promise.resolve(new TextEncoder().encode(JSON.stringify(declaration))) });
  const plan = await prepareHeadlessAssembly({ shard, product, assets: new Map(), rapier: legacyDouble<Rapier>({}) }, modules);
  for (const phase of ['dawn', 'day', 'golden', 'dusk', 'night', 'unobserved']) for (const storm of [false, true]) for (const rule of ['always', 'storm', 'night', 'dusk'] satisfies EliteCoreRule[]) {
    const f = nativeKernelOwners(), before = f.host.rng.snapshot(); state.phase = 'day'; state.storm = false; reads.length = 0;
    try {
      const program = admissionNative(f.host);
      plan.install(f.host, { restoring: false, commands: () => [], emit: () => undefined });
      const core = captured.pop(); if (core === undefined) throw new Error('Missing actual declared core');
      expect(core.player).toBe(f.host.player); expect(reads).toEqual([]);
      state.phase = phase; state.storm = storm;
      {
        let spawns = 0;
        core.add({ def: { id: rule, rule, lair: { x: 0, z: 0, r: 1 }, awareR: 2, engageR: 1, leashR: 10, respawnMin: 1 }, animal: null,
          spawn: () => { spawns++; }, despawn: () => undefined, tick: () => undefined, enterPhase2: () => undefined, reset: () => undefined, trophy: () => undefined });
        core.initialize();
        const accepted = rule === 'always' || (rule === 'storm' ? storm : rule === 'night' ? phase === 'night' : phase === 'dusk' || phase === 'night');
        expect(spawns).toBe(Number(accepted));
        expect(reads).toEqual(rule === 'always' ? [] : rule === 'storm' ? ['phase', 'storm'] : ['phase']);
      }
      expect(admissionNative(f.host)).toBe(program); expect(f.host.rng.snapshot()).toEqual(before);
      expect(core.snapshot().clocks).toEqual({ saveT: 0, lastDusk: false });
    } finally { f.scope.dispose(); }
  }
});

test('foreign player and populated core loans refuse before native registration', () => {
  for (const kind of ['player', 'populated']) {
    const f = nativeKernelOwners(), other = nativeKernelOwners();
    try {
      const core = nativeEliteCore(kind === 'player' ? other.host : f.host);
      if (kind === 'populated') core.add({ def: { id: 'existing', rule: 'always', lair: { x: 0, z: 0, r: 1 }, awareR: 2, engageR: 1, leashR: 3, respawnMin: 1 }, animal: null, spawn: () => undefined, despawn: () => undefined, tick: () => undefined, enterPhase2: () => undefined, reset: () => undefined, trophy: () => undefined });
      expect(() => new NativeEliteRoster({ step: 'quarry.elites', version: 1, wire: {}, roles: ['borrowed'], kernels: [], rows: [{
        def: { id: 'quarry.borrowed', rule: 'always', lair: { x: 0, z: 0, r: 1 }, awareR: 2, engageR: 1, leashR: 3, respawnMin: 1 },
        snapshot: 'borrowed', member: { kind: 'guardian', variant: 'guard' },
      }] }, { host: f.host, core, bindings: nativeEliteBindings() })).toThrow('Invalid elite roster owners');
      expect(f.loans.brains.size).toBe(0); expect(f.hit).not.toHaveBeenCalled();
    } finally { f.scope.dispose(); other.scope.dispose(); }
  }
});
