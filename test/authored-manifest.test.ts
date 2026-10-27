import { describe, expect, test } from 'vitest';
// oxlint-disable-next-line import/no-nodejs-modules -- Execute only the generated build fixture's loader expression.
import { runInNewContext } from 'node:vm';
import * as ts from '@typescript/typescript6';
// oxlint-disable-next-line import/no-nodejs-modules -- The Node fixture checks real authored and emitted asset files.
import { readFileSync, existsSync, mkdirSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Exercise the bounded build-only binding process.
import { execFileSync } from 'node:child_process';
// oxlint-disable-next-line import/no-nodejs-modules -- Use the same Node binary for the bounded build fixture.
import { execPath } from 'node:process';
// oxlint-disable-next-line import/no-nodejs-modules -- Resolve fixture files in this isolated source export.
import { resolve } from 'node:path';
import { parseManifestMetadata } from '@wildshard/format/minimap';
import { parseDiscoveryValues } from '@wildshard/format/discoveryValues';
import { ShardfileSchema } from '@wildshard/format/shardSchema';
import { defineAuthoredShard } from '@wildshard/game/shard/manifest';
import { readProjectAssets } from '../src/sdk/project';
import { decisionLegacyLines } from '../scripts/decision-legacy-lines.mjs';
import { productMapInput } from '../scripts/built-product.mjs';
import { authoredManifestSource } from '../scripts/authored-manifest.mjs';
import { MANIFEST as nalati } from '../src/shards/nalati-grasslands/discovery.generated';
import { MANIFEST as sky } from '../src/shards/far-reach/discovery.generated';
import { MANIFEST as signal } from '../src/shards/sunscar-dunes/discovery.generated';
import { MANIFEST as template } from '../src/shards/_template/discovery.generated';
import { TEMPLATE_SOURCE as templateProduct } from './fixtures/templateSource';
import { MANIFEST as pine } from '../src/shards/pine-hollow/discovery.generated';
import { MANIFEST as blender } from '../src/shards/blender-template/discovery.generated';
import { MANIFEST as driftwood } from '../src/shards/driftwood-isle/discovery.generated';
import { DRIFTWOOD_FAUNA_PLANS } from '../src/shards/driftwood-isle/generators/fauna';
import nineNavigation from './fixtures/nine-navigation.json' with { type: 'json' };
import { bootDiscovery } from './fixtures/nine-boot-discovery';
import { discovery as driftwoodProgramDiscovery } from './fixtures/driftwood-boot-discovery';
import { discovery as pineProgramDiscovery } from './fixtures/pine-discovery';
import { discovery as nalatiProgramDiscovery } from './fixtures/nalati-discovery';
import { generated as signalProgram } from './fixtures/sunscar-source-program';
import * as v from 'valibot';

const root = resolve(import.meta.dirname, '..');
const metadata = (slug: string): unknown => JSON.parse(readFileSync(resolve(root, `src/shards/${slug}/manifest.json`), 'utf8'));
const nineDiscovery = parseDiscoveryValues({ navigation: nineNavigation, ...bootDiscovery });
const driftwoodDiscovery = parseDiscoveryValues(driftwoodProgramDiscovery);
const declaredSource = (slug: string): string => authoredManifestSource(root, slug,
  slug === 'nine-dragon-stack' ? { discovery: nineDiscovery } : slug === 'driftwood-isle' ? { discovery: driftwoodDiscovery }
    : slug === 'pine-hollow' ? { discovery: parseDiscoveryValues(pineProgramDiscovery) }
    : slug === 'nalati-grasslands' ? { discovery: nalatiProgramDiscovery }
    : slug === 'sunscar-dunes' ? { discovery: parseDiscoveryValues(signalProgram.discovery) } : undefined);
describe('authored JSON discovery', () => {
  test('reads checked spawn data without importing its generator at runtime', () => {
    const source = declaredSource('driftwood-isle');
    expect(driftwood.spawns).toEqual(DRIFTWOOD_FAUNA_PLANS);
    expect(parseManifestMetadata(metadata('driftwood-isle')).spawns).toEqual(DRIFTWOOD_FAUNA_PLANS);
    expect(source).not.toMatch(/from ["']\.\/(?:generators|data)\/fauna["']/u);
  });
  test('refuses malformed spawn plans and imports outside the generator directory', () => {
    mkdirSync(resolve(root, 'tmp'), {recursive: true});
    const scratch = mkdtempSync(resolve(root, 'tmp/manifest-spawns-'));
    const generators = resolve(scratch, 'generators'), entry = resolve(generators, 'fauna.ts');
    mkdirSync(generators);
    const read = () => execFileSync(execPath, [resolve(root, 'scripts/manifest-spawns.mjs'), entry, 'plans'], {encoding: 'utf8', timeout: 10_000, stdio: 'pipe'});
    try {
      writeFileSync(entry, 'export const plans = [{ kind: "boar", count: 1 }];');
      expect(read).toThrow();
      writeFileSync(entry, 'import "node:fs"; export const plans = [];');
      expect(read).toThrow(/local generator TypeScript/u);
      writeFileSync(resolve(scratch, 'outside.ts'), 'export const plans = [];');
      writeFileSync(entry, 'export { plans } from "../outside.ts";');
      expect(read).toThrow(/bounded generators directory/u);
    } finally { rmSync(scratch, {recursive: true}); }
  });
  for (const manifest of [sky, signal, template, pine, driftwood, blender, nalati]) test(`${manifest.slug} composes typed native bindings and complete images`, async () => {
    const row = parseManifestMetadata(metadata(manifest.slug));
    expect(manifest.name).toBe(row.name); expect(manifest.spawn).toEqual(row.spawn);
    expect(manifest.bounds).toEqual(row.bounds); expect(manifest.sky).toEqual(row.sky);
    expect(manifest.pois).toEqual(row.pois); expect(manifest.minimap?.image).toBe(row.minimap.image);
    expect(existsSync(resolve(root, `src/shards/${manifest.slug}/manifest.ts`))).toBe(false);
    let source: string;
    if (manifest.slug === 'far-reach') {
      const lines = decisionLegacyLines(root, 'far-reach');
      if (lines === undefined) throw new Error('Missing original Far Reach decision budget');
      const loaded = await readProjectAssets(resolve(root, 'src/shards/far-reach'), undefined, {
        folder: 'far-reach', imageRoots: [{ prefix: '/assets/', directory: resolve(root, 'public/assets') }],
      }, { decisionLegacyLines: lines });
      source = authoredManifestSource(root, manifest.slug, { discovery: parseDiscoveryValues(loaded.output.discovery) });
    } else source = declaredSource(manifest.slug);
    for (const path of Object.values(row.card).concat(Object.values(row.explore.art))) {
      if (path.startsWith('/src/')) { expect(source).toContain(path); expect(existsSync(resolve(root, path.slice(1)))).toBe(true); }
      else expect(path.startsWith('data:image/') || path.startsWith('/assets/')).toBe(true);
    }
    expect(manifest.card.thumb).toBeTruthy(); expect(manifest.card.portrait).toBeTruthy(); expect(manifest.card.landscape).toBeTruthy();
    const map = productMapInput(resolve(root, 'src/shards', manifest.slug), undefined);
    if (map !== undefined && map.image === undefined) expect(row.minimap.image).toBe(`/assets/${manifest.slug}/map/top.webp`);
    else expect(existsSync(resolve(root, 'public', row.minimap.image.slice(1)))).toBe(true);
    expect(manifest.load === undefined).toBe(row.bindings.load === undefined && row.bindings.entry === undefined);
  });
  test('refuses malformed authored data and unresolved source assets', () => {
    const row = parseManifestMetadata(metadata('far-reach'));
    expect(() => parseManifestMetadata({...row, spawn: {...row.spawn, y: Infinity}})).toThrow();
    expect(() => parseManifestMetadata({...row, card: {...row.card, thumb: 'https://example.com/image.jpg'}})).toThrow();
    expect(() => parseManifestMetadata({...row, sky: {...row.sky, typo: true}})).toThrow();
    expect(() => defineAuthoredShard(row, 'sunscar-dunes', {accent: 'pink', bootBindings: {files: []}}, {}, {})).toThrow(/identity/);
    expect(() => defineAuthoredShard(row, 'far-reach', {accent: 'pink', bootBindings: {files: []}}, {}, {})).toThrow(/not bundled/);
  });
  test('the full shardfile schema uses the same authored metadata contract', () => {
    const file = v.parse(ShardfileSchema, templateProduct);
    const row = parseManifestMetadata(metadata('_template'));
    expect(v.parse(ShardfileSchema, {...file, manifest: row}).manifest).toEqual(row);
    expect(() => v.parse(ShardfileSchema, {...file, manifest: {...row, name: ''}})).toThrow();
  });
});

test('declared entries compile literal runtime links without shard plugin wrappers', () => {
  for (const slug of ['pine-hollow', 'driftwood-isle', 'nine-dragon-stack']) {
    const source = declaredSource(slug);
    expect(source).toContain("import('@wildshard/game/shard/declaredEntry')");
    const policy = parseManifestMetadata(metadata(slug)).bindings.entry;
    expect(policy?.platform).toBe('client-plan');
    expect(source).toContain('.declaredClientPlanEntry(');
    expect(source).not.toMatch(/Promise\.all\(\[import\("\.\/runtime\/(?:hybrid|index)"/u);
    expect(source).not.toContain('import("./plugin")');
    const row = parseManifestMetadata(metadata(slug));
    expect(row).not.toHaveProperty('runtimeEntry');
    expect(source).not.toContain('runtimeModule');
  }
});


test('authored platform entry waits for styles and its defining constructor module', async () => {
  for (const slug of ['driftwood-isle', 'pine-hollow', 'nine-dragon-stack']) {
    const source = declaredSource(slug), file = ts.createSourceFile('manifest.ts', source, ts.ScriptTarget.Latest, true);
    let expression: ts.Expression | undefined;
    const find = (node: ts.Node): void => {
      if (ts.isPropertyAssignment(node) && node.name.getText(file) === 'load') expression = node.initializer;
      ts.forEachChild(node, find);
    };
    find(file);
    if (expression === undefined) throw new Error('Missing compiled runtime loader');
    const policy = parseManifestMetadata(metadata(slug)).bindings.entry;
    if (policy === undefined) throw new Error('Missing entry policy');
    const imports:string[]=[];
    const loadModule=async(specifier:string):Promise<object>=>{
      await Promise.resolve();imports.push(specifier);
      if(policy.styles?.includes(specifier))return {};
      if(specifier==='@wildshard/game/shard/declaredEntry')return {declaredClientPlanEntry:(input:object)=>({compiled:input})};
      throw new Error('Unexpected source constructor');
    };
    const loader:unknown=runInNewContext(`(${expression.getText(file).replaceAll('import(', 'loadModule(')})`,{loadModule},{timeout:1000});
    if(typeof loader!=='function')throw new Error('Invalid built-in loader');
    expect(await Reflect.apply(loader,undefined,[])).toEqual({compiled:{retainHomeRuntime:policy.retainHomeRuntime,stagesOwner:policy.stagesOwner}});
    expect(imports).toEqual([...(policy.styles??[]),'@wildshard/game/shard/declaredEntry']);
  }
});

test('geometry discovery defers only its declared generated map image', () => {
  mkdirSync(resolve(root, 'tmp'), { recursive: true });
  const scratch = mkdtempSync(resolve(root, 'tmp/manifest-data-map-'));
  const dir = resolve(scratch, 'src/shards/map-fixture');
  mkdirSync(resolve(dir, 'look'), { recursive: true });
  writeFileSync(resolve(dir, 'budget.json'), '{}');
  const row = { slug: 'map-fixture', card: {}, sky: {}, minimap: { image: '/assets/map-fixture/map/top.webp' }, explore: {}, horizonStrips: [], bindings: { accent: 'moss', budgets: { module: './budget.json', export: 'default' } } };
  const manifest = resolve(dir, 'manifest.json');
  writeFileSync(manifest, JSON.stringify(row));
  writeFileSync(resolve(dir, 'look/map.json'), JSON.stringify({ painter: { version: 1 } }));
  try {
    expect(() => authoredManifestSource(scratch, 'map-fixture')).toThrow(/missing public image/u);
    expect(authoredManifestSource(scratch, 'map-fixture', { generation: true })).toContain('defineAuthoredShard');
    writeFileSync(manifest, JSON.stringify({ ...row, minimap: { image: '/assets/map-fixture/missing.webp' } }));
    expect(() => authoredManifestSource(scratch, 'map-fixture', { generation: true })).toThrow(/missing public image/u);
    writeFileSync(manifest, JSON.stringify(row));
    writeFileSync(resolve(dir, 'look/map.json'), '{}');
    expect(() => authoredManifestSource(scratch, 'map-fixture', { generation: true })).toThrow(/missing public image/u);
  } finally { rmSync(scratch, { recursive: true }); }
});
