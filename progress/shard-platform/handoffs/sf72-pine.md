# Handoff (sf72-pine) — 2026-10-09, SF72 Pine Hollow headless

Coordinator wildshard-new pushes. Plan-State: unchanged.

## Landed

Prior plain-loader/night tape: b0c280ca9 + b20b732dd. King blocker: efd3dc5dcd2d2361107b04160e8d1ad294a52b26. Native inverse binds and the chest-attached cage provide head/body/fore volumes and cage radius. The ordinary first-surface ray includes the page's fore capsule; pine.aim value 2 aims at the cage without bypassing collision or damage. The tape pulls an empty trigger to start the existing reload. King falls at 29,295, dawn finishes at 30,015. Double native bake exact, 34 focused tests, clean full suite 1,052 files / 5,809 passed / 14 skipped.

## Validated continuation

The canonical witness uses runtime/headless.ts under the plain sim loader. Inputs cover every loaded repo module, runner/loader/lockfile and native physics/terrain/navmesh bytes. Five checkpoints come from one uninterrupted command tape: 8,000 / 16,000 / 24,000 / 26,652 (King phase II) / 29,295 (fallen). One compressed immutable world basis plus five checked delta wires avoids duplicate native worlds. CI walks continue at most 8,000 ticks and equal their uninterrupted canonical digests. The phase-II replay uses identical 1,200 commands, exact canonical state/effects and zero restore emissions.

The gameplay ledger records eleven durable identities from twelve submissions, grants four achievements, retries a refused profile write and proves reload/duplicate stability. CI resumes night for 6,015 ticks through King and dawn; the full receipt includes lantern/zipline facts too. Nine coverage proofs pass, slowest 2.45 s (<20 s local budget). arm64/x64 full results equal. compatibility.json stays compatible:false; all exits nonzero, named partial proofs and record produce evidence. Report-card headless/replay/ledger true, compatible false. Clean-export full suite on f983de200 plus this candidate: 1,056 files / 5,834 passed / 14 skipped, 131.58 s. Strict, root-config touched-file lint, paths and ratchet green.

Commands:

- `node --import ./scripts/sim-node-loader.mjs test/proof/pine-hollow/run.mjs checkpoints` after any loaded input changes; commit basis/manifest/deltas together.
- `... run.mjs fresh`, slice-dam/ridge/night/king/fallen/dawn, replay or ledger.
- `... run.mjs record` regenerates the receipt; all refuses whole compatibility.

## Honest open list / exact next step

Outcome differences keeping compatible:false: animated King chest/root motion (hits/damage); arrow wind/moving spread/recovery (hit/miss/ammo); dialogue time and prompt nearest/LOS (eligibility/timing); collectible, journal, lodge and miller producers (ledger); unhosted night-roaming thralls/millrace/lodge (combat/quests); absent King victory resin and immediate first-bow ownership instead of pickup; rain wander goals (positions). Browser pine.bosses versus host flags also leaves save/refight interoperability unproved.

Coverage-only gaps: alternate routes, other elite encounters, repeat fights and a recorded grid quest tape. The standalone tape retains walls; the separate native grid-entry proof removes them. Missing coverage alone is not evidence of a different hosted outcome.

Next is the coordinator's remaining Pine gameplay row. No test-only state writes, damage, flags or teleports. Bake inputs include the bake script/AnimalView and prior runtime fauna/combat/species/models/world/data paths; changes need a real page physics rebake. Native physics/map rebake f983de200 is included after the separate crag sampler change.

No owned browser, Simulator or preview. Own clean exports are throwaways to delete after landing. Foreign Pine runtimeCost/config hunks excluded.

## Latest validated shared feat-law outcome slice

quest/featLaw.ts is the single page/host bounded policy for 19 counters, overlapping kills, flag totals and native thralls. Host actor.died now feeds it; snapshots retain all counters and restore emits nothing. Gameplay submits only newly reached stable IDs (legacy page migration still replays saved IDs), preventing late-tick replays from overcounting partial achievements. A direct policy/ledger fixture proves two thralls -> two increments; the original shipping Progress oracle proves all 19 counter outcomes. The real tape now includes bear/elk/boar and two summoned-thrall kills. King/dawn ticks stay 29,295 / 30,015. Full/replay digests and inputs are in the updated README and compatibility.json.

Validated on a current-HEAD private candidate: clean full 1,059 files / 5,861 passed / 14 skipped, 115.53 s; strict, touched root-config lint, paths and ratchet green. Native coverage worst 12 s (<20 s), final arm64/x64 full receipt exact. Exact next step: host the remaining collectible/journal/lodge/miller producers on the shared page law. Prompt selection/dialogue is the next separate rule extraction; never emit facts or raise flags from the witness itself. Scratch /private/tmp/claude-501/sp-builders/sp-x5/sf72-pine-feats; no owned preview/browser/Simulator.
