# E357 S2.2 ranged checkpoint proof

Source checkpoints: `8d0eb5da` families/engine flight ports, `546ad9b6` AmmoRow/projectile.modify contract, `372fd3b9` scoped loadout/cues/weather and family hooks.

- Clean exported `372fd3b9`: generation, whole tsc, whole oxlint, CSS and production Vite build pass. Focused clean-export 23 suites / 367 tests pass (combat, Pine loadout/weather and relocated model contract). Frozen trajectory and damage fixtures unchanged.
- All four phone before/after1 captures preserve every walk/combat/pause/leak measurement. The attached summary retains all differing fields: S14 input/HUD/Tool system ids and Pine's +6400 Grass slots (+486400 buffer bytes). S24 traced Grass capturing56 slots before the Pine40-slot tier override; S21 owns that correction.
- Final after2 capture completed on `372fd3b9`: combat/pause/leak measurements match all four shards; Pine porch endpoint differs by2mm x/1mm z. Boot differences are intentional S14 systems and Pine +11520 buffer bytes: Forest LOD_DIST captures80 before Pine60; S21 owns correction. Grass instance count now matches. Full comparisons are included in s22-summary.json. Full two-tier parity/push/deploy belongs to the lead. Old shared baseline verdicts are not the evidence for this change.
- Source1 and final raw captures/logs: `/private/tmp/e357-s22/{before,after1,after2}`. Recompare: `node /private/tmp/e357-s22/compare_runs.mjs after2`.
- Remaining: cosmetics/skin-row relocation, actor.died drop wiring and player.died loadout reset; remove remaining main type branches with S21's plugin installation. The 13-line Longbow constructor adapter preserves current wiring; its physics/view numbers live in a profile using the shared Bow implementation.
