/**
 * A toon light model as a look-family system (SHARD-PLATFORM M3): one patch of three's `lights_physical_pars_fragment`
 * chunk lights every MeshStandard / MeshPhysical material on the page the same way (a two-band sun ramp, coloured shade, a
 * rim, a terminator band; the shard's GLSL row). Nothing here knows a shard: the shard passes its GLSL row, the day light
 * its clock turns (borrowed, shared with its graph toon looks) and the starting values of the other tunables.
 *
 *   const toon = new ToonLight(glsl, tune, dayLight);
 *   lighting: { install: () => toon.installLighting() }   // before anything compiles
 *
 * The tunables reach every fogged material through `attachFogUniforms` (the install adds them with `addFogUniforms`).
 * A material that never attaches them gets zeros. A material opts out of the light model with its own GLSL (the shard's
 * row decides, e.g. a `NO_TOON` define). The installer runs once per system.
 */
import * as THREE from 'three';
import { addFogUniforms } from '@wildshard/engine/world/Atmosphere';

type Rgb = readonly [number, number, number];

/** the other tunables' starting values as data (colours linear RGB; the uniform names are the GLSL row's) */
export interface ToonLightTune {
  readonly uToonTerm: Rgb; readonly uToonShadeGrade: number; readonly uCaustics: number;
  readonly uCloudWind: readonly [number, number]; readonly uCloudScale: number;
}

/** three's light chunk line the light model goes after */
const AFTER = '#define RE_IndirectSpecular		RE_IndirectSpecular_Physical';

/** A toon light model from a shard's GLSL row, day light and tunables, with its installer. */
export class ToonLight {
  /** the live tunables (one `{ value }` each, shared by every material that attaches the fog uniforms) */
  private readonly uniforms: Record<string, THREE.IUniform>;
  private lit = false;

  /** `day`: the day light the shard's clock turns and its graph toon looks follow (borrowed: the same `{ value }` objects) */
  constructor(private readonly glsl: string, tune: ToonLightTune, day: Readonly<Record<string, THREE.IUniform>>) {
    this.uniforms = {
      ...day,
      uToonTerm: { value: new THREE.Color(...tune.uToonTerm) },
      uToonShadeGrade: { value: tune.uToonShadeGrade },
      uCaustics: { value: tune.uCaustics },
      uCloudWind: { value: new THREE.Vector2(tune.uCloudWind[0], tune.uCloudWind[1]) },
      uCloudScale: { value: tune.uCloudScale },
    };
  }

  /** the light model: one patch of three's `lights_physical_pars_fragment` (a look's `lighting`), its tunables on every
   *  fogged material */
  installLighting(): void {
    if (this.lit) return;
    this.lit = true;
    addFogUniforms(this.uniforms);
    const chunk = THREE.ShaderChunk.lights_physical_pars_fragment;
    const defs = '#define RE_Direct				RE_Direct_Physical';
    if (!chunk.includes(defs)) { console.warn('[toon light] three chunk changed: lights_physical_pars_fragment has no RE_Direct define; toon lighting off'); return; }
    THREE.ShaderChunk.lights_physical_pars_fragment = chunk.replace(AFTER, `${AFTER}
${this.glsl}`);
  }
}
