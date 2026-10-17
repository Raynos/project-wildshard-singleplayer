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
