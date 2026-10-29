import {expect, test} from 'vitest';
// oxlint-disable-next-line import/no-nodejs-modules -- Exercise the actual composition-root continuation without running the browser entry.
import {readFileSync} from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Erase only types in the actual root, retaining its scheduling and error order.
import {stripTypeScriptTypes} from 'node:module';
// oxlint-disable-next-line import/no-nodejs-modules -- Inject finite module/cache ports into the real world-only continuation.
import {runInNewContext} from 'node:vm';
import {prepareBootImports} from './bootDownloads';

function deferred(): {ready: Promise<void>; finish: () => void} {
  let finish = (): void => {throw new Error('Missing deferred');};
  const ready = new Promise<void>(resolve => {finish = resolve;});
  return {ready, finish};
}

function continuation(ports: Record<string, unknown>): Promise<unknown> {
  const source = readFileSync(new URL('entry.ts', import.meta.url), 'utf8');
  const start = source.indexOf('    const tables = prepareBootImports('), end = source.indexOf("    await import('three');", start);
  if (start === -1 || end < start) throw new Error('Missing early world download continuation');
  const body = source.slice(start, end).replaceAll(/\bimport\(([^)]+)\)/gu, 'load($1)');
  const result: unknown = runInNewContext(stripTypeScriptTypes(`(async () => {${body}})()`), {
    prepareBootImports, search: new URLSearchParams('chunk=example'), ...ports,
  });
  if (!(typeof result === 'object' && result !== null && 'then' in result && typeof result.then === 'function')) throw new Error('Missing root work');
  return Promise.resolve(result);
}

test.each([false, true])('world manifest starts before tables/Three and preserves actual tier and grid intent (%s)', async grid => {
  const tables = deferred(), job = deferred(), started = deferred(), calls: unknown[] = [];
  const tier = {TIER: 'desktop', initializeTier: (): Promise<void> => {tier.TIER = 'phone'; return Promise.resolve();}};
  const run = continuation({
    load: (name: string): Promise<unknown> => {
      if (name === './assetTables') return Promise.resolve({prepareAssetTables: () => tables.ready});
      if (name.endsWith('/core/tier')) return Promise.resolve(tier);
      if (name.endsWith('/grid/menu')) return Promise.resolve({DEVSERVER: false, gridMode: () => ({developer: true, devserver: false, nineDragon: false})});
      if (name.endsWith('/boot/spawnDownload')) return Promise.resolve({
        startSpawnDownload: (...args: unknown[]) => {calls.push(args); started.finish(); return job;},
        paintSpawnDownload: () => {calls.push('paint'); return () => {calls.push('stop');};},
      });
      throw new Error(`Unexpected early import: ${name}`);
    },
    pageGridRecovery: () => null, pendingGridEntry: () => grid,
    document: {querySelector: () => ({})},
  });
  await started.ready; await Promise.resolve();
  expect(calls).toEqual([['example', grid ? 'grid' : 'client', 'phone', '100'], 'paint']);
  tables.finish(); await run; expect(calls).toHaveLength(2);
  job.finish(); await job.ready; expect(calls.at(-1)).toBe('stop');
});

test('original table failure wins over concurrent tier setup failure', async () => {
  const tableError = new Error('original table failure'), tierError = new Error('later tier failure');
  await expect(continuation({load: (name: string): Promise<unknown> => {
    if (name === './assetTables') return Promise.resolve({prepareAssetTables: () => Promise.reject(tableError)});
    if (name.endsWith('/core/tier')) return Promise.resolve({initializeTier: () => Promise.reject(tierError)});
    return Promise.resolve({});
  }})).rejects.toBe(tableError);
});
