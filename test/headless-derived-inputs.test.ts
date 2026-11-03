import { expect, test } from 'vitest';
import * as v from 'valibot';
import { headlessSpecCatalogue } from '../src/sdk/headlessRuntime';
import { encodeCanonicalJson } from '../src/sdk/immutable';
import { driftwoodPhysics } from '../src/shards/driftwood-isle/generators/physics';
import { driftwoodNativeRows } from '../src/shards/driftwood-isle/generators/nativeBake';
import { TOON_LOOK } from '../src/shards/driftwood-isle/generators/toonPresentation';
import { output } from '../src/shards/driftwood-isle/generators/output';
import { ToonLookSchema } from '../src/format/toonLook';

test('the admitted physics reconstructs every original native catalogue byte in order', () => {
  const original = driftwoodNativeRows(driftwoodPhysics());
  const actual = headlessSpecCatalogue([...original.physics.actors.map(actor => actor.spec), original.physics.captain.spec]);
  expect(encodeCanonicalJson([...actual])).toBe(encodeCanonicalJson(original.nativeSpecs));
  expect(actual.get('captain.captain')).toBe(original.physics.captain.spec);
});

test('the emitted toon section retains the entire native day input without an assembly copy', () => {
  const file = output.namedFiles.find(row => row.name === 'sim/headless-assembly.json');
  const bytes = file === undefined ? undefined : output.assets.get(file.hash);
  if (bytes === undefined) throw new Error('Missing emitted native assembly');
  const assembly: unknown = JSON.parse(new TextDecoder().decode(bytes));
  expect(assembly).not.toHaveProperty('constants.dayStyle');
  expect(assembly).not.toHaveProperty('constants.nativeSpecs');
  const section = output.platform.sections.find(row => row.name === 'look/toon');
  const lookBytes = section === undefined ? undefined : output.platform.files.get(section.path);
  if (lookBytes === undefined) throw new Error('Missing emitted toon section');
  const look = v.parse(ToonLookSchema, JSON.parse(new TextDecoder().decode(lookBytes)));
  expect(encodeCanonicalJson(look.sky.day)).toBe(encodeCanonicalJson(TOON_LOOK.sky.day));
});

test('native catalogue derivation keeps order and borrows bodies while refusing divergent identities', () => {
  const first = { kind: 'crab', variant: 'shore', hp: 4 };
  const second = { kind: 'wolf', variant: 'grey', hp: 8 };
  const repeat = { ...first };
  const catalogue = headlessSpecCatalogue([first, second, repeat]);
  expect([...catalogue.keys()]).toEqual(['crab.shore', 'wolf.grey']);
  expect(catalogue.get('crab.shore')).toBe(repeat);
  expect(catalogue.get('wolf.grey')).toBe(second);
  expect(() => headlessSpecCatalogue([first, { ...first, hp: 5 }])).toThrow('Divergent native spec crab.shore');
  expect([...headlessSpecCatalogue([])]).toEqual([]);
});
