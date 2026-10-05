/**
 * SF22a / G173 median of three cold-run play medians, build 0ffa9a4ba: default standalone hybrid OFF, with GPU-only
 * copies and island instancing now the only paths. Simulator WebContent plus same-pin desktop labelled GL bytes
 * including renderbuffers (not GPU-process RSS). Native cold range 458.903–484.446 MB
 * is recorded in the linked study. The 299 MB engine base remains
 * the dated 91f97bdfc calibration in progress/memory/sf22a-2026-10-04.json; it was not remeasured in this run.
 * This opaque runtime includes its home render and sim. G144 subtracts the measured engine base and calibrates once
 * in the game helper; the original readings and provenance remain here, shared by the manifest and declaration.
 */
export const DRIFTWOOD_RUNTIME_COST = {
  webContentMB: 463.294,
  glMB: 205.1,
  engineBaseMB: 299,
  rev: '0ffa9a4ba',
  device: 'iOS Simulator iPhone 17 Pro Safari + desktop labelled GL census',
  evidence: 'progress/memory/sf22a-g173-0ffa9a4ba/summary.json',
} as const;
