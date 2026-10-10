/**
 * A toon light model and colour-ramp fog as a look-family system (SHARD-PLATFORM M3): one patch of three's
 * `lights_physical_pars_fragment` chunk lights every MeshStandard / MeshPhysical material on the page the same way (a
 * two-band sun ramp, coloured shade, a rim, a terminator band; the shard's GLSL row), and a replacement of three's fog
 * chunks ramps the far distance into the sky. Nothing here knows a shard: the shard passes its GLSL rows and the starting
 * values of the tunables, and a look declares the installers.
 *
 *   const toon = new ToonLight(glslRows, tune);
 *   lighting: { install: () => toon.installLighting() }   // before anything compiles
 *   fog: { order: 200, install: () => toon.installRampFog() }
 *   toon.uniforms.uToonNight.value = night;               // a day / night clock turns the tunables
 *
 * The tunables reach every fogged material through `attachFogUniforms` (the fog install adds them with `addFogUniforms`).
 * A material that never attaches them gets zeros: still the ramp. A material opts out of the light model with its own GLSL
 * (the shard's row decides, e.g. a `NO_TOON` define). Each installer runs once per system.
 */
import * as THREE from 'three';
import { addFogUniforms } from '@wildshard/engine/world/Atmosphere';
import { ShaderFamily } from './shaderFamily';

type Rgb = readonly [number, number, number];

/** the light model's GLSL rows: the light chunk's addition, and the ramp fog's pars and fragment */
export interface ToonLightGlsl {
  readonly toon: string;
  readonly rampFogPars: string;
  readonly rampFog: string;
}

/** the tunables' starting values as data (colours linear RGB; the uniform names are the GLSL rows') */
export interface ToonLightTune {
  readonly uToonLift: Rgb; readonly uToonRim: Rgb; readonly uToonTerm: Rgb;
  readonly uToonShadeGrade: number; readonly uCloudShadow: number; readonly uToonNight: number;
  readonly uSeaLevel: number; readonly uCaustics: number; readonly uCloudTime: number;
  readonly uCloudWind: readonly [number, number]; readonly uCloudScale: number;
  readonly uFogZenith: Rgb; readonly uFogNear: Rgb; readonly uFogStart: number; readonly uFogEnd: number;
}

/** the live tunables (one `{ value }` each, shared by every material that attaches the fog uniforms) */
export interface ToonLightUniforms extends Record<string, THREE.IUniform> {
  uToonLift: { value: THREE.Color }; uToonRim: { value: THREE.Color }; uToonTerm: { value: THREE.Color };
  uToonShadeGrade: { value: number }; uCloudShadow: { value: number }; uToonNight: { value: number };
  uSeaLevel: { value: number }; uCaustics: { value: number }; uCloudTime: { value: number };
  uCloudWind: { value: THREE.Vector2 }; uCloudScale: { value: number };
  uFogZenith: { value: THREE.Color }; uFogNear: { value: THREE.Color }; uFogStart: { value: number }; uFogEnd: { value: number };
}

const rgb = (c: Rgb): THREE.Color => new THREE.Color(c[0], c[1], c[2]);
/** three's light chunk line the light model goes after */
const AFTER = '#define RE_IndirectSpecular		RE_IndirectSpecular_Physical';

/** A toon light model and colour-ramp fog from a shard's GLSL rows and tunables, with its installers and live uniforms. */
export class ToonLight {
  readonly uniforms: ToonLightUniforms;
  private readonly toonGlsl: string;
  private readonly rampFogPars: string;
  private readonly rampFog: string;
  private lit = false;
  private fogged = false;
  private readonly held = { start: 0, end: 0 };

  constructor(glsl: ToonLightGlsl, tune: ToonLightTune) {
    const family = new ShaderFamily({ ...glsl }, {});
    this.toonGlsl = family.glsl(glsl.toon);
    this.rampFogPars = family.glsl(glsl.rampFogPars);
    this.rampFog = family.glsl(glsl.rampFog);
    this.uniforms = {
      uToonLift: { value: rgb(tune.uToonLift) },
      uToonRim: { value: rgb(tune.uToonRim) },
      uToonTerm: { value: rgb(tune.uToonTerm) },
      uToonShadeGrade: { value: tune.uToonShadeGrade },
      uCloudShadow: { value: tune.uCloudShadow },
      uToonNight: { value: tune.uToonNight },
      uSeaLevel: { value: tune.uSeaLevel },
      uCaustics: { value: tune.uCaustics },
      uCloudTime: { value: tune.uCloudTime },
      uCloudWind: { value: new THREE.Vector2(tune.uCloudWind[0], tune.uCloudWind[1]) },
      uCloudScale: { value: tune.uCloudScale },
      uFogZenith: { value: rgb(tune.uFogZenith) },
      uFogNear: { value: rgb(tune.uFogNear) },
      uFogStart: { value: tune.uFogStart },
      uFogEnd: { value: tune.uFogEnd },
    };
  }

  /** the light model: one patch of three's `lights_physical_pars_fragment` (a look's `lighting`) */
  installLighting(): void {
    if (this.lit) return;
    this.lit = true;
    const chunk = THREE.ShaderChunk.lights_physical_pars_fragment;
    const defs = '#define RE_Direct				RE_Direct_Physical';
    if (!chunk.includes(defs)) { console.warn('[toon light] three chunk changed: lights_physical_pars_fragment has no RE_Direct define; toon lighting off'); return; }
    THREE.ShaderChunk.lights_physical_pars_fragment = chunk.replace(AFTER, `${AFTER}
${this.toonGlsl}`);
  }

  /** the colour-ramp fog replaces the engine's exponential fog (installed first), and the tunables ride every fogged
   *  material's `attachFogUniforms` (a look's `fog`) */
  installRampFog(): void {
    if (this.fogged) return;
    this.fogged = true;
    THREE.ShaderChunk.fog_pars_fragment += this.rampFogPars;
    THREE.ShaderChunk.fog_fragment = this.rampFog;
    addFogUniforms(this.uniforms);
  }

  /** an overhead map shot: the ramp haze off, then back (a look's `fogControl`) */
  suspendRampFog(): void {
    const u = this.uniforms;
    this.held.start = u.uFogStart.value; this.held.end = u.uFogEnd.value;
    u.uFogStart.value = 1e6; u.uFogEnd.value = 2e6;
  }
  resumeRampFog(): void { this.uniforms.uFogStart.value = this.held.start; this.uniforms.uFogEnd.value = this.held.end; }
}
