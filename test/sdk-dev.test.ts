// oxlint-disable-next-line import/no-nodejs-modules -- Own and clean disposable author products.
import { mkdtempSync, mkdirSync, rmSync, writeFileSync, realpathSync, statSync, utimesSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Fixture directories and paths.
import { tmpdir } from 'node:os';
// oxlint-disable-next-line import/no-nodejs-modules -- Fixture paths.
import { join } from 'node:path';
import { expect, it, vi } from 'vitest';
import { emptyShardfile } from '../src/sdk/author';
import { devProject, projectSourceStamp } from '../src/sdk/dev';
import { assertProductionBuild } from '../scripts/check-devserver.mjs';

it('detects quick overwrites and nested source changes without depending on a native watch event', () => {
  const dir = realpathSync(mkdtempSync(join(tmpdir(), 'sdk-source-stamp-'))), config = join(dir, 'shard.config.ts');
  try {
    writeFileSync(config, 'first');
    const original = statSync(config), initial = projectSourceStamp(dir);
    expect(projectSourceStamp(dir)).toBe(initial);
    writeFileSync(config, 'other'); utimesSync(config, original.atime, original.mtime);
    const edited = projectSourceStamp(dir); expect(edited).not.toBe(initial);
    mkdirSync(join(dir, 'data')); writeFileSync(join(dir, 'data', 'row.ts'), 'export const x=1;');
    const added = projectSourceStamp(dir); expect(added).not.toBe(edited);
    for (const name of ['node_modules', '.git', 'dist', 'public']) { mkdirSync(join(dir, name)); writeFileSync(join(dir, name, 'ignored'), 'data'); }
    expect(projectSourceStamp(dir)).toBe(added);
    rmSync(join(dir, 'data', 'row.ts')); expect(projectSourceStamp(dir)).toBe(edited);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

it('rejects an enabled or missing production runtime stamp even if its metadata claims false', () => {
  const dir = mkdtempSync(join(tmpdir(), 'production-flags-'));
  try {
    writeFileSync(join(dir, 'build-flags.json'), '{"devserver":false}');
    writeFileSync(join(dir, 'entry.js'), 'globalThis.__WILDSHARD_DEVSERVER__ = false;'); expect(() => assertProductionBuild(dir)).not.toThrow();
    writeFileSync(join(dir, 'entry.js'), 'globalThis.__WILDSHARD_DEVSERVER__ = true;'); expect(() => assertProductionBuild(dir)).toThrow('runtime flag');
    writeFileSync(join(dir, 'entry.js'), 'console.log(__DEVSERVER__);'); expect(() => assertProductionBuild(dir)).toThrow('unsubstituted');
    writeFileSync(join(dir, 'entry.js'), 'console.log(1);'); expect(() => assertProductionBuild(dir)).toThrow('missing');
    writeFileSync(join(dir, 'build-flags.json'), '{"devserver":true}'); expect(() => assertProductionBuild(dir)).toThrow('enabled');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

it('rebuilds an edited project, serves its admitted product and preserves the last good build on a bad edit', async () => {
  const dir = realpathSync(mkdtempSync(join(tmpdir(), 'sdk-dev-test-'))), client = join(dir, 'test-client'); mkdirSync(client);
  writeFileSync(join(client, 'index.html'), '<html><head></head><body><script src="app.js"></script></body></html>');
  writeFileSync(join(client, 'app.js'), 'globalThis.__WILDSHARD_DEVSERVER__ = true;'); writeFileSync(join(client, 'build-flags.json'), '{"devserver":true}');
  const shard = emptyShardfile({ slug: 'dev-fixture', name: 'Initial', author: 'Fixture', revision: 1, seed: 435 });
  const config = join(dir, 'shard.config.ts'), write = (): void => { writeFileSync(config, `export default ${JSON.stringify(shard)};`); }; write();
  const errors = vi.spyOn(console, 'error').mockImplementation(() => undefined);
  let server: Awaited<ReturnType<typeof devProject>> | undefined;
  try {
    server = await devProject(dir, { client }); const url = server.url;
    expect(await (await fetch(url)).text()).toContain('ws-shardfile'); expect(await (await fetch(url)).text()).toContain('/__wildshard_dev_revision');
    shard.identity.name = 'Edited'; shard.identity.revision++; write();
    await vi.waitFor(async () => { expect(await (await fetch(`${url}__wildshard_dev_revision`)).json()).toEqual({ revision: 2, error: null }); }, { timeout: 10000, interval: 100 });
    expect(await (await fetch(url)).text()).toContain('Edited');
    writeFileSync(config, 'export default {broken:true};');
    await vi.waitFor(async () => { const status: unknown = await (await fetch(`${url}__wildshard_dev_revision`)).json(); if (typeof status !== 'object' || status === null || !('revision' in status) || !('error' in status)) throw new Error('Missing rebuild status'); expect(status.revision).toBe(2); expect(typeof status.error).toBe('string'); }, { timeout: 10000, interval: 100 });
    expect(await (await fetch(url)).text()).toContain('Edited');
    shard.identity.name = 'Recovered'; shard.identity.revision++; write();
    await vi.waitFor(async () => { expect(await (await fetch(`${url}__wildshard_dev_revision`)).json()).toEqual({ revision: 3, error: null }); }, { timeout: 10000, interval: 100 });
    expect((await fetch(`${url}%2e%2e%2fshard.config.ts`)).status).toBe(404);
    await server.close(); await expect(fetch(url)).rejects.toThrow();
  } finally { await server?.close(); errors.mockRestore(); rmSync(dir, { recursive: true, force: true }); }
}, 30000);
