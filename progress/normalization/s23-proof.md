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
