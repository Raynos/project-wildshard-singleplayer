import { expect, test } from 'vitest';
import { encodeCanonicalJson } from '../src/sdk/immutable';
import { nalatiHeadlessAssembly } from '../src/shards/nalati-grasslands/generators/nativeGroups';
import { nalatiNativeGroupWire } from '../src/shards/nalati-grasslands/generators/nativeGroupWire';
import { nalatiGroupInputs } from './fixtures/nalati-group-inputs';
import { NALATI_ADMISSION } from './fixtures/nalati-admission';
import { NALATI_PASTURE } from './fixtures/nalati-titan';

const { constants } = nalatiHeadlessAssembly(NALATI_PASTURE, NALATI_ADMISSION);
const original = constants.groupRows, wildlife = constants.pageWildlife;
const wire = nalatiNativeGroupWire(original, wildlife.pasture);

test('live wildlife restores every native group byte and ordered guest declaration', () => {
  const actual = nalatiGroupInputs(wire, wildlife);
  expect(encodeCanonicalJson(actual)).toBe(encodeCanonicalJson(original));
  expect(actual.steps.map(step => step.kind)).toEqual(['group', 'group', 'delay', 'group']);
  expect(encodeCanonicalJson(original).length - encodeCanonicalJson(wire).length).toBe(80934);
});

test('a divergent guest programme cannot be silently removed or shadow its wildlife owner', () => {
  expect(() => nalatiNativeGroupWire(original, { ...wildlife.pasture, bytes: 'changed' })).toThrow('differs from its wildlife owner');
  expect(() => nalatiGroupInputs(original, wildlife)).toThrow();
  expect(() => nalatiGroupInputs(wire, { ...wildlife, pasture: { ...wildlife.pasture, bytes: 3 } })).toThrow();
});

test('the complete original group parser still refuses invalid contacts and adoption', () => {
  expect(() => nalatiGroupInputs({ ...wire, contacts: { ...wire.contacts, pack: { ...wire.contacts.pack, damage: 'bad' } } }, wildlife)).toThrow();
  expect(() => nalatiGroupInputs({ ...wire, steps: wire.steps.map(step => step.kind === 'group' ? { ...step, adopt: 3 } : step) }, wildlife)).toThrow();
  expect(() => nalatiGroupInputs({ ...wire, injected: 'unused' }, wildlife)).toThrow();
});
