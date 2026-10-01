import type { Color, DirectionalLight, Fog, HemisphereLight, Mesh, Sprite, Vector3, PerspectiveCamera, Scene, WebGLRenderer } from 'three';
import type { BloomEffect, BrightnessContrastEffect, ChromaticAberrationEffect, Effect, EffectComposer, GodRaysEffect, HueSaturationEffect, LookupTexture, LUT3DEffect, NoiseEffect, Pass, ToneMappingEffect, VignetteEffect } from 'postprocessing';
import type { N8AOPostPass } from 'n8ao';
import type { GradeEffect } from '../core/Grade';
import type { DayCycleClock } from '../world/dayCycle';
import type { Sky } from '../world/Sky';
import type { App } from '../app/app';
import type { Scope } from '../app/scope';
import type { LevelContext } from '../level/context';
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
  app: App;
  scope: Scope;
  debug: LevelContext['debug'];
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
  backdrop?: SkyBackdropFactory;

  compose: (c: LookComposeContext) => LookComposition;

  frame?: (dt: number, t: number) => void;

  dispose?: () => void;
}


export interface SkyBackdropTargets {
  sunDir: Vector3; sunColor: Color;
  lights: DirectionalLight[]; lightDirection: Vector3;
  hemi: HemisphereLight; fog: Fog;
  fogU: { fogSunDir: { value: Vector3 }; fogSunColor: { value: Color }; fogDistDensity: { value: number }; fogHeightDensity: { value: number } };
  /** true while the eye is under water (Atmosphere.ts owns the fog then) */
  underwater: () => boolean;
  disc: Mesh; halo: Sprite | null;
  cloud: { uSunDir: { value: Vector3 }; uSunColor: { value: Color }; uCloudLit: { value: Color }; uCloudAlpha: { value: number } };
  far: { uHazeCol: { value: Color }; uSeaSky: { value: Color }; uSeaSun: { value: Color }; uSeaSunDir: { value: Vector3 } };
}
/** the post effects the clock drives (Game.buildComposer hands them over) */
export interface SkyBackdropPost {
  vol: { setSun: (dir: Vector3, color: Color) => void; setFogColor: (c: Color) => void; setStrength: (s: number) => void };
  rays: { blendMode: { opacity: { value: number } } } | null;
  /** the grade's HueSaturationEffect */
  hueSat: { saturation: number } | null;
}


export interface SkyBackdrop {
  clock: DayCycleClock;
  horizon: Color;
  lut: LookupTexture | null;
  bind: (targets: SkyBackdropTargets) => void;
  update: (dt: number, camera: PerspectiveCamera) => void;
  rebuild: () => void;
  attachPost: (post: SkyBackdropPost) => void;
}
export type SkyBackdropFactory = (c: { sky: Sky; scene: Scene; renderer: WebGLRenderer }) => Promise<SkyBackdrop>;
