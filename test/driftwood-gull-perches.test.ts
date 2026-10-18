// @vitest-environment happy-dom
import { expect, it } from 'vitest';
import { readNativeTerrain } from '@wildshard/sdk/bake/terrain';
import { bindLevelSelection } from '@wildshard/engine/level/selection';
import type { LevelSpec } from '@wildshard/engine/level/spec';
import { HeightfieldBinding, bindHeightfield } from '@wildshard/engine/world/Heightfield';
import { MANIFEST } from '../src/shards/driftwood-isle/discovery.generated';
import { driftwoodGroundBytes } from '../src/shards/driftwood-isle/generators/groundRows';
import { beachGullPerches } from '../src/shards/driftwood-isle/generators/islandDressing';
import { Gulls as OriginalGulls } from '../src/shards/driftwood-isle-legacy/world/Gulls';
import { DRIFTWOOD_CLIENT_SECTIONS } from '../src/shards/driftwood-isle/generators/clientSections';
import { SECTIONS } from '../src/shards/driftwood-isle/generators/sections';
import * as v from 'valibot';

it('admits the whole perch list with its original wet-sand suffix', () => {
  const terrain = MANIFEST.ground.terrain;
  if (terrain === undefined) throw new Error('Native island ground is required');
  const level: LevelSpec = { id: MANIFEST.slug, ground: { terrain }, spawn: MANIFEST.spawn, sky: MANIFEST.sky, atmosphere: MANIFEST.atmosphere, grade: MANIFEST.grade,
    budgets: {}, mechanisms: [], fight: {}, boot: { files: [] }, audio: { ambience: 'none', score: 'none' }, loadout: { weapons: [], tools: [], start: [] }, species: [], spawns: [], minimap: {}, kitLook: 'toon' };
  const restoreLevel = bindLevelSelection(level), binding = new HeightfieldBinding(level);
  binding.install(readNativeTerrain(driftwoodGroundBytes()));
  const restoreGround = bindHeightfield(binding);
  try {
    const original = OriginalGulls.beachPerches(MANIFEST.seed, 10, { x: 0, z: -195, r: 90 }).map(({x,y,z}) => ({x,y,z}));
    expect(original).toHaveLength(10);
    expect(beachGullPerches(binding.field.heightAt, MANIFEST.seed)).toEqual(original);
    const section = DRIFTWOOD_CLIENT_SECTIONS.find(row => row.name === 'custom/fixedLayouts');
    if (section === undefined) throw new Error('Missing fixed layouts');
    const schema = SECTIONS['custom/fixedLayouts'];
    const rows = v.parse(schema, section.value);
    expect(rows.gullPerches).toHaveLength(100);
    expect(rows.gullPerches.slice(-original.length)).toEqual(original);
    expect(v.safeParse(schema, {...rows, gullPerches: Array.from({ length: 257 }, () => ({ x: 0, y: 0, z: 0 }))}).success).toBe(false);
  } finally { restoreGround(); restoreLevel(); }
});
