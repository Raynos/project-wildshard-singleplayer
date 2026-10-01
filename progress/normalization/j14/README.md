# E357 J14 — spear BRACE removed

Jake's P22: remove BRACE; keep THROW, conditional LOCK, DODGE and JUMP.

Implementation candidate tested: `f8c3f37cf7e91596d20427bcf704ae55773fb2b6`, parent `97453d22f5a75a294fc2e1372fde77af1b297546`.
Later landing rebases retain the same J14 runtime diff and preserve intervening builder commits.

## Checks

- Whole-tree TypeScript, oxlint and check-css pass. Full suite: 318 files, 2,298 tests pass.
- All seven shards booted on phone tier with `boot.errors: []`. Four shipped shards also booted on phone + desktop during the direct parent/candidate comparison.
- Happy-dom renders actual TouchControls with the shipped stylesheet: JUMP visible/clickable, no BRACE, THROW press/release works. Real Space key events reach jump; spear binding rows contain only attack/aim.
- RMB hold never locks walking or enters ADS. Quick RMB tap still winds/releases one javelin on its old clock. Existing thrust timing, mounted lance clear-path 88 damage, occlusion and weapon tuning checks pass.

## Exact direct-parent deltas

- Nalati `boot.scene.totals.mesh`: phone 311 → 310; desktop 583 → 582. The deleted ring accounts for exactly one mesh.
- All four phone `boot.hud` arrays lose one hidden `ws-touch-disc` node: the shared BRACE button, removed with the lead's approval. Other phone HUD entries are identical; other-shard desktop fingerprints are identical.
- All four shards' pose positions, draw calls and triangle counts are identical to the direct parent on both tiers. 17/24 screenshots are byte-identical; remaining image differences have normalized RMSE ≤0.011622 (ambient shots/information, not a gameplay parity acceptance).
- Pine budget reds occur identically in the direct parent and candidate: cabin 147/277 draws vs 146/276 ceilings, +80 triangles; GPU totals 587.132/1318.542 MiB vs 583.849/1308.289 ceilings. J14 adds none. `proof.json` retains every exact inherited field.

## Nalati walk, combat and leak

Completed phone + desktop after the quiet window, parent `79407c64` vs candidate `7fa68e42` (same J14 runtime diff). Walk stuck=0; all three leg traces/endpoints unchanged. Leg `seconds` varies as informational timing. Sabre kills wolf in 3 hits; bow in 2 hits, with identical first-hit/kill clocks, sounds and loot. Pause/resume is identical.

Base + weather leak before/after census equals the parent and has no disposal errors. The removed ring reduces retained geometry/material inventory by two and GPU material inventory by one. Diagnostic stack URLs/build hashes and timer samples vary; their counters match. Exact counts and walk timings are in `proof.json`.

Clean Vercel export passed CSS/gen/typechecks/whole-tree lint/ratchet/liveness, then hit existing R9 captain/npc preload 5 s load timeouts. Both files pass alone on that clean export (6 tests). The lead accepted this inherited load flake and assigned test hardening to sol-fin. Private full suite passed all 2,298 tests. Vite build passed for the tested parity exports.

Raw captures: `/tmp/sol-j14-boot`, `/tmp/sol-j14-parent-poses`, `/tmp/sol-j14-final-poses`, `/tmp/sol-j14-parent-play`, `/tmp/sol-j14-after-play`. Runners finished and closed all browsers/previews.
No enemy charge or lunge tuning changed; no public engine/kit export changed.

Landing code commit: `1555b2f72f0c9e0ad8cf491d271a8d99497d7c55` (rebased onto `97bae80f`).
