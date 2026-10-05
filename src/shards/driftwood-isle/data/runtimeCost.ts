/**
 * SF22a / G172 median of three cold-run play medians, build fe508c172: the lowered world is now Driftwood's
 * only world, with GPU-only copies and island instancing as the only paths. Simulator WebContent plus same-pin
 * desktop labelled GL bytes including renderbuffers (not GPU-process RSS). Native cold range 471.813–477.024 MB
 * is recorded in the linked study. The 299 MB engine base remains
 * the dated 91f97bdfc calibration in progress/memory/sf22a-2026-10-04.json; it was not remeasured in this run.
 * This opaque runtime includes its home render and sim. G144 subtracts the measured engine base and calibrates once
 * in the game helper; the original readings and provenance remain here, shared by the manifest and declaration.
 */
export const DRIFTWOOD_RUNTIME_COST = {
  webContentMB: 473.878,
  glMB: 204.5,
  engineBaseMB: 299,
  rev: 'fe508c172',
  device: 'iOS Simulator iPhone 17 Pro Safari + desktop labelled GL census',
  evidence: 'progress/memory/sf22a-default-g172-g180/summary.json',
} as const;
