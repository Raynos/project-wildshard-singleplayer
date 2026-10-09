# Handoff (sf57-qualify) — 2026-10-09, lane sf57-qualify5

## Landed
- Earlier lanes: `933205df4`, `f05a45712`, `1e428e7d7` (re-entry leaks), `17775d714` (calibration attributed), `236c1225d`
  (template sims at 3.21 MB), `20225cf9a` (calibration measured, borrowed-home road plan), `2245b3c89` (sampling gate
  counts unlabelled GL bytes), `f87598a62` (the qualifying public soak on `a098b4964`).
- This lane: the grader phases each sample by its timestamp against the recorded drive boundaries (`soakPhaseByTime`,
  `soakDriveBounds` in `scripts/soak/route.ts`; the coordinator's pick). A `drive` / `settle` tag stamped after the drive's
  end is `unloaded`; a missing boundary or a drive tag before the drive started refuses. The worker records the drive's
  end on a failed drive too, and phases `perLap` the same way. Fixtures in `test/sf57-soak.test.ts`.

## Where it stands
The shipped layout's soak is green on both legs from the unedited raw archive (`progress/memory/sf57/public-a098b4964/`,
`regrade-phase-*.json`): the rule moved exactly one sample (road, 0.158 s after the drive's end). Cells 852.7 MB peak,
calibration 1.027–1.050; road 805.4 MB, loops within 12 MB of loop 2, calibration 1.018–1.020; leaks 0 on both. The
recorded worker verdicts stay red in `shipped-*.json`; both passes are regrades under picked grader rules.

## Left (in order)
1. The dev layout's cells + road legs, after SF49-g / SF50-g (closes SF57 under M3).
2. Three phone runs with no tab kill (Jake's).
3. Not a gate: the cells leg's WebContent-only growth (+3.8 / +3.3 / +2.8 MB per circuit, none on the road); a diagnostic
   run that splits it (JS heap vs buffers vs bitmaps) is still owed. The 236c1225d template-2-exit transient's allocation
   site is still unnamed.

Plan-State: unchanged
