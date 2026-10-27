import { expect, test } from 'vitest';
import { controlChunkSelector, controlChunkFileName } from '../scripts/app-build/controlChunks';
import { readModuleFiles } from '../src/engine/boot/download';

test('control batches retain title, session, lazy and shard boundaries through cycles', () => {
  const root = '/fixture';
  const edges: Readonly<Record<string, readonly string[]>> = {
    '/fixture/src/entry.ts': ['/fixture/src/shared.ts'],
    '/fixture/src/game/session/session.ts': ['/fixture/src/sessionOnly.ts', '/fixture/src/shared.ts'],
    '/fixture/src/core.ts': ['/fixture/src/game/session/session.ts', '/fixture/src/services.ts', '/fixture/src/shards/one/manifest.ts'],
    '/fixture/src/services.ts': ['/fixture/src/core.ts'],
  };
  const graph = { getModuleInfo: (id: string) => ({ importedIds: edges[id] ?? [] }) };
  const select = controlChunkSelector(root, ['/fixture/src/entry.ts', '/fixture/src/core.ts']);
  expect(select('/fixture/src/shared.ts', graph)).toBeNull();
  expect(select('/fixture/src/entry.ts', graph)).toBeNull();
  expect(select('/fixture/src/sessionOnly.ts', graph)).toBe('control-session');
  expect(select('/fixture/src/services.ts', graph)).toBe('control-startup');
  expect(select('/fixture/src/lazyExplorer.ts', graph)).toBeNull();
  expect(select('/fixture/src/calibration.ts', graph)).toBeNull();
  expect(select('/fixture/src/shards/one/manifest.ts', graph)).toBeNull();
  expect(select('/fixture/src/styles.css', graph)).toBeNull();
  const title = controlChunkSelector(root, [], 'title');
  expect(title('/fixture/src/shared.ts', graph)).toBe('title-boundary');
  expect(title('/fixture/src/services.ts', graph)).toBeNull();
});

test('a subsequent build uses its own graph, including changed optional requirements', () => {
  const graph = { getModuleInfo: () => ({ importedIds: [] }) };
  const first = controlChunkSelector('/fixture', ['/fixture/src/first.ts']);
  const second = controlChunkSelector('/fixture', ['/fixture/src/second.ts']);
  expect(first('/fixture/src/first.ts', graph)).toBe('control-startup');
  expect(first('/fixture/src/second.ts', graph)).toBeNull();
  expect(second('/fixture/src/first.ts', graph)).toBeNull();
  expect(second('/fixture/src/second.ts', graph)).toBe('control-startup');
});

test('entry-aware chunk labels preserve the strict named module bank contract', () => {
  const pattern = controlChunkFileName({ name: 'title-boundary~main~session' });
  expect(pattern).toBe('assets/title-boundary-main-session-[hash].js');
  const file = `/${pattern.replace('[hash]', '012345ab')}`;
  expect(readModuleFiles([[file, 42]])).toEqual([[file, 42]]);
  expect(() => readModuleFiles([['/assets/title~session.js', 42]])).toThrow('Invalid boot module file');
});
