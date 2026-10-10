// aoTuning — a look's ambient-occlusion tuning as a data row (SHARD-PLATFORM M3, ex Nine Dragon's look/render.ts): the
// engine's AO pass re-tuned at compose time — radius, distance falloff, intensity, the sample / denoise counts per tier
// (phone, other), the denoise radius, the occlusion's colour (linear RGB), half resolution — and the scene fog's near / far,
// which the AO pass fades its occlusion with (nothing else in the engine reads them), or null to leave the fog alone.
//
//   tuneAo(c.fx.ao, AO_TUNING, c.tier === 'phone', c.scene);
import { Color, Fog, type Scene } from 'three';

/** An AO tuning row: per-tier counts are `[phone, other]`; `color` is linear RGB; `fog` the scene fog's `[near, far]` the AO fades with, or null. */
export interface AoTuning {
  readonly radius: number;
  readonly falloff: number;
  readonly intensity: number;
  readonly samples: readonly [number, number];
  readonly denoiseSamples: readonly [number, number];
  readonly denoiseIterations: readonly [number, number];
  readonly denoiseRadius: number;
  readonly color: readonly [number, number, number];
  readonly halfRes: boolean;
  readonly fog: readonly [number, number] | null;
}

/** The AO pass knobs a tuning row writes (the engine's AO pass `configuration`). */
export interface AoKnobs {
  aoRadius: number; distanceFalloff: number; intensity: number; aoSamples: number; denoiseSamples: number; denoiseIterations: number;
  denoiseRadius: number; color: Color; halfRes: boolean;
}

/** Re-tune the AO pass (if there is one) from a row, in the row's order, and set the scene fog's distances when it has a `Fog`. */
export function tuneAo(ao: { readonly configuration: AoKnobs } | null, row: AoTuning, phone: boolean, scene: Scene): void {
  if (ao === null) return;
  const k = ao.configuration, tier = phone ? 0 : 1;
  k.aoRadius = row.radius;
  k.distanceFalloff = row.falloff;
  k.intensity = row.intensity;
  k.aoSamples = row.samples[tier];
  k.denoiseSamples = row.denoiseSamples[tier];
  k.denoiseIterations = row.denoiseIterations[tier];
  k.denoiseRadius = row.denoiseRadius;
  k.color = new Color(row.color[0], row.color[1], row.color[2]);
  k.halfRes = row.halfRes;
  if (row.fog !== null && scene.fog instanceof Fog) { scene.fog.near = row.fog[0]; scene.fog.far = row.fog[1]; }
}
