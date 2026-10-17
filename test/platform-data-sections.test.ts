import { expect, test } from 'vitest';
import { parseUiStrings } from '../src/format/uiStrings';
import { parseWorldPhysics } from '../src/format/worldPhysics';
import { emitPlatformSections, worldPhysicsSection } from '../src/sdk/platformSections';
import { nativeBodySpecSchema, nativeColliderSchema, nativeGroundSchema } from '../src/sdk/headlessRuntime';
import { nativeBodySchema, nativeColliderRecordSchema, nativeGroundRecordSchema } from '../src/format/nativePhysics';
import * as v from 'valibot';
import pine from '../src/shards/pine-hollow/data/physics.generated.json';
import driftwood from '../src/shards/driftwood-isle/data/physics.generated.json';
import PINE_STRINGS from '../src/shards/pine-hollow/data/strings.json' with { type: 'json' };
import DRIFTWOOD_STRINGS from '../src/shards/driftwood-isle/data/strings.json' with { type: 'json' };

test('player-facing strings retain authored labels and refuse unsafe or executable entries', () => {
  expect(parseUiStrings(PINE_STRINGS)).toEqual(PINE_STRINGS);
  expect(parseUiStrings(DRIFTWOOD_STRINGS)).toEqual(DRIFTWOOD_STRINGS);
  expect(() => parseUiStrings({ invalid: 1 })).toThrow();
  expect(() => parseUiStrings({ constructor: 'invalid' })).toThrow();
  expect(() => parseUiStrings({ label: () => 'invalid' })).toThrow();
  expect(() => parseUiStrings({ 'bad/path': 'invalid' })).toThrow();
});

test('native physics emission preserves both worlds without retaining owner metadata in the common section', () => {
  for (const [source, policy] of [[pine, { rig: 'segments', provenance: 'piece' }], [driftwood, { rig: 'axis', provenance: 'tagged' }]] as const) {
    const section = worldPhysicsSection(source, policy);
    expect(section.ground).toEqual(source.ground);
    expect(section.solids).toEqual(source.solids);
    expect(section.actors).toEqual(source.actors);
    expect(section.herds).toEqual(source.herds);
    expect('kingHit' in section || 'habitat' in section || 'captain' in section).toBe(false);
    const emitted = emitPlatformSections(new Map([['world/physics', section]]));
    const entry = emitted.sections.find(row => row.name === 'world/physics');
    if (entry === undefined) throw new Error('Missing physics section');
    const bytes = emitted.files.get(entry.path);
    if (bytes === undefined) throw new Error('Missing physics bytes');
    expect(parseWorldPhysics(JSON.parse(new TextDecoder().decode(bytes)))).toEqual(section);
    expect(entry).toMatchObject({ schema: 'wildshard:world/physics@1' });
    const actor = section.actors[0];
    if (actor === undefined) throw new Error('Missing native actor');
    expect(() => parseWorldPhysics({ ...section, actors: [{ ...actor, kind: 'wrong-kind' }] })).toThrow();
    expect(() => parseWorldPhysics({ ...section, actors: [actor, actor] })).toThrow();
    expect(() => parseWorldPhysics({ ...section, ground: { ...section.ground, heights: 'not base64' } })).toThrow();
    expect(() => parseWorldPhysics({ ...section, rig: policy.rig === 'axis' ? 'segments' : 'axis' })).toThrow();
  }
  expect('kingHit' in pine).toBe(true);
  expect('habitat' in driftwood).toBe(true);
});

test('SDK native intake facades retain the defining format verdicts and provenance refusals', () => {
  const actor = pine.actors[0];
  const rawSolid: unknown = pine.solids[0];
  const solid = v.parse(nativeColliderRecordSchema([1, 2, 6, 9], 'piece'), rawSolid);
  if (actor === undefined) throw new Error('Missing native fixture');
  expect(v.parse(nativeBodySpecSchema('segments'), actor.spec)).toEqual(v.parse(nativeBodySchema('segments'), actor.spec));
  expect(v.parse(nativeColliderSchema([1, 2, 6, 9], 'piece'), solid)).toEqual(v.parse(nativeColliderRecordSchema([1, 2, 6, 9], 'piece'), solid));
  expect(v.parse(nativeGroundSchema(256), pine.ground)).toEqual(v.parse(nativeGroundRecordSchema(256), pine.ground));
  expect(() => v.parse(nativeColliderSchema([1, 2, 6, 9], 'piece'), { ...solid, owner: 'foreign' })).toThrow();
  expect(() => v.parse(nativeGroundSchema(128), pine.ground)).toThrow();
});
