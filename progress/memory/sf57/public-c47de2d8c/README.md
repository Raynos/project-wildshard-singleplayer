# Public SF57 soak: c47de2d8c (plain 30 minutes, borrowed Driftwood home)

App pin `c47de2d8c2fd3ac51a0b780af1457cb7e86b7e20` (origin/main at launch), build `c47de2d-mv0d6oui`, one preview
(:4400), one Simulator through `scripts/sim-lane.sh` (portrait iPhone Simulator Safari). Layout `shipped`, leg `cells`,
route scope `catalogue`: the public catalogue (Driftwood home plus template-1 to template-5), with the first circuit's road
tour across all 16 crossroads. Developer OFF and render scale 2×. The sampler records kernel footprint only; the
light/coalesced observer runs with the raw upload trace off (`shipped-cells-gl-uploads.jsonl` is empty), and there are no
VM-map or heap probes. Rehearsal, not `--qualifying`.

## Harness change (this commit)

On the public page, Driftwood is the **borrowed home**: the page's own level, held by the `sim:driftwood-isle` page
claim for the page lifetime. It is never a regional resident, which is why attempt 2 on 0f82dbeb8 refused with "source
driftwood-isle not a resident". `ownedSoakPlans(…, homeMode)` now takes `'borrowed'` (from `soakGridEntry('shipped').home`):
- every plan carries `borrowedHome`, so the floor's source proof accepts the home as a source;
- legs no longer require the home as a resident (destination) or demand its retirement (source), because it is retained
  by design;
- `soakWitnessFailures` adds strict checks on top of the floor's witness, before and after every leg: the page level is
  the home, the `sim:<home>` claim is still present with the same positive bytes, and the home never became a regional
  resident. The floor's own destination checks still apply (frame commits, current / inside / gameplayReady, feet
  inside the cell).
- On entry, the worker refuses a public run whose home is not the borrowed Driftwood page level. The metadata now
  records `homeResidency` and the page's texture mode (`__wildshard.textures()`).

The game itself refused no public route. Developer runs are unchanged (`homeMode` defaults to `'owned'`).

## Result: functional PASS; memory under the cap, grader RED on calibration only

- **Functional:** 1813.677 s, 4 complete circuits plus a partial fifth, 46 route witnesses with 0 failures. All 6 cells
  were admitted and none refused; 16/16 crossroads. App errors 0, GPU / context losses 0 (one context event: `observed`),
  native process losses 0. Leak census before = after, 15 scope counters zero, disposal errors 0, 61 ordinary evictions.
  The grader's sampling, leakZero and recovery checks pass.
- **Peaks, each component separately (playing phases):** WebContent interval-high **604.066 MB** (drive start + 15 s, on
  the road between Driftwood and template-1). Labelled live GL **252.799 MB** (+1630 s, circuit 3). Independent GPU
  process 205.392 MB (reported only, never added).
- **Combined (paired row): 848.839 MB** = WC interval-high 604.066 + GL 244.773 (drive start + 15 s). That is **151.2 MB
  under the 1.0 GB cap**; the Developer b13614a6e peak was 1229.156. Loading (all-WebContent overlap + GL):
  923.496 MB, under the 1.8 GB loading limit. Per-lap peaks: 848.8 / 780.7 / 785.8 / 790.1 / (partial) 783.5 MB.
- **Settled growth** (median of the original windows, fixed game PID, 1.5 s census fence), WC + GL: c0 759.345, c1 764.699,
  c2 770.046, c3 775.081, c4 778.642 MB. From c2 to c4 that is +8.597 MB, **+4.298 MB per circuit** (WC +3.686, GL +0.612;
  linear fit R² 0.990). The allocator's accounted bytes stay flat at 536.230. c1 to c4 is +4.648 MB per circuit. There is no
  plateau: the rise is steady and linear. Extrapolated (unproven), the 151 MB of headroom lasts about 30 circuits (about
  2.5 h of nonstop travel).
- **Grader:** memoryPass false only because of **calibration**: adjusted ratio 0.867–0.893 against the 1.01–1.21 window
  (raw 1.43–1.45). The allocator's model over-states the measured WC + GL, which is the safe direction. gatePass is also
  false because the run is a rehearsal.
- **Texture mode:** `img`. Reason: "auto: driftwood-isle's KTX2 set is not cached (yet)". The KTX2 probe did not run
  (`probe: null`), so on this cold Simulator Safari the Driftwood and template paths loaded images, not KTX2.

## Limits

This is the Simulator, on the Mac GPU: it cannot show the iPhone's memory limit, its throttling, or a tab kill. Jake's
"three phone runs with no tab kill" stays separate. The road-only leg and a `--qualifying` run remain open. With KTX2
cached, the texture bytes would differ.

Clean export (HEAD 65301367a + this harness): full suite **993 files / 5523 pass / 14 skip**; soak Node tests 40/40; scripts strict and type-aware oxlint green.

Files: `analyse.mjs` (sp-x3's offline reader, plus separate per-component peaks, texture mode and home residency),
`analysis.json`, `archive.json` (sha256 of the raw files, archived losslessly as `.br`), `run.log`, `manifest.json`.
Cleanup: the preview stopped in the parent's finally, the sim lane is at 0/1, and the owned device
`23CFA683-A1A3-4DBE-8984-65F63587F642` is deleted.

Plan-State: unchanged.
