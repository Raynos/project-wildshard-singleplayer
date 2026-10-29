// @vitest-environment node
import { expect, test, vi } from 'vitest';
import { exitSessionToTitle } from '../src/game/session/exitToTitle';

test('main-menu exit replaces the document synchronously without touching the old world or worker', () => {
  const replace = vi.fn<(url: string) => void>();
  const forbidden = (): never => {throw new Error('The old world and worker are not exit work');};
  const navigation = {url: 'https://wildshard.io/?chunk=driftwood-isle&glreload=1&explore=hub#ws-shardfile', replace,
    get dispose(): never {return forbidden();}, get activate(): never {return forbidden();}};
  exitSessionToTitle(navigation);
  expect(replace).toHaveBeenCalledExactlyOnceWith('https://wildshard.io/');
});

test.each(['driftwood-isle', 'pine-hollow', 'nalati-grasslands', 'nine-dragon-stack', 'far-reach', 'sunscar-dunes', '_template'])(
  '%s exits to the actual root title without a stale shard, mode or fragment', slug => {
    const replace = vi.fn<(url: string) => void>();
    exitSessionToTitle({url: `https://wildshard.io/play?chunk=${slug}&explore=hub#ws-shardfile`, replace});
    expect(replace).toHaveBeenCalledExactlyOnceWith('https://wildshard.io/');
  });

test('a navigation failure preserves its original error instead of pretending the old session was disposed', () => {
  const failure = new Error('Navigation unavailable');
  expect(() => exitSessionToTitle({url: 'https://wildshard.io/?chunk=pine-hollow-legacy', replace: () => {throw failure;}})).toThrow(failure);
});
