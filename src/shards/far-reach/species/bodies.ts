import { creatureLooks, creatureBodies } from '@wildshard/game/plugin/geometry';
import { SKY_CREATURES, SKY_CREATURE_RIGS } from '../data/files';
import { releaseDecodedOnUpload } from '../look/image';
import { SKY_STAND_INS } from '../data/standIns';
import { SKY_CREATURE_LOOK_ROWS } from '../data/creatureLooks';

/**
 * Sky Reach's creature bodies, baked offline (SHARD-PLATFORM M3: `generators/creatures.ts` → `rigs/<creature>.glb`) and
 * loaded by the game's shared creature-body loader; a body that did not load stands undrawn on its stand-in skeleton
 * (data/standIns.ts). Memory saver: each decoded atlas goes at its upload (no CPU reader; every Roc shares one texture).
 */
export const SKY_BODIES = creatureBodies({ creatures: SKY_CREATURES, urls: SKY_CREATURE_RIGS, standIns: SKY_STAND_INS, fault: '[far-reach]',
  onMap: (map) => { const atlas: unknown = map.image; if (typeof ImageBitmap !== 'undefined' && atlas instanceof ImageBitmap) releaseDecodedOnUpload(map, () => { atlas.close(); }); } });
/** The authored ordered look catalogue on the unchanged shared loader. */
export const SKY_CREATURE_LOOKS = creatureLooks(SKY_BODIES, SKY_CREATURE_LOOK_ROWS);
