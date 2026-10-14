import { modelCatalogue } from '@wildshard/game/plugin/geometry';
import { FAN_HELD_OWNERS } from '../runtime/weapons/heldFan';
import { bridgeKit, vane } from '../world/shapes';
import { towerMill } from '../world/mill';
import { questNpcSpecimen } from '@wildshard/game/plugin/ui';
import source from '../runtime/source';
import { SKY_LIBRARY, skyHd } from '../world/meshes';
import { GEAR_SCENE_ROWS } from '../data/gearModels';

/** Existing model owners are built only when their declared specimen is requested. */
export const [fanEntry,windmillEntry,bridgeEntry,keeperEntry,vaneEntry] = modelCatalogue(GEAR_SCENE_ROWS,{owners:new Map<string,unknown>(Object.entries(FAN_HELD_OWNERS)),builds:[
  ['mill',()=>towerMill().group], ['bridge',bridgeKit],
  ['keeper',()=>questNpcSpecimen(source,'far.keeper',{kind:'pivots',read:()=>skyHd('keeper-hd'),material:map=>SKY_LIBRARY.mappedLook('keeper-scarf',map)})],
  ['vane',vane],
]});
