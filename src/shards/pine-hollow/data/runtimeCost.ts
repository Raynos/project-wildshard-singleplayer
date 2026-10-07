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

/** Preserve the images-first reading when the current default measurement is refreshed with compressed textures. */
export const PINE_RUNTIME_COST = { ...PINE_IMAGES_FIRST_COST, imagesFirst: PINE_IMAGES_FIRST_COST } as const;
