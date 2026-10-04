import { saveStorageFixture } from './fake/saveFixture';
// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Scope } from '#engine-internal/app/scope';
import { QUEUE_KEY, reportError, type LoadFailure } from '#engine-internal/core/errorReport';
import { showLoadFailure } from '#engine-internal/ui/errorScreen';
import { runShardLoad, withShardHooks } from '#game/shard/load';
import { SHARDS } from '../src/shards.generated';
import type { ShardManifest } from '#game/shard/manifest';

const fixtures = saveStorageFixture('device');

// the error tracker is passed to reportError, not a mocked module (E422)
const captureBrowserError = vi.fn<(error: Error, tags: object) => void>();

afterEach(() => { document.body.replaceChildren(); vi.unstubAllGlobals(); });

function manifest(): ShardManifest {
  const source = SHARDS[0];
  if (source === undefined) throw new Error('registry is empty');
  return { ...source, ground: { ...source.ground } };
}

describe('shard load failure', () => {
  it('a rejecting render disposes the scope, queues the report and shows the original stack and RELOAD', async () => {
    localStorage.clear(); sessionStorage.clear();
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    const m = manifest();
    const error = new Error('render <script> failed');
    error.stack = 'Error: render <script> failed\n  at failingRender (shard.ts:8:2)';
    m.render = () => Promise.reject(error);
    const authored = m.render;
    const scope = new Scope('level');
    const order: string[] = [];
    scope.onDispose(() => { order.push('dispose'); });
    await expect(runShardLoad(m, (stage) => withShardHooks(m, stage, async () => { await m.render?.(); }), {
      build: 'test-build',
      dispose: () => { scope.dispose(); },
      report: (failure) => { order.push('report'); return reportError(failure, captureBrowserError); },
      show: (failure) => { expect(scope.disposed).toBe(true); order.push('show'); return showLoadFailure(failure); },
    })).rejects.toThrow('render <script> failed');
    expect(order).toEqual(['dispose', 'report', 'show']);
    expect(captureBrowserError).toHaveBeenCalledWith(expect.objectContaining({ stack: error.stack }), expect.objectContaining({ shard: m.slug, bootStage: 'render', build: 'test-build' }));
    expect(m.render).toBe(authored);
    await vi.waitFor(() => { expect(JSON.parse(fixtures.getItem(QUEUE_KEY) ?? '[]')).toHaveLength(1); });
    expect(JSON.parse(fixtures.getItem(QUEUE_KEY) ?? '[]')).toEqual([expect.objectContaining({
      system: 'shard-load', fatal: true, stack: error.stack,
      context: { kind: 'shard-load', shard: m.slug, build: 'test-build', stage: 'render' },
    })]);
    expect(document.querySelector('section')?.dataset['wsShell']).toBe('true');
    expect(document.querySelector('pre')?.textContent).toBe(error.stack);
    expect(document.querySelector('script')).toBeNull();
    expect(document.body.textContent).toContain(m.name);
    expect(document.body.textContent).toContain('test-build');
    expect(document.querySelector('button')?.textContent).toBe('RELOAD');
    const reload = vi.fn<() => void>();
    vi.stubGlobal('location', { reload });
    document.querySelector('button')?.click();
    expect(reload).toHaveBeenCalledOnce();
  });

  it('refuses an API mismatch before running any build hook and names both versions', async () => {
    const work = vi.fn(() => Promise.resolve());
    const dispose = vi.fn<() => void>();
    const report = vi.fn(() => Promise.resolve());
    const show = vi.fn<(failure: LoadFailure) => void>();
    await expect(runShardLoad({ api: 42, name: 'New shard', slug: 'new-shard' }, work, { build: 'b', dispose, report, show })).rejects.toThrow('shard API 42; engine supports API 1');
    expect(work).not.toHaveBeenCalled();
    expect(dispose).toHaveBeenCalledOnce();
    expect(report).toHaveBeenCalledWith(expect.objectContaining({ stage: 'manifest.api', shard: 'new-shard' }));
    expect(show).toHaveBeenCalledOnce();
  });

  it('successful builds keep their scope and return the built level', async () => {
    const dispose = vi.fn<() => void>();
    const report = vi.fn(() => Promise.resolve());
    const show = vi.fn<(failure: LoadFailure) => void>();
    await expect(runShardLoad(manifest(), (stage) => stage('world', () => 17), { build: 'b', dispose, report, show })).resolves.toBe(17);
    expect(dispose).not.toHaveBeenCalled(); expect(report).not.toHaveBeenCalled(); expect(show).not.toHaveBeenCalled();
  });
});
