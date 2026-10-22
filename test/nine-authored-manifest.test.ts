import { expect, test } from 'vitest';
import { MANIFEST } from '../src/shards/nine-dragon-stack/discovery.generated';
import { DECLARATION, POSES } from '../src/shards/nine-dragon-stack/boot/declaration.generated';
import { toLevelSpec } from '../src/game/shard/spec';
import { authoredManifestSource } from '../scripts/authored-manifest.mjs';
// oxlint-disable-next-line import/no-nodejs-modules -- Inspect the defining compiler output in this clean source tree.
import { resolve } from 'node:path';

test('Nine preserves its exact authored boot inventory, modes, art and structures', async () => {
  const level = toLevelSpec(MANIFEST), expected = DECLARATION.boot;
  expect(level.ground.structures).toBe(true);
  expect(level.ground.terrain?.heightAt(0, 0)).toBe(0);
  expect(level.boot.files).toEqual(expected.files);
  expect(level.boot.sources).toEqual(expected.sources);
  expect(level.boot.explore).toEqual(expected.explore);
  expect(level.boot.barrier).toBe(expected.barrier);
  expect(level.boot.phone).toEqual(expected.phone);
  expect(level.boot.cullBeforeFirstDraw).toBe(expected.cullBeforeFirstDraw);
  expect(level.boot.steps).toEqual(expected.steps);
  expect(level.boot.precache).toEqual(expected.precache);
  expect(level.fight).toEqual(DECLARATION.fight);
  expect(level.fight.attackers).toBe(Infinity);
  expect(level.tiers).toEqual(DECLARATION.tiers);
  expect(level.spawn).toEqual(DECLARATION.spawn);
  expect(level.bounds).toEqual(DECLARATION.bounds);
  expect(MANIFEST.dev).toBeDefined();
  expect(await MANIFEST.dev?.poses()).toEqual(POSES);
  expect(typeof MANIFEST.audio?.preload).toBe(typeof DECLARATION.audio.preload);
  expect(typeof level.boot.audio).toBe(typeof expected.audio);
  const density = MANIFEST.forest?.density;
  if (density === undefined) throw new Error('Nine must keep its constant forest density');
  expect(density(50, -50)).toBe(0);
  expect(MANIFEST.trustedRuntime?.entry).toBe('runtime/index.ts');
  const source = authoredManifestSource(resolve(import.meta.dirname, '..'), 'nine-dragon-stack');
  expect(source).toContain('nativeModule["NdPlugin"]');
  expect(source).toContain('"nativePlan":{"phases":["kit"]}');
  expect(source).toContain('...{"structures":true}');
  expect(source).toContain('graphSword("nine-dragon-stack", "weapons/jian-row.json")');
});
