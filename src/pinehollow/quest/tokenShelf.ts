/**
 * The token shelf (PINE-HOLLOW-REMASTER PH-C8's last piece): once all eight carved tokens are found, a pine display rack
 * stands on the ranger's mantel with the eight of them in a row — the cabin's side of the "Whittled Down" achievement
 * (its title, "Token Gesture", is the achievement's).
 *
 *   const shelf = buildTokenShelf(sky);          // hidden until shown
 *   cabins.roots[0].add(shelf.mesh);             // the ranger's cabin's frame (Cabin.ts: the chimney on its −Z gable)
 *   shelf.setShown(tokenCount() === 8);  game.onUpdate(() => shelf.update(camera));
 *
 * ONE merged mesh on the shared `lowPolyMaterial` (the tokens' own pickup material, so no new program): the rack (a
 * plank, a slotted back rail, two end posts) + the pickup's `carvedToken` geometry eight times, standing on edge and
 * leaning back a touch. No shadow, no light; past `CULL` metres it is not drawn.
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { Sky } from '../../world/Sky';
import { LowPolyKit, lowPolyMaterial, plank } from '../../world/lowpolyKit';
import { carvedToken } from '../../world/interact/models';

/**
 * The ranger's cabin (Cabin.ts SPECS[0]: W 5, L 7, chimney −Z): the mantel is 1.7 × 0.7 m centred on x −0.6, z −3.15,
 * its top 1.78 m over the cabin's root (PLINTH 0.18 + its centre 1.55 + half its 0.1 thickness). The rack sits on its
 * front half.
 */
export const TOKEN_SHELF_AT = { x: -0.6, y: 1.78, z: -3.02 } as const;
const TOKENS = 8, SCALE = 0.6, PITCH = 0.185, LEAN = -0.14;
/** past this (m, from the rack) it is not drawn: it is indoors, and one draw is still a draw */
const CULL = 28;

export interface TokenShelf {
  readonly mesh: THREE.Mesh;
  setShown: (on: boolean) => void;
  update: (camera: THREE.Camera) => void;
}

/** the rack + tokens in the rack's frame: origin on the mantel top under the rack's centre, +Z out into the room */
export function tokenShelfGeometry(): THREE.BufferGeometry {
  const k = new LowPolyKit(8088);
  const len = TOKENS * PITCH + 0.12, r = (0.15 * SCALE);
  k.add(plank(len, 0.13, 0.03, k.rng, 0.004).translate(0, 0.015, 0), '#9a7048', { jitter: 0.05 });            // the base
  k.add(plank(len, 0.035, 0.05, k.rng, 0.003).translate(0, 0.055, -0.052), '#6b4a2e', { jitter: 0.04 });      // the back rail
  k.add(plank(len, 0.025, 0.02, k.rng, 0.003).translate(0, 0.04, 0.05), '#6b4a2e', { jitter: 0.04 });        // the front lip
  for (const s of [-1, 1]) k.add(new THREE.BoxGeometry(0.035, 0.26, 0.13).translate(s * (len / 2 - 0.018), 0.13, 0), '#7c5634', { jitter: 0.05 }); // the end posts
  const parts = [k.finish({ ao: false })];
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), p = new THREE.Vector3(), sc = new THREE.Vector3(SCALE, SCALE, SCALE);
  for (let i = 0; i < TOKENS; i++) {
    // on edge in the slot between the rail and the lip, a hair of lean and turn each so the row reads hand-set
    const x = (i - (TOKENS - 1) / 2) * PITCH;
    e.set(LEAN + ((i * 37) % 5) * 0.012, ((i * 53) % 7 - 3) * 0.03, ((i * 29) % 5 - 2) * 0.02);
    m.compose(p.set(x, 0.03 + r, -0.005), q.setFromEuler(e), sc);
    parts.push(carvedToken(1000 + i).applyMatrix4(m));
  }
  const geo = mergeGeometries(parts, false);
  for (const g of parts) g.dispose();
  return geo;
}

export function buildTokenShelf(sky: Sky): TokenShelf {
  const mesh = new THREE.Mesh(tokenShelfGeometry(), lowPolyMaterial(sky));
  mesh.name = 'token-shelf';
  mesh.position.set(TOKEN_SHELF_AT.x, TOKEN_SHELF_AT.y, TOKEN_SHELF_AT.z);
  mesh.castShadow = false; mesh.receiveShadow = true;
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
