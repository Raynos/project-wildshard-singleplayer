// oxlint-disable-next-line import/no-nodejs-modules -- The preview fixture writes and removes only its owned ./tmp directory.
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Paths for the owned static HTTP fixture.
import { join, resolve } from 'node:path';
import { expect, test } from 'vitest';
import { preview } from 'vite';
import { pwaPlugin, workerScripts } from '../vite/pwa-plugin';

test('worker bootstrap names exact core bytes and changes for same-length edits', () => {
  const first = workerScripts('self.version = "first";'), next = workerScripts('self.version = "other";');
  expect(first.fileName).toMatch(/^sw-core\/[a-f0-9]{64}\.js$/u);
  expect(first.bootstrap).toBe(`importScripts("/${first.fileName}");\n`);
  expect(new TextEncoder().encode(first.bootstrap).length).toBeLessThan(1024);
  expect(next.fileName).not.toBe(first.fileName);
  expect(next.bootstrap).not.toBe(first.bootstrap);
  expect(workerScripts('self.version = "first";')).toEqual(first);
});

test('worker updates revalidate unchanged bytes and fetch a changed script in full', async () => {
  mkdirSync(resolve('tmp'), { recursive: true });
  const root = mkdtempSync(resolve('tmp/pwa-update-'));
  mkdirSync(join(root, 'dist'));
  writeFileSync(join(root, 'vercel.json'), readFileSync('vercel.json'));
  const file = join(root, 'dist/sw.js'), original = 'self.version = "first";';
  writeFileSync(file, original);
  const scripts = workerScripts(original);
  mkdirSync(join(root, 'dist/sw-core'));
  writeFileSync(join(root, 'dist', scripts.fileName), original);
  const server = await preview({ root, configFile: false, logLevel: 'silent',
    plugins: [pwaPlugin('test')], preview: { host: '127.0.0.1', port: 0 }, build: { outDir: 'dist' } });
  try {
    const base = server.resolvedUrls?.local[0];
    if (base === undefined) throw new Error('Preview did not bind its fixture');
    const url = new URL('sw.js', base), first = await fetch(url);
    const core = await fetch(new URL(scripts.fileName, base));
    expect(core.headers.get('cache-control')).toBe('public, max-age=31536000, immutable');
    expect(core.headers.get('vary')?.toLowerCase() ?? '').not.toContain('origin');
    expect(await core.text()).toBe(original);
    expect(first.status).toBe(200); expect(first.headers.get('cache-control')).toBe('no-cache');
    expect(await first.text()).toBe(original);
    const firstTag = first.headers.get('etag');
    if (firstTag === null) throw new Error('Worker has no revalidation tag');
    for (const origin of [undefined, 'http://localhost:4312']) {
      const headers: Record<string, string> = origin === undefined ? {} : { origin };
      const copy = await fetch(url, { headers });
      expect(copy.headers.get('vary')?.toLowerCase() ?? '').not.toContain('origin');
      expect(copy.headers.get('access-control-allow-origin')).toBe('*');
      expect(copy.headers.get('etag')).toBe(firstTag);
      expect(await copy.text()).toBe(original);
      const unchanged = await fetch(url, { headers: { ...headers, 'if-none-match': firstTag } });
      expect(unchanged.status).toBe(304); expect((await unchanged.arrayBuffer()).byteLength).toBe(0);
    }
    const changed = 'self.version = "other";';
    expect(changed.length).toBe(original.length);
    writeFileSync(file, changed);
    const update = await fetch(url, { headers: { 'if-none-match': firstTag } });
    expect(update.status).toBe(200); expect(update.headers.get('cache-control')).toBe('no-cache');
    expect(await update.text()).toBe(changed); expect(update.headers.get('etag')).not.toBe(firstTag);
    const nextTag = update.headers.get('etag');
    if (nextTag === null) throw new Error('Changed worker has no revalidation tag');
    const rechecked = await fetch(url, { headers: { 'if-none-match': nextTag } });
    expect(rechecked.status).toBe(304); expect((await rechecked.arrayBuffer()).byteLength).toBe(0);
  } finally {
    await server.close(); rmSync(root, { recursive: true, force: true });
  }
}, 20_000);
