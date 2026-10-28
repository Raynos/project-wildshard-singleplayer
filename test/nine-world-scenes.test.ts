import * as v from 'valibot';
import { expect, test } from 'vitest';
import { parseWorldSceneModels } from '../src/format/worldSceneModels';
import { parseWorldScenes } from '../src/format/worldScenes';
import { controlFileHashes } from '../src/format/admissionControl';
import { emptyShardfile } from '../src/sdk/author';
import { defineWorldSceneCatalogue } from '../src/game/models/worldSceneCatalogue';
import NINE, { NINE_SCENE_BLOBS, NINE_WORLD_SCENES, world, layout as sourceLayout } from './fixtures/nine-product-inputs';
import { LayoutRowsSchema } from '../src/shards/nine-dragon-stack/generators/sections';
import { nineRefinementFiles } from '../src/shards/nine-dragon-stack/generators/refinementAdmission';

const blob = (name: string): unknown => {
  const row = NINE_SCENE_BLOBS.find(entry => entry.file.name === name);
  if (row === undefined) throw new Error(`Missing blob ${name}`);
  return JSON.parse(new TextDecoder().decode(row.bytes));
};

test('the real fine-file inventory defers transport while critical demand still wins', () => {
  const late = nineRefinementFiles(NINE_WORLD_SCENES.libraries), hashes = new Set(late.map(row => row.hash));
  const source = emptyShardfile({ slug: 'fine-transport', name: 'Fine transport', author: 'Test', revision: 1, seed: 1 });
  source.files = NINE.files.filter(file => hashes.has(file.hash)); source.library = [...hashes];
  expect(source.files.length).toBeGreaterThan(0); expect(source.files).toHaveLength(hashes.size);
  expect(source.files.every(file => file.kind === 'glb')).toBe(true);
  expect(controlFileHashes(source)).toEqual(hashes);
  source.late = late;
  expect([...controlFileHashes(source)]).toEqual([]);
  const first = source.library[0]; if (first === undefined) throw new Error('Missing fine inventory');
  source.critical = [first];
  expect(controlFileHashes(source)).toEqual(new Set([first]));
});

test('every Nine catalogue draw names a declared whole-library model on its own baked tiles', () => {
  const layout=v.parse(v.object({rows:LayoutRowsSchema}),sourceLayout);
  const catalogue = parseWorldSceneModels(blob('models/world-scenes.json')), models = defineWorldSceneCatalogue(catalogue);
  for (const model of catalogue.models) expect(models.model(model.key).id).toBe(model.id);
  const libraries = new Map(NINE_WORLD_SCENES.libraries.flatMap(row => row.kind === 'whole' ? [[row.id, row] as const] : []));
  const explorer = new Set(world.libraries.explorer);
  expect([...libraries.keys()]).toEqual(['native', 'native-refine', 'native-explorer']);
  for (const id of ['native', 'native-refine']) for (const tile of libraries.get(id)?.models.flatMap(model => model.files) ?? []) expect(explorer.has(tile)).toBe(false);
  // D179 B: the refine library is the city fabric alone (the layout kits and shell), read only by the fabric weld's plain
  // mesh nodes; no catalogue draw reads it (a catalogue model keeps its full exact intake)
  const refine = libraries.get('native-refine');
  expect(refine?.load).toBe('refine');
  expect(refine?.models.length).toBeGreaterThan(0);
  expect(refine?.models.every(row => row.id.startsWith('layout-'))).toBe(true);
  for (const model of catalogue.models) for (const choice of model.choices) for (const draw of [...choice.draws, ...choice.lods.flatMap(level => level.draws)]) expect(draw.library).not.toBe('native-refine');
  // the reader refines a model only from L0 tile rows (refiningWholeLibrary): every file of it is a fine tile's, never a
  // layout-set piece's (layout-9's set geometry stays in 'native')
  const fine = new Set(world.shardfile.tiles.filter(tile => tile.lod === 0).flatMap(tile => tile.files));
  for (const model of refine?.models ?? []) for (const hash of model.files) expect(fine.has(hash), `${model.id} ${hash}`).toBe(true);
  expect(libraries.get('native')?.models.some(row => row.id === 'layout-9')).toBe(true);
  // a draw reads a whole-library model on its baked tiles, a cast in its pool file (the lion's, the crowd's, the hook's
  // levels) or an owned file (the hook's full cast)
  const pools = new Map(NINE_WORLD_SCENES.libraries.flatMap(row => row.kind === 'pool' ? [[row.id, row] as const] : []));
  const owned = new Map(NINE_WORLD_SCENES.libraries.flatMap(row => row.kind === 'owned' ? [[row.id, row] as const] : []));
  for (const model of catalogue.models) for (const choice of model.choices) for (const draw of [...choice.draws, ...choice.lods.flatMap(level => level.draws)]) {
    expect(libraries.get(draw.library)?.models.some(row => row.id === draw.model) === true || pools.get(draw.library)?.files.some(file => file.parts.includes(draw.model)) === true
      || owned.get(draw.library)?.models.some(row => row.id === draw.model) === true, draw.model).toBe(true);
    expect(NINE_WORLD_SCENES.materials.some(row => row.id === draw.material)).toBe(true);
  }
  // the lion's TRELLIS cast is a catalogue row over its pool, its middle levels on the full cast's attributes; every
  // model a kit draws in is a row
  const lion = catalogue.models.find(model => model.key === 'guardianLion');
  expect(lion?.choices[0]?.lods.map(level => level.draws.map(row => [row.model, row.attributes?.model]))).toEqual([[['lion-mid10', 'lion']], [['lion-mid30', 'lion']]]);
  for (const copy of layout.rows.inKit) expect(catalogue.models.some(model => model.id === copy.model)).toBe(true);
});

test('a whole library admits unique models with their tiles and refuses an empty tile list', () => {
  const base = { version: 1, materials: [], steps: [] };
  const model = { id: 'a', part: 'a', files: ['f'] };
  expect(parseWorldScenes({ ...base, libraries: [{ id: 'w', kind: 'whole', load: 'explorer', models: [model] }] }).libraries[0]?.kind).toBe('whole');
  expect(() => parseWorldScenes({ ...base, libraries: [{ id: 'w', kind: 'whole', models: [model, model] }] })).toThrow();
  expect(() => parseWorldScenes({ ...base, libraries: [{ id: 'w', kind: 'whole', models: [{ ...model, files: [] }] }] })).toThrow();
});
