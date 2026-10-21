import { defineWorldSceneCatalogue } from '@wildshard/game/models/worldSceneCatalogue';
import data from '../boot/modelCatalogue.generated.json' with { type: 'json' };

export const sites = defineWorldSceneCatalogue(data.siteCatalogue);
export const captainHat = sites.model('captainHat');
export const sailclothCape = sites.model('sailclothCape');
export const tradeCounter = sites.model('tradeCounter');
export const trader = sites.model('trader');
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
