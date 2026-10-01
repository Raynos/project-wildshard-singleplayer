# E357 S2.1 continuation proof (sol-s21b)

Direct evidence: [s21b-regressions.json](s21b-regressions.json). Original baseline is `20fcbf54`; corrected regression checkpoint is `432101a8`.

- Physics restored exactly: 2,417 colliders, ten kinematic bodies.
- GPU resources restored exactly: 404 textures / 567,729,880 texture bytes; 41,667,444 buffer bytes; total609,397,324 bytes.
- All three complete movement traces and gameplay fields match exactly (wall-clock runtime is excluded). Lookout ends at(34.926,57.477,211.28); all routes have zero stuck points.
- Gate/cabin/pond masked SSIM: .9990727/.9990617/.9977719. The earlier .987–.994 pose regression was corrected by f1 particle/grass LOD binding.
- Combat records match exactly, including crossbow/bow hits, kill timing, loot writes and sounds. Both pause diffs are empty. Corrected checkpoint unload resources and scoped residue are zero; five shared engine ask answerers remain (not an owned scope leak).
- Root causes: public placement height remained analytic after baked terrain installation (cabin support vertices +11,520B, walk drift); elite update migrated after main sync (eight hitboxes missing and four additional uploaded textures). Publishing baked height and restoring only the elite callback's original before-main order resolves them. The attempted blanket callback rule caused a HUD/regen cycle and was reverted in75810729.
- Later3e02 four-shard boots have no errors and their ordered loading steps exactly equal the original baseline. Pine now owns tree factory, feats, compendium, items, life/crag debug rows and late-load lifetimes. Pine score is S35's committed source, installed in98dd1f04.

Limitations: the later3e02 capture used P1's new accelerated clock while the earlier baseline used RAF. Its images and GPU census cannot establish direct parity against that older capture. Lead assigned the newer scene/resource discrepancy to R1 (Opus). Final comparison must use the same clock on both revisions; use `--clock=raf` to compare to existing pre-S2 evidence. Pond triangle count at432 is+8,863 after restoring elite timing; masked SSIM passes, but no blanket geometry waiver is asserted. The final integrated source still needs narrow parity and the lead/V1 clean committed-tree gate.

Source verification: owned lint passes; focused item/travel/Pine/plugin81cases passed atfffaf143; final committed dd83f29e export passes18 plugin/life/shard-tools/manifest cases and owned lint. Whole export tsc has two integration errors (Nalati custom selector, subsequently corrected94f73a9e, S34 tick-rates mock tuple); owned source has no reported type errors. Full gate on3e02 passes CSS/gen/app+API TypeScript/oxlint/ratchet and1909/1910 tests; the sole docs-exclusion debug-hygiene failure is fixed by X8's6551de4e. Under decision110, V1/lead owns subsequent full gates. No builder push or pin move.
