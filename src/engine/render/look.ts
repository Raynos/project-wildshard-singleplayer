import type { Color, DirectionalLight, Fog, Group, HemisphereLight, Mesh, Object3D, Sprite, Texture, Vector3, PerspectiveCamera, Scene, WebGLRenderer } from 'three';
import type { BloomEffect, BrightnessContrastEffect, ChromaticAberrationEffect, Effect, EffectComposer, GodRaysEffect, HueSaturationEffect, LookupTexture, LUT3DEffect, NoiseEffect, Pass, ToneMappingEffect, VignetteEffect } from 'postprocessing';
import type { N8AOPostPass } from 'n8ao';
import type { GradeEffect } from '../core/Grade';
import type { DayCycleClock } from '../world/dayCycle';
import type { SkyRig as Sky } from '../world/skyRig';
import type { App } from '../app/app';
import type { Scope } from '../app/scope';
import type { LevelContext } from '../level/context';
import type { Tier } from '../core/tier';
import type { LevelSpec } from '../level/spec';
import type { VolumetricsEffect } from '../core/Volumetrics';
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

/** the engine's two colour chains (Game.buildComposer): 'cinematic' (volumetrics, god rays, grain, fringe, the level's
 *  learned LUT) and 'clean' (E88, the L5 pick: no volumetrics, grain or fringe; faint rays, the LUT last) */
export type EngineChainKind = 'clean' | 'cinematic';

export interface LookComposeContext extends LookReplaceContext {
  /** the engine chain's effects: the 'cinematic' chain's unless the compose asked `engineChain('clean')` first */
  fx: EngineEffects;
  /** the engine's colour chain, in order, for the composition's `chain` slot (01 §13.1, 13 C6); one kind per level */
  engineChain: (kind: EngineChainKind) => Effect[];
}

/** a `mode: 'replace'` composition: the whole chain, in order (01 §13.1: a level's own composer) */
export interface LookChain { chain: Pass[] }

export interface LookComposition {

  beforeScene?: Pass[];

  afterScene?: Pass[];

  beforeChain?: Pass[];

  chain?: Effect[];

  afterChain?: Pass[];
}

/**
 * A level's fog patch (01 §13.2's ordered `fog_fragment` slots: engine fog 100, stylize 200, a level's fog 300). The
 * engine runs `install()` once, after its own `installAtmosphere()` and before the sky builds or anything compiles.
 */
export interface FogModel { order: number; install: () => void }

/** the heightfield a painter samples (live: the baked terrain replaces the procedural one once `ready()` resolves) */
export interface PainterField {
  ready: () => Promise<boolean>;
  heightAt: (x: number, z: number) => number;
  normalAt: (x: number, z: number, eps?: number) => [number, number, number];
  trails: () => readonly (readonly [number, number])[][];
  /** the distance (m) to the nearest trail's centre line */
  trailDistance: (x: number, z: number) => number;
}
/** a level's own ground: it builds the terrain's mesh(es) into `t.group` and sets `t.mesh` / `t.material` (Terrain.build) */
export interface TerrainPainter { build: (t: Terrain, field: PainterField, scope: Scope) => Promise<void> }

/** what a `GrassDriver` builds: its group goes in the scene, `update` runs every frame from the engine's Grass */
export interface GrassLayer { group: Group | Object3D; update: (dt: number, playerPos: Vector3) => void }
/** a level's own grass in place of the engine's carpet (Grass.build) */
export interface GrassDriver { build: (sky: Sky, forest: Forest) => GrassLayer }

/**
 * A level's own sky layer on the engine's sky rig (07 §6.2 step 5). Sky.build runs `build` where it builds its cloud
 * layer, after the shadow cascades exist (a light-loop patch goes there) and before anything compiles; `update` runs in
 * Sky.update every frame, after the clock.
 */
export interface SkyDressing {
  /** false: the engine's cloud layer is not built (`sky.clouds` stays null) — the level paints its own sky */
  clouds: boolean;
  /** false: the engine's planet is not built (`sky.planet` stays an empty group outside the scene) — the level paints its own */
  planet: boolean;
  /**
   * Sun surface/corona visibility at build; each omitted flag defaults to true. Lighting is unchanged. `rays` (E398):
   * with the disc off (a level whose painted sky has the sun), keep the disc as the god rays' source only: it is never
   * drawn in the frame, but the rays pass masks it. `true` = at the light's sun; `{ azimuth, elevation }` (degrees, the
   * same compass as `sky.sun`) = at the painted sun.
   */
  sun?: { disc?: boolean; halo?: boolean; rays?: boolean | { azimuth: number; elevation: number } };
  /** `cloudField`: the engine's tileable cloud fbm (R), for a level's cloud shadows */
  build?: (sky: Sky, cloudField: Texture) => void;
  update?: (dt: number) => void;
}

/** a level's light model, patched into three's chunks at the top of Sky.build (before anything compiles) */
export interface LightingRig { install: () => void }

/**
 * The sun's shadow rig as data (Sky.build). Without one: the tier table's cascades, three's filter, normal bias 0.05,
 * radius 2, steps that pop.
 */
export interface ShadowStyle {
  /** 'phoneSplits': on a one-cascade tier (the phone), three 2048² cascades to 7 / 22 / 80 m (E123, E147) */
  rig: 'tier' | 'phoneSplits';
  /** 'tent': the phone rig's 7×7 / 5×5 tent filter (E138, shadowFilter.ts) */
  filter?: 'tent';
  /** each step of the key light's shadow crossfades (E147 / E153, shadowFade.ts) */
  fade?: boolean;
  normalBias: number;
  radius: number;
  /** 'phone': on the phone rig the normal bias is fitted in texels and the far cascade draws every other frame */
  texelBias?: 'phone';
  /** 'phone': the phone rig's maps are depth only at 16 bits (E174, shadowVariants.ts) */
  depth16?: 'phone';
}

/** a level's fog switched off and back on around an off-screen shot (Explore's map from overhead) */
export interface FogControl { suspend: () => void; resume: () => void }

interface LookParts {
  backdrop?: SkyBackdropFactory;

  lighting?: LightingRig;

  shadows?: ShadowStyle;

  fogControl?: FogControl;

  sky?: SkyDressing;

  frame?: (dt: number, t: number) => void;

  dispose?: () => void;

  fog?: FogModel;

  terrainPainter?: TerrainPainter;

  grass?: GrassDriver;
}

/** 'extend' (the default): the level's passes go in slots around the engine's chain */
export interface ExtendLook extends LookParts {
  mode?: 'extend';
  compose: (c: LookComposeContext) => LookComposition;
}

/** 'replace': the level's compose builds the whole chain; the engine adds exactly its passes to its one composer */
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
  /** the gas giant's live uniforms (`uCrisp` 1: a crisp, opaque disc) */
  planet: { uSunDir: { value: Vector3 }; uHaze: { value: Color }; uCrisp: { value: number } };
  /** a key-light shadow step is still crossfading (ShadowStyle.fade): hold the next one */
  shadowBusy: () => boolean;
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
  /** the backdrop's own sky layer (a dome): Game keeps it on the camera, and the engine builds no cloud layer */
  clouds?: Object3D;
  /** 'late': `update` runs at the end of Sky.update, after the shadow cascades (default: first, before them) */
  updateAt?: 'early' | 'late';
  /** false: the planet keeps its built opacity (default: it fades in with the clock's night) */
  fadesPlanet?: boolean;
  /** the dome's live palette uniforms a horizon painting blends with (HorizonMatte); `middayLit` its noon cloud colour */
  palette?: { uHorizon: { value: Color }; uCloudLit: { value: Color }; uSunGlow: { value: Color }; uSunDir: { value: Vector3 }; middayLit: Color };
  /** free its textures, render targets and dome (a layered backdrop, `SkyRig.layerBackdrop`, leaves with its region; G223) */
  dispose?: () => void;
  /** the GPU bytes its textures and render targets hold now (the census a layered backdrop is charged by; G223) */
  gpuBytes?: () => number;
  /** the most GPU bytes it can hold (its resident key cap, environment and PMREM targets): what a layer reserves (G223) */
  gpuCeiling?: () => number;
}
export interface SkyBackdropContext { sky: Sky; scene: Scene; renderer: WebGLRenderer; level: LevelSpec; tier: Tier; look: { vol: number; fogDist: number; sat: number; ambient: number; sky: number } | null }
export type SkyBackdropFactory = (c: SkyBackdropContext) => Promise<SkyBackdrop>;
