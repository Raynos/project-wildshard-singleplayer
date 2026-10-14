import { defineSceneModels } from '@wildshard/engine/models/model';
import { buildWhipModel } from '../runtime/items/heldWhip';
import { lastBakedWorld } from '../world/baked';
import { buildPlace } from '../world/places';
import { questNpcSpecimen } from '@wildshard/game/plugin/ui';
import source from '../runtime/source';
import { duneMesh } from '../world/meshes';
import { GEAR_SCENE_ROWS } from '../data/gearModels';

/** Lazy ports retain each real page builder; shared rows own Explorer framing. */
export const GEAR_MODELS = defineSceneModels(GEAR_SCENE_ROWS,[
  ['whip',buildWhipModel], ['tower',()=>buildPlace('tower',lastBakedWorld()??new Map())],
  ['caravan',()=>buildPlace('caravan',lastBakedWorld()??new Map())],
  ['well',()=>buildPlace('well',lastBakedWorld()??new Map())],
  ['brazier',()=>buildPlace('brazier',lastBakedWorld()??new Map(),0,[])],
  ['scout',()=>questNpcSpecimen(source,'sunscar.scout',{kind:'mesh',read:()=>duneMesh('caravan-scout')})],
]);
