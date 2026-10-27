import { array, object, parse, string } from 'valibot';
import { expect, test } from 'vitest';
import { driftwoodCatalogueFiles } from '../src/shards/driftwood-isle/generators/output';
import { worldScenes } from '../src/shards/driftwood-isle/generators/worldScenes';
import { parseWorldSceneModels, WorldSceneModelsSchema, worldSceneModelResources } from '../src/format/worldSceneModels';
import { parseWorldScenes } from '../src/format/worldScenes';
import { driftwoodFixedFiles, driftwoodSceneBanks } from './fixtures/driftwoodSceneBanks';
import { driftwoodModelCatalogue } from './fixtures/driftwoodModelCatalogue';

test('native cards bind the same catalogue and owned sources at boot and product admission', async () => {
  const boot=parse(object({siteCatalogue:WorldSceneModelsSchema}),
    await driftwoodModelCatalogue());
  // The product's own producers over the banks the build makes (no whole-product read): the emitted site catalogue file,
  // the world/scenes section's rows and the fixed program files the native library names.
  const banks = await driftwoodSceneBanks(), fixed = await driftwoodFixedFiles(), emitted = driftwoodCatalogueFiles(banks);
  const catalogueFile = emitted.files.find(file => file.name === 'models/world-scenes.json');
  const catalogueBytes = catalogueFile === undefined ? undefined : emitted.assets.get(catalogueFile.hash);
  if (catalogueBytes === undefined) throw new Error('Missing admitted native-card resources');
  const catalogue = parseWorldSceneModels(JSON.parse(new TextDecoder().decode(catalogueBytes)));
  const world = parseWorldScenes(worldScenes(banks));
  expect(parseWorldSceneModels(boot.siteCatalogue)).toEqual(catalogue);
  const { native } = banks, cards = parseWorldSceneModels(native.catalogue);
  const blobRows: unknown = JSON.parse(new TextDecoder().decode(fixed.get('data/fixedBlobs.generated.json')));
  const blobs = parse(object({ blobs: array(object({ name: string(), source: string() })) }), blobRows).blobs;
  expect(cards.models.map(row => row.key)).toEqual(['captainHat', 'sailclothCape', 'tradeCounter', 'trader']);
  for (const card of cards.models) expect(catalogue.models.filter(row => row.id === card.id)).toEqual([card]);
  const library = world.libraries.find(row => row.id === 'native-specimens');
  if (library?.kind !== 'owned') throw new Error('Native cards require their declared owned library');
  const resources = worldSceneModelResources(cards);
  for (const ref of resources.geometry) {
    expect(ref.library).toBe(library.id);
    const model = library.models.find(row => row.id === ref.model);
    if (model === undefined || typeof model.file !== 'string') throw new Error('Missing native card source');
    const source = blobs.find(row => row.name === model.file)?.source;
    expect(source === undefined ? undefined : fixed.get(source)).toBeInstanceOf(Uint8Array);
  }
  for (const material of resources.materials) expect(world.materials.some(row => row.id === material)).toBe(true);
});
