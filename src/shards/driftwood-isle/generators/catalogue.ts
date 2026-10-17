import { defineSpecimenCatalogue } from '@wildshard/sdk/kit/specimenCatalogue';
import rows from '../data/trailCatalogue.json' with { type: 'json' };
import type { CatalogueParams } from '../data/trailParams';

const catalogue = defineSpecimenCatalogue<CatalogueParams>(rows);
export const fencePost = catalogue.model('fencePost');
export const signpost = catalogue.model('signpost');
export const plankStep = catalogue.model('plankStep');
