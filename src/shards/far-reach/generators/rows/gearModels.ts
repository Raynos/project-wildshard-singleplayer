import questPage from '../../data/questPage.generated.json' with { type: 'json' };
import { FAN_HELD_RECIPE } from './heldWeapon';
import STRINGS from '../../data/strings.json' with { type: 'json' };

const FILE = 'src/shards/far-reach/models/gear.ts';
/** Original lazy Explorer metadata and order; live material owners remain borrowed. */
export const GEAR_SCENE_ROWS = [
  {builder:'fan',specimen:{kind:'held',recipe:FAN_HELD_RECIPE},model:{id:'far-reach/war-fan',name:STRINGS.fan,category:'gear',pipeline:'code',file:FILE}},
  {builder:'mill',model:{id:'far-reach/windmill',name:STRINGS.mill,category:'buildings',pipeline:['code'],file:'src/shards/far-reach/world/mill.ts'}},
  {builder:'bridge',model:{id:'far-reach/rope-bridge',name:STRINGS.rope,category:'buildings',pipeline:['hunyuan','code'],file:FILE}},
  {builder:'keeper',specimen:{kind:'npc',npc:'far.keeper',figure:{kind:'pivots',materialId:questPage.model.material,read:{owner:'npcModels',path:['painted']},material:{owner:'npcLooks',path:['mappedLook']}},prepare:{owner:'npcModels',path:['preload']}},model:{id:'far-reach/keeper',name:STRINGS.keeperName,category:'people',pipeline:['hunyuan','code'],file:FILE}},
  {builder:'vane',model:{id:'far-reach/wind-vane',name:STRINGS.vane,category:'props',pipeline:['hunyuan','code'],file:FILE}},
] as const;
