/**
 * SF22a default Pine (trim OFF), build 6c0aaea4f: one cold run, median of three settled play samples, WebContent plus
 * same-pin labelled GL. The 299 MB engine calibration remains dated 91f97bdfc. This over-cap reading is intentional:
 * admission must refuse the home before allocating it; an optimized variant cannot replace the default measurement.
 */
export const PINE_RUNTIME_COST = {
  webContentMB: 569.49544,
  glMB: 622.7,
  engineBaseMB: 299,
  rev: '6c0aaea4f',
  device: 'iOS Simulator iPhone 17 Pro Safari + desktop labelled GL census',
  evidence: 'progress/memory/sf22a-refresh-6c0aaea4f/summary.json',
} as const;
