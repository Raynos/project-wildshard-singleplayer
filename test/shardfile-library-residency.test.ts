import { expect, it } from 'vitest';
import { emptyShardfile } from '../src/sdk/author';
import { contentHash } from '../src/sdk/project';
import { Scope } from '../src/engine/app/scope';
import { ResidencyAllocator } from '../src/game/grid/allocator';
import { leaseClientLibrary } from '../src/game/shardfile/clientLibrary';

function fixture() {
  const source = emptyShardfile({ slug: 'library-test', name: 'Library', author: 'Local', revision: 1, seed: 1 });
  const a = new Uint8Array([1, 2, 3]), b = new Uint8Array([4, 5]), common = new Uint8Array([6]), first = contentHash(a), second = contentHash(b), hash = contentHash(common);
  source.files = [first, second].map((ref, i) => ({ hash: ref, kind: 'binary', compressed: i === 0 ? 3 : 2, decoded: i === 0 ? 3 : 2, gpu: 0, triangles: 0, draws: 0, dependencies: i === 0 ? [second, `commons:${hash}`] : [], critical: false }));
  source.library = [first, second]; source.requires.commons = [hash]; source.requires.commonsWire[hash] = common.length;
  source.requires.commonsCosts[hash] = { decoded: common.length, gpu: 0, triangles: 0, draws: 0 };
  return { source, assets: new Map([[first, a], [second, b], [`commons:${hash}`, common]]) };
}
it('deduplicates library dependencies and commons across instances in the one allocator and releases each owner', () => {
  const { source, assets } = fixture(), allocator = new ResidencyAllocator(), first = new Scope('first'), second = new Scope('second');
  leaseClientLibrary(source, assets, { allocator, scope: first, owner: 'copy-1' }); leaseClientLibrary(source, assets, { allocator, scope: second, owner: 'copy-2' });
  expect(allocator.entries()).toHaveLength(3); expect(allocator.entries().every((entry) => entry.refs === 2)).toBe(true);
  expect(allocator.cost().input.libraries).toBe(5); expect(allocator.cost().input.commons).toBe(1); expect(allocator.cost().input.sims).toBe(0);
  first.dispose(); expect(allocator.entries().every((entry) => entry.refs === 1)).toBe(true); second.dispose(); expect(allocator.entries()).toEqual([]);
});
it('releases earlier library reservations if a later needed claim cannot fit', () => {
  const { source, assets } = fixture(), allocator = new ResidencyAllocator({ playing: 380000004 }), scope = new Scope('refused');
  expect(() => leaseClientLibrary(source, assets, { allocator, scope, owner: 'copy-1' })).toThrow('deferred');
  expect(allocator.entries()).toEqual([]); scope.dispose();
});
