/**
 * Trailside — the wooden dressing along Driftwood Isle's sand paths: rope fences (posts with a
 * sagging rope), plank steps set into the steeper climbs, and signposts with arrow boards at the
 * forks. Flat-shaded vertex colours, one mesh; fence posts and signposts collide, steps are
 * decoration on the walkable slope.
 *
 * E306 / E315 M1: the fence post, the signpost and the plank step are models
 * (src/shards/driftwood-isle/models/trailside.ts). The trail builds them in its layout's order from one stream, between
 * what is its own — the ropes sagging between the posts, the steps' side rails, the trestle stairs. The offline
 * generator welds these into one baked mesh; this builder admits it and places each model `drawnInto` it
 * (its copies, its card, its colliders: pieces `trail-*`). The trail's
 * own piece (`trailside`, main.ts) keeps the steps' and stairs' treads, admitted by the shared collider-row reader.
 * A dev page's trail registers its models in a registry nothing reads.
 *
 *   const trailside = buildTrailside(sky);
 *   scene.add(trailside.mesh); its registry piece.push(...trailside.colliders);
 *
 * `islandTrailsideSpec()` is Driftwood's layout: fences along the plateau ramp and the plateau's
 * seaward rim, steps up the plateau ramp and the headland ramp, signposts at the pier landing and
 * the hut fork.
 */
import * as THREE from 'three';
import { modelContext } from '@wildshard/engine/models/model';
import { place, type Placed } from '@wildshard/engine/models/place';
import type { BoxSpec as Collider } from '@wildshard/engine/physics/box';
import type { WorldRegistry } from '@wildshard/engine/world/registry';
import type { SkyRig as Sky } from '@wildshard/engine/world/skyRig';
import { fencePost, plankStep, signpost, trailMaterial } from '../models/trailside';

import { copyTrailsideGeometry } from '../runtime/boot/trailsideGeometry';
import { readColliderRows } from '@wildshard/engine/models/colliders';
import { islandTrailsideSpec, type TrailsideSpec } from './trailsideLayout';

/** Admit the trail weld; register its native treads at the original world-build phase. */
export function buildTrailside(sky: Sky, spec: TrailsideSpec = islandTrailsideSpec()): { mesh: THREE.Mesh; colliders: Collider[]; placed: Placed[]; place: (registry: WorldRegistry) => void } {
  const { geometry: geo, metadata, worldColliders } = copyTrailsideGeometry(spec);
  const ctx = modelContext(sky), { posts, signs, planks } = metadata;
  const mesh = new THREE.Mesh(geo, trailMaterial(ctx));
  mesh.castShadow = true; mesh.receiveShadow = true;
  const into = (boxes: number[]): { object: THREE.Mesh; boxes: Float32Array } => ({ object: mesh, boxes: Float32Array.from(boxes) });
  const placed: Placed[] = [];
  // The posts, signposts and steps keep their original model registration order.
  if (posts.pls.length > 0) placed.push(place(fencePost, posts.pls, { ctx, draw: 'merged', drawnInto: into(posts.boxes), piece: { id: 'trail-fence-posts' } }));
  if (signs.pls.length > 0) placed.push(place(signpost, signs.pls, { ctx, draw: 'merged', drawnInto: into(signs.boxes), piece: { id: 'trail-signposts' } }));
  if (planks.pls.length > 0) placed.push(place(plankStep, planks.pls, { ctx, draw: 'merged', drawnInto: into(planks.boxes), piece: { id: 'trail-steps' } }));
  return {
    mesh, colliders: [...metadata.colliders], placed,
    place: registry => {
      registry.add({ id: 'trailside', name: 'Trailside', category: 'props', file: 'src/shards/driftwood-isle/world/Trailside.ts', object: mesh,
        colliders: readColliderRows(worldColliders, { kinds: ['box', 'treads'], surfaces: [] }), surface: 'wood', solidFloor: true });
    },
  };
}
