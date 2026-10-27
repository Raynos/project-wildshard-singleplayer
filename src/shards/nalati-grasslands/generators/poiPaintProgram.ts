import type { Board } from './campParams';
import type { ProjectGenerationContext } from '@wildshard/sdk/projectGeneration';
import catalogue from '../data/campCatalogue.json' with { type: 'json' };
import contacts from '../data/poiContacts.json' with { type: 'json' };
import { bakeModelPaint } from './modelPaint.mjs';
import { nalatiPoiPaintSources, POI_PAINT_MODELS } from './poiPaintSources';

const terrain = '/assets/baked/nalati-grasslands/terrain.bin';
const modelPrefix = '/assets/nalati/models/';
function signBoards(input: unknown): readonly Board[] {
  const record = (value: unknown): Record<string, unknown> => {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid POI sign declaration');
    return value as Record<string, unknown>;
  };
  const boards = record(record(record(input)['model'])['defaults'])['boards'];
  if (!Array.isArray(boards)) throw new Error('Missing POI sign boards');
  return boards.map((value: unknown) => {
    const row = record(value), text = row['text'], dir = row['dir'];
    if (typeof text !== 'string' || typeof dir !== 'number' || !Number.isFinite(dir)) throw new Error('Invalid POI sign board');
    return { text, dir };
  });
}

/** Explicit input inventory shared by the product cache and offline map author. */
export const POI_PAINT_INPUTS: readonly string[] = [terrain, ...POI_PAINT_MODELS.map(name => `${modelPrefix}${name}`)];

/** Source-owned paint publication: native cache identity includes the terrain and
 * every original rock model. Bundled authored boards/contacts key the recipe. */
export async function nalatiPoiPaintProgram(ctx: Pick<ProjectGenerationContext, 'cached'>): Promise<ReadonlyMap<string, Uint8Array>> {
  const files = await ctx.cached({ id: 'poi-paint', native: true, inputs: POI_PAINT_INPUTS }, nalatiPoiPaintFromInputs);
  const expected = ['boot/poiPaint.json', 'data/poiPaint.json',
    ...Array.from({ length: 14 }, (_, index) => `data/poi-shape-${String(index)}.bin`)];
  if (files.size !== expected.length || expected.some(name => (files.get(name)?.length ?? 0) === 0)) {
    throw new Error('Owned POI paint inventory differs');
  }
  return files;
}

/** Pure author input composition, without cache or publication capabilities. */
export async function nalatiPoiPaintFromInputs(inputs: ReadonlyMap<string, Uint8Array>): Promise<ReadonlyMap<string, Uint8Array>> {
    const native = inputs.get(terrain);
    if (native === undefined) throw new Error('Missing native POI terrain');
    const boards = signBoards(catalogue.find(row => row.key === 'signpostBaked'));
    const models = new Map<string, Uint8Array>();
    for (const file of POI_PAINT_MODELS) {
      const bytes = inputs.get(`${modelPrefix}${file}`), name = file.split('.')[0];
      if (bytes === undefined || name === undefined) throw new Error(`Missing authored POI model ${file}`);
      models.set(file, await bakeModelPaint(bytes, name));
    }
    return nalatiPoiPaintSources(native, boards, models, contacts);
}
