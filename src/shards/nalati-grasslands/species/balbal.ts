import * as THREE from 'three';
import type { Animal } from '@wildshard/engine/entities/AnimalView';
import type { SpeciesDef,RigAnimCtx } from '@wildshard/engine/entities/species/registry';
import { smooth01,step } from '@wildshard/engine/entities/species/rigs';
import { terrainHeight } from '@wildshard/engine/world/terrainHeight';
import { PageCreatureGuest } from '@wildshard/game/population/creatureGuest';
import speciesRows from '../boot/speciesRows.generated.json' with { type:'json' };
import { poseNalatiCreature,balbalCrackGeometry,speciesGuestRows } from './presentation';

export const BALBAL = speciesRows.balbal.kind;
export const BALBAL_SLAM = speciesRows.slam;
const cracks = new WeakMap<Animal, THREE.MeshBasicMaterial>();
let guest: PageCreatureGuest | null = null;
/** The balbal's guest (its weak points and damage model), built once. */
export function creatureGuest(): PageCreatureGuest {
  guest ??= new PageCreatureGuest({ ...speciesRows.balbalGuest,...speciesGuestRows() });
  return guest;
}
function animateBalbal(c: RigAnimCtx): void {
  const m = c.mem, a = c.animal;
  let material = cracks.get(a);
  if (material === undefined) {
    material = new THREE.MeshBasicMaterial({ color: new THREE.Color(1, .46, .1), toneMapped: false }); material.name = 'balbal-cracks';
    const mesh = new THREE.SkinnedMesh(balbalCrackGeometry(), material); mesh.frustumCulled = false; mesh.castShadow = false; mesh.receiveShadow = false;
    a.mesh.add(mesh); mesh.bind(a.mesh.skeleton, a.mesh.bindMatrix); cracks.set(a, material);
  }
  const atk = c.attack, wind = atk >= 0 ? step(atk, 0, .52) : 0, flash = atk >= 0 ? Math.max(0, 1 - Math.abs(atk - .55) * 14) : 0;
  const dead = c.deathT >= 0 ? smooth01(c.deathT) : 0, rising = m['field'] === 1 ? 1 - (m['rise'] ?? 1) : 0;
  m['glow'] = (.9 + .25 * Math.sin(c.t * 2.3 + c.seed) + 2.6 * wind * wind + 4 * flash + 1.5 * rising * (.6 + .4 * Math.sin(c.t * 17))) * (1 - dead * .85);
  material.color.setRGB(1, .46, .1).multiplyScalar(m['glow']);
  if (!c.alive) m['deadT'] = (m['deadT'] ?? 0) + c.dt;
  const ground = terrainHeight(a.position.x, a.position.z), sink = Math.max(0, (m['deadT'] ?? 0) - .9) * 1.1;
  a.yOffset = (m['field'] === 1 ? -(1 - smooth01(m['rise'] ?? 1)) * 2.5 * a.scale : (m['floorY'] ?? ground) - ground) - sink;
  poseNalatiCreature('balbal', c);
}
/** The balbals' page controls; their body, rig and look are the look book's rows. */
export const BALBAL_SPECIES: Pick<SpeciesDef, 'kind' | 'animate' | 'think' | 'damageMul'> = {
  kind: BALBAL, animate: animateBalbal,
  think: (actor,context) => { creatureGuest().binding.think(actor,context); },
  damageMul: (actor,point,direction,request) => creatureGuest().binding.damageMul(actor,point,direction,request),
};

