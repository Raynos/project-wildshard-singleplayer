import { defineSpecimenCatalogue } from '@wildshard/game/models/specimenCatalogue';
import data from '../boot/specimens.generated.json' with { type: 'json' };
import type { CatalogueParams } from '../boot/specimenParams.generated';

const catalogue = defineSpecimenCatalogue<CatalogueParams>(data.catalogue);
export const fencePost = catalogue.model('fencePost');
export const signpost = catalogue.model('signpost');
export const plankStep = catalogue.model('plankStep');
