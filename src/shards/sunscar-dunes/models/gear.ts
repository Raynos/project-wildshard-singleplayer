import { defineSceneModels } from '@wildshard/engine/models/model';
import { buildWhipModel } from '../runtime/items/heldWhip';
import { buildTower } from '../world/tower';
import { lastBakedWorld } from '../world/baked';
import { buildBrazier, buildCaravan, buildWell } from '../world/places';
import { questNpcSpecimen } from '@wildshard/game/plugin/ui';
import source from '../runtime/source';
import { SIGNAL_QUEST_PAGE } from '../data/questPage';
import { duneMesh } from '../world/meshes';
import { GEAR_SCENE_ROWS } from '../data/gearModels';

/** Lazy ports retain each real page builder; shared rows own Explorer framing. */
export const GEAR_MODELS = defineSceneModels(GEAR_SCENE_ROWS,[
  ['whip',buildWhipModel], ['tower',()=>buildTower(lastBakedWorld()??new Map())],
  ['caravan',()=>buildCaravan(lastBakedWorld()??new Map())],
  ['well',()=>buildWell(lastBakedWorld()??new Map())],
  ['brazier',()=>buildBrazier(lastBakedWorld()??new Map(),0,[])],
  ['scout',()=>questNpcSpecimen(source,SIGNAL_QUEST_PAGE.npc,SIGNAL_QUEST_PAGE.model,{kind:'mesh',read:()=>duneMesh('caravan-scout')})],
]);
