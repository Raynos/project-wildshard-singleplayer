import type { CustomSections } from '../runtime/productSections.generated.d.ts';
import { defineGeometryModel, type GeometryModelSource, type ModelDef } from '@wildshard/engine/models/model';
import { driftwoodRows } from '../runtime/boot/rows';
import { defineWorldSceneCatalogue } from '@wildshard/game/models/worldSceneCatalogue';
import { defineSpecimenCatalogue } from '@wildshard/game/models/specimenCatalogue';
import data from '../boot/modelCatalogue.generated.json' with { type: 'json' };
import type { CatalogueParams } from '../boot/specimenParams.generated';

const catalogue = defineSpecimenCatalogue<CatalogueParams>(data.catalogue);
export const fencePost = catalogue.model('fencePost');
export const signpost = catalogue.model('signpost');
export const plankStep = catalogue.model('plankStep');

export const sites = defineWorldSceneCatalogue(data.siteCatalogue);
export const hut = sites.model('hut');
export const lookout = sites.model('lookout');
export const shipwreck = sites.model('shipwreck');
export const shrine = sites.model('shrine');

export const shoreBoulder = sites.model('shoreBoulder');
export const smallRock = sites.model('smallRock');
export const reefRock = sites.model('reefRock');

export const palm = sites.model('palm');
export const hibiscusBush = sites.model('hibiscus');
export const driftLog = sites.model('driftLog');
export const pier = sites.model('pier');
export const boat = sites.model('boat');
export const zipline = sites.model('zipline');

/** The island supplies its already-loaded prototypes and looks, with no fitting. */
export function coveModels(source: GeometryModelSource): ReadonlyMap<string, { readonly look: CustomSections['custom/fixedLayouts']['island']['models'][number]['look']; readonly model: ModelDef<{ proto: string }> }> {
  return new Map(driftwoodRows('custom/fixedLayouts').island.models.map(row => [row.key, { look: row.look,
    model: defineGeometryModel(row.model, 'proto', { category: row.model.category, pipeline: row.model.pipeline }, source) }]));
}
