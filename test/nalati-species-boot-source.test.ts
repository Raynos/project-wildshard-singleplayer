import { originalSpeciesJson } from './fixtures/nalati-original-species';
import * as v from 'valibot';
import { expect, test } from 'vitest';
import { SPECIES_POSES } from '../src/shards/nalati-grasslands/generators/speciesPoses';
import { parseClientChannels } from '../src/format/clientChannels';

test('authored pose rows retain the entire original serialized graph and parsed header channels', () => {
  const before = v.parse(v.object({ poses: v.record(v.string(), v.object({ programs: v.unknown() })) }),
    originalSpeciesJson('species.json'));
  const original = v.parse(v.object({ poses: v.unknown() }), originalSpeciesJson('species.json'));
  expect(JSON.stringify(SPECIES_POSES)).toBe(JSON.stringify(original.poses));
  expect(Object.values(SPECIES_POSES).flatMap(pose => parseClientChannels(pose.programs)))
    .toEqual(Object.values(before.poses).flatMap(pose => parseClientChannels(pose.programs)));
});
