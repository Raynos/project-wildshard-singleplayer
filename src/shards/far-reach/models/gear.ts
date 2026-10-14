import { modelCatalogue } from '@wildshard/game/plugin/geometry';
import { FAN_HELD_OWNERS } from '../runtime/weapons/heldFan';
import { bridgeKit, vane } from '../world/shapes';
import { towerMill } from '../world/mill';
import source from '../runtime/source';
import { HERO_LIBRARY, SKY_LIBRARY } from '../world/meshes';
import { GEAR_SCENE_ROWS } from '../data/gearModels';

/** Existing model owners are built only when their declared specimen is requested. */
export const [fanEntry,windmillEntry,bridgeEntry,keeperEntry,vaneEntry] = modelCatalogue(GEAR_SCENE_ROWS,{owners:new Map<string,unknown>([...Object.entries(FAN_HELD_OWNERS),['npcModels',HERO_LIBRARY],['npcLooks',SKY_LIBRARY]]),source,builds:[
  ['mill',()=>towerMill().group], ['bridge',bridgeKit],
  ['vane',vane],
]});
