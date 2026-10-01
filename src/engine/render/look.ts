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
import type { LevelSpec } from '../level/spec';
import type { VolumetricsEffect } from '../core/Volumetrics';
import type { Group, Object3D } from 'three';
import type { Terrain } from '../world/Terrain';
import type { Forest } from '../world/forest/Forest';

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

/** what a `mode: 'replace'` compose gets: the engine built no chain, so there are no engine effects to hand over */
export interface LookReplaceContext {
  app: App;
  scope: Scope;
  debug: LevelContext['debug'];
  renderer: WebGLRenderer;
  scene: Scene;
  camera: PerspectiveCamera;
  /** the engine's one composer (HalfFloat, `multisampling` from the tier's `msaa` knob), still empty */
  composer: EffectComposer;
  tier: Tier;
}

export interface LookComposeContext extends LookReplaceContext {
  fx: EngineEffects;
}

/** a `mode: 'replace'` composition: the whole chain, in order (01 §13.1; Nalati's painterly composer) */
export interface LookChain { chain: Pass[] }

export interface LookComposition {

  beforeScene?: Pass[];

  afterScene?: Pass[];

  beforeChain?: Pass[];

  chain?: Effect[];

  afterChain?: Pass[];
}

/**
 * A shard's fog patch (01 §13.2's ordered `fog_fragment` slots: engine fog 100, stylize 200, a shard's fog 300). The
 * engine runs `install()` once, after its own `installAtmosphere()` and before the sky builds or anything compiles.
 */
export interface FogModel { order: number; install: () => void }

/** a shard's own ground: it builds the terrain's mesh(es) into `t.group` and sets `t.mesh` / `t.material` (Terrain.build) */
export interface TerrainPainter { build: (t: Terrain) => Promise<void> }

/** what a `GrassDriver` builds: its group goes in the scene, `update` runs every frame from the engine's Grass */
export interface GrassLayer { group: Group | Object3D; update: (dt: number, playerPos: Vector3) => void }
/** a shard's own grass in place of the engine's carpet (Grass.build) */
export interface GrassDriver { build: (sky: Sky, forest: Forest) => GrassLayer }

interface LookParts {
  backdrop?: SkyBackdropFactory;

  frame?: (dt: number, t: number) => void;

  dispose?: () => void;

  fog?: FogModel;

  terrainPainter?: TerrainPainter;

  grass?: GrassDriver;
}

/** 'extend' (the default): the shard's passes go in slots around the engine's chain */
export interface ExtendLook extends LookParts {
  mode?: 'extend';
  compose: (c: LookComposeContext) => LookComposition;
}

/** 'replace': the shard's compose builds the whole chain; the engine adds exactly its passes to its one composer */
export interface ReplaceLook extends LookParts {
  mode: 'replace';
  compose: (c: LookReplaceContext) => LookChain;
}

export type LookStrategy = ExtendLook | ReplaceLook;


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
export interface SkyBackdropContext { sky: Sky; scene: Scene; renderer: WebGLRenderer; level: LevelSpec; tier: Tier; look: { vol: number; fogDist: number; sat: number; ambient: number; sky: number } | null }
export type SkyBackdropFactory = (c: SkyBackdropContext) => Promise<SkyBackdrop>;
