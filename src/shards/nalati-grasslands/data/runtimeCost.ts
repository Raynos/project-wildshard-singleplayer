/**
 * SF22a settled default-path readings on 91f97bdfc, before the later regional world extraction. The linked receipt
 * records native WebContent 606 MB and same-pin GL textures/buffers/renderbuffers 122.5/73.2/41.1 MB. These are
 * the original single-cold-run readings, not a fresh three-run regional measurement. Keep this older charge rather
 * than substituting the lower 585.911848 MB single-run play reading on 6c0aaea4f. G144 calibrates exactly once.
 */
export const NALATI_RUNTIME_COST = {
  webContentMB: 606,
  glMB: 236.8,
  engineBaseMB: 299,
  rev: '91f97bdfc',
  device: 'iOS Simulator iPhone 17 Pro Safari + desktop labelled GL census',
  evidence: 'progress/memory/sf22a-2026-10-04.json',
} as const;
