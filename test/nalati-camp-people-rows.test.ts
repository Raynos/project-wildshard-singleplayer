import { expect, test } from 'vitest';
import { campPeople } from '../src/shards/nalati-grasslands/models/people';
import frames from '../src/shards/nalati-grasslands/boot/peopleFrames.generated.json' with { type: 'json' };

test('camp choices retain the original public order, labels and typed parameters', () => {
  expect(campPeople.defaults).toEqual({ person: 'elder' });
  expect(campPeople.variants).toEqual([
    { id: 'elder', label: 'Baqyt Ata, the elder', params: { person: 'elder' } },
    { id: 'herderGate', label: 'Dauren, herder (corral gate)', params: { person: 'herderGate' } },
    { id: 'herderRail', label: 'Erlan, herder (hitching rail)', params: { person: 'herderRail' } },
    { id: 'child', label: 'Ayan, the child', params: { person: 'child' } },
    { id: 'cook', label: 'Gulnar Apa, the cook', params: { person: 'cook' } },
  ]);
  for (const choice of campPeople.variants ?? []) expect(Object.hasOwn(frames.figures, choice.id)).toBe(true);
});
