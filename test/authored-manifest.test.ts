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
import { ShardfileSchema } from '@wildshard/format/shardSchema';
import { defineAuthoredShard } from '@wildshard/game/shard/manifest';
import { authoredManifestSource } from '../scripts/authored-manifest.mjs';
import { MANIFEST as sky } from '../src/shards/far-reach/discovery.generated';
import { MANIFEST as signal } from '../src/shards/sunscar-dunes/discovery.generated';
import { MANIFEST as template } from '../src/shards/_template/discovery.generated';
import templateProduct from '../src/shards/_template/shard.config';
import { MANIFEST as pine } from '../src/shards/pine-hollow/discovery.generated';
import { MANIFEST as blender } from '../src/shards/blender-template/discovery.generated';
import { MANIFEST as driftwood } from '../src/shards/driftwood-isle/discovery.generated';
import { DRIFTWOOD_FAUNA_PLANS } from '../src/shards/driftwood-isle/generators/fauna';
import * as v from 'valibot';

const root = resolve(import.meta.dirname, '..');
const metadata = (slug: string): unknown => JSON.parse(readFileSync(resolve(root, `src/shards/${slug}/manifest.json`), 'utf8'));
describe('authored JSON discovery', () => {
  test('embeds checked spawn plans without importing their generator at runtime', () => {
    const source = authoredManifestSource(root, 'driftwood-isle');
    expect(driftwood.spawns).toEqual(DRIFTWOOD_FAUNA_PLANS);
    expect(source).toContain(`spawns: ${JSON.stringify(DRIFTWOOD_FAUNA_PLANS)}`);
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
  for (const manifest of [sky, signal, template, pine, driftwood, blender]) test(`${manifest.slug} composes typed native bindings and complete images`, () => {
    const row = parseManifestMetadata(metadata(manifest.slug));
    expect(manifest.name).toBe(row.name); expect(manifest.spawn).toEqual(row.spawn);
    expect(manifest.bounds).toEqual(row.bounds); expect(manifest.sky).toEqual(row.sky);
    expect(manifest.pois).toEqual(row.pois); expect(manifest.minimap?.image).toBe(row.minimap.image);
    expect(existsSync(resolve(root, `src/shards/${manifest.slug}/manifest.ts`))).toBe(false);
    const source = authoredManifestSource(root, manifest.slug);
    for (const path of Object.values(row.card).concat(Object.values(row.explore.art))) {
      if (path.startsWith('/src/')) { expect(source).toContain(path); expect(existsSync(resolve(root, path.slice(1)))).toBe(true); }
      else expect(path.startsWith('data:image/') || path.startsWith('/assets/')).toBe(true);
    }
    expect(manifest.card.thumb).toBeTruthy(); expect(manifest.card.portrait).toBeTruthy(); expect(manifest.card.landscape).toBeTruthy();
    expect(existsSync(resolve(root, 'public', row.minimap.image.slice(1)))).toBe(true);
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
  for (const slug of ['pine-hollow', 'driftwood-isle']) {
    const source = authoredManifestSource(root, slug);
    expect(source).toContain("import('@wildshard/game/shard/declaredEntry')");
    const policy = parseManifestMetadata(metadata(slug)).bindings.entry;
    expect(source).toContain(policy !== undefined && 'platform' in policy ? '.declaredClientPlanEntry(' : 'entryModule.declaredRuntimeEntry(runtimeModule.default, nativeModule.default,');
    expect(source).not.toMatch(/Promise\.all\(\[import\("\.\/runtime\/(?:hybrid|index)"/u);
    expect(source).not.toContain('import("./plugin")');
    const row = parseManifestMetadata(metadata(slug));
    if (policy !== undefined && 'platform' in policy) { expect(row.runtimeEntry).toBeUndefined(); expect(source).not.toContain('runtimeModule'); }
    else { if (row.runtimeEntry === undefined) throw new Error('Missing declared runtime entry'); expect(source).toContain(`import(${JSON.stringify(`./${row.runtimeEntry.slice(0, -3)}`)})`); }
  }
});


test('linked entry modules finish before the next namespace can observe their constructors', async () => {
  for (const slug of ['driftwood-isle', 'pine-hollow', 'nine-dragon-stack']) {
    const source = authoredManifestSource(root, slug), file = ts.createSourceFile('manifest.ts', source, ts.ScriptTarget.Latest, true);
    let expression: ts.Expression | undefined;
    const find = (node: ts.Node): void => {
      if (ts.isPropertyAssignment(node) && node.name.getText(file) === 'load') expression = node.initializer;
      ts.forEachChild(node, find);
    };
    find(file);
    if (expression === undefined) throw new Error('Missing compiled runtime loader');
    let initialized = false;
    class Runtime { readonly kind = 'runtime'; }
    class Native { readonly kind = 'native'; }
    const authored = parseManifestMetadata(metadata(slug)), policy = authored.bindings.entry;
    if (policy === undefined) throw new Error('Missing entry policy');
    if ('platform' in policy) {
      const imports:string[]=[];
      const loadModule=async(specifier:string):Promise<object>=>{await Promise.resolve();imports.push(specifier);if(policy.styles?.includes(specifier))return {};if(specifier==='@wildshard/game/shard/declaredEntry')return {declaredClientPlanEntry:(input:object)=>({compiled:input})};throw new Error('Unexpected source constructor');};
      const loader:unknown=runInNewContext(`(${expression.getText(file).replaceAll('import(', 'loadModule(')})`,{loadModule},{timeout:1000});
      if(typeof loader!=='function')throw new Error('Invalid built-in loader');
      expect(await Reflect.apply(loader,undefined,[])).toEqual({compiled:{retainHomeRuntime:policy.retainHomeRuntime,stagesOwner:policy.stagesOwner}});
      expect(imports).toEqual([...(policy.styles??[]),'@wildshard/game/shard/declaredEntry']);continue;
    }
    if(authored.runtimeEntry===undefined)throw new Error('Missing legacy runtime entry');
    const runtimePath = `./${authored.runtimeEntry.slice(0, -3)}`;
    const nativePath = 'legacy' in policy ? policy.legacy : policy.native.module;
    const nativeName = 'legacy' in policy ? 'default' : policy.native.export;
    const loadModule = async (specifier: string): Promise<object> => {
      if (policy.styles?.includes(specifier)) return {};
      if (specifier === runtimePath) {
        await Promise.resolve(); await Promise.resolve(); initialized = true;
        return { default: Runtime };
      }
      if (specifier === nativePath) {
        if (!initialized) throw new Error('Native entry observed an unfinished linked runtime');
        return { [nativeName]: Native };
      }
      if (specifier === '@wildshard/game/shard/declaredEntry') {
        if (!initialized) throw new Error('Adapter observed an unfinished linked runtime');
        return { declaredRuntimeEntry: (runtime: object, native: object): object => ({ runtime, native }) };
      }
      throw new Error('Unexpected compiled import');
    };
    const concurrent = [loadModule(runtimePath), loadModule(nativePath), loadModule('@wildshard/game/shard/declaredEntry')];
    await expect(Promise.all(concurrent)).rejects.toThrow('unfinished linked runtime');
    await Promise.allSettled(concurrent); initialized = false;
    const loader: unknown = runInNewContext(`(${expression.getText(file).replaceAll('import(', 'loadModule(')})`, { loadModule }, { timeout: 1000 });
    if (typeof loader !== 'function') throw new Error('Compiled entry is not a loader');
    expect(await Reflect.apply(loader, undefined, [])).toEqual({ runtime: Runtime, native: runtimePath === nativePath && nativeName === 'default' ? Runtime : Native });
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
