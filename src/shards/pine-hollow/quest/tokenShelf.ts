import type { SceneHandles } from '@wildshard/game/shardfile/sceneHandles';
/**
 * The token shelf (PINE-HOLLOW-REMASTER PH-C8's last piece): once all eight carved tokens are found, a pine display rack
 * stands on the ranger's mantel with the eight of them in a row — the cabin's side of the "Whittled Down" achievement
 * (its title, "Token Gesture", is the achievement's). The baked rack is the named scene placement `timbers.token-shelf`; here it is shown.
 *
 *   const shelf = await placeTokenShelf(cabins.resources);   // hidden until shown
 *   shelf.setShown(tokenCount() === 8);  game.onUpdate(() => shelf.update(camera));
 *
 * Past `CULL` metres it is not drawn.
 */
import * as THREE from 'three';


/** past this (m, from the rack) it is not drawn: it is indoors, and one draw is still a draw */
const CULL = 28;

export interface TokenShelf {
  readonly mesh: THREE.Object3D;
  setShown: (on: boolean) => void;
  update: (camera: THREE.Camera) => void;
}

/** Borrow the rack's authored placement on the ranger's mantel. */
export async function placeTokenShelf(scenes: SceneHandles): Promise<TokenShelf> {
  const mesh = (await scenes.place('timbers.token-shelf')).object;
  mesh.visible = false;
  let shown = false;
  const _w = new THREE.Vector3();
  return {
    mesh,
    setShown: (on) => { shown = on; if (!on) mesh.visible = false; },
    update: (camera) => {
      if (!shown) return;
      mesh.getWorldPosition(_w);
      mesh.visible = _w.distanceToSquared(camera.position) < CULL * CULL;
    },
  };
}
