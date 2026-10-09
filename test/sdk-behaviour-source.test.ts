// oxlint-disable-next-line import/no-nodejs-modules -- The author source fixture is a committed text file.
import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import * as v from 'valibot';
import { compileScript } from '../src/sdk/compileScript';
import { compileBehaviourSource } from '../src/sdk/behaviourSource';
import { hashImmutableBytes } from '../src/sdk/immutable';
import { emptyShardfile } from '../src/sdk/author';
import { parseShardfile } from '../src/sdk/shardfile';
import { validateProject } from '../src/sdk/project';
import { HeadlessSimulation } from '../src/sdk/headless';

const source = readFileSync('test/fixtures/sdk-authored-world/door.as', 'utf8');
const behaviour = [{ id: 'door', source: 'behaviour/door.as', maximumPages: 2 }];
function declaration() {
  const shard = emptyShardfile({ slug: 'portable-behaviour', name: 'Portable behaviour', author: 'Wildshard', revision: 1, seed: 55 });
  return { ...shard, sim: { ...shard.sim, scripts: ['script:door'], scriptTickDivisor: 1, bindings: [{ module: 'script:door', entity: 1106943697, actorId: 'actor.player', kind: 'server' }] },
    state: { ...shard.state, shared: [{ id: 101, name: 'door.open', type: 'bool', privacy: 'public', default: false }] }, hooks: { conditions: [], scenes: [{ id: 'door.toggle', type: 201, value: 1 }] } };
}
it('keeps the existing compiler and structural metering byte identity', async () => {
  expect(hashImmutableBytes(await compileScript(source, { maximumPages: 2 }))).toBe('ecc886d8bbebcf190298ff9162b6bb364f2125606f5bdc8cc220ea28044f96ea');
});
it('compiles named server sources, resolves references and admits their exact memory costs', async () => {
  const compiled = await compileBehaviourSource(behaviour, declaration(), () => source), shard = parseShardfile(compiled.declaration);
  validateProject(shard, compiled.assets);
  expect(shard.sim.scripts).toEqual([...compiled.assets.keys()]); expect(shard.sim.bindings[0]?.module).toBe(shard.sim.scripts[0]);
  const wire = compiled.assets.values().next().value?.length ?? 0;
  expect(shard.budgets.sim).toEqual({ resident: wire + 2 * 65536 * 3, compressed: wire });
});
it('names compiler errors and refuses duplicate IDs, path traversal and unresolved references', async () => {
  await expect(compileBehaviourSource(behaviour, declaration(), () => 'broken nonsense')).rejects.toThrow('AssemblyScript door (behaviour/door.as)');
  await expect(compileBehaviourSource([...behaviour, ...behaviour], declaration(), () => source)).rejects.toThrow('unique');
  await expect(compileBehaviourSource([{ ...behaviour[0], source: '../door.as' }], declaration(), () => source)).rejects.toThrow('relative');
  await expect(compileBehaviourSource([], declaration(), () => source)).rejects.toThrow('Unknown authored script:door');
});
it('runs the compiled event-controlled door on the public plain-Node host', async () => {
  const compiled = await compileBehaviourSource(behaviour, declaration(), () => source), shard = parseShardfile(compiled.declaration);
  const host = await HeadlessSimulation.create(shard, compiled.assets, undefined, { deadline: 'advisory' });
  try {
    const shared = (snapshot: string): number => {
      const saved = v.parse(v.object({ snapshot: v.object({ adapters: v.array(v.object({ id: v.string(), state: v.unknown() })) }) }), JSON.parse(snapshot));
      const adapter = saved.snapshot.adapters.find(row => row.id === 'script.declared'); if (adapter === undefined) throw new Error('No script continuation');
      const numeric = v.parse(v.object({ world: v.object({ shared: v.array(v.number()) }) }), JSON.parse(v.parse(v.string(), adapter.state)));
      return numeric.world.shared[0] ?? -1;
    };
    expect(shared((await host.step()).snapshot)).toBe(0);
    for (const expected of [1, 0]) {
      let commit = await host.step([{ source: 'door', commands: [{ kind: 'event', type: 201, target: 1106943697, value: 1 }] }]);
      for (let tick = 0; tick < 3; tick++) commit = await host.step();
      expect(shared(commit.snapshot)).toBe(expected);
    }
  } finally { await host.dispose(); }
}, 30_000);
