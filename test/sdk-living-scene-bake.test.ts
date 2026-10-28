import * as v from 'valibot';
import { expect, test } from 'vitest';
import { worldSceneLivingBakeRows, worldSceneWeldData, buildingLifeRows } from '../src/sdk/worldScenes';
import type { CabinLivingProfile } from '../src/shards/pine-hollow/generators/cabinLivingContribution';
import { cabinLivingBake } from '../src/shards/pine-hollow/generators/bake-cabin-living.mjs';
import { PINE_SOURCES } from './fixtures/pine-sources';

const id = v.string(), geometry = v.object({ key: id, id, source: v.object({ library: id, model: id }) });
const CabinLivingProfileSchema = v.object({ tier: v.picklist(['phone', 'desktop']), shadow: v.boolean(), shared: v.boolean(), file: id,
  graph: v.pipe(v.unknown(), v.transform(worldSceneWeldData)), life: v.pipe(v.unknown(), v.transform(buildingLifeRows)), geometry: v.array(geometry) });
/** The living cabin rows the program bakes (bake-cabin-living.mjs; the retired pine-cabin-living job's rows). */
const CabinLivingRowsSchema = v.object({ blobs: v.array(v.object({ name: id, kind: v.picklist(['glb', 'json']), source: id })),
  profiles: v.array(CabinLivingProfileSchema), geometry: v.array(v.object({ id, library: id, file: id, attributes: v.record(id, id) })) });

const types: [CabinLivingProfile extends v.InferOutput<typeof CabinLivingProfileSchema> ? true : false,
  v.InferOutput<typeof CabinLivingProfileSchema> extends CabinLivingProfile ? true : false] = [true, true];
const bake = await cabinLivingBake(PINE_SOURCES);

test('living scene admission preserves every original profile, field order and owned binding', () => {
  expect(types).toEqual([true, true]);
  const before = v.parse(CabinLivingRowsSchema, bake.rows), after = worldSceneLivingBakeRows(bake.rows);
  expect(after.profiles).toHaveLength(8);
  expect(JSON.stringify(after)).toBe(JSON.stringify(before));
  const first = after.geometry[0];
  if (first === undefined) throw new Error('Missing original geometry');
  first.attributes['probe'] = 'another-attribute';
  expect(worldSceneLivingBakeRows(bake.rows)).toEqual(before);
  const profile = before.profiles[0];
  if (profile === undefined) throw new Error('Missing original living profile');
  const extra = { ...before, ignored: 1, profiles: [{ ...profile, ignored: true, geometry: profile.geometry.map(row => Object.assign(structuredClone(row), { ignored: 1, source: { ...row.source, ignored: 1 } })) }] };
  expect(worldSceneLivingBakeRows(extra)).toEqual(v.parse(CabinLivingRowsSchema, extra));
});

test('living scene admission retains original profile, graph, life and library refusals', () => {
  const before = v.parse(CabinLivingRowsSchema, bake.rows), profile = before.profiles[0];
  if (profile === undefined) throw new Error('Missing original living profile');
  const invalid: unknown[] = [null, [], {}, { ...before, blobs: [{ name: '', kind: 'binary', source: '' }] },
    { ...before, geometry: [{ id: '', library: '', file: '', attributes: { position: 1 } }] }];
  for (const wrong of [{ ...profile, tier: 'tablet' }, { ...profile, shadow: 0 }, { ...profile, shared: undefined },
    { ...profile, graph: null }, { ...profile, life: { sites: 'bad' } },
    { ...profile, geometry: [{ key: '', id: '', source: { library: 5, model: '' } }] }]) invalid.push({ ...before, profiles: [wrong] });
  for (const input of invalid) {
    expect(() => v.parse(CabinLivingRowsSchema, input)).toThrow();
    expect(() => worldSceneLivingBakeRows(input)).toThrow();
  }
});
