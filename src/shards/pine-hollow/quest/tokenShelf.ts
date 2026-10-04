/**
 * The token shelf (PINE-HOLLOW-REMASTER PH-C8's last piece): once all eight carved tokens are found, a pine display rack
 * stands on the ranger's mantel with the eight of them in a row — the cabin's side of the "Whittled Down" achievement
 * (its title, "Token Gesture", is the achievement's). The rack is a model (E315 M2:
 * src/shards/pine-hollow/models/tokenShelf.ts); here it is placed on the mantel and shown.
 *
 *   const shelf = placeTokenShelf(sky, cabins.roots[0], registry);   // hidden until shown
 *   shelf.setShown(tokenCount() === 8);  game.onUpdate(() => shelf.update(camera));
 *
 * Past `CULL` metres it is not drawn.
 */
import * as THREE from 'three';
import { place } from '@wildshard/engine/models/place';
import type { WorldRegistry } from '@wildshard/engine/world/registry';
import type { SkyRig as Sky } from '@wildshard/engine/world/skyRig';
import { pineModels } from '../world/context';
import { tokenShelf } from '../models/tokenShelf';


/**
 * The ranger's cabin (Cabin.ts SPECS[0]: W 5, L 7, chimney −Z): the mantel is 1.7 × 0.7 m centred on x −0.6, z −3.15,
 * its top 1.78 m over the cabin's root (PLINTH 0.18 + its centre 1.55 + half its 0.1 thickness). The rack sits on its
 * front half.
 */
export const TOKEN_SHELF_AT = { x: -0.6, y: 1.78, z: -3.02 } as const;
/** past this (m, from the rack) it is not drawn: it is indoors, and one draw is still a draw */
const CULL = 28;

export interface TokenShelf {
  readonly mesh: THREE.Object3D;
  setShown: (on: boolean) => void;
  update: (camera: THREE.Camera) => void;
}

/** place the rack on the ranger's mantel (`cabin`: the ranger's cabin's root, its frame) */
export function placeTokenShelf(sky: Sky, cabin: THREE.Object3D, registry: WorldRegistry): TokenShelf {
  cabin.updateWorldMatrix(true, false);
  const m = cabin.matrixWorld.clone().multiply(new THREE.Matrix4().makeTranslation(TOKEN_SHELF_AT.x, TOKEN_SHELF_AT.y, TOKEN_SHELF_AT.z)), e = m.elements;
  const mesh = place(tokenShelf, [{ x: e[12], y: e[13], z: e[14], matrix: m }], { ctx: pineModels(sky), draw: 'single', registry, piece: { id: 'pine-hollow/token-shelf' } }).object;
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
