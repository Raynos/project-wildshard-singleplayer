// oxlint-disable-next-line import/no-nodejs-modules -- This consumer test executes the real Node baker loader.
import { execFileSync } from 'node:child_process';
// oxlint-disable-next-line import/no-nodejs-modules -- The Node test resolves fixture paths from its own module URL.
import { fileURLToPath } from 'node:url';
// oxlint-disable-next-line import/no-nodejs-modules -- The child must use the same Node executable as vitest.
import { execPath } from 'node:process';
import { describe, expect, it } from 'vitest';
import { ENGINE_API } from '@wildshard/engine';
import { GAME_API } from '@wildshard/game';
import { KIT_API } from '@wildshard/kit';
import { ALIAS_FIXTURE_PARAM } from '../src/engine/aliasFixture';
import aliasArt from '../src/engine/aliasFixture.webp';
import { importedConst } from '../lint/wildshard-plugin.js';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
/** run `code` in node under the baker loader; stdout, or the error's code when it throws */
const inNode = (code: string): string => {
  try {
    return execFileSync(execPath, ['--import', './scripts/bake-loader.mjs', '-e', code], { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  } catch (error) {
    const stderr = typeof error === 'object' && error !== null && 'stderr' in error ? String(error.stderr) : '';
    return /ERR_[A-Z_]+/u.exec(stderr)?.[0] ?? stderr;
  }
};

describe('package imports resolve in every F1 consumer', () => {
  it('vitest resolves the layer indexes, and the tests reach an engine internal (module or asset) by its relative path', () => {
    expect([ENGINE_API, GAME_API, KIT_API]).toEqual([1, 1, 1]);
    expect(ALIAS_FIXTURE_PARAM).toBe('tier');
    expect(aliasArt).toMatch(/\.webp$/);
  });

  it('node (the baker loader) resolves @wildshard/engine and its ./data entry, and no deep engine path (AG5, E432)', () => {
    expect(inNode("import('@wildshard/engine/data').then((m) => process.stdout.write(typeof m.buildTerrain))")).toBe('function');
    expect(inNode("import('@wildshard/engine').then((m) => process.stdout.write(String(m.ENGINE_API)))")).toBe('1');
    expect(inNode("import('@wildshard/engine/aliasFixture').then((m) => process.stdout.write(m.ALIAS_FIXTURE_PARAM))")).toBe('ERR_PACKAGE_PATH_NOT_EXPORTED');
    expect(inNode("import('./src/engine/aliasFixture.webp').then((m) => process.stdout.write(m.default))")).toBe('/src/engine/aliasFixture.webp');
  });

  it('the URL-switch lint resolver follows relative exported constants, and a deep package path resolves to nothing', () => {
    const from = fileURLToPath(new URL('../src/main.ts', import.meta.url));
    expect(importedConst(from, './engine/aliasFixture', 'ALIAS_FIXTURE_PARAM')).toBe('tier');
    expect(importedConst(from, '@wildshard/engine/aliasFixture', 'ALIAS_FIXTURE_PARAM')).toBeNull();
    expect(importedConst(from, './engine/aliasFixture.webp', 'ALIAS_FIXTURE_PARAM')).toBeNull();
    expect(importedConst(from, './engine/missing-fixture', 'ALIAS_FIXTURE_PARAM')).toBeNull();
    expect(importedConst(from, 'three', 'ALIAS_FIXTURE_PARAM')).toBeNull();
  });
});
