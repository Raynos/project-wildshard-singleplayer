# Handoff (sf72-nalati17) — Nalati mounted-player input law

Coordinator wildshard-new pushes. Plan-State: unchanged. Canonical Nalati headless qualification remains fail-closed.

This slice extracts Mount's shipping reins decision into renderer-free `runtime/rideReins.ts` (MountedReins). The page
inherits that state and delegates through one persistent input/world-query port. The native motor, fixed-step movement,
camera, taming and companion law are unchanged. Keyboard/touch sectors, road keeping, gallop rhythm, skid, panic,
exhaustion, water and boundary/fire refusal use the same shipping arithmetic. RhythmSpur and MountedReins have strict
versioned continuation, preserving queued presses and the previous spur press; invalid records refuse before mutation.

The frozen shipping body is authenticated in `test/fixtures/nalati-reins-oracle/`; 4,800 frames compare every decision
clock/output exactly, with positive branch counters, and a text restore reproduces a 600-frame suffix. Existing six
ride-assist tests stay intact. Eight focused checks pass. The two new tests pass under coverage in 6.71 s total,
comfortably within their 20 s timeouts. The fresh native bake passes 23 combined controls/native fixtures; root strict, root/touched lint, ratchet and SF2 pass. Clean-export full ticket 1146: 1,095 files / 5,991 tests GREEN in 124.37 s (no generated-only exception needed).

`scripts/nalati-physics-inputs.mjs` now hashes the shared reins law. The Nalati native bake must be captured atomically
on the merged lockfile 9b1fead83 and Pine bake 03d69480b. Preview 2f45367cd captures 35 native actors and 2,694 solid world colliders twice exactly. Ground, solids, actor recipes, groups, placement and remaining payloads are byte-identical to the parent; only the existing render-timed owned horse graze and shepherd yaw change.

Next, in the original task order: the approved generic owned-SimHost `usePlayerDriver({input,step})` seam, then the
actual mounted lying-capsule/body law and crouch. Optional generic raw-local steer and held sprint/crouch require
commandVersion 1; the page and host must read the same producer. Ordinary no-driver hosts and old commands keep their
exact bytes. Driver state/native handles use the existing adapter/physicsRestored protocol. Do not claim riding from
this reins-only slice. Then bosses, swept sabre/heavy and committed canonical witnesses; named night/storm controllers
and taming remain explicit blockers wherever their actual gameplay is not yet hosted.

Scratch: `/private/tmp/claude-501/sp-builders/sp-x1/nalati17/`; reusable export `../nalati12/candidate/`. Current source
paths are in `paths`, with the authenticated fixture in the repository. All owned browsers and previews (4400/4402) closed after proof; no Simulator acquired.
Private CURRENT-HEAD index, explicit hooks, CAS old-value, subject/stat/ancestor verification, owned-copy sync only.
Shared generated files and unrelated audio/look/cost work stay untouched. Nalati bake/witness landings serialize after
sp-x2 Pine and then sp-x5 G258 claim forward, then sp-x4 Driftwood; release the native inputs to sp-x2's NPC relocation after landing.

Real standalone parent 03d69480b versus candidate 2f45367cd: phone/desktop parity 2/2 GREEN, 0 stuck, 0 page/disposal errors, 0 bodies/colliders and all scope counters zero after unload; minimum pose SSIM .9999946 / .9998213. Raw arrays/images remain in scratch; `parity-summary.json` keeps the scalar proof. The original shipping oracle is authenticated at 25661521c.
