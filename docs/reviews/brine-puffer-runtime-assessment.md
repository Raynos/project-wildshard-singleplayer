# Brine Puffer runtime assessment: V55

2026-10-18. Scope: the unaccepted V55 isolated actual-engine arena, not production
Driftwood or a human playtest. The owner's **4/5 stopping condition is visual
resemblance**; it does not certify animation, balance, performance or fun.

## Verdict

A functioning single-enemy combat prototype with verified damage, rewards, defeat
and reset. It is ready for continued review, not broad gameplay acceptance.
**Visual resemblance: 3.81/5**, the independent hero-plus-nine-view Blender review.
This is not a runtime-lighting score. Other quality axes are **not scored**: the
available scripted test and source inspection cannot support honest five-point
quality judgments. Passing a test is not a quality rating.

| Axis | Evidence and current assessment | Rating |
| --- | --- | --- |
| Animation | Native head remains bind-local under belly. Three belly scale channels cap swell at 1.10; no independent head animation. Source retains the 2.1-second strike clock. Sampled initial/close/Retry screenshots show no obvious head/body separation. No per-frame phase telemetry, complete locomotion/death-animation review or all-angle containment check. | Not scored |
| AI | Source has nearest-player stalk, attack within 2.1 units, then a 2.4-second alert pause; stun and death stop movement. Real enemy attacks reduced player health to zero. No obstacle/navigation, disengagement, stun, multiplayer-target or exploit testing. | Not scored |
| Combat readability | HUD-fixed portrait layout leaves health clear; 320/390 layout verification was on the same HTML/CSS with V51. V55 shows readable defeat/Retry states. Swell is only 10%; close weapons/UI occlude part of the face/body. No human reaction or dodge-timing evidence establishes that the tell/range is legible. | Not scored |
| Gameplay | Real keyboard approach and touch attacks produced two local coins; another fresh bout produced player defeat; Retry restored 100 health and reset the opponent. This establishes a small playable loop, not encounter quality or progression. | Not scored |
| Balance | Authored enemy HP45; burst damage12, radius2.2, windup0.9s, active0.1s, recovery1.1s; stalk speed0.70 and stand-off2.0. Conservative geometry-derived colliders remain unaccepted. Passive damage/defeat observations are not skilled time-to-kill or fairness measurements. | Not scored |
| Variety | This preview admits one Puffer species, one burst strike and one fixed-scale variant. No multi-enemy combinations or encounter variations were exercised. The deliberately narrow slice cannot establish game-wide variety. | Not scored |
| Performance | Mounted cloud Chromium software-WebGL run had zero JS/HTTP errors. Static artifact: 137 files, 9,081,463 bytes (not measured transfer or memory). No frame-time, GPU/memory, thermal or device measurements. Absolutely no phone-performance verdict. | Not scored |
| Estimated fun | A plausible readable bait-and-punish loop is a design hypothesis from windup/recovery, not demonstrated enjoyment. No human sessions, preference feedback or replay-choice evidence; estimated fun remains unknown. | Not scored |

## Observed run and source pins

- Run: 20:04:29.934–20:07:12.992 UTC, unchanged runtime speed, no gameplay-state injection.
- Two coins at 20:04:56.606; actual defeat/0 health at 20:07:02.291; final Retry/100 health at 20:07:07.860.
- Local/session storage, cookies, IndexedDB names, CacheStorage keys and service-worker registrations stayed empty across sampled phases. This proves the sampled local isolation surfaces, not a general network/privacy audit.
- [Exact timestamped receipt and 137-file inventory](brine-puffer-native-preview-v55/cloud-mounted-runtime-receipt.json), SHA256 `c9bf9d9abd428c95f87f62dfc661e01623b727d5b732b5010b4882a3e24723ba`.
- Engine baseline `c4339d90a93ccc289540e3a72c1e9cbf221d98fb`; native inputs `6fe68af59d05ef4d56c8b65e7dfd8a46471262cf`; builder `4caa8849e4dd800860b4f2c5b288126af5e14574`; HUD config `d940e51eec5090e10ecbb815db6dbfe6feae554b`.
- Native SHA256 `6be3655e74bced514508a383c1cc2615e97c1db09634fbc586e0f4d2a5b1b04c`.
- Source inspection: `src/shards/driftwood-isle/behaviour/brinePuffer.as`, `generators/driftwoodRegularCombat.ts`, and `generators/pufferNativeClips.ts` under that shard. All three were byte-compared with the clean source actually built.

## Remaining risks / next evidence

1. Review swell timing, limb motion and head/body containment through the actual attack cycle from unobstructed multiple views. Conservative colliders need independent range/contact testing.
2. Test evasion, punishment windows, navigation and reset edge cases. Obtain human combat-readability/fun evidence before assigning quality scores.
3. Measure performance on the target device before claiming phone readiness; cloud boot success is insufficient.
4. Runtime color remains an arena probe: actual toon/AgX/grade, but fixed empty-look lighting and no LUT. It does not establish full Driftwood Noon or Model Explorer Solid/Paint parity.

No new build/browser run was made for this assessment. V57 review is pending and
does not change the V55 evidence or its score here.
