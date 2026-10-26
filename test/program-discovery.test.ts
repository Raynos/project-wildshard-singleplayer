// oxlint-disable-next-line import/no-nodejs-modules -- Build fixtures own and remove only their temporary directories.
import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Resolve owned fixture paths.
import { resolve } from 'node:path';
// oxlint-disable-next-line import/no-nodejs-modules -- Evaluate the emitted literal, without executing imports or loaders.
import { runInNewContext } from 'node:vm';
import * as ts from '@typescript/typescript6';
import { expect, test } from 'vitest';
import * as v from 'valibot';
import { parseDiscoveryValues } from '../src/format/discoveryValues';
import { emptyShardfile } from '../src/sdk/author';
import { writeOutputProduct } from '../src/sdk/outputProduct';
import { encodeCanonicalJson, hashImmutableBytes } from '../src/sdk/immutable';
import { parseManifestMetadata } from '../src/format/minimap';
import { readProgramDiscovery, usesProgramDiscovery } from '../scripts/program-discovery.mjs';
import { authoredManifestSource } from '../scripts/authored-manifest.mjs';
import { registerGpuFiles, standIn } from '../src/engine/boot/gpuFiles';
import { TIER } from '../src/engine/core/tier';

const slug = 'discovery-fixture';
const sha = 'a'.repeat(40);
const options = { env: { WS_TEST_PRODUCTS_SHA: sha, VERCEL_GIT_COMMIT_SHA: sha } };
const discovery = parseDiscoveryValues({
  budgets: {},
  'boot.files': { modes: { phone: { img: ['phone.png'], ktx2: ['phone.ktx2'] }, desktop: { img: ['desktop.png'], ktx2: ['desktop.ktx2'] } } },
  'boot.sources': { modes: { phone: { img: { art: ['phone.png'] }, ktx2: { art: ['phone.ktx2'] } }, desktop: { img: { art: ['desktop.png'] }, ktx2: { art: ['desktop.ktx2'] } } } },
  'boot.lateReads': ['last.glb', 'first.glb'],
  'boot.explore': { art: ['data:image/png;base64,AA=='] },
});
function fixture(): string {
  mkdirSync('tmp', { recursive: true });
  return mkdtempSync(resolve('tmp', 'program-discovery-'));
}
function receipt(root: string): Record<string, unknown> {
  const input: unknown = JSON.parse(readFileSync(resolve(root, 'out', slug, 'validation.json'), 'utf8'));
  if (typeof input !== 'object' || input === null || Array.isArray(input)) throw new Error('Missing fixture receipt');
  return v.parse(v.record(v.string(), v.unknown()), input);
}
function putReceipt(root: string, input: unknown): void {
  writeFileSync(resolve(root, 'out', slug, 'validation.json'), JSON.stringify(input));
}
function build(root: string): void {
  writeOutputProduct(emptyShardfile({ slug, name: 'Discovery', author: 'Test', revision: 1, seed: 1 }), new Map(), resolve(root, 'out', slug), { discovery });
}

test('program discovery admits only a current product with matching index and values', () => {
  const root = fixture();
  try {
    build(root);
    expect(readProgramDiscovery(root, slug, options)).toEqual(discovery);
    const original = receipt(root);
    putReceipt(root, { ...original, indexHash: '0'.repeat(64) });
    expect(() => readProgramDiscovery(root, slug, options)).toThrow('index receipt differs');
    putReceipt(root, { ...original, discovery: { hash: '0'.repeat(64), values: discovery } });
    expect(() => readProgramDiscovery(root, slug, options)).toThrow('values receipt differs');
    const invalid = { load: { program: true } };
    putReceipt(root, { ...original, discovery: { hash: hashImmutableBytes(new TextEncoder().encode(encodeCanonicalJson(invalid))), values: invalid } });
    expect(() => readProgramDiscovery(root, slug, options)).toThrow();
    putReceipt(root, original);
    const admitted = readProgramDiscovery(root, slug, options);
    admitted['boot.lateReads'] = ['changed'];
    expect(readProgramDiscovery(root, slug, options)).toEqual(discovery);
    rmSync(resolve(root, 'out', slug, 'validation.json'));
    expect(() => readProgramDiscovery(root, slug, options)).toThrow();
    writeFileSync(resolve(root, 'outside.json'), JSON.stringify(original));
    symlinkSync(resolve(root, 'outside.json'), resolve(root, 'out', slug, 'validation.json'));
    expect(() => readProgramDiscovery(root, slug, options)).toThrow('exceeds bounds');
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('emission inlines computed modes and ordered bindings without source imports', () => {
  const root = fixture();
  const folder = resolve(root, 'src/shards', slug);
  mkdirSync(folder, { recursive: true });
  const bindings = { accent: '#123456', budgets: { program: true }, boot: {
    files: { program: true }, sources: { program: true }, lateReads: { program: true }, explore: { program: true },
  } };
  const manifest = { slug, card: {}, sky: {}, minimap: {}, explore: {}, horizonStrips: [], bindings };
  const path = resolve(folder, 'manifest.json');
  writeFileSync(path, JSON.stringify(manifest));
  try {
    const source = authoredManifestSource(root, slug, { discovery });
    expect(source).not.toContain('generators/');
    expect(source).not.toContain('binding0');
    const file = ts.createSourceFile('discovery.ts', source, ts.ScriptTarget.Latest, true);
    let initializer: ts.Expression | undefined;
    const find = (node: ts.Node): void => {
      if (ts.isVariableDeclaration(node) && node.name.getText(file) === 'rows') initializer = node.initializer;
      ts.forEachChild(node, find);
    };
    find(file);
    if (initializer === undefined) throw new Error('Missing emitted rows');
    const actual: unknown = runInNewContext(`(${initializer.getText(file)})`, {}, { timeout: 1000 });
    expect(actual).toEqual({ accent: bindings.accent, budgets: {}, bootBindings: {
      files: discovery['boot.files'], sources: discovery['boot.sources'], lateReads: discovery['boot.lateReads'], explore: discovery['boot.explore'],
    } });
    expect(() => authoredManifestSource(root, slug)).toThrow('missing or invalid program discovery');
    expect(() => authoredManifestSource(root, slug, { discovery: { budgets: {} } })).toThrow('boot.explore');
    writeFileSync(path, JSON.stringify({ ...manifest, bindings: { ...bindings, budgets: { module: './generators/recipe.ts', export: 'budgets' } } }));
    expect(() => authoredManifestSource(root, slug, { discovery })).toThrow('JSON or generated module');
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('authored metadata permits program values only at data binding slots', () => {
  const original: unknown = JSON.parse(readFileSync('src/shards/nine-dragon-stack/manifest.json', 'utf8'));
  const row = parseManifestMetadata(original);
  const data = { ...row, bindings: { ...row.bindings, navigation: { program: true }, boot: { files: { program: true }, sources: { program: true } } } };
  expect(() => parseManifestMetadata(data)).not.toThrow();
  for (const key of ['entry', 'load', 'render']) expect(() => parseManifestMetadata({ ...data, bindings: { ...data.bindings, [key]: { program: true } } })).toThrow();
});

test('a receipt-owned GPU table emits the existing native callback and registers both original tier choices', async () => {
  const root = fixture(), folder = resolve(root, 'src/shards', slug);
  const ktx2 = { phone: { '/discovery-test/modern.glb': '/discovery-test/phone.glb' },
    desktop: { '/discovery-test/modern.glb': '/discovery-test/desktop.glb' } };
  const values = parseDiscoveryValues({ ktx2 });
  const bindings = { accent: '#123456', budgets: { module: './data/budget.json', export: 'default' }, ktx2: { program: true } };
  const manifest = { slug, card: {}, sky: {}, minimap: {}, explore: {}, horizonStrips: [], bindings };
  mkdirSync(resolve(folder, 'data'), { recursive: true });
  writeFileSync(resolve(folder, 'data/budget.json'), '{}');
  writeFileSync(resolve(folder, 'manifest.json'), JSON.stringify(manifest));
  try {
    expect(usesProgramDiscovery(manifest)).toBe(true);
    writeOutputProduct(emptyShardfile({ slug, name: 'Discovery', author: 'Test', revision: 1, seed: 1 }), new Map(), resolve(root, 'out', slug), { discovery: values });
    const admitted = readProgramDiscovery(root, slug, options);
    const source = authoredManifestSource(root, slug, { discovery: admitted });
    expect(source).not.toContain('generators/'); expect(source).not.toContain('ktx2.generated');
    const file = ts.createSourceFile('discovery.ts', source, ts.ScriptTarget.Latest, true);
    let initializer: ts.Expression | undefined;
    const find = (node: ts.Node): void => {
      if (ts.isVariableDeclaration(node) && node.name.getText(file) === 'native') initializer = node.initializer;
      ts.forEachChild(node, find);
    };
    find(file);
    if (initializer === undefined) throw new Error('Missing native GPU callback');
    const native = v.parse(v.object({ ktx2: v.function() }), runInNewContext(`(${initializer.getText(file)})`, {}, { timeout: 1000 }));
    const loaded = v.parse(v.object({ GPU_FILES: v.unknown() }), await native.ktx2());
    const table = parseDiscoveryValues({ ktx2: structuredClone(loaded.GPU_FILES) }).ktx2;
    if (table === undefined) throw new Error('Missing admitted GPU table');
    expect(table).toEqual(ktx2); registerGpuFiles(table);
    expect(standIn('/discovery-test/modern.glb', 'ktx2')).toBe(ktx2[TIER]['/discovery-test/modern.glb']);
    expect(standIn('/discovery-test/modern.glb', 'img')).toBeUndefined();
    expect(() => authoredManifestSource(root, slug, { discovery: {} })).toThrow('ktx2');
    expect(() => authoredManifestSource(root, slug)).toThrow('ktx2');
    const metadata = parseManifestMetadata(JSON.parse(readFileSync('src/shards/far-reach/manifest.json', 'utf8')));
    expect(() => parseManifestMetadata({ ...metadata, bindings: { ...metadata.bindings, ktx2: { program: true } } })).not.toThrow();
    expect(() => parseManifestMetadata({ ...metadata, bindings: { ...metadata.bindings, ktx2: { program: true, module: './foreign.generated' } } })).toThrow();
  } finally { rmSync(root, { recursive: true, force: true }); }
});
