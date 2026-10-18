// @vitest-environment happy-dom
import { expect, test } from 'vitest';
import { SIGNAL_MODEL_SPECIMENS as signalModels } from '../src/shards/sunscar-dunes/generators/rows/rigLibrary';
import { SIGNAL_PAGE_PROGRAM } from '../src/shards/sunscar-dunes/generators/rows/population';
import { output as signalOutput } from '../src/shards/sunscar-dunes/generators/output';
import { readSpeciesProgram, readSpeciesPrograms } from '../src/format/speciesPrograms';

// Explorer and page use the same generated body catalogue and exact clip rows.
test('Signal creature models retain body order, framing and page rig contracts', () => {
  const species = SIGNAL_PAGE_PROGRAM.species;
  const bytes = signalOutput.platform.files.get('sections/actors/species-programs.json');
  if (bytes === undefined) throw new Error('Missing emitted Signal species section');
  const admitted = readSpeciesPrograms(JSON.parse(new TextDecoder().decode(bytes)));
  expect(admitted.page).toStrictEqual(species.page);
  expect(admitted.program).toStrictEqual(readSpeciesProgram(species.program));
  expect(admitted.native).toEqual([]);
  expect(signalModels.map(row => row.body)).toEqual(['ray', 'skitterer', 'strider', 'matriarch']);
  expect(signalModels.map(row => 'scale' in row.specimen ? row.specimen.scale : 1)).toEqual([1, 1, 1, 3.6]);
  expect(species.library.looks.map(row => row.body)).toEqual(signalModels.map(row => row.body));
  expect(species.library.looks.map(row => row.look.species)).toEqual(species.page.map(row => row.id));
  expect(species.library.looks.map(row => row.clips.length)).toEqual([3, 7, 12, 5]);
});
