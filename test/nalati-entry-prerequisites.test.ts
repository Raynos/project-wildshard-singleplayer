// @vitest-environment happy-dom
import { expect, test, vi } from 'vitest';
import { Vector3 } from 'three';
import { Scope } from '../src/engine/app/scope';
import type { ShardContext } from '../src/game/plugin/context';
import type { ShardRuntime } from '../src/game/shard/runtime';
import { NalatiPlugin } from '../src/shards/nalati-grasslands/runtime/index';
import { legacyDouble } from './fake/FakeGame';

function context(runtime: ShardRuntime | undefined) {
  const scope = new Scope('native Nalati prerequisite');
  const game = legacyDouble<ShardContext['game']>({});
  Object.defineProperty(game, 'runtime', { get: () => runtime });
  const json = vi.fn(() => Promise.reject(new Error('No content read before native world admission')));
  const species = vi.fn<ShardContext['rows']['species']>(), speciesLook = vi.fn<ShardContext['rows']['speciesLook']>();
  const ctx = legacyDouble<ShardContext>({ scope, game,
    product: legacyDouble<ShardContext['product']>({ json }),
    rows: legacyDouble<ShardContext['rows']>({ species, speciesLook }) });
  return { scope, ctx, json, species, speciesLook };
}

function makeRuntime(world: ShardRuntime['world'], step: ShardRuntime['step']): ShardRuntime {
  return { world, step, play: null, interactables: [], overhead: [], hooks: {}, objects: {},
    viewer: () => new Vector3(), horizonVeil: null };
}

test('every native entry hook refuses missing world prerequisites before reads or row registration', async () => {
  const stepped = vi.fn();
  const step: NonNullable<ShardRuntime['step']> = () => { stepped(); return Promise.reject(new Error('No boot step before native world admission')); };
  const cases = [undefined, makeRuntime(null, step), makeRuntime(legacyDouble<NonNullable<ShardRuntime['world']>>({}), null)];
  for (const owner of cases) {
    const f = context(owner), native = new NalatiPlugin();
    try {
      const message = owner === undefined ? 'requires its world host' : 'requires counted world steps';
      await expect(native.world(f.ctx)).rejects.toThrow(message);
      expect(() => native.kit(f.ctx)).toThrow(message);
      await expect(native.play(f.ctx)).rejects.toThrow(message);
      expect(f.json).not.toHaveBeenCalled(); expect(f.species).not.toHaveBeenCalled(); expect(f.speciesLook).not.toHaveBeenCalled();
      expect(stepped).not.toHaveBeenCalled();
    } finally { f.scope.dispose(); }
  }
});
