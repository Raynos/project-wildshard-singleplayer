import { object, parse } from 'valibot';
import { WorldSceneModelsSchema } from '../../src/format/worldSceneModels';
import { defineWorldSceneCatalogue } from '@wildshard/game/models/worldSceneCatalogue';
import { driftwoodModelCatalogue } from './driftwoodModelCatalogue';

export const siteRows=parse(object({siteCatalogue:WorldSceneModelsSchema}),
  await driftwoodModelCatalogue()).siteCatalogue;

export const sites = defineWorldSceneCatalogue(siteRows);
export const captainHat = sites.model('captainHat');
export const sailclothCape = sites.model('sailclothCape');
export const tradeCounter = sites.model('tradeCounter');
export const trader = sites.model('trader');
