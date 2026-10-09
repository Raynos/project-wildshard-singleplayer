/**
 * SF22a settled default-path readings on 91f97bdfc, before the later regional world extraction. The linked receipt
 * records native WebContent 606 MB and same-pin GL textures/buffers/renderbuffers 122.5/73.2/41.1 MB. These are
 * the original single-cold-run readings, not a fresh three-run regional measurement. Keep this older charge rather
 * than substituting the lower 585.911848 MB single-run play reading on 6c0aaea4f. G144 calibrates exactly once.
 */
const NALATI_IMAGES_FIRST_COST = {
  webContentMB: 606,
  glMB: 236.8,
  engineBaseMB: 299,
  rev: '91f97bdfc',
  device: 'iOS Simulator iPhone 17 Pro Safari + desktop labelled GL census',
  evidence: 'progress/memory/sf22a-2026-10-04.json',
} as const;

/** G258: largest paired entry/centre increment across three cold compressed Simulator runs on private f3a42924f.
 * The matched settled pre-entry road contains the platform, composer and highway that stay separately charged.
 * The dated engine base is provenance; calibrate the measured increment once. The probe bypass is diagnostic-only.
 * These settled readings are neither an unobserved transient peak nor a physical-phone claim. Keep the prior image arm. */
export const NALATI_RUNTIME_COST = {
  webContentMB: 634.916944,
  glMB: 269.1803,
  engineBaseMB: 299,
  residentBaseMB: 685.345862,
  rev: 'f3a42924f51424d2a653597c945451f69505ed14',
  device: 'iOS Simulator Safari compressed matched pre-entry increment, three cold runs',
  evidence: 'progress/memory/g258-accounting/summary.json',
  imagesFirst: NALATI_IMAGES_FIRST_COST,
} as const;
