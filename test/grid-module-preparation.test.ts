import { expect, test, vi } from 'vitest';
import { ShardPlugin, manifestRuntimeEntry, prepareTrustedRuntime } from '../src/game/plugin/context';
import { readGridEdges } from '../src/game/grid/edgeSources';

function fixture() {
  const construct = vi.fn(), hook = vi.fn();
  class Native extends ShardPlugin {
    constructor() { super(); construct(); }
    override world(): void { hook(); }
  }
  const resolve = vi.fn((_entry: string) => Native);
  const load = vi.fn(async () => { await Promise.resolve(); return { default: Native, resolveTrustedRuntime: resolve }; });
  const entry = manifestRuntimeEntry({ trustedRuntime: { slug: 'content', entry: 'runtime/index.ts' }, load });
  return { Native, construct, hook, resolve, load, entry };
}

test('preparation resolves only the registered runtime without constructing or entering it', async () => {
  const f = fixture();
  expect(await prepareTrustedRuntime({ entry: 'runtime/index.ts' }, 'content', true, [f.entry])).toBe(f.Native);
  expect(f.resolve).toHaveBeenCalledExactlyOnceWith('runtime/index.ts');
  expect(f.construct).not.toHaveBeenCalled(); expect(f.hook).not.toHaveBeenCalled();
});

test.each(['third-party', 'identity', 'path'] as const)('preparation keeps authority checks before loading: %s', async reason => {
  const f = fixture();
  await expect(prepareTrustedRuntime({ entry: reason === 'path' ? 'runtime/other.ts' : 'runtime/index.ts' },
    reason === 'identity' ? 'other' : 'content', reason !== 'third-party', [f.entry])).rejects.toThrow();
  expect(f.load).not.toHaveBeenCalled(); expect(f.construct).not.toHaveBeenCalled();
});

test('an unresolved registered module remains a refusal', async () => {
  class Native extends ShardPlugin {}
  const entry = manifestRuntimeEntry({ trustedRuntime: { slug: 'content', entry: 'runtime/index.ts' }, load: () => Promise.resolve({ default: Native }) });
  await expect(prepareTrustedRuntime({ entry: 'runtime/index.ts' }, 'content', true, [entry])).rejects.toThrow('does not resolve');
});

test.each([false, true])('edge readiness holds the admitted lease until preparation settles (failure %s)', async fail => {
  const release = vi.fn(), row = { heights: [0, 0], colours: [[0, 0, 0] as [number, number, number], [0, 0, 0] as [number, number, number]], roadHeight: 0 as const };
  const source = { edge: { north: row, south: row, east: row, west: row }, entryways: [], runtime: { entry: 'runtime/index.ts' } };
  let finish = (): void => undefined;
  const wait = new Promise<void>(resolve => { finish = resolve; });
  const prepare = vi.fn(async () => { await wait; if (fail) throw new Error('module failed'); });
  const work = readGridEdges({ instance: 'cell', slug: 'content', cell: [0, 0], origin: { x: 0, y: 0, z: 0 } }, {
    product: () => Promise.resolve({ admitted: { source }, release }), prepare,
    fetch: () => Promise.reject(new Error('unexpected fetch')),
  });
  await Promise.resolve(); expect(prepare).toHaveBeenCalledOnce(); expect(release).not.toHaveBeenCalled();
  finish();
  if (fail) await expect(work).rejects.toThrow('module failed');
  else { const edges = await work; expect(edges.kind).toBe('declared'); }
  expect(release).toHaveBeenCalledOnce();
});
