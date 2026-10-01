/**
 * The renderer handle (E357 X6, decision 22: WebGPU containment). Outside `src/engine/render/**` code names
 * `Renderer`, never three's WebGL class (`wildshard/no-renderer-type`), so a future port changes this file and the
 * inventory's checklist (docs/design/webgpu-port-inventory.md), not every module that is handed the renderer.
 * No TSL, no WebGPURenderer (X6).
 */
import * as THREE from 'three';

/** the renderer every layer is handed (today three's WebGL renderer) */
export type Renderer = THREE.WebGLRenderer;

/** a throw-away renderer on its own canvas, to probe the GPU's formats before the game's exists (KTX2 support) */
export function probeRenderer(): Renderer {
  return new THREE.WebGLRenderer({ canvas: document.createElement('canvas') });
}

/** a value is the renderer (the scene-ownership walk skips it) */
export function isRenderer(value: object): boolean {
  return Reflect.get(value, 'isWebGLRenderer') === true;
}

/** Create the game's renderer on its recovered WebGL context. */
export function createRenderer(canvas: HTMLCanvasElement, context: WebGL2RenderingContext): Renderer {
  return new THREE.WebGLRenderer({ canvas, context, antialias: false, stencil: false, depth: true });
}
