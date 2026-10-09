/**
 * The token shelf (E315 M2; PINE-HOLLOW-REMASTER PH-C8's last piece): a pine display rack with the eight carved tokens in
 * a row — once all eight are found it stands on the ranger's mantel (the "Whittled Down" achievement's cabin side). Built
 * in code as ONE merged mesh on the shared `lowPolyMaterial` (the tokens' own pickup material, no new program): the rack
 * (a plank, a slotted back rail, two end posts) and the pickup's `carvedToken` eight times, on edge, leaning back a touch.
 * Its own space: the origin on the mantel top under the rack's centre, +Z out into the room. No shadow, no light. The
 * quest places it on the ranger's mantel and shows it (src/shards/pine-hollow/quest/tokenShelf.ts).
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { defineModel } from '@wildshard/engine/models/model';
import { plank } from '@wildshard/engine/world/geometryKit';
import { LowPolyKit, lowPolyMaterial } from '@wildshard/engine/world/lowpolyKit';
import { carvedTokenGeometry as carvedToken } from '@wildshard/game/models/pickups';

const TOKENS = 8, SCALE = 0.6, PITCH = 0.185, LEAN = -0.14;

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

export const tokenShelf = defineModel<Record<string, never>>({
  id: 'pine-hollow/token-shelf', name: 'Token shelf', category: 'props', pipeline: 'code',
  file: 'src/shards/pine-hollow/models/tokenShelf.ts', surface: 'wood',
  defaults: {},
  build: (ctx) => [{ geometry: ctx.once('pine-hollow/token-shelf', tokenShelfGeometry), material: lowPolyMaterial(ctx.sky), receiveShadow: true }],
});
