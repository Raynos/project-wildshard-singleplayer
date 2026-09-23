import type * as THREE from 'three';
import type { Sky } from '../world/Sky';
import { painterlyMaterial } from '../world/painterly';

/**
 * The material every Nalati creature is drawn with (`AnimalFactory` style 'painterly', the instanced sheep flock):
 * the shard's shared painterly material (`src/world/painterly.ts` — soft cel bands, sky-tinted shade, rim light), with
 * a slightly stronger rim so fur silhouettes catch the low sun as in the mockups. Vertex colours carry the coat.
 *
 *   painterlyAnimalMaterial(sky, eyeGlow?, eyeGlowIntensity?) → a fresh material per animal (the instance's tint goes in
 *   `color`); it is one program for every creature (painterly's constant cache key; skinning / instancing fork siblings).
 */
export function painterlyAnimalMaterial(sky: Sky, glow?: [number, number, number], glowIntensity = 1): THREE.MeshLambertMaterial {
  const m = painterlyMaterial(sky, { rim: 0.8, bands: 0.85 });   // a strong rim: silhouettes catch the low sun (the camp mockups)
  if (glow !== undefined) { m.emissive.setRGB(glow[0], glow[1], glow[2]); m.emissiveIntensity = glowIntensity; }
  return m;
}
