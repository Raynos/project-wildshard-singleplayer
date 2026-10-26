import type { WhipHeldRecipe } from './heldWeapon';
import * as LAYOUT from '../layout';
import STRINGS from '../../data/strings.json' with { type: 'json' };

const FILE = 'src/shards/sunscar-dunes/models/gear.ts';
/** Original catalogue order; native material/motion builders stay with their owners. */
export const GEAR_MODEL_ROWS: readonly [{ readonly id: "sunscar-dunes/bullwhip"; readonly name: string; readonly category: "gear"; readonly pipeline: readonly ["hunyuan", "code"]; readonly file: "src/shards/sunscar-dunes/models/gear.ts"; }, { readonly id: "sunscar-dunes/signal-tower"; readonly name: string; readonly category: "buildings"; readonly pipeline: "code"; readonly file: "src/shards/sunscar-dunes/models/gear.ts"; }, { readonly id: "sunscar-dunes/caravan"; readonly name: string; readonly category: "props"; readonly pipeline: readonly ["hunyuan", "code"]; readonly file: "src/shards/sunscar-dunes/models/gear.ts"; }, { readonly id: "sunscar-dunes/dry-well"; readonly name: string; readonly category: "buildings"; readonly pipeline: readonly ["hunyuan", "code"]; readonly file: "src/shards/sunscar-dunes/models/gear.ts"; }, { readonly id: "sunscar-dunes/waymark-brazier"; readonly name: string; readonly category: "props"; readonly pipeline: readonly ["hunyuan", "code"]; readonly file: "src/shards/sunscar-dunes/models/gear.ts"; }, { readonly id: "sunscar-dunes/caravan-scout"; readonly name: string; readonly category: "people"; readonly pipeline: readonly ["hunyuan"]; readonly file: "src/shards/sunscar-dunes/models/gear.ts"; }] = [
  {id:'sunscar-dunes/bullwhip',name:STRINGS.whip,category:'gear',pipeline:['hunyuan','code'],file:FILE},
  {id:'sunscar-dunes/signal-tower',name:STRINGS.tower,category:'buildings',pipeline:'code',file:FILE},
  {id:'sunscar-dunes/caravan',name:STRINGS.caravan,category:'props',pipeline:['hunyuan','code'],file:FILE},
  {id:'sunscar-dunes/dry-well',name:STRINGS.well,category:'buildings',pipeline:['hunyuan','code'],file:FILE},
  {id:'sunscar-dunes/waymark-brazier',name:STRINGS.waymark,category:'props',pipeline:['hunyuan','code'],file:FILE},
  {id:'sunscar-dunes/caravan-scout',name:STRINGS.scoutName,category:'people',pipeline:['hunyuan'],file:FILE},
] as const;

interface GearModel<Index extends number, Builder extends string> { readonly model: (typeof GEAR_MODEL_ROWS)[Index]; readonly builder: Builder }
interface Positioned { readonly position: readonly [number, number, number] }
/** Fixed catalogue order and the original shared specimen recipe shapes. */
export type GearSceneRows = readonly [
  GearModel<0, 'whip'> & { readonly show: readonly ['coil']; readonly specimen: { readonly kind: 'held'; readonly recipe: WhipHeldRecipe } },
  GearModel<1, 'tower'> & Positioned & { readonly subtractY: 'deckY'; readonly show: readonly ['fire'] },
  GearModel<2, 'caravan'> & Positioned, GearModel<3, 'well'> & Positioned,
  GearModel<4, 'brazier'> & Positioned & { readonly show: readonly ['fire', 'oil'] },
  GearModel<5, 'scout'> & { readonly specimen: { readonly kind: 'npc'; readonly npc: 'sunscar.scout';
    readonly figure: { readonly kind: 'mesh'; readonly read: { readonly owner: 'npcModels'; readonly path: readonly ['mesh'] } };
    readonly prepare: { readonly owner: 'npcModels'; readonly path: readonly ['preload'] } } },
];
/** Original lazy specimen framing and visible rest parts. */
export function gearSceneRows(world: { readonly caravan: { readonly anchors: { readonly y: number } };
  readonly well: { readonly anchors: { readonly y: number } }; readonly braziers: { readonly braziers: readonly { readonly y: number }[] } },
  held: WhipHeldRecipe): GearSceneRows {
  return [
  {model:GEAR_MODEL_ROWS[0],builder:'whip',show:['coil'],specimen:{kind:'held',recipe:held}},
  {model:GEAR_MODEL_ROWS[1],builder:'tower',position:[-LAYOUT.TOWER.x,LAYOUT.TOWER.deck,-LAYOUT.TOWER.z],subtractY:'deckY',show:['fire']},
  {model:GEAR_MODEL_ROWS[2],builder:'caravan',position:[-LAYOUT.CARAVAN.x,-world.caravan.anchors.y,-LAYOUT.CARAVAN.z]},
  {model:GEAR_MODEL_ROWS[3],builder:'well',position:[-LAYOUT.WELL.x,-world.well.anchors.y,-LAYOUT.WELL.z]},
  {model:GEAR_MODEL_ROWS[4],builder:'brazier',position:[-(LAYOUT.BRAZIERS[0]?.x??0),-(world.braziers.braziers[0]?.y??0),-(LAYOUT.BRAZIERS[0]?.z??0)],show:['fire','oil']},
  {model:GEAR_MODEL_ROWS[5],builder:'scout',specimen:{kind:'npc',npc:'sunscar.scout',
    figure:{kind:'mesh',read:{owner:'npcModels',path:['mesh']}},prepare:{owner:'npcModels',path:['preload']}}},
] as const;
}
