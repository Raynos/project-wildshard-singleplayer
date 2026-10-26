// oxlint-disable-next-line import/no-nodejs-modules -- validate the generated catalogue without inferring its complete JSON type
import { readFileSync } from 'node:fs';
import { object, parse } from 'valibot';
import { expect, test } from 'vitest';
import { readProjectAssets } from '../src/sdk/project';
import { parseWorldSceneModels, WorldSceneModelsSchema, worldSceneModelResources } from '../src/format/worldSceneModels';
import { parseWorldScenes } from '../src/format/worldScenes';
import native from '../src/shards/driftwood-isle/data/nativeSpecimens.generated.json' with { type: 'json' };

test('native cards bind the same catalogue and owned sources at boot and product admission', async () => {
  const boot=parse(object({siteCatalogue:WorldSceneModelsSchema}),
    JSON.parse(readFileSync('src/shards/driftwood-isle/boot/modelCatalogue.generated.json','utf8')));
  const loaded = await readProjectAssets('src/shards/driftwood-isle', undefined, { folder: 'driftwood-isle', imageRoots: [{ prefix: '/assets/', directory: 'public/assets' }] });
  const catalogueFile = loaded.output.namedFiles?.find(file => file.name === 'models/world-scenes.json');
  const catalogueBytes = catalogueFile === undefined ? undefined : loaded.assets.get(catalogueFile.hash);
  const platform = loaded.output.platform, section = platform?.sections.find(row => row.name === 'world/scenes');
  const sceneBytes = section === undefined ? undefined : platform?.files.get(section.path);
  if (catalogueBytes === undefined || sceneBytes === undefined) throw new Error('Missing admitted native-card resources');
  const catalogue = parseWorldSceneModels(JSON.parse(new TextDecoder().decode(catalogueBytes)));
  const world = parseWorldScenes(JSON.parse(new TextDecoder().decode(sceneBytes)));
  expect(parseWorldSceneModels(boot.siteCatalogue)).toEqual(catalogue);
  const cards = parseWorldSceneModels(native.catalogue);
  expect(cards.models.map(row => row.key)).toEqual(['captainHat', 'sailclothCape', 'tradeCounter', 'trader']);
  for (const card of cards.models) expect(catalogue.models.filter(row => row.id === card.id)).toEqual([card]);
  const library = world.libraries.find(row => row.id === 'native-specimens');
  if (library?.kind !== 'owned') throw new Error('Native cards require their declared owned library');
  const resources = worldSceneModelResources(cards);
  for (const ref of resources.geometry) {
    expect(ref.library).toBe(library.id);
    const model = library.models.find(row => row.id === ref.model);
    if (model === undefined || typeof model.file !== 'string') throw new Error('Missing native card source');
    const file = loaded.output.namedFiles?.find(row => row.name === model.file);
    expect(file === undefined ? undefined : loaded.assets.get(file.hash)).toBeInstanceOf(Uint8Array);
  }
  for (const material of resources.materials) expect(world.materials.some(row => row.id === material)).toBe(true);
});
