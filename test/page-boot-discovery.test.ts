import { expect, test } from 'vitest';
// oxlint-disable-next-line import/no-nodejs-modules -- Check discovery from committed authored JSON without loading the page.
import { readFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Locate the fixture's own source root.
import { resolve } from 'node:path';
import { parseManifestMetadata } from '../src/format/minimap';
import { authoredManifestSource } from '../scripts/authored-manifest.mjs';

const root = resolve(import.meta.dirname, '..');
const manifest = parseManifestMetadata(JSON.parse(readFileSync(resolve(root, 'src/shards/pine-hollow/manifest.json'), 'utf8')));
const boot = { platform: 'page-mode', rows: { module: './data/bootMetadata.generated.json', export: 'default' } };
const ktx2 = { platform: 'page-mode', rows: { module: './data/gpuTables.generated.json', export: 'default' } };

test('page boot discovery keeps GPU rows inside the lazy KTX2 call', () => {
  const source = authoredManifestSource(root, 'pine-hollow', { metadataOnly: true,
    composed: { ...manifest, bindings: { ...manifest.bindings, boot, ktx2 } } });
  expect(source).toContain('bootBindings: pageModeBoot(');
  expect(source).toContain('ktx2: async () =>');
  expect(source).toContain('pageModeKtx2((await import("./data/gpuTables.generated.json", { with: { type: \'json\' } })).default)');
  expect(source).not.toMatch(/^import .*gpuTables/gmu);
  expect(source).not.toContain('./runtime/boot/files');
  expect(source).not.toContain('./runtime/boot/gpuTable');
});

test('page boot bindings refuse recipes, executable sources and ignored options', () => {
  const binding = (value: unknown): unknown => ({ ...manifest, bindings: { ...manifest.bindings, boot: value } });
  expect(() => parseManifestMetadata(binding(boot))).not.toThrow();
  expect(() => parseManifestMetadata(binding({ ...boot, recipe: [] }))).toThrow();
  expect(() => parseManifestMetadata(binding({ ...boot, rows: { ...boot.rows, module: './boot.ts' } }))).toThrow();
  expect(() => parseManifestMetadata(binding({ ...boot, rows: { ...boot.rows, export: 'factory' } }))).toThrow();
  expect(() => parseManifestMetadata({ ...manifest, bindings: { ...manifest.bindings, ktx2: { ...ktx2, option: true } } })).toThrow();
});
