/**
 * The sun's shadow cascades, as data the TSL back-end can read (SHARD-PLATFORM SF59 step 2, fix 3;
 * sf59-tsl-spike.md §2.2). three's classic CSM is one DirectionalLight per cascade, and its shader chunk gates each light
 * to its own depth slice (with the fade margins); the shadow fade (shadowFade.ts, E147) mixes a ghost light's shadow into
 * cascade i's while a sun step crossfades. Both are ShaderChunk edits, which node materials never read, so a node
 * material would be lit by every cascade at full strength. The sky rig registers its cascades here; the node back-end
 * (render/nodes/cascadeLightNode.ts) gates each registered light the way the chunk does. No TSL here: the default render
 * path imports this module, the node back-end loads lazily.
 */
import type * as THREE from 'three';
import type { CSM } from 'three/examples/jsm/csm/CSM.js';

/** one sky's cascades: the CSM, its fade ghosts (ghost i belongs to cascade i) and the fade's progress (0 old … 1 settled) */
export interface CascadeSet {
  readonly csm: CSM;
  readonly ghosts: readonly THREE.DirectionalLight[];
  readonly fade: { value: number };
}

const byLight = new WeakMap<THREE.Light, { set: CascadeSet; index: number }>();
const ghosts = new WeakMap<THREE.Light, { set: CascadeSet; index: number }>();

/** the sky rig's cascades (after the CSM and its fade exist); a light belongs to the last set registered for it */
export function registerCascades(set: CascadeSet): void {
  set.csm.lights.forEach((light, index) => { byLight.set(light, { set, index }); });
  set.ghosts.forEach((light, index) => { ghosts.set(light, { set, index }); });
}

/** the cascade a light draws, or undefined for any other light */
export function cascadeOf(light: THREE.Light): { set: CascadeSet; index: number } | undefined { return byLight.get(light); }

/** the fade ghost that belongs to cascade `index` of `set`, if any */
export function ghostOf(set: CascadeSet, index: number): THREE.DirectionalLight | undefined { return set.ghosts[index]; }

/** a fade ghost (intensity 0: it only lends its shadow map to its cascade) */
export function isCascadeGhost(light: THREE.Light): boolean { return ghosts.has(light); }
