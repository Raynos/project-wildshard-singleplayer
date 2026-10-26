import * as v from 'valibot';
import pins from './nalati-species-files.json' with { type: 'json' };

const bank = pins.find(pin => /^public\/assets\/nalati\/baked\/bodies-[a-f0-9]{64}\.bin$/u.test(pin.path));
if (bank === undefined) throw new Error('Missing complete original species bank pin');
export const originalSpeciesBank = bank;
const originalFile = bank.path.slice('public'.length);
const file = v.looseObject({ file: v.string() });
const source = v.looseObject({ packedBodies: file, presentation: v.looseObject({ packedBodies: file }), hullBook: v.looseObject({ compactBody: file }) });

/** Reconstruct only the three transport locators; retain every original metadata field and its assignment order. */
export function originalSpeciesMetadata(input: unknown): unknown {
  const rows = structuredClone(input);
  if (!v.is(source, rows)) throw new Error('Missing complete species metadata');
  for (const body of [rows.packedBodies, rows.presentation.packedBodies, rows.hullBook.compactBody]) {
    if (body.file !== 'actors/bodies.bin') throw new Error('Unexpected named species bank locator');
    body.file = originalFile;
  }
  return rows;
}

/** Restore the one named transport field in each complete shipped JSON document. */
export function originalSpeciesProductRows(name: string, input: unknown): unknown {
  const rows = structuredClone(input);
  let body;
  if (name === 'look/hull-book') {
    if (!v.is(v.looseObject({ compactBody: file }), rows)) throw new Error('Missing complete hull book');
    body = rows.compactBody;
  } else if (name === 'actors/sheep.json') {
    if (!v.is(v.looseObject({ species: v.looseObject({ packedBodies: file }) }), rows)) throw new Error('Missing complete species actors');
    body = rows.species.packedBodies;
  } else throw new Error('Unknown species transport document');
  if (body.file !== 'actors/bodies.bin') throw new Error('Unexpected product species bank locator');
  body.file = originalFile;
  return rows;
}
