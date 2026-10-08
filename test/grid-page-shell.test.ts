import { expect, it, vi } from 'vitest';
import { gridPageShell, gridPageShellLevel } from '../src/game/grid/pageShell';
import { PINE_HOLLOW } from '../src/shards/pine-hollow/manifest';
import { needsTerrainCollider } from '../src/engine/level/spec';
import { navmeshUrl } from '../src/engine/physics/navmeshUrl';
import { terrainFor } from '../src/game/shard/manifest';

it('keeps catalogue identity while excluding every resident home asset and authored hook', () => {
  const load = vi.fn(PINE_HOLLOW.load), render = vi.fn(PINE_HOLLOW.render), fieldModels = vi.fn(PINE_HOLLOW.fieldModels);
  const source = { ...PINE_HOLLOW, load, render, fieldModels };
  const original = Object.getOwnPropertyDescriptors(source), shell = gridPageShell(source), level = gridPageShellLevel(shell);
  expect(shell.slug).toBe(source.slug); expect(shell.card).toBe(source.card); expect(shell.spawn).toEqual(source.spawn);
  expect(shell.spawn).not.toBe(source.spawn);
  expect(Object.getOwnPropertyDescriptors(source)).toEqual(original);
  expect([load, render, fieldModels].map(fn => fn.mock.calls)).toEqual([[], [], []]);
  for (const key of ['load', 'render', 'fieldModels', 'roster', 'sword', 'ktx2', 'assets', 'assetGlobs', 'forest', 'ocean',
    'horizon', 'horizonStrips', 'look', 'loot', 'bodyShadow', 'bounds', 'dev', 'shardfile', 'gridShardfile', 'trustedRuntime']) {
    expect(Reflect.has(shell, key), key).toBe(false);
  }
  expect(shell.treeCount).toBe(0); expect(shell.trees.factory).toBe('none'); expect(shell.spawns).toEqual([]);
  expect(shell.species).toEqual([]); expect(shell.sky.planet).toBeUndefined(); expect(shell.sky.hdri).toBeUndefined();
  expect(shell.boot?.files('phone')).toEqual([]); expect(shell.audio?.preload).toBeUndefined();
  expect(shell.loadout?.weapons).toEqual([]); expect(shell.loadout?.start).toEqual(['tool.hoverboard']);
  expect(level.id).toBe('platform.grid'); expect(needsTerrainCollider(level)).toBe(false);
  expect(navmeshUrl(level.id)).toBeNull(); expect(level.creatures).toBeUndefined(); expect(level.roster).toBeUndefined();
  expect(terrainFor(shell).heightAt(0, 0)).toBeLessThan(-500);
});
