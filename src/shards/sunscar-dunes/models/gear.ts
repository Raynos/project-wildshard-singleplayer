import { modelCatalogue } from '@wildshard/game/plugin/geometry';
import { WHIP_HELD_OWNERS } from '../runtime/items/heldWhip';
import { WORLD } from '../world/baked';
import { buildPlace } from '../world/places';
import source from '../runtime/source';
import { DUNE_LIBRARY } from '../world/meshes';
import { GEAR_SCENE_ROWS } from '../data/gearModels';

/** Lazy ports retain each real page builder; shared rows own Explorer framing. */
export const GEAR_MODELS = modelCatalogue(GEAR_SCENE_ROWS,{owners:new Map<string,unknown>([...Object.entries(WHIP_HELD_OWNERS),['npcModels',DUNE_LIBRARY]]),source,builds:[
  ['tower',()=>buildPlace('tower',WORLD.last()??new Map())],
  ['caravan',()=>buildPlace('caravan',WORLD.last()??new Map())],
  ['well',()=>buildPlace('well',WORLD.last()??new Map())],
  ['brazier',()=>buildPlace('brazier',WORLD.last()??new Map(),0,[])],
]});
