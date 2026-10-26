import { defineSpecimenCatalogue } from '@wildshard/game/models/specimenCatalogue';
import rows from '../data/trailCatalogue.json' with { type: 'json' };
import type { CatalogueParams } from './trailParams';

const catalogue: ReturnType<typeof defineSpecimenCatalogue<CatalogueParams>> = defineSpecimenCatalogue<CatalogueParams>(rows);
export const fencePost: ReturnType<typeof catalogue.model<'fencePost'>> = catalogue.model('fencePost');
export const signpost: ReturnType<typeof catalogue.model<'signpost'>> = catalogue.model('signpost');
export const plankStep: ReturnType<typeof catalogue.model<'plankStep'>> = catalogue.model('plankStep');
