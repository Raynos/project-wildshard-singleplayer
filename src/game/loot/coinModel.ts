import * as THREE from 'three';
import { LowPolyKit } from '#engine';

const done = (kit: LowPolyKit): THREE.BufferGeometry => kit.finish({ ao: false });

/** a gold coin (the loot's coins: CoinBurst, the coin pickup) — moved from the engine's interactables (E405) */
export function coinModel(seed: number): THREE.BufferGeometry {
  const k = new LowPolyKit(seed);
  k.add(new THREE.CylinderGeometry(0.07, 0.07, 0.014, 8).rotateX(Math.PI / 2), '#f2c44d', { jitter: 0.1 });
  return done(k);
}
