# E173 — the two open rows, measured back to back (2026-09-26)

The first E173 scorecards flagged two rows as E173's own: Driftwood desktop cold on Fast 4G (23.6 → 27.7 s, same bytes)
and Pine Hollow desktop main-thread ms per frame (+1–2 ms). Both were single runs, each after or before a run of main on a
machine other agents were also loading. Measured here with main and the branch alternated, three times each, same
scorecard, same machine, one after the other (`--shards=driftwood-isle,pine-hollow --viewports=desktop --no-switch`;
main `89d63764`, the branch `fe3052a8` = main + E173; 01:23–02:03, load average 2.9–7.0).

| row (s, ms per frame, MiB) | main 1 | main 2 | main 3 | **main median** | tip 1 | tip 2 | tip 3 | **tip median** |
|---|---|---|---|---|---|---|---|---|
| driftwood-isle/desktop/cold4g.playMs | 26.05 | 25.76 | 25.91 | **25.91** | 26.09 | 26.04 | 25.98 | **26.04** |
| driftwood-isle/desktop/cold.playMs | 7.83 | 7.68 | 7.65 | **7.68** | 7.70 | 7.66 | 7.65 | **7.66** |
| driftwood-isle/desktop/cold.netBytes | 22.12 | 22.12 | 22.12 | **22.12** | 22.12 | 22.12 | 22.12 | **22.12** |
| pine-hollow/desktop/cold4g.playMs | 84.04 | 83.99 | 83.96 | **83.99** | 84.02 | 84.09 | 83.96 | **84.02** |
| pine-hollow/desktop/warm.playMs | 3.59 | 3.38 | 3.38 | **3.38** | 3.47 | 3.31 | 3.24 | **3.31** |
| pine-hollow/desktop/pose.gate.cpuP50Ms | 9.1 | 8.4 | 8.9 | **8.9** | 8.9 | 10.1 | 9.0 | **9.0** |
| pine-hollow/desktop/pose.cabin.cpuP50Ms | 8.1 | 9.0 | 7.8 | **8.1** | 8.1 | 8.2 | 8.0 | **8.1** |
| pine-hollow/desktop/pose.pond.cpuP50Ms | 5.0 | 4.7 | 4.9 | **4.9** | 4.9 | 5.5 | 5.3 | **5.3** |
| pine-hollow/desktop/pose.gate.cpuP95Ms | 10.6 | 9.3 | 9.7 | **9.7** | 9.5 | 11.5 | 10.3 | **10.3** |
| pine-hollow/desktop/pose.cabin.cpuP95Ms | 9.5 | 10.7 | 8.6 | **9.5** | 8.7 | 9.7 | 9.2 | **9.2** |
| pine-hollow/desktop/pose.pond.cpuP95Ms | 5.9 | 5.4 | 5.9 | **5.9** | 5.4 | 6.3 | 6.1 | **6.1** |
| pine-hollow/desktop/mem.glTexBytes | 1205.21 | 1205.21 | 1205.21 | **1205.21** | 619.30 | 619.30 | 619.30 | **619.30** |

**Driftwood desktop cold on Fast 4G: not E173.** Main 25.76–26.05 s, the branch 25.98–26.09 s: +0.13 s between the
medians (0.5 %), inside main's own 0.29 s spread, and the bytes are the same to the byte. Main itself now reads ~26 s where
the baseline read 23.1 s (and main measured 23.6 s in the earlier pair): that move is main's (E186 / E188 landed between).
The 27.7 s was one run. Nothing KTX2 runs on an images first visit: `initKtx2` returns before the loader exists unless the
build loads KTX2, the Basis transcoder is fetched only by a KTX2 boot or the background download (after playable), and the
Auto check computes a URL list (no fetch).

**Pine Hollow desktop main-thread per frame: not E173.** The medians are +0.1 / 0.0 / +0.4 ms (p50) and +0.6 / −0.3 /
+0.2 ms (p95), each inside its band (±1.5–1.9 ms), while every run of the branch draws on KTX2 (619 MB of GPU textures
against main's 1205). Two in-page checks agree:
- a CDP CPU profile, images then KTX2 on the same build (Pine Hollow spawn, 8 s): the extra time was spread over every
  function in proportion (three's traverse, matrices, render lists, the game's own code) with the same WebGL calls per
  frame (4440 vs 4430): the same work running slower in that one load (the machine), not new work; no function of
  `src/core/ktx2.ts` appears;
- the same pose, images and KTX2 alternated six times in one browser: game rAF ms per frame, images 9.77 / 10.35 / 9.75,
  KTX2 9.44 / 9.43 / 9.81.

**The look rows change because the textures are KTX2.** The desktop pose SSIM against the image goldens drops (Pine Hollow
gate 0.969 → 0.927, cabin 0.963 → 0.884, pond 0.971 → 0.912; Nalati bridge 0.994 → 0.979): the goldens were shot with
images, and the warm page now draws the UASTC → ASTC 4×4 / ETC1S → ETC2 textures the user asked for (E173). What the
difference is: progress/279–281 (the A/B, close-ups at the run-to-run floor on the ground, bark and sand, below it on
foliage and grass edges), and the texture-level loss (37–51 dB PSNR per map, the ARM planes 37 dB). The phone's own
KTX2 look was accepted the same way (E157). New desktop goldens are a baseline re-run (docs/design/scorecard.md rule 5).

## The final run (2026-09-26, rebased on origin/main 05060a93, the switch route at 2 shards in memory — E194)

`node scripts/scorecard.mjs --export=HEAD --tag=e173 --compare=baseline`: **0 budget rules missed** (33 row
regressions against the 2026-09-25 baseline, most of them main's own since: the phone's locked 30 fps, E189; the
geometry / buffer rows). Main measured alone right after, same machine (`e173-base`), and the two compared
(`e173-vs-e173-base.txt`): 17 row regressions, 16 better, 0 rules missed. E173's own rows:
- **better**: desktop GPU textures Pine Hollow 1205 → 619 MB, Nalati 450 → 341, Driftwood 370 → 334; the resident pair
  Driftwood + Pine Hollow 1298 → 712 MB, Pine Hollow + Nalati 1510 → 814 MB; the Driftwood → Pine Hollow build 3.71 → 2.93 s;
- **Fast 4G cold starts equal**: Driftwood desktop 24.01 → 24.09 s, phone 24.51 → 24.63 s, every shard within ±0.5 %;
- **the look** (KTX2's, above): desktop pose SSIM Pine Hollow gate / cabin / pond 0.957 / 0.966 / 0.967 → 0.943 / 0.905 /
  0.936, Nalati bridge / camp / plains −0.012 to −0.015, Driftwood wreck 0.991 → 0.980, Nalati phone plains 0.972 → 0.957
  (the phone set is unchanged; that pose also moved in main's own runs, 0.982 in the baseline);
- **the cache**: desktop Cache Storage for all three shards 124.9 → 271.9 MiB (the 300 MB rule passes);
- the phone draw-call / tris / cpu rows flagged against main's run are main's run being low (Driftwood phone pier 175 calls
  where the baseline and the branch read 233 / 222); the phone's KTX2 files are unchanged, and those rows pass against
  the baseline.
