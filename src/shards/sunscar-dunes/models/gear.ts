import { defineSceneModels } from '@wildshard/engine/models/model';
import { buildWhipModel } from '../runtime/items/heldWhip';
import { WORLD } from '../world/baked';
import { buildPlace } from '../world/places';
import { questNpcSpecimen } from '@wildshard/game/plugin/ui';
import source from '../runtime/source';
import { DUNE_LIBRARY } from '../world/meshes';
import { GEAR_SCENE_ROWS } from '../data/gearModels';

/** Lazy ports retain each real page builder; shared rows own Explorer framing. */
export const GEAR_MODELS = defineSceneModels(GEAR_SCENE_ROWS,[
  ['whip',buildWhipModel], ['tower',()=>buildPlace('tower',WORLD.last()??new Map())],
  ['caravan',()=>buildPlace('caravan',WORLD.last()??new Map())],
  ['well',()=>buildPlace('well',WORLD.last()??new Map())],
  ['brazier',()=>buildPlace('brazier',WORLD.last()??new Map(),0,[])],
  ['scout',()=>questNpcSpecimen(source,'sunscar.scout',{kind:'mesh',read:()=>DUNE_LIBRARY.mesh('caravan-scout')})],
]);
