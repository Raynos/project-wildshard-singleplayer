import { describe, expect, it } from 'vitest';
import { graph, headModuleExists } from '../scripts/check-graph.mjs';

describe('staged graph resolves generated modules consistently with HEAD', () => {
  it('keeps unchanged imports to ignored generated outputs in both edge counts', () => {
    const source = ['bytes', 'versions', 'audio', 'shards'].map((name) => `import { table } from './game/boot/${name}.generated';`).join('\n');
    const disk = new Set(['src/identity.ts', ...['bytes', 'versions', 'audio', 'shards'].map((n) => `src/game/boot/${n}.generated.ts`)]);
    const tracked = new Set(['src/identity.ts']);
    const now = graph(['src/identity.ts'], () => source, (p) => disk.has(p));
    const before = graph(['src/identity.ts'], () => source, (p) => headModuleExists(p, tracked, (path) => disk.has(path)));
    expect(before.edges).toEqual({ 'root → game': 4 }); expect(now).toEqual(before);
  });
  it('does not treat ordinary untracked modules or absent generated paths as HEAD source', () => {
    expect(headModuleExists('src/game/new.ts', new Set(), () => true)).toBe(false);
    expect(headModuleExists('src/game/new.generated.ts', new Set(), () => false)).toBe(false);
    expect(headModuleExists('src/game/generated/new.ts', new Set(), () => true)).toBe(false);
    expect(headModuleExists('src/game/new.generated.json', new Set(), () => true)).toBe(false);
  });
  it('still counts a deleted tracked module in the previous graph', () => {
    const file = 'src/entry.ts', source = "import { removed } from './game/removed';", tracked = new Set([file, 'src/game/removed.ts']);
    const before = graph([file], () => source, (p) => headModuleExists(p, tracked, () => false));
    expect(before.edges).toEqual({ 'root → game': 1 });
    expect(graph([file], () => source, () => false).edges).toEqual({});
  });
  it('counts a newly added import to generated data as an actual rise', () => {
    const exists = (p: string): boolean => headModuleExists(p, new Set(), () => true);
    const before = graph(['src/entry.ts'], () => '', exists), now = graph(['src/entry.ts'], () => "import './game/new.generated';", exists);
    expect(before.edges).toEqual({}); expect(now.edges).toEqual({ 'root → game': 1 });
  });
});

// Frozen historical imports are not a second copy of the primary measured graph.
it('keeps frozen reach and cycle checks while excluding only exact inventoried edges', () => {
  const legacy = 'src/shards/coast-legacy/plugin.ts';
  const files = new Map([
    // G288: downward shard imports are never counted, so the counted edge here is a cross-shard one
    [legacy, "import '@wildshard/engine/app/runtime'; import '../other/a';"],
    ['src/shards/fake-legacy/plugin.ts', "import '@wildshard/engine/app/runtime'; import '../other/a';"],
    ['src/shards/other/a.ts', 'export const a = 1;'],
    ['src/engine/app/runtime.ts', 'export const runtime = 1;'],
  ]);
  const frozen = { shards: { 'coast-legacy': { files: { 'plugin.ts': 'x' } } } };
  const run = () => graph([...files.keys()], path => files.get(path) ?? '', path => files.has(path), frozen);
  expect(run().edges).toEqual({ 'shards/fake-legacy → shards/other': 1 });
  files.set('src/engine/app/runtime.ts', "import '../../shards/coast-legacy/plugin';");
  expect(run().violations).toContain('src/engine/app/runtime.ts reaches into src/shards/coast-legacy/plugin.ts: only src/shards.generated.ts imports a shard (its manifest), and a plugin loads only by import() from its own manifest');
  expect(run().violations.some(reason => reason.startsWith('cycle across'))).toBe(true);
});
