/**
 * Seabed — the lagoon floor of an open-water shard (Driftwood Isle): where its reef stands and its fish swim (E306 /
 * E315 M1). Everything is baked: the reef is ONE flat-shaded vertex-coloured mesh (one draw call, ~15k tris) welded
 * offline from every coral, seaweed and starfish copy (generators/reefScatter.ts, data/reefLayout.generated.json) in its
 * graph look (runtime/models/reef.ts `reefMaterial`: the seaweed sways in the vertex shader); nothing collides (you
 * swim through it — underwater is decorative, no underworld). The school is the baked fish (generators/reefFish.ts) on
 * the ambient-flock host (@wildshard/sdk/looks/ambientFlock, one instanced draw), wheeling over the densest reef on
 * data/seabedLook.ts's swim row, each fish in its baked tint.
 *
 *   const seabed = await buildSeabed(sky);
 *   scene.add(seabed.mesh, seabed.fish);
 *   game.onUpdate((dt) => seabed.tick(dt));   // the sway clock, the school
 */
import * as THREE from 'three';
import { modelContext } from '@wildshard/engine/models/model';
import { lowPolyLookMaterial } from '@wildshard/engine/world/lowpolyKit';
import type { SkyRig as Sky } from '@wildshard/engine/world/skyRig';
import { createAmbientFlock } from '@wildshard/sdk/looks/ambientFlock';
import { loadReefWorld } from '../runtime/boot/reefGeometry';
import { REEF_FISH_GEOMETRY, loadFixedGeometry } from '../runtime/boot/fixedGeometry';
import { reefMaterial } from '../runtime/models/reef';
import { SEABED } from '../data/seabedLook';
import REEF_LAYOUT from '../data/reefLayout.generated.json' with { type: 'json' };

/** The reef weld, its school and their once-a-frame step. */
export interface Seabed { readonly mesh: THREE.Mesh; readonly fish: THREE.InstancedMesh; tick: (dt: number) => void }

/** The baked weld in the reef's graph look, and the baked school on its flock row. */
export async function buildSeabed(sky: Sky): Promise<Seabed> {
  const [batch] = await Promise.all([loadReefWorld(REEF_LAYOUT.items.length), loadFixedGeometry()]);
  const { material, update } = reefMaterial(modelContext(sky));
  batch.geometry.computeBoundingSphere();
  const mesh = new THREE.Mesh(batch.geometry, material);
  mesh.name = SEABED.mesh; mesh.receiveShadow = true;
  const s = REEF_LAYOUT.school, swim = SEABED.swim, centre = { x: s.x, y: s.y, z: s.z };
  // the baked fish faces -z, the host's +z
  const school = createAmbientFlock({ ...swim, count: s.n, wheeling: { ...swim.wheeling, centre: { x: s.x, z: s.z }, radius: s.r, altitude: [s.y, s.y] } },
    { name: SEABED.fishMesh, geometry: REEF_FISH_GEOMETRY.copy().rotateY(Math.PI), material: lowPolyLookMaterial(sky, 'still') });
  const tint = new THREE.Color();
  for (let i = 0; i < 64; i++) { const fish = s.fish[i]; if (fish === undefined) break; school.mesh.setColorAt(i, tint.setHex(fish.colour)); }
  return { mesh, fish: school.mesh, tick: (dt) => { update?.(); school.update(dt, centre); } };
}
