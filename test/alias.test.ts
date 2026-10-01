// oxlint-disable-next-line import/no-nodejs-modules -- This consumer test executes the real Node baker loader.
import { execFileSync } from 'node:child_process';
// oxlint-disable-next-line import/no-nodejs-modules -- The Node test resolves fixture paths from its own module URL.
import { fileURLToPath } from 'node:url';
// oxlint-disable-next-line import/no-nodejs-modules -- The child must use the same Node executable as vitest.
import { execPath } from 'node:process';
import { describe, expect, it } from 'vitest';
import { ENGINE_API } from '#engine/index';
import { GAME_API } from '#game/index';
import { KIT_API } from '#kit/index';
import { ALIAS_FIXTURE_PARAM } from '#engine/aliasFixture';
import aliasArt from '#engine/aliasFixture.webp';
import { importedConst } from '../lint/wildshard-plugin.js';

describe('package imports resolve in every F1 consumer', () => {
  it('vitest resolves layer indexes, a deep TypeScript module and an extension-preserving asset', () => {
    expect([ENGINE_API, GAME_API, KIT_API]).toEqual([1, 1, 1]);
    expect(ALIAS_FIXTURE_PARAM).toBe('tier');
    expect(aliasArt).toMatch(/\.webp$/);
  });

  it('the baker loader resolves the deep alias through the same package imports map', () => {
    const stdout = execFileSync(execPath, ['--import', './scripts/bake-loader.mjs', '-e',
      "import('#engine/aliasFixture').then((m) => process.stdout.write(m.ALIAS_FIXTURE_PARAM))"],
    { cwd: fileURLToPath(new URL('../', import.meta.url)), encoding: 'utf8' });
    expect(stdout).toBe('tier');
    const imageURL = execFileSync(execPath, ['--import', './scripts/bake-loader.mjs', '-e',
      "import('#engine/aliasFixture.webp').then((m) => process.stdout.write(m.default))"],
    { cwd: fileURLToPath(new URL('../', import.meta.url)), encoding: 'utf8' });
    expect(imageURL).toBe('/src/engine/aliasFixture.webp');
  });

  it('the URL-switch lint resolver follows aliased and relative exported constants', () => {
    const from = fileURLToPath(new URL('../src/main.ts', import.meta.url));
    expect(importedConst(from, '#engine/aliasFixture', 'ALIAS_FIXTURE_PARAM')).toBe('tier');
    expect(importedConst(from, './engine/aliasFixture', 'ALIAS_FIXTURE_PARAM')).toBe('tier');
    expect(importedConst(from, '#engine/aliasFixture.webp', 'ALIAS_FIXTURE_PARAM')).toBeNull();
    expect(importedConst(from, '#engine/missing-fixture', 'ALIAS_FIXTURE_PARAM')).toBeNull();
    expect(importedConst(from, 'three', 'ALIAS_FIXTURE_PARAM')).toBeNull();
  });
});
