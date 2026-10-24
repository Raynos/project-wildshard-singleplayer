import { nalatiEliteCore } from './fixtures/nalati-headless';
import {admissionNative,admission} from './fixtures/nalati-return-modules';
import { expect, test } from 'vitest';
import type { EliteCoreRule } from '../src/game/eliteSystem';
import { ReturnProgram } from '../src/game/population/returnProgram';
import { NativeEliteRoster, nativeEliteBindings } from '../src/engine/ai/eliteRoster';
import { nativeKernelOwners } from './fixtures/nativeEliteKernelOwners';
import { nativeEliteCore } from './fixtures/nativeEliteCore';


test('actual native condition rows reuse the original AS owner and preserve every phase/storm gate', () => {
  const state = { phase: 'day', storm: false }, reads: string[] = [], clock = { get dayPhase() { reads.push('phase'); return state.phase; } }, env = { get storm() { reads.push('storm'); return state.storm; } };
  for (const phase of ['dawn', 'day', 'golden', 'dusk', 'night', 'unobserved']) for (const storm of [false, true]) for (const rule of ['always', 'storm', 'night', 'dusk'] satisfies EliteCoreRule[]) {
    const f = nativeKernelOwners(), before = f.host.rng.snapshot(); state.phase = 'day'; state.storm = false; reads.length = 0;
    try {
      const program = admissionNative(f.host);
      const core = nalatiEliteCore(f.host,clock,env,ReturnProgram.native(f.host,admission));
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
