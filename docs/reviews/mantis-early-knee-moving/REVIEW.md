# Same-product moving-death diagnostic

2026-10-19. Runtime and visual acceptance remain HOLD. Candidate4 stays public.

## Scope and recipe

This is one bounded diagnostic bout against immutable product 1411a8ac1dbbbc08e9da4e3857ac9b369de248e491a23ba25566279842a59996. No app/product rebuild, gameplay, enemy, health, damage, clock, RNG or public asset changes. All 194 entries in the existing built/native closure verified before launch. The new harness passed syntax and type-aware lint before its freeze.

The main recording's genuine moving lethal was applied at first-strike active elapsed .5667, after pre-hit speed 3.2725. Its visible recording skipped HUD1214–1226, including the early knee fold. The prior supplement proves a stationary death only. Neither is relabeled or replaced.

The new harness waits for the real first-strike active onset before each ordinary sword tap, using the same logged diagnostic player placement 2.05 m, angle −2.2, pitch −.03. This is observed-event timing, not an injected AI/animation state. Up to 10 attacks and 75 seconds bound the attempt; any timeout/failure stays in the original report. No second bout, parameter sweep, defeat/Retry/reload repetition or staged enemy motion is included.

Per-species transparent pre-update attachment preserves original calls and returns. Every render retains actual pose-owned inputs separately from post-hit state, full 22-bone transforms and meshWorld. Trace stays entirely in browser memory until after the 6.5-second settled observation, avoiding periodic whole-trace serialization during death. Portrait iPhone16Pro emulation is 402×874 at capture scale 1, using the same silent SwiftShader cloud browser and temporary render-only observer camera as earlier diagnostics. The informational overlay has pointer-events:none. This is not a physical-phone performance test.

## Reproduction

Use scripts/qa-mantis-early-knee-moving.mjs through scripts/browser-lane.sh --max 3 with the installed Chrome headless shell and existing frozen tmp/mantis-early-knee-dist-capture1. No installs or build. HOME is the repository's tmp/home; PATH includes tmp/dot-audit/bin; PLAYWRIGHT_BROWSERS_PATH is tmp/dot-audit/playwright. MANTIS_QA_OUT must be a fresh directory. Local static server uses 4478. Exact tooling and input closure hashes are in tooling-freeze.json.

## Outcome

The one 35.84-second continuous VP8 portrait video has 896 encoded frames at 25 fps. Capture exited 0 with all 9 harness checks true, no page errors and no fatal exception. Five genuine 12-damage sword hits killed the 55 HP enemy. Actual lethal event HUD208 follows HUD207 speed 3.0653; its own animation input records speed 3.7415, alive=true, deathT −1. The same rendered frame's post-hit state records alive=false, deathT 0, flinch 1. This preserves the lethal-boundary pose/state distinction.

All 303 renders have full 22-bone/meshWorld observations and pose-owned inputs. Actual trace deathT reaches 0 at HUD208 and 1 at HUD220, with 87 settled renders at 1. Median render interval 101.7 ms, p95 184 ms, maximum 392.4 ms. Exact native-vertex analysis reports minimum +0.698609 mm and zero frames below −5 mm. This does not prove unsampled clearance or robust collider contact.

Original raw streams/video remain under tmp/mantis-early-knee-moving1; evidence-closure.json pins each whole file. Ordinary report/hits/aim/contact proofs are also preserved in run1. No failed attempts were discarded; there was only this single bout. All 194built/native closure files still hash identically after recording.

Every-frame independent review and actual visible HUD continuity remain required. In particular, whether any of HUD208–220 is skipped in the encoded video must be established by direct review; the contiguous trace does not settle that question. A passing trace assertion alone cannot establish visible death coverage or animation quality.
