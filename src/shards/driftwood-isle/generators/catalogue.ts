import { defineSpecimenCatalogue } from '@wildshard/game/models/specimenCatalogue';
import rows from '../data/trailCatalogue.json' with { type: 'json' };
import type { CatalogueParams } from './trailParams';

const catalogue = defineSpecimenCatalogue<CatalogueParams>(rows);
export const fencePost = catalogue.model('fencePost');
export const signpost = catalogue.model('signpost');
export const plankStep = catalogue.model('plankStep');
