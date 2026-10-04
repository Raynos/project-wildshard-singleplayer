import { describe, expect, it, vi } from 'vitest';
import { App } from '../../src/engine/app/app';
import { Scope } from '../../src/engine/app/scope';
import { levelSequenceDriver, type LevelSequence } from '../../src/game/shard/sequence';
import { toLevelSpec } from '../../src/game/shard/spec';
import manifest from '../../src/shards/nine-dragon-stack/manifest';

const noop = (): void => { /* No renderer in this stage-order contract. */ };

describe('production boot sequence adapter', () => {
  it('runs engine work between awaited hooks and adopts the renderer scope', async () => {
    const app = new App(), scope = new Scope('level'), calls: string[] = [];
    async function* sequence(): LevelSequence<number> {
      await Promise.resolve();
      calls.push('data'); const ctx = yield 'world'; expect(ctx?.scope).toBe(scope);
      calls.push('world'); yield 'kit';
      calls.push('kit'); yield 'loadout';
      calls.push('loadout'); yield 'play';
      calls.push('play'); yield 'finish';
      calls.push('finish'); return 7;
    }
    const staged = levelSequenceDriver(sequence(), scope, () => ({ set: noop, detail: noop }), noop);
    app.levelDriver = staged.driver;
    expect(() => staged.result()).toThrow('not finished');
    await app.loadLevel(toLevelSpec(manifest), {
      world: async () => { await Promise.resolve(); calls.push('hook.world'); },
      kit: () => { calls.push('hook.kit'); }, play: () => { calls.push('hook.play'); },
    });
    expect(calls).toEqual(['data', 'world', 'hook.world', 'kit', 'hook.kit', 'loadout', 'play', 'hook.play', 'finish']);
    expect(staged.result()).toBe(7);
    await app.unloadLevel(); expect(scope.disposed).toBe(true);
  });

  it.each(['world', 'kit', 'play'] as const)('does not continue the sequence after a failing %s hook', async (stage) => {
    const app = new App(), scope = new Scope('level'), dispose = vi.fn<() => void>(), calls: string[] = [];
    async function* sequence(): LevelSequence<number> {
      await Promise.resolve();
      yield 'world'; calls.push('world'); yield 'kit'; calls.push('kit'); yield 'loadout';
      calls.push('loadout'); yield 'play'; calls.push('play'); yield 'finish'; calls.push('finish'); return 7;
    }
    app.levelDriver = levelSequenceDriver(sequence(), scope, () => ({ set: noop, detail: noop }), dispose).driver;
    await expect(app.loadLevel(toLevelSpec(manifest), { [stage]: () => { throw new Error(stage); } })).rejects.toThrow(stage);
    expect(calls).toEqual(stage === 'world' ? ['world'] : stage === 'kit' ? ['world', 'kit'] : ['world', 'kit', 'loadout', 'play']);
    expect(scope.disposed).toBe(true); expect(dispose).toHaveBeenCalledOnce();
  });

  it('fails and disposes a boot that yields stages out of order', async () => {
    const app = new App(), scope = new Scope('level');
    async function* sequence(): LevelSequence<number> { await Promise.resolve(); yield 'kit'; return 7; }
    app.levelDriver = levelSequenceDriver(sequence(), scope, () => ({ set: noop, detail: noop }), noop).driver;
    await expect(app.loadLevel(toLevelSpec(manifest), {})).rejects.toThrow('world boundary');
    expect(scope.disposed).toBe(true);
  });
});
