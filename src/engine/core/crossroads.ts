import { CONTENT_CAPS, CONTENT_MB } from './config.js';

/** Fixed crossroads experiment at provisional caps v1; shared by the static build and telemetry validator. */
export const CROSSROADS_CONFIG = {
  n0: 29, // Four-library worst disc: 21 resident tiles plus 8 heading lookahead (SF22a).
  n1: CONTENT_CAPS.l1Count, nf: CONTENT_CAPS.farCount,
  libs: CONTENT_CAPS.libraryCount, sims: CONTENT_CAPS.simCount,
  churn: 2, cpu: 'drop', empty: 8, secs: 20, shadow: 1, shadowRadius: CONTENT_CAPS.shadowRadius, dpr: 2,
  l0SplatSize: 256, l1AtlasSize: 512, farSegments: 62,
  capsMB: { l0: CONTENT_CAPS.l0.resident / CONTENT_MB, l1: CONTENT_CAPS.l1.resident / CONTENT_MB,
    far: CONTENT_CAPS.far.resident / CONTENT_MB, lib: CONTENT_CAPS.library.resident / CONTENT_MB, sim: CONTENT_CAPS.sim.resident / CONTENT_MB },
  trisCap: { l0: CONTENT_CAPS.l0.triangles, l1: CONTENT_CAPS.l1.triangles, far: CONTENT_CAPS.far.triangles },
} as const;
