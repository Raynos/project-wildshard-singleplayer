import type * as THREE from 'three';

/**
 * The depth material a renderer's shadow pass really draws a caster's material with, where that is not three's stock
 * `MeshDepthMaterial` (sp-o289). The graph back-end (`nodes/engineNodesHandler.ts`) swaps a graph material that moves its
 * vertices (`graphShadowDepth`) for its own node depth variant inside the shadow draw; precompile's shadow jobs compiled
 * the stock depth material instead, so every such variant linked inside a travel frame on its first shadow draw
 * (Pine Hollow's road entry: 107–164 ms `getProgramInfoLog` frames on desktop with a cold shader cache).
 *
 * `resolve(source, stock)` configures and returns the variant exactly as the shadow draw would for a caster of `source`
 * whose stock depth material is `stock`, or null when the shadow draw keeps the stock one. The handler registers itself
 * on its renderer; a renderer without one resolves nothing, so its programs stay as they were.
 */
export type ShadowDepthResolver = (source: THREE.Material, stock: THREE.MeshDepthMaterial) => THREE.Material | null;

const resolvers = new WeakMap<object, ShadowDepthResolver>();

/** Register the shadow pass's depth substitution for this renderer (the graph back-end, once it is installed). */
export function registerShadowDepthResolver(renderer: object, resolve: ShadowDepthResolver): void {
  resolvers.set(renderer, resolve);
}

/** This renderer's shadow-pass depth substitution, or undefined where its shadow draws keep three's stock materials. */
export function shadowDepthResolver(renderer: object): ShadowDepthResolver | undefined {
  return resolvers.get(renderer);
}
