// oxlint-disable-next-line import/no-nodejs-modules -- Retained AssemblyScript is the author fixture, never a runtime injection.
import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import * as v from 'valibot';
import { emptyShardfile } from '../src/sdk/author';
import { parseShardfile } from '../src/sdk/shardfile';
import { compileBehaviourSource } from '../src/sdk/behaviourSource';
import { HeadlessSimulation, proveSceneClient } from '../src/sdk/headless';

async function product(wall = false) {
  const base = emptyShardfile({ slug: 'scene-proof', name: 'Scene proof', author: 'SDK', revision: 1, seed: 1 });
  const compiled = await compileBehaviourSource([{ id: 'door', source: 'behaviour/door.as', maximumPages: 2 }], {
    ...base, state: { ...base.state, shared: [{ id: 101, name: 'door.open', type: 'bool', privacy: 'public', default: false }] },
    sim: { ...base.sim, scriptTickDivisor: 1, scripts: ['script:door'], bindings: [{ module: 'script:door', entity: 1106943697, actorId: 'actor.player', kind: 'server' }] },
    hooks: { conditions: [], scenes: [{ id: 'door.toggle', type: 201, value: 1 }] },
    targets: { panels: [], interactions: [
      { id: 'beacon', at: [0, 1.68, 1], radius: 3, label: 'BEACON', scene: 'door.toggle' },
      { id: 'farther', at: [0, 1.68, 2], radius: 3, label: 'FARTHER', scene: 'door.toggle' },
      { id: 'distant', at: [0, 1.68, 100], radius: 3, label: 'DISTANT', scene: 'door.toggle' },
    ] },
    ...(wall ? { props: { version: 1, family: 'toon', panels: [], models: [], tiles: [], textures: [], far: null,
      colliders: [{ id: 'wall', panel: null, initialActive: true, shapes: [{ kind: 'box', x: 0, y: 1.68, z: 0.5, hx: 3, hy: 2, hz: 0.05 }] }] } } : {}),
  }, () => readFileSync('test/fixtures/sdk-authored-world/door.as', 'utf8'));
  return { shard: parseShardfile(compiled.declaration), assets: compiled.assets };
}
function opened(snapshot: string): number {
  const saved = v.parse(v.object({ snapshot: v.object({ adapters: v.array(v.object({ id: v.string(), state: v.unknown() })) }) }), JSON.parse(snapshot));
  const adapter = saved.snapshot.adapters.find(row => row.id === 'script.declared'); if (adapter === undefined) throw new Error('Missing declared script continuation');
  const world = v.parse(v.object({ world: v.object({ shared: v.array(v.number()) }) }), JSON.parse(v.parse(v.string(), adapter.state)));
  return world.world.shared[0] ?? -1;
}
it('dispatches only the nearest reachable scene prompt, refusing distance and actual native wall LOS', async () => {
  for (const wall of [false, true]) {
    const { shard, assets } = await product(wall), sim = await HeadlessSimulation.create(shard, assets, undefined, { deadline: 'advisory' });
    try {
      for (const id of ['distant', 'farther']) expect(opened((await sim.step([{ source: 'author', commands: [{ kind: 'interact', id }] }])).snapshot)).toBe(0);
      const commit = await sim.step([{ source: 'author', commands: [{ kind: 'interact', id: 'beacon' }] }]);
      expect(opened(commit.snapshot)).toBe(wall ? 0 : 1);
      await expect(sim.step([{ source: 'author', commands: [{ kind: 'interact', id: 'invented' }] }])).rejects.toThrow('Unknown authored interaction');
    } finally { await sim.dispose(); }
  }
}, 20_000);

it('refuses an absent client and caller data that lists a creature without its actual view', async () => {
  await expect(proveSceneClient({ evaluate: read => Promise.resolve(read()) }, { creatures: ['goat.0'], selectedInteraction: null })).rejects.toThrow();
});
