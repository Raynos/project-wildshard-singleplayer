# Mantis candidate5 bounded diagnostic capture

2026-10-19. One isolated actual-engine capture after root build GO. **UNACCEPTED WIP. No promotion, collider, visual, runtime or physical-phone acceptance.** Candidate4 remains unchanged.

## Exact artifact

- Candidate source checkpoint: `4582a26c08e33c77264170e6a0b755570e93df6b`; strict source closure SHA256 `471c590760e63d74f10a4601568fb36938901e1e1ce84b91a60a9843d01fb890`.
- New product source hash: `984bfeb67b6fbd80371783923ccfbdff0a942d77ab83b3fcc4ad616a1ac5e962`.
- New empty native/app outputs, normal heavy-lane build, strict candidate-native admission. Native49 files and complete host137 files are byte-identical before/after capture. Current engine/game/SDK/practice/Vite inputs are independently inventoried; old candidate4 host evidence is not reused.
- New editable tooling `scripts/qa-mantis-onset-motion.mjs`, frozen copy in evidence. Typed oxlint:1 file,452 rules,zero diagnostics. Existing measurement script independently linted. No installs, gameplay edits or engine exemptions.
- The first browser launch failed before opening a browser because `lockf` was absent from PATH. Its complete log is retained. The same frozen tooling then ran through the normal browser lane with the existing Linux lock shim. Browser closed at completion.

## Evidence and timing boundaries

One continuous original portrait402×874 VP8 video:4066 encoded frames at25fps,162.64seconds. All video bytes remain intact at the source referenced by evidence/provenance.json; root owns native Site publication. Compositor trace:1355 snapshots over106.5817game seconds and152.1654wall seconds. Compositor intervals min2.6ms/median98.3ms/max987.4ms. Encoded repeats are not simulation frames or new poses.

The labeled render-only oblique camera preserves player/gameplay state and shows both blades. Diagnostic player placement/aim is logged. Health, enemy state, clocks, damage and RNG are never injected. Each trace row retains authoritative strike snapshot, observed phase/clock, stage, local bone positions/quaternions and full world matrix. Ground plane is900. Browser recording begins before observer installation and continues through reload; the original trace ends before reload destroys that page's observer.

First actual-active trace69/frame74/game6.509 still shows observed windup. First observed-active trace70/frame75/game6.609 has observed clock0 and authoritative active elapsed.15. Second actual-active trace93/frame98/game8.7893 still shows windup; observed-active94/frame99/game8.8893 has clock0 and active elapsed.1167. Both windup/active/recovery windows and neighboring poses exist; the first recovery is only one compositor sample. Independent framewise review must judge whether the earlier full cut is readable.

## Actual runtime findings and retained failures

18 of19 original harness checks pass. The failing terminal-defense damage assertion is retained unchanged: it compares HP after a five-second tail, when ordinary regeneration has restored100. Independent complete sample history shows real damage100→90 at game7.4915 and through11.7544; health.ts permits regeneration after6000ms without hurt. This is an assertion-design failure, not permission to rewrite the original result as a clean pass.

Real sword damage55→43 occurs at trace292/frame297 during active stage1 with flinch1. Further idle-stage hits43→31→19→7 and lethal7→0 are captured. This is actual hit/flinch coverage; no struck windup was captured, and the active strike persists rather than being canceled. Do not claim unobserved interruption cases.

Real enemy death, collapse, settled corpse tail, practice-only3coin completed reward and no postdeath strike are captured. Fresh-bout actual enemy attacks reduce player health to0, defeated attack cannot hurt the enemy, Retry restores55enemy HP/100player HP, and reload starts fresh. Approach/stop/resume/second stop are observed through normal AI response to logged player placement. Browser stores and world/shard state remain empty/unchanged throughout. No page errors or fatal capture error.

**Fresh contact failure:** one of1355 recorded poses penetrates the floor. Trace385/frame390/game34.1994, stage5, deathT.110375, flinch.615297 has leg-1_1_knee minimum−.10222949m. This early-death pose needs independent verification and motion review; it prevents a positive clearance claim. The historical counterfactual's positive clearances do not validate this fresh host/trace. All raw poses and full world measurements are retained.

## Preservation

Evidence/provenance.json maps screened copies to complete original bytes and SHA256. Public-safe text removes private absolute paths and trailing whitespace only; original logs/report/trace remain intact. Full native/app inventories, source inputs, raw report, complete render trace, complete world measurements, original video and screenshots are retained without chunks, archives or base64 files. No public candidate4 bytes or frozen source tuple were changed. Review and promotion remain root decisions.
