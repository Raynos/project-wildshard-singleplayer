import * as THREE from 'three';
import { pickup as pickupModel } from '@wildshard/engine/models/interact';
import { rock } from '@wildshard/engine/world/geometryKit';
import { interactParts } from '@wildshard/engine/world/interact/kit';
import { registerPickupLook, type PickupLook } from '@wildshard/engine/world/interact/types';
import { LowPolyKit } from '@wildshard/engine/world/lowpolyKit';
import { coinModel, installCoinModel } from '../loot/coinModel';

const M = new THREE.Matrix4();
const at = (x: number, y: number, z: number, ry = 0, rx = 0, rz = 0): THREE.Matrix4 =>
  M.compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(1, 1, 1));
const done = (kit: LowPolyKit): THREE.BufferGeometry => kit.finish({ ao: false });

/**
 * The kit's pickups (moved from the engine's interactables, E405 LAYER-PURITY): a pickup row's `look` names one of these.
 * Each has its batched model (the far draw, the Model Explorer card) and the parts drawn up close, bobbing and spinning.
 * installKitPickups registers them.
 */
const FILE = 'src/game/models/pickups.ts';
const SEED = 0x1a7e;
const { lit, glow } = interactParts;

export function seaGlassGeometry(seed = SEED): THREE.BufferGeometry {
  const k = new LowPolyKit(seed);
  k.add(rock(0.12, 0, k.rng, 0.6, 0.35), '#ffffff', { jitter: 0.25 });
  return done(k);
}

export function glyphShardGeometry(seed = SEED): THREE.BufferGeometry {
  const k = new LowPolyKit(seed);
  const g = new THREE.OctahedronGeometry(0.16, 0);
  g.scale(0.7, 2.1, 0.45);
  k.add(g, '#8fe8ff', { jitter: 0.18, wobble: 0.015 });
  k.add(new THREE.OctahedronGeometry(0.06, 0), '#ffffff', { matrix: at(0.1, -0.16, 0.03, 0.4, 0, 0.3), jitter: 0.1 });
  return done(k);
}

/** flint + steel striker on a scrap of leather — lit batch */
export function flintKitGeometry(seed = SEED): THREE.BufferGeometry {
  const k = new LowPolyKit(seed);
  k.add(new THREE.CylinderGeometry(0.14, 0.15, 0.015, 7), '#6e4629', { matrix: at(0, 0.008, 0) });
  k.add(rock(0.055, 0, k.rng, 0.7, 0.3), '#7b7f86', { matrix: at(-0.04, 0.05, 0) });
  k.add(new THREE.TorusGeometry(0.04, 0.01, 4, 8, Math.PI * 1.4), '#62656d', { matrix: at(0.06, 0.03, 0, 0, Math.PI / 2, 0) });
  return done(k);
}

/** an amber resin drop — glow batch: a bead of amber weeping down a trunk, a smaller drip under it */
export function resinDropGeometry(seed = SEED): THREE.BufferGeometry {
  const k = new LowPolyKit(seed);
  const bead = new THREE.IcosahedronGeometry(0.075, 1); bead.scale(0.85, 1.35, 0.7);
  k.add(bead, '#ffb23a', { matrix: at(0, 0.02, 0), jitter: 0.12 });
  const drip = new THREE.IcosahedronGeometry(0.04, 0); drip.scale(0.8, 1.5, 0.8);
  k.add(drip, '#ff9a1f', { matrix: at(0.012, -0.1, 0.01), jitter: 0.1 });
  k.add(new THREE.OctahedronGeometry(0.03, 0), '#ffe08a', { matrix: at(-0.03, 0.07, 0.035), jitter: 0.1 });
  return done(k);
}

/** a carved wooden token — lit batch: a wooden disc on edge, a burnt antler glyph on both faces, a bark rim */
export function carvedTokenGeometry(seed = SEED): THREE.BufferGeometry {
  const k = new LowPolyKit(seed);
  k.add(new THREE.CylinderGeometry(0.15, 0.15, 0.036, 12).rotateX(Math.PI / 2), '#a88157', { jitter: 0.04 });
  k.add(new THREE.TorusGeometry(0.15, 0.014, 4, 12), '#5f432a');
  for (const z of [-0.02, 0.02]) {
    k.add(new THREE.BoxGeometry(0.018, 0.16, 0.006), '#2d2622', { matrix: at(0, -0.01, z) });
    for (const s of [-1, 1]) {
      k.add(new THREE.BoxGeometry(0.014, 0.08, 0.006), '#2d2622', { matrix: at(s * 0.035, 0.07, z, 0, 0, s * -0.7) });
      k.add(new THREE.BoxGeometry(0.012, 0.05, 0.006), '#2d2622', { matrix: at(s * 0.03, 0.02, z, 0, 0, s * -1.1) });
    }
  }
  return done(k);
}

/** the token's faint ember rim (glow batch), so a token reads at a few metres in the undergrowth */
export function tokenRimGeometry(seed = SEED): THREE.BufferGeometry {
  const k = new LowPolyKit(seed);
  k.add(new THREE.TorusGeometry(0.168, 0.006, 3, 16), '#ffb060');
  return done(k);
}

export const flintKit = pickupModel('shared/flint-kit', 'Flint & steel', 0, (ctx) => [lit(ctx, flintKitGeometry())], FILE);
export const seaGlass = pickupModel('shared/sea-glass', 'Sea glass', 0.45, (ctx) => [glow(ctx, seaGlassGeometry())], FILE);
export const doubloon = pickupModel('shared/doubloon', 'Doubloon', 0.6, (ctx) => [glow(ctx, coinModel(SEED))], FILE);
export const resinDrop = pickupModel('shared/resin-drop', 'Resin drop', 0, (ctx) => [glow(ctx, resinDropGeometry())], FILE);
export const carvedToken = pickupModel('shared/carved-token', 'Carved token', 0.55, (ctx) => [lit(ctx, carvedTokenGeometry(SEED)), glow(ctx, tokenRimGeometry())], FILE);
export const glyphShard = pickupModel('shared/glyph-shard', 'Glyph shard', 1.2, (ctx) => [glow(ctx, glyphShardGeometry())], FILE);

const LOOKS: Readonly<Record<string, PickupLook>> = {
  flint: { model: flintKit, batch: 'lit', lift: 0, parts: [{ key: 'flint', batch: 'lit', geometry: flintKitGeometry }] },
  seaglass: { model: seaGlass, batch: 'glow', lift: 0.45, parts: [{ key: 'seaglass', batch: 'glow', geometry: seaGlassGeometry, bob: [0.45, 0.07, 1.1], pulse: 2.2 }] },
  coin: { model: doubloon, batch: 'glow', lift: 0.6, parts: [{ key: 'coin', batch: 'glow', geometry: coinModel, bob: [0.6, 0.06, 2.4], pulse: 1.4 }] },
  resin: { model: resinDrop, batch: 'glow', lift: 0, parts: [{ key: 'resin', batch: 'glow', geometry: resinDropGeometry, bob: [0.0, 0.025, 0.35], pulse: 1.25 }] },
  token: { model: carvedToken, batch: 'lit', lift: 0.55, parts: [
    { key: 'token', batch: 'lit', geometry: carvedTokenGeometry, bob: [0.55, 0.05, 1.3] },
    { key: 'token-rim', batch: 'glow', geometry: tokenRimGeometry, bob: [0.55, 0.05, 1.3], pulse: 0.9 },
  ] },
  shard: { model: glyphShard, batch: 'glow', lift: 1.2, parts: [{ key: 'shard', batch: 'glow', geometry: glyphShardGeometry, bob: [1.2, 0.12, 0.9], pulse: 2.2 }] },
};

export function installKitPickups(): void {
  installCoinModel((seed) => {
    const k = new LowPolyKit(seed);
    k.add(new THREE.CylinderGeometry(0.07, 0.07, 0.014, 8).rotateX(Math.PI / 2), '#f2c44d', { jitter: 0.1 });
    return done(k);
  });
  for (const [id, look] of Object.entries(LOOKS)) registerPickupLook(id, look);
}
