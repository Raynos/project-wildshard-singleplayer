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
 * G258: largest paired entry/centre increment across three cold compressed Simulator runs on private 9f0245c.
 * The matched settled pre-entry road includes the platform, composer and highway that stay separately charged.
 * Subtract that complete resident set, not just the dated 299 MB engine base; runtimeAccountedBytes calibrates once.
 * Readback-zero probe bypass exists only in the accounting diagnostic; production still selects its image fallback.
 * No transient-peak or physical-phone admission proof is inferred from these settled samples.
 */
export const PINE_RUNTIME_COST = {
  webContentMB: 533.958808,
  glMB: 316.131094,
  engineBaseMB: 299,
  residentBaseMB: 670.843114,
  rev: '9f0245c60e20b30ac6200fee6c233e48a5052ac1',
  device: 'iOS Simulator Safari compressed matched pre-entry increment, three cold runs',
  evidence: 'progress/memory/g258-accounting/summary.json',
  imagesFirst: PINE_IMAGES_FIRST_COST,
} as const;
