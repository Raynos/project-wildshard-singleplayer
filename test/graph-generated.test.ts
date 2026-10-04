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
