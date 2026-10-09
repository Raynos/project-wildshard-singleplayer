// oxlint-disable-next-line import/no-nodejs-modules -- This consumer test executes the real Node baker loader.
import { execFileSync } from 'node:child_process';
// oxlint-disable-next-line import/no-nodejs-modules -- The Node test resolves fixture paths from its own module URL.
import { fileURLToPath } from 'node:url';
// oxlint-disable-next-line import/no-nodejs-modules -- The child must use the same Node executable as vitest.
import { execPath } from 'node:process';
import { describe, expect, it } from 'vitest';
import { CHUNK_HALF } from '@wildshard/engine/core/config';
import { PACK_SLOTS } from '@wildshard/game/Inventory';
import { createForestAudio } from '@wildshard/game/systems/audio/forest';
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

describe('the layer packages resolve in every consumer (E432, E434: no barrels)', () => {
  it('vitest resolves a module each package exports, and a test reaches an internal (module or asset) by its relative path', () => {
    expect(CHUNK_HALF).toBeGreaterThan(0);
    expect(PACK_SLOTS).toBeGreaterThan(0);
    expect(typeof createForestAudio).toBe('function');
    expect(ALIAS_FIXTURE_PARAM).toBe('tier');
    expect(aliasArt).toMatch(/\.webp$/);
  });

  it('node (the baker loader) resolves an exported module, and neither a bare package (no index) nor an unlisted path', () => {
    expect(inNode("import('@wildshard/engine/world/terrainField').then((m) => process.stdout.write(typeof m.buildTerrain))")).toBe('function');
    expect(inNode("import('@wildshard/engine').then(() => process.stdout.write('resolved'))")).toBe('ERR_PACKAGE_PATH_NOT_EXPORTED');
    expect(inNode("import('@wildshard/engine/aliasFixture').then((m) => process.stdout.write(m.ALIAS_FIXTURE_PARAM))")).toBe('ERR_PACKAGE_PATH_NOT_EXPORTED');
    expect(inNode("import('./src/engine/aliasFixture.webp').then((m) => process.stdout.write(m.default))")).toBe('/src/engine/aliasFixture.webp');
  });

  it('the URL-switch lint resolver follows relative exported constants, and an unlisted package path resolves to nothing', () => {
    const from = fileURLToPath(new URL('../src/main.ts', import.meta.url));
    expect(importedConst(from, './engine/aliasFixture', 'ALIAS_FIXTURE_PARAM')).toBe('tier');
    expect(importedConst(from, '@wildshard/engine/aliasFixture', 'ALIAS_FIXTURE_PARAM')).toBeNull();
    expect(importedConst(from, './engine/aliasFixture.webp', 'ALIAS_FIXTURE_PARAM')).toBeNull();
    expect(importedConst(from, './engine/missing-fixture', 'ALIAS_FIXTURE_PARAM')).toBeNull();
    expect(importedConst(from, 'three', 'ALIAS_FIXTURE_PARAM')).toBeNull();
  });
});
