# E357 S2.3 — sol-s23 proof

Before: `74c61a710b1e90096205aed3664553c89f568278`; runtime after: `c3132402c7626dc8859bfd0bf8f0ddca8fc8b85e`.
Both all-four phone runs used `walk+combat+leak`; raw JSON and report files: `/private/tmp/e357-sol-s23/{before,after}`.
Twelve walk endpoints, combat hit counts, kills and combat sound event maps match exactly. Every after-run class-D field is green;
unload scope census is zero on all four. The global comparison verdict is red against pre-F10/B27 records, whose save paths and
system names differ; this is not a claim of full baseline parity. Aggression intentionally adds two persistent root answerers;
each unload returns to the measured engine baseline. Browser contexts closed by the runner.

Frozen six-lane replay hashes compare 480 frames per scenario with the old implementation (Ironhide, Blackpaw, imperial, rival,
Antler King and thrall). Seeded species roll fixture was recorded on the old implementation in clean candidate
`/private/tmp/e357-sol-s23/candidate-9c8b9159-gd3c2vi8` before table replacement, then passed unchanged against the new implementation:
512 rolls across boar/bear/deer/elk, normal and legendary exclusion, including the next random draw. Existing fauna and harvest tests
pass unchanged. Overlay off/on/off/unload test verifies zero off-state visual/system allocation and resident cleanup.

B4 is covered by real Rapier tests in `test/combat/wall-characterization.test.ts`: all boar and bear variant damage amounts,
elite lane 30, King sweep 24 and Blackpaw swipe 22 are blocked by WORLD cover; open controls still deal their exact original damage.
Roar 12, roots 20 and lantern blast 9 explicitly remain cover-exempt. There is no pending.json entry: the harness cannot record
enemy damage. Lead owns the M2 before/after clip.

Scripted wall repro: WORLD cuboid half extents `(4,3,.1)`, center `(0,0,-1.25)`; creature feet `(0,0,-2.5)`, yaw 0;
player feet `(0,0,-1.2)`. Test wall placement blocks the chest/body ray; remove it for the positive control. Board the Pine brown
bear at the cabin wall, Ironhide at a fence and the King at the fallen log with equivalent blocked/open player spots.

Remaining S2.3 work is listed in the sol-s23 handoff in `docs/tasks/asks/E357.md`; this checkpoint does not complete the row.

Final population after-run: `182f730f32c2811aeb0fe8e20e9b99226905bbe2`, raw artifacts `/private/tmp/e357-sol-s23/final`.
All class-D fields green and all scope counters zero; combat counts/kills/event sounds match before. Eleven endpoints exact;
Pine porch is `(-10.386,3.833,-34.360)` versus before `(-10.388,3.833,-34.359)`. This 2 mm / 1 mm difference remains unresolved;
do not claim full exact parity for this run. Maximum walk heights are unchanged. The later vocabulary-only NightBrain correction
changes no species order or random draws. Stun wiring is separately covered by the effect tests and requires combined plugin smoke.

Full clean Vercel gate on `e0b2617c`: CSS/gen/gen-check/tsc/app+api/oxlint/ratchet pass, 1796/1797 tests pass.
Only `test/shard-prefetch.test.ts:99` fails (Pine phone missing declared boot reads), assigned to S2.1;
log `/private/tmp/e357-sol-s23/nightfix-gate.log`. Vite build is not reached after that failure. No push/deploy by this builder.

Final clean projected source verification on `8f3b7541`: 258 tests / 27 files pass (all AI, inventory/loot, wall controls,
effects and level lifecycle). Whole working-tree TypeScript and owned lint pass at 06:26 before the final proof commit.

## Continuation — sol-s23b, 2026-10-01

`a3df39a1` separates kit boar/bear simulation rows and visual strategies, with Pine and Driftwood children.
`d2398ba4` publishes their public ports and passes the complete clean Vercel gate. The original procedural
PBR/toon fingerprints and 512-roll fixtures remain unchanged; no snapshots or parity baselines were rewritten.

`14e57a0f` publishes scoped species resolution at the factory boundary, Pine hull/coats/rigs in the shard,
King and four elite move policies, authored swipe/roar/sweep/root/lantern contacts, scoped thrall spawn tables,
and boss/elite runtime binding. `386ff9a7` unlinks retired King adds from their spawner and removes four obsolete
engine rig modules. Both were published by the index hot-file holder, V1, from reviewed committed-tree projections.
`2f44de31` applies the kit defaults and active island child composition calls through the main hot-file holder, S3.1.

Clean candidate `e40d8dd4` passes CSS, generation/check, application/API TypeScript, oxlint and the ratchet.
Its full suite is 1890/1901 (11 sibling failures in 8 files); this is not a full green gate claim.
Log: `/private/tmp/e357-sol-s23b/source-gate.log`. A separate clean export builds successfully:
`/private/tmp/e357-sol-s23b/final-build.log`. Focused AI, inventory, wall and hitbox-owner tests pass 227/227
in 26 files: `/private/tmp/e357-sol-s23b/final-focused.log`.
The published `386ff9a7` gate also passes every pre-test stage; 1891/1901 tests pass (10 sibling failures).
Log: `/private/tmp/e357-sol-s23b/published-gate.log`. The obsolete `pineCreatures.ts` is absent from this committed tree.
Final documentation checkpoint `18bcbb31` passes all pre-test stages and 1909/1910 tests. The remaining test,
debug-flag-hygiene, reads docs/tasks/ASKS.md excluded from the clean Vercel export; V1 owns the correction.
Log: `/private/tmp/e357-sol-s23b/final-gate.log`.

Contact tests compare the sweep with the old union of arcs across 4225 points, roots with the old expanding
ring and jump exemption, and strict lantern/roar distances and damage. Real Rapier wall controls preserve B4
cover rejection and open damage. Retirement tests verify one manager actor loses its brain/body ownership
without removing its neighbor; encounter tests verify scope switching, unload, idempotent retirement and no extra draw.

The after-pose attempt on `2f44de31` failed before the first page with browser.newPage reporting a closed browser.
Its report is infrastructure exitCode3: `/private/tmp/e357-sol-s23b/after-poses/report.json`.
No continuation browser parity was recorded. Do not carry the predecessor's browser results forward as
proof of this source. The next builder/lead must run direct all-four phone fingerprint/poses and walk/combat/leak
before and after this checkpoint, preserving the predecessor's exact-field and 2 mm Pine porch caveats above.
The previous eight removed disabled hitboxes identified by S2.1 are distinct from new explicit retirement cleanup.
Deer/elk remain legacy engine rows/views behind a scoped Pine hull adapter; no full species-directory migration is claimed.

At the stop, the retry has complete first-pass raw fingerprints and three poses for all four shards, all with
empty boot.errors: `/private/tmp/e357-sol-s23b/after-poses-retry/run-1`. The direct before run in
`/private/tmp/e357-sol-s23b/before-poses/run-1` has Nalati, Nine Dragon and Pine captured. Nine Dragon physics,
render, GPU bytes and scene are exact. Nalati collider count stays 2772 but scene/render/GPU fields differ.
Pine colliders are 2409 before and 2417 after; scene/render/GPU fields differ (S2.1 notified). These are
cross-builder integrated changes, not an accepted direct parity result. The first-pass screenshots are evidence;
default raw SSIM fields are not a computed direct image comparison. Walk/combat/leak remains queued.
The before-run finished Driftwood's first pass before exit: all-four before/after raw files now exist.
Driftwood physics, render, GPU bytes and scene are exact too. Owned lane runs were terminated and released;
retries against the stale global baseline were not completed. The direct image comparison remains outstanding.
