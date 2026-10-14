import type { Group, Object3D, Material } from 'three';
import { hdMaterial, skyHd, SKY_LIBRARY } from './meshes';
import { WORLD } from './baked';
import { bindWorldSceneParts, createWorldScene } from '@wildshard/game/plugin/ui';
import { MILL_SCENE } from '../data/millScene.generated';

/** Authored painted tower, foot and moving sail hierarchy; native hub motion remains borrowed. */
export function towerMill(): { group: Group; hub: Object3D; hubAt: { y: number; z: number } } {
  const tower = skyHd('mill-tower'), foot = skyHd('mill-foot'), ready = tower !== null && foot !== null;
  const materials = new Map<string, Material | null>([['tower', ready ? SKY_LIBRARY.mappedLook('mill-tower', tower.map) : null], ['foot', ready ? hdMaterial(foot.map) : null]]);
  tower?.geometry.dispose(); foot?.geometry.dispose();
  const scene = createWorldScene(MILL_SCENE.recipe, { materials, textures: new Map([['ready', ready ? tower.map : null]]),
    geometry: SKY_LIBRARY.geometry, model: SKY_LIBRARY.model, baked: WORLD.object });
  return { group: scene.root, ...bindWorldSceneParts(scene, { hub: 'group', hubAt: 'vector' }, MILL_SCENE.bindings) };
}
