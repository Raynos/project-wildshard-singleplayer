import * as v from 'valibot';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { PlatformBrain, buildPlatformSpawns, installPlatformBrains, type BrainNavigation, type PlatformBrainSpec, type PlatformSpawn } from '../../src/engine/ai/platform';
import { createSimHost } from '../../src/engine/sim';
import { snapshotSimHost, restoreSimHost } from '../../src/engine/sim/snapshot';
import { loadRapier } from '../../src/engine/physics/rapier';
import wasmInline from '@dimforge/rapier3d-simd/rapier_wasm3d_bg.wasm?inline';
import { SIM_LEVEL } from '../fixtures/sim-level/level';
import { CreaturesSchema } from '../../src/game/shardfile/creatures';
import { CREATURES } from '../../src/shards/_template/data/creatures';

const brain: PlatformBrainSpec = { id: 'pursuit', kind: 'pursue', awareRadius: 12, leashRadius: 20, speed: 2, returnSpeed: 3, stopDistance: 1.7, turnRate: 6, thinkDivisor: 3, attackCooldownTicks: 60, wanderRadius: 4, wanderEveryTicks: 420 };
const rows: PlatformSpawn[] = [{ id: 'boar:1', species: 'boar', variant: 'boar', brain: 'pursuit', strike: 'boar.charge', seed: 7, scale: 1, at: [0, 0, 5], yaw: Math.PI }];
const original = SIM_LEVEL.entities[0]; if (!original?.strike) throw new Error('Missing fixture species/strike');
const species = new Map([['boar', original.spec]]), strikes = new Map([['boar.charge', original.strike]]);
const level = { ...SIM_LEVEL, entities: buildPlatformSpawns(rows, species, strikes) };
let rapier: Awaited<ReturnType<typeof loadRapier>>;
beforeAll(async () => { rapier = await loadRapier(await (await fetch(wasmInline)).arrayBuffer()); });
describe('declared platform creature brain and spawner', () => {
  it('expands stable data spawns then perceives, navigates and attacks through the real fixed-step sim', () => {
    const sim = createSimHost(level, { rapier }), navigation = vi.fn<BrainNavigation>((_from, to) => [to]), brains = installPlatformBrains(sim, rows, [brain], navigation);
    try {
      for (let i = 0; i < 300; i++) sim.step();
      expect(navigation).toHaveBeenCalled(); expect(sim.entities.get('boar:1')?.position.z).toBeLessThan(3);
      expect(sim.player.health.attributes.health).toBeLessThan(sim.player.health.attributes.maxHealth); expect(brains.get('boar:1')?.mode).toBe('attack');
      expect(sim.adapters.has('brain.boar:1')).toBe(true);
    } finally { sim.dispose(); }
    expect(sim.adapters.size).toBe(0);
  });
  it('blocks hidden targets, stops on missing paths and returns home when a target exceeds its leash', () => {
    const sim = createSimHost(level, { rapier }), actor = sim.entities.get('boar:1'); if (!actor) throw new Error('Missing actor');
    const target = { id: 'target', alive: true, position: { x: 0, y: 0, z: 0 } }, attack = vi.fn(); let visible = false;
    const ports = { targets: () => [target], visible: () => visible, path: vi.fn(() => []), attack, random: () => 0.5 };
    const policy = new PlatformBrain(actor, { ...brain, wanderRadius: 0 }, { x: 0, y: 0, z: 5 }, ports);
    try {
      policy.step(3); expect(policy.mode).toBe('idle'); expect(attack).not.toHaveBeenCalled();
      visible = true; policy.step(6); expect(policy.mode).toBe('pursue'); expect(actor.desiredSpeed).toBe(0); expect(ports.path).toHaveBeenCalled();
      target.position.z = 100; actor.position.x = 4; policy.step(9); expect(policy.mode).toBe('return');
      actor.alive = false; policy.step(10); expect(policy.mode).toBe('dead'); expect(actor.desiredSpeed).toBe(0);
    } finally { sim.dispose(); }
  });
  it('restores brain/RNG/motor/strike continuations then produces the same same-engine suffix', () => {
    const sim = createSimHost(level, { rapier }); installPlatformBrains(sim, rows, [brain]);
    let fresh: ReturnType<typeof createSimHost> | undefined;
    try {
      for (let i = 0; i < 91; i++) sim.step();
      const saved = snapshotSimHost(sim); fresh = restoreSimHost(level, { rapier }, structuredClone(saved), (host) => { installPlatformBrains(host, rows, [brain]); });
      for (let i = 0; i < 90; i++) { sim.step(); fresh.step(); }
      expect(snapshotSimHost(fresh)).toEqual(snapshotSimHost(sim));
    } finally { sim.dispose(); fresh?.dispose(); }
  });
  it('validates the template spawn as pure data and refuses unresolved or duplicate references', () => {
    expect(v.parse(CreaturesSchema, CREATURES).spawns[0]?.at).toEqual([0, 0, -19]);
    expect(() => v.parse(CreaturesSchema, { brains: [brain], spawns: [{ ...rows[0], brain: 'missing' }] })).toThrow();
    expect(() => buildPlatformSpawns([...rows, ...rows], species, strikes)).toThrow('identity');
    expect(() => buildPlatformSpawns(rows, new Map(), strikes)).toThrow();
    expect(() => buildPlatformSpawns(rows, species, new Map())).toThrow('strike');
    expect(() => v.parse(CreaturesSchema, { brains: [{ ...brain, thinkDivisor: 7 }], spawns: rows })).toThrow();
  });
});
