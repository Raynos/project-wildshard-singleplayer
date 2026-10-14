import type { Group } from 'three';
import { bindWorldSceneParts, createWorldScene } from '@wildshard/game/plugin/ui';
import { hdMaterial, skyHd, SKY_LIBRARY } from './meshes';
import { CROWN_SCENE } from '../data/crownScene.generated';
import { WORLD } from './baked';

/** The carved arena borrows its prepared models, painted looks and original baked colliders. */
export function crownArena(): { group: Group; colliders: ReturnType<typeof WORLD.piece>['colliders'] } {
  const models = new Map<string, ReturnType<typeof skyHd>>(CROWN_SCENE.models.map(row => [row.id, skyHd(row.model)]));
  const complete = [...models.values()].every(model => model !== null);
  const materials = new Map(CROWN_SCENE.models.map(row => {
    const model = models.get(row.id);
    return [row.id, model === undefined || model === null ? null : row.look === null ? hdMaterial(model.map) : SKY_LIBRARY.mappedLook(row.look, model.map)];
  }));
  const made = createWorldScene(CROWN_SCENE.recipe, { geometry: id => complete ? models.get(id)?.geometry ?? null : null,
    materials, model: SKY_LIBRARY.model, baked: WORLD.object });
  return { group: made.root, ...bindWorldSceneParts(made, { colliders: 'colliders' }, CROWN_SCENE.bindings) };
}
