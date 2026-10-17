// oxlint-disable-next-line import/no-nodejs-modules -- This build validator fixture owns an isolated source tree.
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- The fixture stays under the repository scratch root.
import { dirname, resolve } from 'node:path';
import { expect, test } from 'vitest';
import { checkHeadlessAssembly, generateHeadlessModuleMap } from '../scripts/check-headless-assemblies.mjs';

test('product builds resolve exact static exports and refuse catalogue drift without executing owners', () => {
  mkdirSync('tmp', { recursive: true });
  const root = mkdtempSync(resolve('tmp/headless-assembly-build-'));
  const put = (path: string, value: string): void => { const file = resolve(root, path); mkdirSync(dirname(file), { recursive: true }); writeFileSync(file, value); };
  const catalogue = "import {install as owner} from '../sim/owner'; export const headlessModules = {'src/shards/demo/sim/owner':{install:owner}};";
  const declaration = { version: 1, modules: { 'src/shards/demo/sim/owner': ['install'] }, entries: { $ref: ['src/shards/demo/sim/owner', 'install'] } };
  try {
    put('src/shards/demo/sim/owner.ts', "throw new Error('build must never execute gameplay'); export function install():void {}");
    put('src/shards/demo/boot/headlessModules.ts', catalogue);
    put('src/shards/demo/data/headlessAssembly.json', JSON.stringify(declaration));
    expect(() => checkHeadlessAssembly(root, 'demo')).not.toThrow();
    put('src/shards/demo/boot/headlessModules.ts', catalogue.replace('install:owner', 'install:()=>{}'));
    expect(() => checkHeadlessAssembly(root, 'demo')).toThrow('static import bindings');
    put('src/shards/demo/boot/headlessModules.ts', catalogue);
    put('src/shards/demo/sim/owner.ts', 'export const different=1;');
    expect(() => checkHeadlessAssembly(root, 'demo')).toThrow('Missing headless export');
    put('src/shards/demo/sim/owner.ts', 'export const install=1;');
    put('src/shards/demo/data/headlessAssembly.json', JSON.stringify({ ...declaration, entries: { $ref: ['src/shards/demo/sim/owner', 'different'] } }));
    expect(() => checkHeadlessAssembly(root, 'demo')).toThrow('Undeclared headless capability');
    put('src/shards/demo/data/headlessAssembly.json', JSON.stringify({ version: 1, modules: { 'https://example.com/owner.ts': ['install'] } }));
    expect(() => checkHeadlessAssembly(root, 'demo')).toThrow('Unresolved trusted assembly module');
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('data-only native proofs generate checked imports outside source and play products', () => {
  mkdirSync('tmp', { recursive: true });
  const root = mkdtempSync(resolve('tmp/headless-proof-map-'));
  const put = (path: string, value: string): void => { const file = resolve(root, path); mkdirSync(dirname(file), { recursive: true }); writeFileSync(file, value); };
  try {
    put('src/game/proof/entryways.ts', "throw new Error('admission must not execute proofs'); export function proveEntryways():void {}");
    put('src/shards/demo/data/headlessAssembly.json', JSON.stringify({ version: 1, modules: { 'src/game/proof/entryways': ['proveEntryways'] }, entries: { $ref: ['src/game/proof/entryways', 'proveEntryways'] } }));
    const path = generateHeadlessModuleMap(root, 'demo'), source = readFileSync(path, 'utf8');
    expect(path).toBe(resolve(root, 'tmp/headless-modules/demo/modules.mjs'));
    expect(source).toContain('import { proveEntryways as m0e0 } from "../../../src/game/proof/entryways.ts"');
    expect(source).toContain('"src/game/proof/entryways": { "proveEntryways": m0e0 }');
    expect(existsSync(resolve(root, 'src/shards/demo/boot/headlessModules.ts'))).toBe(false);
    // Export admission still applies when no handwritten import map exists.
    put('src/game/proof/entryways.ts', 'export function different():void {}');
    expect(() => generateHeadlessModuleMap(root, 'demo')).toThrow('Missing headless export');
    expect(readFileSync(path, 'utf8')).toBe(source);
    expect(() => generateHeadlessModuleMap(root, '../escape')).toThrow('Invalid headless assembly slug');
  } finally { rmSync(root, { recursive: true, force: true }); }
});
