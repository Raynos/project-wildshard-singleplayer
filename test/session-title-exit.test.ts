// @vitest-environment node
import { expect, test, vi } from 'vitest';
import { Scene } from 'three';
import { Game } from '../src/engine/core/Game';
import { legacyDouble } from '../src/engine/test/FakeGame';
import { Scope } from '../src/engine/app/scope';
import { exitSessionToTitle } from '../src/game/session/exitToTitle';

test('grid → main → standalone retires all worlds before update adoption and entry', async () => {
  const owner = new Scope('grid'), engine = new Scope('engine'), worlds = new Set(['home', 'neighbour']), released: string[] = [];
  for (const world of worlds) owner.child(world).onDispose(() => { worlds.delete(world); released.push(world); });
  let finish: (() => void) | undefined;
  const activation = new Promise<void>(resolve => { finish = resolve; });
  const replace = vi.fn<(url: string) => void>(), renderer = { renderLists: {dispose: vi.fn<() => void>()}, dispose: vi.fn<() => void>(), forceContextLoss: vi.fn<() => void>() };
  const receiver = {dead:false, levelScope:owner, engineScope:engine, rootScene:new Scene(), _composer:null, lookStrategy:null, renderer};
  const nativeDispose: unknown = Reflect.get(Game.prototype, 'dispose');
  if (typeof nativeDispose !== 'function') throw new Error('Missing Game disposal');
  const game = legacyDouble<Game>({dispose: () => { Reflect.apply(nativeDispose, receiver, []); }});
  const leaving = exitSessionToTitle(game, {
    url: 'https://wildshard.io/?chunk=driftwood-isle&glreload=1&explore=hub#ws-shardfile',
    activate: () => { expect(worlds.size).toBe(0); return activation; }, replace,
  });
  expect(receiver.dead).toBe(true); expect(engine.disposed).toBe(true);
  expect(renderer.dispose).toHaveBeenCalledOnce(); expect(renderer.renderLists.dispose).toHaveBeenCalledOnce();
  expect(renderer.forceContextLoss).toHaveBeenCalledOnce();
  expect(owner.disposed).toBe(true); expect(released.sort()).toEqual(['home', 'neighbour']);
  expect(replace).not.toHaveBeenCalled();
  if (finish === undefined) throw new Error('Missing activation completion');
  finish(); await leaving;
  expect(replace).toHaveBeenCalledExactlyOnceWith('https://wildshard.io/');
  expect(worlds.size).toBe(0); // The clean title has no resident worlds to resume.
});

test('an unavailable update cannot keep a disposed session on its old page', async () => {
  const dispose = vi.fn<() => void>(), replace = vi.fn<(url: string) => void>();
  const warning = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  try {
    await exitSessionToTitle({ dispose }, { url: 'https://wildshard.io/play?chunk=pine-hollow',
      activate: () => Promise.reject(new Error('Worker unavailable')), replace });
    expect(dispose).toHaveBeenCalledOnce(); expect(replace).toHaveBeenCalledExactlyOnceWith('https://wildshard.io/play');
    expect(warning).toHaveBeenCalledOnce();
  } finally { warning.mockRestore(); }
});

test('a failed session disposal still reaches the title (QB7)', async () => {
  const replace = vi.fn<(url: string) => void>();
  const failure = new AggregateError([new TypeError("undefined is not an object (evaluating 'r.usedTimes')")], 'Scope level disposal failed');
  const logged = vi.spyOn(console, 'error').mockImplementation(() => undefined);
  try {
    await exitSessionToTitle({ dispose: () => { throw failure; } }, { url: 'https://wildshard.io/?chunk=pine-hollow-legacy',
      activate: () => Promise.resolve(true), replace });
    expect(replace).toHaveBeenCalledExactlyOnceWith('https://wildshard.io/');
    expect(logged).toHaveBeenCalledOnce(); expect(logged.mock.calls[0]?.[1]).toBe(failure);
  } finally { logged.mockRestore(); }
});
