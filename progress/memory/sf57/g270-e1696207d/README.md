# G270 shipped-layout SF57 — recorded refusal and failed memory qualification

Production pin `e1696207dc0c8b1d73421f40d459b8c0ab081fec`; 2026-10-09. The ordinary Simulator image-fallback arm refused Pine at the hard shared budget. The diagnostic-only `6b74ba9f07dc32f9797c07c74abdd0f01c296082` ignores only the texture-mode probe veto, as authorized for this run. It never ships. Public Developer OFF, phone tier, 2× scale, Auto textures and muted audio remain unchanged. Caps, claims, catalogue and physics are unchanged.

The diagnostic cells leg completed 1,807.798 seconds: four complete circuits, all six cells entered, sixteen crossroads, zero refusals, zero errors, complete GL sampling and zero final live resource leaks. **Memory qualification failed**: playing peak 1,755.9 MB; recovery false; adjusted calibration 2.04–2.77 instead of 1.01–1.21. The road leg never started its drive: Runtime.evaluate timed out during cold loading. It is incomplete, not a road pass.

The original journal reproduces the peak exactly: fixed game WebContent PID kernel interval high 1,411.0 MB plus live labelled GL 344.9 MB. The instantaneous WC reading there was 1,377.5 MB. No GPU-process footprint is added. This is the defined ruler, not a sum over multiple game processes.

| Settled home circuit | WC MB | Labelled GL MB | Accounted MB | WASM capacity MB |
| --- | ---: | ---: | ---: | ---: |
| 0 | 515.6 | 198.3 | 441.8 | 32.8 |
| 1 | 970.8 | 226.9 | 441.1 | 69.9 |
| 2 | 1046.1 | 228.6 | 440.8 | 69.9 |
| 3 | 1292.8 | 228.6 | 440.8 | 69.9 |
| 4 | 1186.5 | 228.6 | 440.8 | 69.9 |

GL and WASM capacities stabilize after warm-up; WC does not. Actual ASTC 6×6 uploads are present inside Pine and gone at later settled home boundaries. That rules out an accumulating **live GL ASTC handle** explanation for the later 246.6 MB home WC increase. It does not rule out JS/native retention or allocator arenas. Calibration alone cannot establish software ASTC double-storage.

The override does **not** override `applyKtx2Probe`: Basis transcoding still filters the failed format families. As-shipped ASTC planes upload compressed, while some Basis files upload RGBA. The diagnostic is therefore a mixed-format arm whose equivalence to the phone has not been demonstrated. The recorded failure is preserved; no revised threshold or regrade supplies a pass.

Next: the requested one-circuit per-crossing SF64/native/passive-category read, after the Pine desktop floor. Physical-phone M2 memory and no-tab-kill evidence remains Jake's G269 runs. SF22 is postponed until this investigation is reported.

Raw samples remain outside git in the lane scratchpad. `summary.json` preserves the original verdicts and compact scalar analysis; no raw archives are committed.
