# op-frame22: the grid cell composite lands (SF63 / G158, E435, 2026-10-10)

Successor of op-frame21 (`progress/shard-platform/frame21/README.md`). Its local candidate `1b7f4c8ad` lands on main with
one fix, still behind the default-off row pause > Settings > Debug > Look > **Grid cell own composite**
(`gridCellComposite`, reload, reviewBy 2026-12-30).

**Tests.** A clean export of HEAD `001a193bf` plus the candidate ran every test its changed files reach
(`vitest related`, 734 files, 3,937 tests): one failure, `test/shards/sunscar-dunes/headless-runtime.test.ts`
("restores mid-fight and mid-respawn continuation exactly"), a 20 s timeout under the full run; alone it passes all 7
tests in 12 s. op-frame21's red gate (14 files / 20 tests, log lost) did not reproduce on a quiet machine. The Sky,
Nine and Pine witness checkpoints are input-only stale (their `.snap.gz` payloads re-record byte-identical): the pusher
re-records the manifests (GIT.md).

**"Loading Sky Reach" after the cell was ready: a frozen frame, not a loading card.** With the row on, Sky Reach's
composite was a second `ToneMappingEffect` (NEUTRAL) in the page's colour pass, beside the shell's own. Both include
three's tone-mapping chunk, so the merged fragment shader failed to compile (`'toneMappingExposure' : redefinition`,
then `useProgram: program not valid` every frame) and the canvas kept the last image drawn before the composite was
placed: the road view of Sky Reach's G217 cell screen at step 3 / 4 (first run, on the candidate build `da1ce25`: 267
console errors in B, none in A, the same in all three B shots at 0 / 4 / 15 s). Fix: Sky Reach's display is its own `SkyNeutralToneEffect` (`src/shards/far-reach/look/neutralTone.ts`,
three's Khronos PBR Neutral curve at exposure 1, no chunk), and the frame owner now refuses any composite display that
includes the chunk (`GridFrame.composite`, a warning instead of a dead frame; `test/grid-cell-composite.test.ts`).
After the fix the B shot draws Sky Reach with its NEUTRAL curve and no shader error: `sky-reach-ab-fixed.jpg`
(muted iPhone 16 Pro portrait, phone tier 2x, the north dock 4 s after ready; `sky-loading.mjs`, `sheet.py`; readout
`sky-loading.json` from the fixed build `d823261`).
