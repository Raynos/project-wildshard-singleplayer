// oxlint-disable-next-line import/no-nodejs-modules -- Check the defining exports map without changing shared files.
import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { ShaderFamily, uniformsFrom, setUniforms, BLEND_KEEP_ALPHA, BLEND_ADD_KEEP_ALPHA } from '@wildshard/game/plugin/shaderFamily';

it('publishes the existing shader-family definition without changing frozen imports', async () => {
  const legacy = await import('@wildshard/game/systems/looks/shaderFamily');
  expect(ShaderFamily).toBe(legacy.ShaderFamily);
  expect(uniformsFrom).toBe(legacy.uniformsFrom);
  expect(setUniforms).toBe(legacy.setUniforms);
  expect(BLEND_KEEP_ALPHA).toBe(legacy.BLEND_KEEP_ALPHA);
  expect(BLEND_ADD_KEEP_ALPHA).toBe(legacy.BLEND_ADD_KEEP_ALPHA);
  const manifest: unknown = JSON.parse(readFileSync('src/game/package.json', 'utf8'));
  if (manifest === null || typeof manifest !== 'object' || !('exports' in manifest)) throw new Error('Missing game exports');
  const exports = manifest.exports;
  if (exports === null || typeof exports !== 'object') throw new Error('Invalid game exports');
  expect(exports).toMatchObject({ './plugin/shaderFamily': './systems/looks/shaderFamily.ts', './systems/looks/shaderFamily': './systems/looks/shaderFamily.ts' });
});
