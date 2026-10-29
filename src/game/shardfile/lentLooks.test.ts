import { expect, test } from 'vitest';
import { Material } from 'three';
import { Scope } from '@wildshard/engine/app/scope';
import { withOwner } from '@wildshard/engine/app/ownership';
import { lendLooks, prepareLentLooks, setLentParam, type LentLooks } from './lentLooks';

test('preparation groups retain owner, ID order and sequential async barriers', async () => {
  const a = new Scope('looks-a'), b = new Scope('looks-b'), eager = new Scope('looks-eager'), material = new Material();
  const calls: { owner: string; ids: readonly string[] }[] = [];
  let release = (): void => { throw new Error('Missing prepare barrier'); };
  const barrier = new Promise<void>(resolve => { release = resolve; });
  const lend = (scope: Scope, ids: readonly string[], prepare?: LentLooks['prepare']): void => {
    lendLooks(scope, { materials: new Map(ids.map(id => [id, material])),
      setParam: () => undefined, setTexture: () => undefined, bindMeshMap: () => material,
      ...(prepare === undefined ? {} : { prepare }) });
  };
  lend(a, ['shared', 'a'], ids => { calls.push({ owner: 'a', ids }); return Promise.resolve(); });
  lend(b, ['shared', 'b'], async ids => { calls.push({ owner: 'b', ids }); await barrier; });
  lend(eager, ['eager']);
  try {
    const pending = withOwner(a, () => prepareLentLooks(['b', 'shared', 'a', 'b', 'missing', 'eager']));
    expect(calls).toEqual([{ owner: 'b', ids: ['b'] }]);
    release(); await pending;
    expect(calls).toEqual([{ owner: 'b', ids: ['b'] }, { owner: 'a', ids: ['shared', 'a'] }]);
    const first = calls[1]?.ids;
    await withOwner(b, () => prepareLentLooks(['a', 'shared']));
    expect(calls.slice(2)).toEqual([{ owner: 'a', ids: ['a'] }, { owner: 'b', ids: ['shared'] }]);
    expect(first).toEqual(['shared', 'a']);
    expect(calls[2]?.ids).not.toBe(first);
    a.dispose(); b.dispose();
    await prepareLentLooks(['shared', 'a', 'b', 'eager']);
    expect(calls).toHaveLength(4);
  } finally { release(); a.dispose(); b.dispose(); eager.dispose(); material.dispose(); }
});

test('a param write reaches every compile on the owner line, never another world; unowned, the newest', () => {
  const level = new Scope('level'), play = new Scope('runtime.play', level), other = new Scope('other-world'), material = new Material();
  const writes: string[] = [];
  const lend = (scope: Scope, name: string): void => {
    lendLooks(scope, { materials: new Map([['look', material]]),
      setParam: () => { writes.push(name); }, setTexture: () => undefined, bindMeshMap: () => material });
  };
  lend(level, 'level'); lend(play, 'page'); lend(other, 'other');
  try {
    withOwner(level, () => { setLentParam('look', 'fade', 1); });
    expect(writes.splice(0)).toEqual(['page', 'level']);
    withOwner(play, () => { setLentParam('look', 'fade', 1); });
    expect(writes.splice(0)).toEqual(['page', 'level']);
    withOwner(other, () => { setLentParam('look', 'fade', 1); });
    expect(writes.splice(0)).toEqual(['other']);
    setLentParam('look', 'fade', 1);
    expect(writes.splice(0)).toEqual(['other']);
    const stranger = new Scope('stranger');
    withOwner(stranger, () => { setLentParam('look', 'fade', 1); });
    expect(writes.splice(0)).toEqual(['other']);
    stranger.dispose();
  } finally { level.dispose(); other.dispose(); material.dispose(); }
});
