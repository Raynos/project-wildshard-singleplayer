import { defineSceneModels } from '@wildshard/engine/models/model';
import { fanParts } from '../runtime/weapons/heldFan';
import { bridgeKit, vane } from '../world/shapes';
import { towerMill } from '../world/mill';
import { questNpcSpecimen } from '@wildshard/game/plugin/ui';
import source from '../runtime/source';
import { skyHd } from '../world/meshes';
import { skyMappedLook } from '../world/looks';
import { GEAR_SCENE_ROWS } from '../data/gearModels';

/** Existing model owners are built only when their declared specimen is requested. */
export const [fanEntry,windmillEntry,bridgeEntry,keeperEntry,vaneEntry] = defineSceneModels(GEAR_SCENE_ROWS,[
  ['fan',fanParts], ['mill',()=>towerMill().group], ['bridge',bridgeKit],
  ['keeper',()=>questNpcSpecimen(source,'far.keeper',{kind:'pivots',read:()=>skyHd('keeper-hd'),material:map=>skyMappedLook('keeper-scarf',map)})],
  ['vane',vane],
]);
