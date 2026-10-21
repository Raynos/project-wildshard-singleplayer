import type { Animal } from '@wildshard/engine/entities/AnimalView';
import type * as THREE from 'three';

/**
 * Reef Crab — Wreck Cove's tidepool crab (art/driftwood-isle/round-3-enemies/driftwood-enemy-1-crab.png): its look is a
 * packed creature look row (data/creatureLookRows.json: the custom crab rig, its skitter pose). HARD SHELL: a blow that
 * lands from the front (within 60° of its heading) does 50 %; flank it.
 */
export function crabShell(a: Animal, _hit: THREE.Vector3, dir: THREE.Vector3): number {
  const fx = Math.sin(a.yaw), fz = Math.cos(a.yaw);
  const dot = fx * dir.x + fz * dir.z;             // the blow travels opposite the heading when it comes from the front
  return dot < -0.5 ? 0.5 : 1;
}
