import { defineWorldSceneCatalogue } from '@wildshard/game/models/worldSceneCatalogue';
import data from '../boot/modelCatalogue.generated.json' with { type: 'json' };

export const sites = defineWorldSceneCatalogue(data.siteCatalogue);
export const captainHat = sites.model('captainHat');
export const sailclothCape = sites.model('sailclothCape');
export const tradeCounter = sites.model('tradeCounter');
export const trader = sites.model('trader');
