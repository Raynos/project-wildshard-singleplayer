import * as v from 'valibot';
import { Vector3 } from 'three';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { PhaseEncounter, silentBossPresentation } from '../../src/engine/ai/phases';
import type { BossSaved } from '../../src/engine/ai/BossBrain';
import { createSimHost } from '../../src/engine/sim';
import { snapshotSimHost, restoreSimHost } from '../../src/engine/sim/snapshot';
import { loadRapier } from '../../src/engine/physics/rapier';
import wasmInline from '@dimforge/rapier3d-simd/rapier_wasm3d_bg.wasm?inline';
import { SIM_LEVEL } from '../fixtures/sim-level/level';
import { EncountersSchema, encounterRules } from '../../src/game/shardfile/encounters';
import { installDeclaredEncounters } from '../../src/game/shard/declaredEncounters';
import { ENCOUNTERS } from '../../src/shards/_template/data/encounters';
import { CREATURES } from '../../src/shards/_template/data/creatures';
import { CreaturesSchema } from '../../src/game/shardfile/creatures';
import { expectSameSimSnapshot } from '../fake/simSnapshot';

const authored = v.parse(EncountersSchema, ENCOUNTERS);
let rapier: Awaited<ReturnType<typeof loadRapier>>;
beforeAll(async () => { rapier = await loadRapier(await (await fetch(wasmInline)).arrayBuffer()); });
function fixture(which: number) {
  const source = SIM_LEVEL.entities[0]; if (!source) throw new Error('Missing fixture actor');
  const row = authored[which]; if (!row) throw new Error('Missing encounter');
  const spec = { ...row, arena: { at: [0, 0, 0] as const, radius: 8 }, respawn: { at: [0, 0, 0] as const, yaw: 0 } };
  const level = { ...SIM_LEVEL, quests: [], entities: [{ ...source, id: spec.entity, at: { x: 0, y: 0, z: 1.6 } }] };
  return { spec, level };
}
function damage(sim: ReturnType<typeof createSimHost>, id: string, amount: number) {
  const actor = sim.entities.get(id); if (!actor) throw new Error('Missing target');
  return sim.combat.hit({ source: sim.player.health, sourceTags: ['dmg.melee', 'cover.checked'], target: actor.combatActor(), amount, point: actor.position, dir: new Vector3(0, 0, 1), from: sim.player.position });
}
function ticks(sim: ReturnType<typeof createSimHost>, n: number): void { for (let i = 0; i < n; i++) sim.step(); }
describe('data-driven elite and boss phase encounters', () => {
  it('preserves durable reward facts across a fresh host and refuses changed phase continuations', () => {
    const { spec, level } = fixture(1), sim = createSimHost(level, { rapier });
    const persist = vi.fn<(saved: BossSaved) => void>(), reward = vi.fn<() => void>();
    const encounter = new PhaseEncounter(sim, spec, { saved: { defeated: true, rewardTaken: true, kills: 3 }, persist, reward });
    try {
      ticks(sim, 16); damage(sim, spec.entity, 1000); ticks(sim, 92); damage(sim, spec.entity, 1000); sim.step();
      expect(encounter.boss.state).toBe('victory'); expect(reward).not.toHaveBeenCalled();
      expect(persist).toHaveBeenCalledExactlyOnceWith({ defeated: true, rewardTaken: true, kills: 4 });
      const checkpoint = encounter.snapshot(); encounter.restore(checkpoint); expect(reward).not.toHaveBeenCalled();
      const changed = createSimHost(level, { rapier });
      try {
        const other = new PhaseEncounter(changed, { ...spec, intro: 2 }, { saved: { defeated: false, rewardTaken: false, kills: 0 }, persist, reward });
        expect(() => other.restore(checkpoint)).toThrow('Incompatible');
        expect(() => encounter.boss.restore({ ...encounter.boss.snapshot(), phase: 10 })).toThrow('continuation');
      } finally { changed.dispose(); }
    } finally { sim.dispose(); }
  });
  it('fights, clamps a huge hit to the checkpoint, shields the beat, dies, retries and wins once', () => {
    const { spec, level } = fixture(1), sim = createSimHost(level, { rapier }), persist = vi.fn<(saved: BossSaved) => void>(), reward = vi.fn<() => void>();
    const encounter = new PhaseEncounter(sim, spec, { saved: { defeated: false, rewardTaken: false, kills: 0 }, persist, reward });
    try {
      expect(damage(sim, spec.entity, 1000)).toBeNull(); ticks(sim, 62); expect(encounter.boss.state).toBe('fight');
      damage(sim, spec.entity, 1000); expect(sim.entities.get(spec.entity)?.hp).toBe(50); sim.step();
      expect(encounter.boss.phase).toBe(1); expect(encounter.boss.checkpoint).toBe(1); expect(encounter.boss.state).toBe('beat');
      expect(damage(sim, spec.entity, 10)).toBeNull();
      sim.combat.hit({ source: 'env', sourceTags: ['dmg.melee', 'cover.checked'], target: sim.player.health, amount: 1000, point: sim.player.position, dir: new Vector3(), from: sim.player.position });
      sim.step(); expect(encounter.boss.attempts).toBe(2); expect(sim.entities.get(spec.entity)?.hp).toBe(50); expect(sim.player.health.alive).toBe(true);
      ticks(sim, 16); expect(encounter.boss.state).toBe('fight'); expect(encounter.boss.phase).toBe(1);
      damage(sim, spec.entity, 1000); sim.step(); expect(encounter.boss.state).toBe('victory'); expect(persist).toHaveBeenCalledWith({ defeated: true, rewardTaken: false, kills: 1 }); expect(reward).toHaveBeenCalledTimes(1);
      ticks(sim, 120); expect(reward).toHaveBeenCalledTimes(1); expect(persist).toHaveBeenCalledTimes(1);
    } finally { sim.dispose(); }
  });
  it('runs the template elite from the same one-phase table and its declared death/victory hooks', () => {
    const { spec, level } = fixture(0), sim = createSimHost(level, { rapier }), persist = vi.fn<(saved: BossSaved) => void>(), reward = vi.fn<() => void>();
    const encounters = installDeclaredEncounters(sim, [spec], () => ({ saved: { defeated: false, rewardTaken: false, kills: 0 }, persist, reward }));
    try {
      ticks(sim, 2); expect(encounters.get(spec.id)?.boss.state).toBe('fight');
      damage(sim, spec.entity, 1000); sim.step(); expect(encounters.get(spec.id)?.boss.defeated).toBe(true); expect(persist).toHaveBeenCalledTimes(1);
    } finally { sim.dispose(); }
  });
  it('restores a pending phase beat/checkpoint/actor continuation without replaying grants or persistence', () => {
    const { spec, level } = fixture(1), sim = createSimHost(level, { rapier }), persist = vi.fn<(saved: BossSaved) => void>(), reward = vi.fn<() => void>();
    const ports = () => ({ saved: { defeated: false, rewardTaken: false, kills: 0 }, persist, reward });
    installDeclaredEncounters(sim, [spec], ports);
    let fresh: ReturnType<typeof createSimHost> | undefined;
    try {
      ticks(sim, 62); damage(sim, spec.entity, 1000); ticks(sim, 20); const saved = snapshotSimHost(sim);
      fresh = restoreSimHost(level, { rapier }, structuredClone(saved), (host) => { installDeclaredEncounters(host, [spec], ports); });
      ticks(sim, 100); ticks(fresh, 100); expectSameSimSnapshot(snapshotSimHost(fresh), snapshotSimHost(sim));
      expect(persist).not.toHaveBeenCalled(); expect(reward).not.toHaveBeenCalled();
    } finally { sim.dispose(); fresh?.dispose(); }
  });
  it('requires matching declared panels and rejects malformed or unresolved phase data', () => {
    const creatures = v.parse(CreaturesSchema, CREATURES);
    expect(encounterRules(authored, creatures.spawns.map((s) => s.id), [{ id: 'big-blob-panel', encounter: 'template.boss' }])).toEqual([]);
    expect(creatures.spawns.filter((s) => s.brain === null).map((s) => s.id)).toEqual(['greyback', 'big-blob']);
    expect(encounterRules(authored, ['greyback', 'big-blob'], [{ id: 'big-blob-panel', encounter: 'template.boss' }])).toEqual([]);
    expect(encounterRules(authored, [], [])).toContain('declared encounter actor');
    const { spec, level } = fixture(1), sim = createSimHost(level, { rapier });
    try {
      expect(() => installDeclaredEncounters(sim, [spec], () => ({ saved: { defeated: false, rewardTaken: false, kills: 0 }, persist: () => undefined, reward: () => undefined }), { bosses: new Map() })).toThrow('panel');
      const presentation = silentBossPresentation(), handles = { bosses: new Map([[spec.id, { presentation, definition: { name: spec.name, title: spec.title, retryTitle: spec.retry } }]]) };
      installDeclaredEncounters(sim, [spec], () => ({ saved: { defeated: false, rewardTaken: false, kills: 0 }, persist: () => undefined, reward: () => undefined }), handles);
      ticks(sim, 62); expect(presentation.barShown).toBe(true);
    } finally { sim.dispose(); }
    expect(() => v.parse(EncountersSchema, [{ ...spec, phases: [{ ...spec.phases[0], at: 0.5 }] }])).toThrow();
    expect(() => v.parse(EncountersSchema, [...authored, ...authored])).toThrow();
  });
});
