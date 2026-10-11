import { beforeAll, expect, it } from 'vitest';
import { directorDataHostIssues, parseDirectorStages } from '@wildshard/format/directorStages';
import { Director } from '../src/sdk/director';
import { beaconRequestExample } from '../scripts/docs/authoring/directors';
import { emptyShardfile } from '../src/sdk/author';
import { createShardfileSim } from '../src/game/plugin/simulation';
import { loadRapier, type Rapier } from '../src/engine/physics/rapier';
import wasmInline from '@dimforge/rapier3d-simd/rapier_wasm3d_bg.wasm?inline';

let rapier: Rapier;
beforeAll(async () => { rapier = await loadRapier(await (await fetch(wasmInline)).arrayBuffer()); });
it('executes the published flag handoff through the real data-only host and quest owner', () => {
  const example = beaconRequestExample(), base = emptyShardfile({ slug: 'outpost', name: 'Outpost', author: 'Fixture', revision: 1, seed: 1 });
  expect(example.unsupported).toEqual([]);
  const facts: { name: string; entity: string }[] = [];
  const sim = createShardfileSim({ ...base, look: { ...base.look, dayOverride: 0.8 }, quests: example.quests, directors: [example.director] }, new Map(), { rapier, quest: { fact: (name, entity) => { facts.push({ name, entity }); } } });
  try {
    sim.host.step(); expect(sim.host.flags.has('outpost.beacon-request')).toBe(false);
    sim.host.step(); expect(sim.host.flags.has('outpost.beacon-request')).toBe(true);
    sim.host.step(); expect(sim.host.flags.has('outpost.beacon-complete')).toBe(true);
    expect(facts.filter(fact => fact.name === 'outpost.beacon-lit')).toHaveLength(1);
    sim.host.step(); expect(facts.filter(fact => fact.name === 'outpost.beacon-lit')).toHaveLength(1);
  } finally { sim.dispose(); }
});
it.each([{ spawn: 'actor' }, { despawn: 'actor' }, { score: 'music' }, { weather: 'rain' }, { toast: 'notice' }, { reward: 'coins' }, { emit: 'script.request', value: 1 }])('diagnoses admitted native-only actions without inventing a host: %o', action => {
  const data = parseDirectorStages({ version: 2, id: 'fixture', inputs: {}, stages: [{ id: 'start', do: [action] }] });
  expect(directorDataHostIssues(data)).toHaveLength(1);
  const base = emptyShardfile({ slug: 'fixture', name: 'Fixture', author: 'Fixture', revision: 1, seed: 1 });
  expect(() => createShardfileSim({ ...base, directors: [data] }, new Map(), { rapier })).toThrow('requires a native action owner');
  if ('emit' in action) expect(directorDataHostIssues(data)[0]).toContain('does not deliver an AssemblyScript input');
});
it('reports native observation and typed script requirements while retaining defining admission', () => {
  const director = new Director({ id: 'fixture', inputs: { dead: 'actor:boss.dead', here: 'zone:arena', event: 'event:start' }, script: 'a'.repeat(64), stages: [{ id: 'start' }] });
  expect(director.dataHostIssues()).toHaveLength(4); expect(director.toJSON().script).toBe('a'.repeat(64));
});
