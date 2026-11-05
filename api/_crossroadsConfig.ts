/** The fixed caps-v1 experiment, as literals: a deployed Node function cannot run @wildshard/format's raw .ts, and this
 * is all the API needs from it. test/preview-telemetry.test.ts holds it equal to format's crossroadsConfig(). */
export const CROSSROADS_CONFIG = { n0: 29, n1: 32, nf: 9, libs: 4, sims: 4, churn: 2, cpu: 'drop', empty: 8, secs: 20, shadow: 1, shadowRadius: 80,
  dpr: 2, l0SplatSize: 256, l1AtlasSize: 512, farSegments: 62, capsMB: { l0: 4, l1: 2, far: 1.6, lib: 25, sim: 25 },
  trisCap: { l0: 40000, l1: 10000, far: 8000 } } as const;
