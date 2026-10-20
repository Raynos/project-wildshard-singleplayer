import { expect, test } from 'vitest';
import { parseWorldSceneModels } from '../src/format/worldSceneModels';
import { parseWorldScenes } from '../src/format/worldScenes';
import { defineWorldSceneCatalogue } from '../src/game/models/worldSceneCatalogue';
import { NINE_SCENE_BLOBS, NINE_WORLD_SCENES } from '../src/shards/nine-dragon-stack/generators/worldScenes';
import world from '../src/shards/nine-dragon-stack/data/world.generated.json' with { type: 'json' };
import layout from '../src/shards/nine-dragon-stack/data/layout.generated.json' with { type: 'json' };

const blob = (name: string): unknown => {
  const row = NINE_SCENE_BLOBS.find(entry => entry.file.name === name);
  if (row === undefined) throw new Error(`Missing blob ${name}`);
  return JSON.parse(new TextDecoder().decode(row.bytes));
};

test('every Nine catalogue draw names a declared whole-library model on its own baked tiles', () => {
  const catalogue = parseWorldSceneModels(blob('models/world-scenes.json')), models = defineWorldSceneCatalogue(catalogue);
  for (const model of catalogue.models) expect(models.model(model.key).id).toBe(model.id);
  const libraries = new Map(NINE_WORLD_SCENES.libraries.flatMap(row => row.kind === 'whole' ? [[row.id, row] as const] : []));
  const explorer = new Set(world.libraries.explorer);
  expect([...libraries.keys()]).toEqual(['native', 'native-explorer']);
  for (const tile of libraries.get('native')?.models.flatMap(model => model.files) ?? []) expect(explorer.has(tile)).toBe(false);
  for (const model of catalogue.models) for (const choice of model.choices) for (const draw of [...choice.draws, ...choice.lods.flatMap(level => level.draws)]) {
    expect(libraries.get(draw.library)?.models.some(row => row.id === draw.model)).toBe(true);
    expect(NINE_WORLD_SCENES.materials.some(row => row.id === draw.material)).toBe(true);
  }
  // the lion's TRELLIS cast stays the page's own; every model a kit draws in is a row
  expect(catalogue.models.some(model => model.key === 'guardianLion')).toBe(false);
  for (const copy of layout.rows.inKit) expect(catalogue.models.some(model => model.id === copy.model)).toBe(true);
});

test('a whole library admits unique models with their tiles and refuses an empty tile list', () => {
  const base = { version: 1, materials: [], steps: [] };
  const model = { id: 'a', part: 'a', files: ['f'] };
  expect(parseWorldScenes({ ...base, libraries: [{ id: 'w', kind: 'whole', load: 'explorer', models: [model] }] }).libraries[0]?.kind).toBe('whole');
  expect(() => parseWorldScenes({ ...base, libraries: [{ id: 'w', kind: 'whole', models: [model, model] }] })).toThrow();
  expect(() => parseWorldScenes({ ...base, libraries: [{ id: 'w', kind: 'whole', models: [{ ...model, files: [] }] }] })).toThrow();
});
