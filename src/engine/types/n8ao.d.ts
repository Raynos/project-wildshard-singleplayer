// n8ao ships no types: the slice of N8AOPostPass that Game.ts uses (constructor, the `configuration` proxy, `renderTransparency`).
declare module 'n8ao' {
  import type * as THREE from 'three';
  import type * as PP from 'postprocessing';

  /** the `configuration` proxy: every write re-tunes the pass (see n8ao's N8AOPostPass source) */
  export interface N8AOConfiguration {
    aoSamples: number;
    aoRadius: number;
    aoTones: number;
    denoiseSamples: number;
    denoiseRadius: number;
    distanceFalloff: number;
    intensity: number;
    denoiseIterations: number;
    renderMode: 0 | 1 | 2 | 3 | 4;
    biasOffset: number;
    biasMultiplier: number;
    color: THREE.Color;
    gammaCorrection: boolean;
    depthBufferType: 1 | 2 | 3;
    screenSpaceRadius: boolean;
    halfRes: boolean;
    depthAwareUpsampling: boolean;
    colorMultiply: boolean;
    transparencyAware: boolean;
    accumulate: boolean;
    neuralDenoise: boolean;
  }

  export class N8AOPostPass extends PP.Pass {
    constructor(scene: THREE.Scene, camera: THREE.Camera, width?: number, height?: number);
    configuration: N8AOConfiguration;
    /** the transparency-aware pre-passes (two extra renders of the scene); Game.ts wraps it (the multi-material fix) */
    renderTransparency(renderer: THREE.WebGLRenderer): void;
  }
}
