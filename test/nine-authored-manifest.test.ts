import { inputs } from './fixtures/nine-product-inputs';
import { bootDiscovery } from './fixtures/nine-boot-discovery';
import { expect, test } from 'vitest';
import { MANIFEST } from '../src/shards/nine-dragon-stack/discovery.generated';
import { originalBootContract } from './fixtures/nine-boot-contract';
import { toLevelSpec } from '../src/game/shard/spec';
import { authoredManifestSource } from '../scripts/authored-manifest.mjs';
import { parseDiscoveryValues } from '../src/format/discoveryValues';
// oxlint-disable-next-line import/no-nodejs-modules -- Inspect the defining compiler output in this clean source tree.
import { resolve } from 'node:path';

test('Nine preserves its exact authored boot inventory, modes, art and structures', async () => {
  const level = toLevelSpec(MANIFEST), expected = originalBootContract.boot;
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
  expect(level.fight).toEqual(originalBootContract.fight);
  expect(level.fight.attackers).toBe(Infinity);
  expect(level.tiers).toEqual(originalBootContract.tiers);
  expect(level.spawn).toEqual(originalBootContract.spawn);
  expect(level.bounds).toEqual(originalBootContract.bounds);
  expect(MANIFEST.dev).toBeDefined();
  expect(await MANIFEST.dev?.poses()).toEqual(originalBootContract.poses);
  expect(typeof MANIFEST.audio?.preload).toBe(originalBootContract.audioKinds.preload);
  expect(typeof level.boot.audio).toBe(originalBootContract.audioKinds.boot);
  const density = MANIFEST.forest?.density;
  if (density === undefined) throw new Error('Nine must keep its constant forest density');
  expect(density(50, -50)).toBe(0);
  expect(Object.hasOwn(MANIFEST, 'trustedRuntime')).toBe(false);
  expect(MANIFEST.clientPlanRuntime).toBe(true);
  const root = resolve(import.meta.dirname, '..');
  expect(() => authoredManifestSource(root, 'nine-dragon-stack')).toThrow('missing or invalid program discovery value boot.explore');
  const source = authoredManifestSource(root, 'nine-dragon-stack', { discovery: parseDiscoveryValues({ ...bootDiscovery, navigation: { ...inputs.navigation } }) });
  expect(source).not.toContain('navigation.generated');
  expect(source).toContain('.declaredClientPlanEntry({"retainHomeRuntime":true,"stagesOwner":"declared"})');
  expect(source).not.toContain('nativeModule');
  expect(source).not.toContain('./plugin');
  expect(source).not.toContain('./runtime/index');
  expect(source).toContain('...{"structures":true}');
  expect(source).toContain('HeldView.fromProduct("nine-dragon-stack", "weapons/jian-row.json")).sword()');
});

test('each computed boot binding refuses an absent current-product value', () => {
  const root = resolve(import.meta.dirname, '..');
  for (const slot of ['poses', 'boot.files', 'boot.sources', 'boot.explore']) {
    const discovery: Record<string, unknown> = { ...bootDiscovery, navigation: { ...inputs.navigation } }; delete discovery[slot];
    expect(() => authoredManifestSource(root, 'nine-dragon-stack', { discovery: parseDiscoveryValues(discovery) })).toThrow(`missing or invalid program discovery value ${slot}`);
  }
  const source = authoredManifestSource(root, 'nine-dragon-stack', { discovery: parseDiscoveryValues({ ...bootDiscovery, navigation: { ...inputs.navigation } }) });
  for (const name of ['poses', 'files', 'sources', 'explore']) expect(source).not.toContain(`./boot/${name}.generated.json`);
});
