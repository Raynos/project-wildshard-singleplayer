/**
 * SF22a default Pine (trim OFF), build 6c0aaea4f: one cold run, median of three settled play samples, WebContent plus
 * same-pin labelled GL. The 299 MB engine calibration remains dated 91f97bdfc. This over-cap reading is intentional:
 * admission must refuse the home before allocating it; an optimized variant cannot replace the default measurement.
 */
export const PINE_IMAGES_FIRST_COST = {
  webContentMB: 569.49544,
  glMB: 622.7,
  engineBaseMB: 299,
  rev: '6c0aaea4f',
  device: 'iOS Simulator iPhone 17 Pro Safari + desktop labelled GL census',
  evidence: 'progress/memory/sf22a-refresh-6c0aaea4f/summary.json',
} as const;

/**
 * SF22a / G226: grid-default trim ON, cold Auto resolving to KTX2, G187 cuts 1–3 on 8e82ae91f.
 * Median of three cold-run settled play medians plus the same-pin, same-phase labelled GL census. Play native range
 * 629.231336–651.235 MB; Explorer GL reaches 246.332454 MB and the conservative combined playing transient is
 * 960.832454 MB in the linked receipt. This is a settled opaque-runtime charge, not a transient or grid-fit verdict.
 * Standalone's explicit trim-OFF variant was not measured by this study. Keep images-first separately for G188;
 * the 299 MB engine calibration remains dated to 91f97bdfc, rather than being measured again here.
 */
export const PINE_RUNTIME_COST = {
  webContentMB: 648.990416,
  glMB: 205.941312,
  engineBaseMB: 299,
  rev: '8e82ae91f701f8990199fe92407e4f1c61f14b20',
  device: 'iOS Simulator iPhone 17 Pro Safari + desktop labelled GL census',
  evidence: 'progress/memory/sf22a-pine-g187-8e82ae91f/summary.json',
  imagesFirst: PINE_IMAGES_FIRST_COST,
} as const;
