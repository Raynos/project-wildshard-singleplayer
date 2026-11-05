import { parseWorldScenePlacementPage } from '@wildshard/format/worldScenePlacement';
import { expect, test } from 'vitest';
import { driftwoodCatalogueFiles, driftwoodOutputRows, output } from '../src/shards/driftwood-isle/generators/output';
import { validateNamedJsonSchema } from '../src/game/shared/shardfile/customSchema';
import { driftwoodSceneBanks } from './fixtures/driftwoodSceneBanks';
import { DRIFTWOOD_GUEST_ROWS } from './fixtures/driftwood-guest-programs';

test('every Driftwood named JSON has a defining schema and corrupt scenes refuse', async () => {
  // The emitted inventory, not only the static rows: since GR7 the foliage placements, quest page, population, returns,
  // keeper and director files are built from the scene banks' layouts, and the banks add their own catalogue.
  const banks = await driftwoodSceneBanks(), rows = driftwoodOutputRows(banks.layouts, banks.facts, DRIFTWOOD_GUEST_ROWS);
  const files = [...rows.namedFiles, ...driftwoodCatalogueFiles(banks).files].filter(file => file.kind === 'json');
  expect(output.namedFiles.filter(file => file.kind === 'json').every(file => files.some(row => row.name === file.name))).toBe(true);
  for (const name of ['world/placement-pages/harbour.shared.0.json', 'world/placement-pages/foliage-phone.shared.0.json', 'world/placement-pages/foliage-desktop.shared.0.json', 'quests/page-composition.json', 'directors/main.json', 'scenes/rocks.json', 'models/world-scenes.json'])
    expect(files.some(file => file.name === name), name).toBe(true);
  const pageFile=files.find(file=>file.name==='world/placement-pages/harbour.shared.0.json');
  if(pageFile===undefined)throw new Error('Missing native placement page');
  const bytes=rows.assets.get(pageFile.hash);if(bytes===undefined)throw new Error('Missing native placement bytes');
  const wire:unknown=JSON.parse(new TextDecoder().decode(bytes)),page=parseWorldScenePlacementPage(wire);
  expect(page.rows).toHaveLength(8);
  for(const id of ['foliage.logs','wreck.logs'])expect(page.rows.some(row=>row.id===id)).toBe(true);
  // Keep the original >40-document inventory floor over logical documents:
  // exactly 12 original native documents now occupy three transport files.
  expect(files.length+12-3).toBeGreaterThan(40);
  expect(files.filter(file=>(file.name?.startsWith('world/piers/')??false)||(file.name?.startsWith('world/foliage/')??false))).toHaveLength(0);
  for (const file of files) expect(file.jsonSchema, file.name).toBeDefined();
  const scene = files.find(file => file.name === 'scenes/zipline.json');
  if (scene === undefined) throw new Error('Missing zipline scene');
  expect(() => validateNamedJsonSchema(scene.jsonSchema, new TextEncoder().encode('{"scene":{"root":42},"imports":[]}'))).toThrow('refuses its schema');
});
