import type { PerspectiveCamera, Scene, WebGLRenderer } from 'three';
import type { BloomEffect, BrightnessContrastEffect, ChromaticAberrationEffect, Effect, EffectComposer, GodRaysEffect, HueSaturationEffect, LUT3DEffect, NoiseEffect, Pass, ToneMappingEffect, VignetteEffect } from 'postprocessing';
import type { N8AOPostPass } from 'n8ao';
import type { GradeEffect } from '../core/Grade';
import type { Tier } from '../core/tier';
import type { VolumetricsEffect } from '../core/Volumetrics';

export interface EngineEffects {
  ao: N8AOPostPass | null;
  vol: VolumetricsEffect;
  godRays: GodRaysEffect;
  bloom: BloomEffect;
  chroma: ChromaticAberrationEffect | null;
  vignette: VignetteEffect;
  tone: ToneMappingEffect;
  saturation: HueSaturationEffect;
  contrast: BrightnessContrastEffect;

  grade: GradeEffect;

  lut: LUT3DEffect | null;
  grain: NoiseEffect | null;

  order: Effect[];
}

export interface LookComposeContext {
  renderer: WebGLRenderer;
  scene: Scene;
  camera: PerspectiveCamera;
  composer: EffectComposer;
  tier: Tier;
  fx: EngineEffects;
}

export interface LookComposition {

  beforeScene?: Pass[];

  afterScene?: Pass[];

  beforeChain?: Pass[];

  chain?: Effect[];

  afterChain?: Pass[];
}

export interface LookStrategy {

  compose: (c: LookComposeContext) => LookComposition;

  frame?: (dt: number, t: number) => void;

  dispose?: () => void;
}

