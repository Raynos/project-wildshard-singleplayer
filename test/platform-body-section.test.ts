import { expect, test } from 'vitest';
import { parsePlatformDataSection } from '../src/format/platformDataSections';
import { emitPlatformSections } from '../src/sdk/platformSections';
import { BARREL_BODIES } from '../src/shards/driftwood-isle/generators/barrelDecision';

test('declared body section preserves actual body profiles and captured floors', () => {
  const rows = parsePlatformDataSection('sim/bodies', BARREL_BODIES);
  const emitted = emitPlatformSections(new Map([['sim/bodies', rows]]));
  const section = emitted.sections.find(row => row.name === 'sim/bodies');
  if (section === undefined) throw new Error('Missing declared body section');
  const bytes = emitted.files.get(section.path);
  if (bytes === undefined) throw new Error('Missing declared body bytes');
  expect(section.schema).toBe('wildshard:sim/bodies@1');
  expect(parsePlatformDataSection('sim/bodies', JSON.parse(new TextDecoder().decode(bytes)))).toEqual(rows);
  expect(rows.bodies).toEqual(BARREL_BODIES.bodies);
  expect(rows.floors).toEqual(BARREL_BODIES.floors);
});

test('declared body admission refuses duplicate identities and foreign collision targets', () => {
  expect(() => parsePlatformDataSection('sim/bodies', { ...BARREL_BODIES, bodies: [...BARREL_BODIES.bodies, ...BARREL_BODIES.bodies] })).toThrow();
  expect(() => parsePlatformDataSection('sim/bodies', { ...BARREL_BODIES, colliders: [{ id: 'gate', target: { kind: 'body', body: 'missing' } }] })).toThrow();
  expect(() => parsePlatformDataSection('sim/bodies', { ...BARREL_BODIES, floors: [{ x: 0, z: 0, step: 1, width: 2, height: 2, values: [0] }] })).toThrow();
});
