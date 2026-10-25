import { expect, test } from 'vitest';
import { gridSeamAsset } from '../vite/gridSeamPlans';
import { checkChunks } from '../scripts/check-chunks.mjs';
import { chunkReport } from '../vite/chunkReport';
import { build, type InlineConfig } from 'vite';
// oxlint-disable-next-line import/no-nodejs-modules -- The build guard fixture owns and removes only its small tmp tree.
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Resolve the isolated build fixture inside the ignored scratch root.
import { resolve } from 'node:path';

test('the build keeps exact seam JSON in a content-addressed asset, not a JS literal', () => {
  const source = '{"plans":[["native",[[0,0.125,1]]]],"edges":[]}';
  const asset = gridSeamAsset(source);
  expect(asset.source).toBe(source);
  expect(asset.address.bytes).toBe(new TextEncoder().encode(source).length);
  expect(asset.address.url).toBe(`/${asset.fileName}`);
  expect(asset.fileName).toBe(`assets/grid-seams-${asset.address.sha256.slice(0, 8)}.json`);
  expect(gridSeamAsset(source)).toEqual(asset);
  expect(gridSeamAsset(source.replace('0.125', '0.250')).address.url).not.toBe(asset.address.url);
  expect(() => gridSeamAsset('{"plans":[]}')).toThrow('plans and edges');
});

test('the grid chunk guard refuses inline data, missing measurements and either exceeded ceiling', () => {
  const manifest = { 'index.html': { file: 'entry.js', isEntry: true } };
  const modules = { 'entry.js': { name: 'entry', moduleIds: [], rawBytes: 40, gzBytes: 30 },
    'grid.js': { name: 'grid', moduleIds: ['src/game/grid/session.ts'], rawBytes: 300000, gzBytes: 50000 } };
  const caps = { 'js/grid-session/raw': 450000, 'js/grid-session/gzip': 100000 };
  expect(checkChunks(manifest, modules, {}, caps).errors).toEqual([]);
  expect(checkChunks(manifest, { ...modules, 'grid.js': { ...modules['grid.js'], rawBytes: 3853495 } }, {}, caps).errors).toContainEqual(expect.stringContaining('grid session raw 3853495 exceeds'));
  expect(checkChunks(manifest, { ...modules, 'grid.js': { ...modules['grid.js'], gzBytes: 100001 } }, {}, caps).errors).toContainEqual(expect.stringContaining('grid session gzip 100001 exceeds'));
  expect(checkChunks(manifest, modules, {}).errors).toContain('missing grid session raw ceiling');
  expect(checkChunks(manifest, { ...modules, 'grid.js': { name: 'grid', moduleIds: modules['grid.js'].moduleIds, gzBytes: 50000 } }, {}, caps).errors).toContainEqual(expect.stringContaining('missing grid session raw bytes'));
});

test('an actual Vite build refuses a grid chunk above the ratchet', async () => {
  const root = mkdtempSync(resolve('tmp/js-grid-budget-'));
  try {
    mkdirSync(resolve(root, 'src/game/grid'), { recursive: true }); mkdirSync(resolve(root, 'lint'));
    writeFileSync(resolve(root, 'src/game/grid/session.ts'), `globalThis.grid = ${JSON.stringify('exact data'.repeat(100))};`);
    const policy = resolve(root, 'lint/ratchet.json');
    writeFileSync(policy, JSON.stringify({ budgets: { 'js/grid-session/raw': 10, 'js/grid-session/gzip': 10 } }));
    const options: InlineConfig = { root, configFile: false, logLevel: 'silent', plugins: [chunkReport()],
      build: { write: false, minify: false, rolldownOptions: { input: resolve(root, 'src/game/grid/session.ts') } } };
    await expect(build(options)).rejects.toThrow('grid session raw');
    writeFileSync(policy, JSON.stringify({ budgets: { 'js/grid-session/raw': 2000, 'js/grid-session/gzip': 1000 } }));
    await expect(build(options)).resolves.toBeDefined();
  } finally { rmSync(root, { recursive: true, force: true }); }
});
