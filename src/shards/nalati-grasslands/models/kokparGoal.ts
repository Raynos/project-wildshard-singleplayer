/**
 * The kokpar goal (E306 / E315 M3; the tai-kazan): a raised ring of trodden turf with a stone rim, where a rider throws
 * the goat. One at each end of the kokpar field's oval (src/shards/nalati-grasslands/world/Bowl.ts). Placed on the ground (`at.y`).
 * Painted into its place's mesh (src/shards/nalati-grasslands/world/painted.ts). Collides: the mound as an 18-sided prism.
 */
import * as THREE from 'three';
import { defineModel } from '@wildshard/engine/models/model';
import { M } from '../world/paint';
import { PC } from '../world/props';
import { prism } from '../world/solid';
import { painted, type Paint } from '../world/painted';

const EARTH = new THREE.Color('#6f5a3a');

const paint: Paint<object> = (kit, at) => {
  const gy = at.y;
  kit.add(new THREE.CylinderGeometry(2.2, 2.6, 0.9, 18, 1), EARTH, { matrix: M(at.x, gy + 0.2, at.z), brush: 0.1 });
  kit.add(new THREE.TorusGeometry(2.25, 0.28, 6, 18).rotateX(Math.PI / 2), PC.stone, { matrix: M(at.x, gy + 0.68, at.z), brush: 0.1 });
  return { descs: [prism(at.x, at.z, gy - 1, gy + 0.72, 2.6, 18, 0, 'earth', 2.3)] };
};

export const kokparGoal = defineModel<object>({
  id: 'nalati-grasslands/kokpar-goal', name: 'Kokpar goal', category: 'props', pipeline: 'code',
  file: 'src/shards/nalati-grasslands/models/kokparGoal.ts', surface: 'earth',
  defaults: {},
  build: painted(paint, { seed: 0x60ba }),
});
