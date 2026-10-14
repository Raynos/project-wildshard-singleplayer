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
