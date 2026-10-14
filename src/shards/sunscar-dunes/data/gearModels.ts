import { WHIP_HELD_RECIPE } from './heldWeapon';
import { SIGNAL_RUNTIME_ROWS } from './runtimeRows';
import { BRAZIERS, CARAVAN, TOWER, WELL } from './layout';
import caravan from './caravan.json' with {type:'json'};
import well from './well.json' with {type:'json'};
import braziers from './braziers.json' with {type:'json'};
import { STRINGS } from './strings';

const FILE = 'src/shards/sunscar-dunes/models/gear.ts';
/** Original catalogue order; native material/motion builders stay with their owners. */
export const GEAR_MODEL_ROWS = [
  {id:'sunscar-dunes/bullwhip',name:STRINGS.whip,category:'gear',pipeline:['hunyuan','code'],file:FILE},
  {id:'sunscar-dunes/signal-tower',name:STRINGS.tower,category:'buildings',pipeline:'code',file:FILE},
  {id:'sunscar-dunes/caravan',name:STRINGS.caravan,category:'props',pipeline:['hunyuan','code'],file:FILE},
  {id:'sunscar-dunes/dry-well',name:STRINGS.well,category:'buildings',pipeline:['hunyuan','code'],file:FILE},
  {id:'sunscar-dunes/waymark-brazier',name:STRINGS.waymark,category:'props',pipeline:['hunyuan','code'],file:FILE},
  {id:'sunscar-dunes/caravan-scout',name:STRINGS.scoutName,category:'people',pipeline:['hunyuan'],file:FILE},
] as const;

export const CARAVAN_MODEL_Y = caravan.anchors.y, WELL_MODEL_Y = well.anchors.y, BRAZIER_MODEL_Y = braziers.braziers[0]?.y ?? 0;
/** Original lazy specimen framing and visible rest parts. */
export const GEAR_SCENE_ROWS = [
  {model:GEAR_MODEL_ROWS[0],builder:'whip',show:['coil'],specimen:{kind:'held',recipe:WHIP_HELD_RECIPE}},
  {model:GEAR_MODEL_ROWS[1],builder:'tower',position:[-TOWER.x,TOWER.deck,-TOWER.z],subtractY:'deckY',show:['fire']},
  {model:GEAR_MODEL_ROWS[2],builder:'caravan',position:[-CARAVAN.x,-CARAVAN_MODEL_Y,-CARAVAN.z]},
  {model:GEAR_MODEL_ROWS[3],builder:'well',position:[-WELL.x,-WELL_MODEL_Y,-WELL.z]},
  {model:GEAR_MODEL_ROWS[4],builder:'brazier',position:[-(BRAZIERS[0]?.x??0),-BRAZIER_MODEL_Y,-(BRAZIERS[0]?.z??0)],show:['fire','oil']},
  {model:GEAR_MODEL_ROWS[5],builder:'scout',specimen:{kind:'npc',npc:'sunscar.scout',
    figure:{...SIGNAL_RUNTIME_ROWS.pageQuest.model,read:{owner:'npcModels',path:['mesh']}},prepare:{owner:'npcModels',path:['preload']}}},
] as const;
