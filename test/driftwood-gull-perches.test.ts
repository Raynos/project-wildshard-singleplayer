// @vitest-environment happy-dom
import { expect, it } from 'vitest';
import { readNativeTerrain } from '@wildshard/sdk/bake/terrain';
import { bindLevelSelection } from '@wildshard/engine/level/selection';
import type { LevelSpec } from '@wildshard/engine/level/spec';
import { HeightfieldBinding, bindHeightfield } from '@wildshard/engine/world/Heightfield';
import { MANIFEST } from '../src/shards/driftwood-isle/discovery.generated';
import { driftwoodGroundBytes } from '../src/shards/driftwood-isle/generators/groundRows';
import { beachGullPerches } from '../src/shards/driftwood-isle/generators/islandDressing';
import { WORLD_STAGES } from '../src/shards/driftwood-isle/generators/worldAssembly';
import { WorldAssemblySchema } from '../src/format/worldAssembly';
import * as v from 'valibot';
// The original Gulls.beachPerches(seed, 10, the beach circle) on this same native ground.
import frozen from './fixtures/legacy-oracles/driftwood-gull-perches.json';

it('admits the whole perch list with its original wet-sand suffix', () => {
  const terrain = MANIFEST.ground.terrain;
  if (terrain === undefined) throw new Error('Native island ground is required');
  const level: LevelSpec = { id: MANIFEST.slug, ground: { terrain }, spawn: MANIFEST.spawn, sky: MANIFEST.sky, atmosphere: MANIFEST.atmosphere, grade: MANIFEST.grade,
    budgets: {}, mechanisms: [], fight: {}, boot: { files: [] }, audio: { ambience: 'none', score: 'none' }, loadout: { weapons: [], tools: [], start: [] }, species: [], spawns: [], minimap: {}, kitLook: 'toon' };
  const restoreLevel = bindLevelSelection(level), binding = new HeightfieldBinding(level);
  binding.install(readNativeTerrain(driftwoodGroundBytes()));
  const restoreGround = bindHeightfield(binding);
  try {
    const original = frozen.perches;
    expect(frozen.seed).toBe(MANIFEST.seed); expect(original).toHaveLength(10);
    expect(beachGullPerches(binding.field.heightAt, MANIFEST.seed)).toEqual(original);
    const rows=v.parse(WorldAssemblySchema,WORLD_STAGES),flock=rows.stages.find(row=>row.kind==='ambient-flock');
    if(flock?.kind!=='ambient-flock')throw new Error('Missing gull stage');
    expect(flock.perches).toHaveLength(100);
    expect(flock.perches.slice(-original.length)).toEqual(original);
    expect(v.safeParse(WorldAssemblySchema,{...rows,stages:[{...flock,perches:Array.from({length:4097},()=>({x:0,y:0,z:0}))}]}).success).toBe(false);
  } finally { restoreGround(); restoreLevel(); }
});
