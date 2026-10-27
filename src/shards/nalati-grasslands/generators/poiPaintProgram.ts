import * as v from 'valibot';
import type { ProjectGenerationContext } from '@wildshard/sdk/projectGeneration';
import catalogue from '../data/campCatalogue.json' with { type: 'json' };
import contacts from '../data/poiContacts.json' with { type: 'json' };
import { bakeModelPaint } from './modelPaint.mjs';
import { nalatiPoiPaintSources, POI_PAINT_MODELS } from './poiPaintSources';

const terrain = '/assets/baked/nalati-grasslands/terrain.bin';
const modelPrefix = '/assets/nalati/models/';
const signSchema = v.object({ model: v.object({ defaults: v.object({
  boards: v.array(v.object({ text: v.string(), dir: v.number() })),
}) }) });

/** Source-owned paint publication: native cache identity includes the terrain and
 * every original rock model. Bundled authored boards/contacts key the recipe. */
export async function nalatiPoiPaintProgram(ctx: Pick<ProjectGenerationContext, 'cached'>): Promise<ReadonlyMap<string, Uint8Array>> {
  const files = await ctx.cached({ id: 'poi-paint', native: true,
    inputs: [terrain, ...POI_PAINT_MODELS.map(name => `${modelPrefix}${name}`)] }, async inputs => {
    const native = inputs.get(terrain);
    if (native === undefined) throw new Error('Missing native POI terrain');
    const sign = v.parse(signSchema, catalogue.find(row => row.key === 'signpostBaked'));
    const models = new Map<string, Uint8Array>();
    for (const file of POI_PAINT_MODELS) {
      const bytes = inputs.get(`${modelPrefix}${file}`), name = file.split('.')[0];
      if (bytes === undefined || name === undefined) throw new Error(`Missing authored POI model ${file}`);
      models.set(file, await bakeModelPaint(bytes, name));
    }
    return nalatiPoiPaintSources(native, sign.model.defaults.boards, models, contacts);
  });
  const expected = ['boot/poiPaint.json', 'data/poiPaint.json',
    ...Array.from({ length: 14 }, (_, index) => `data/poi-shape-${String(index)}.bin`)];
  if (files.size !== expected.length || expected.some(name => (files.get(name)?.length ?? 0) === 0)) {
    throw new Error('Owned POI paint inventory differs');
  }
  return files;
}
