// oxlint-disable-next-line import/no-nodejs-modules -- validate the generated site catalogue without inferring its complete JSON type
import { readFileSync } from 'node:fs';
import { object, parse } from 'valibot';
import { WorldSceneModelsSchema } from '../../src/format/worldSceneModels';
import { defineWorldSceneCatalogue } from '@wildshard/game/models/worldSceneCatalogue';

export const siteRows=parse(object({siteCatalogue:WorldSceneModelsSchema}),
  JSON.parse(readFileSync('src/shards/driftwood-isle/boot/modelCatalogue.generated.json','utf8'))).siteCatalogue;

export const sites = defineWorldSceneCatalogue(siteRows);
export const captainHat = sites.model('captainHat');
export const sailclothCape = sites.model('sailclothCape');
export const tradeCounter = sites.model('tradeCounter');
export const trader = sites.model('trader');
