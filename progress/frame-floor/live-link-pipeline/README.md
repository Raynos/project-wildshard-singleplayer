# Live shader-link pipeline: preparation and drive

Source `9bd93c090` settles one completed older link while issuing the next live material job. Incomplete KHR links stay queued and owner-fenced. Ordinary boot/desktop batching, materials and render scale are unchanged. Fifty-two focused shader tests pass; root strict passes on the matched base. Current-HEAD root strict has unrelated stale Pine night-test imports after the director move.

Matched Simulator pins: `88b76f10c` and isolated `fe363a5d0`. Developer on, phone tier, 2× render scale, Auto FPS, build pacing on; GL timing and CPU profiles off. Quiet windows: 06:13–06:16 UTC and 06:31–06:35 UTC on 2026-10-11. One-minute loads: 7.46–12.84. All five routes complete without game errors.

| Route | Before p95 / max ms | After p95 / max ms | Verdict |
| --- | --- | --- | --- |
| Nalati normal road, to motor transfer | 34 / 92 | 35 / 89 | Warm-up faster, edge still waits |
| Sky short edge entry | 41 / 72 | 39 / 100 | p95 remains above 35 ms |
| Nalati normal road, geometric interior | — | 34 / 91 | Visible at the geometric boundary; unmatched after run |

Nalati afterPlay falls from 18.045 s to 11.883 s (6.162 s saved), but the road turn supplies only about 1.6 s of preparation lead. Observed closed-wall time remains 17.632 s, down from 23.683 s. **Ready before normal arrival is not proved.** The first visible root in the full-entry after run occurs at x=305.565, just inside the real x=305 boundary, with residency ready. Motor transfer at about x=300 is not a visibility boundary.

The long road/wait sample dilutes p95 and cannot close the short-entry Nalati drive row. These pins predate the newer horizon/residency fixes; current-HEAD maximum checks (Signal/Nalati/template), edge-entry p95 and desktop control remain open. No raw timing archive is committed.
