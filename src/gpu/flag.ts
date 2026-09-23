/**
 * The WebGPU renderer path (src/gpu/, overview at the top of src/gpu/GpuPath.ts) is opt-in:
 *
 *   ?gpu=webgpu      WebGPURenderer on the WebGPU backend (TSL materials + TSL post)
 *   ?gpu=webgpu-gl   the same TSL path on WebGPURenderer's WebGL 2 backend (forceWebGL) — for A/B and old browsers
 *
 * Anything else, or no flag, is the shipping WebGLRenderer + pmndrs postprocessing path, unchanged.
 * Without the param, main menu ▸ Settings ▸ Renderer's saved pick decides (E55, `setting('gpu')` in src/ui/Settings.ts).
 * This module is tiny and sits in the main bundle; the rest of src/gpu/ is imported dynamically.
 */
import { setting } from '../ui/Settings';

export type GpuMode = 'webgpu' | 'webgpu-gl';

function readMode(): GpuMode | null {
  const m = setting('gpu');
  return m === 'webgl' ? null : m;
}

export const GPU_MODE: GpuMode | null = readMode();
