import * as THREE from 'three';
import { gameplayRandom } from '#engine/app/runtime';
import { worldHit, impactSurfaceOf, sstep } from './ranged';
import type { Targets, TargetHit } from '#engine/combat/types';
import type { ImpactSurface } from '#engine/combat/Weapon';

export interface HitscanProfile { range: number; damageScale: number; spreadAds: number; spreadHip: number; spreadRadius: 'linear' | 'sqrt'; movingSpread: number; movingAimReduction: number }
export interface HitscanResult { point: THREE.Vector3; direction: THREE.Vector3; surface: ImpactSurface | null; hit: TargetHit | null; killed: boolean }
const origin = new THREE.Vector3(), direction = new THREE.Vector3(), transverse = new THREE.Vector3(), end = new THREE.Vector3();
export function hitscan(aim: (origin: THREE.Vector3, direction: THREE.Vector3) => THREE.Vector3, targets: Targets | undefined,
  profile: HitscanProfile, adsBlend: number, bloom: number, speedFactor: number): HitscanResult {
  aim(origin, direction);
  const a = sstep(0, 1, adsBlend);
  const spread = THREE.MathUtils.degToRad(profile.spreadAds + (1 - a) * profile.spreadHip + bloom * (1 - a * 0.7) + speedFactor * profile.movingSpread * (1 - a * profile.movingAimReduction));
  transverse.set(gameplayRandom() - 0.5, gameplayRandom() - 0.5, gameplayRandom() - 0.5).cross(direction).normalize();
  const radius = gameplayRandom();
  direction.addScaledVector(transverse, Math.tan(spread * (profile.spreadRadius === 'sqrt' ? Math.sqrt(radius) : radius))).normalize();
  let dist = profile.range, surface: ImpactSurface | null = null;
  const wall = worldHit(origin, end.copy(origin).addScaledVector(direction, profile.range), 0);
  if (wall) { dist = wall.distance; surface = impactSurfaceOf(wall.material); }
  const hit = targets?.raycast(origin, direction, dist) ?? null;
  if (hit) { dist = hit.distance; surface = 'flesh'; }
  const point = end.copy(origin).addScaledVector(direction, dist);
  let killed = false;
  if (surface === 'flesh' && hit) { point.copy(hit.point); killed = hit.animal.applyDamage(hit.animal.damageFor(hit.headshot, hit.distance) * profile.damageScale, hit.point, direction); }
  return { point, direction, surface, hit, killed };
}
