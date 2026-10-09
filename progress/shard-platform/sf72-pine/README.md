# SF72 — Pine Hollow headless Warden Hollow witness

Plan-State: unchanged. Coordinator wildshard-new pushes. This proves the named gameplay path; it does not claim whole-Pine compatibility.

The old ray tested only the King's main capsule, whose surface lay outside its fabricated internal rib ball. The page also has a chest capsule and a cage attached to its chest bone. The fix uses two identical native page captures of the actual loaded rig's inverse binds, capsule definitions and cage offset/radius. Aiming at that point still uses the ordinary nearest-surface ray and the page's open/shut/bark damage rule. Animated rig displacement remains open. The tape also pulls an empty trigger to start the page's existing lever reload; waiting for a chambered round left 21 reserve rounds unused.

King fix: efd3dc5dcd2d2361107b04160e8d1ad294a52b26. Native double bake exact; 34 focused tests and clean strict/lint green. Clean full suite: 1,052 files, 5,809 passed, 14 skipped, 140.84 s.

## Real gameplay

Plain Node, no DOM or renderer shim, real terrain/navmesh/Rapier. Tick commands move, aim, attack, jump, select equipment and press prompts; no health/flag/pose writes. The uninterrupted tape takes the lever off its pegs, walks the day tasks, waits with Hale, follows the stag, fights the King and reaches dawn.

| Event | Tick |
| --- | ---: |
| King phase II checkpoint | 26,652 |
| King defeated by weapon play | 29,295 |
| Dawn quest fact | 30,014 |
| Tape complete | 30,015 |

Full canonical digest: `97b55b8c542405e22ae7a0c8e8bc8eccad2128a0772c69c7b929b391a9e57a8b`.
Phase-II replay after 1,200 identical command ticks: `22262bb1044b310aea148fdf0afa84e75187e689468638ec078f79d2da479c45`, both worlds equal, no restore emissions. arm64 and Rosetta x64 full JSON results are exactly equal.

Twelve gameplay submissions become eleven durable ledger identities, including the duplicate quest ingress. The real tape now files one bear, one elk, one boar and two summoned thrall deaths, alongside the lanterns, zipline, King and dawn. Four achievements are earned: lanterns, zipline, King, quest. An actual storage refusal stays non-durable; retry succeeds; reopened state matches; repeated identities remain duplicates. The CI ledger continuation runs 6,015 ticks from night and proves the King/dawn facts. The full receipt retains all emitted gameplay facts.

## Bounded proof and freshness

Five checkpoints at 8,000 / 16,000 / 24,000 / 26,652 / 29,295 share one checked immutable native basis. The compressed set is about 3.1 MB rather than five complete copies of the world. Each resumed leg must equal its uninterrupted canonical digest. The inputs hash includes every loaded repo module, runner, loader, lockfile and native physics/terrain/navmesh bytes. Changed inputs refuse freshness until the checkpoints are regenerated.

Nine tests under coverage pass on the f983de200 candidate; the slowest is 2.45 s, below 20 s (one third of its 60 s timeout). Six walk continuations each run at most 8,000 ticks; replay uses one decoded checkpoint and 1,200 commands. The separate determinism test compares two independent native phase-II replay processes. The report-card reads headless/replay/ledger as passed and compatible as false. Clean-export full suite: 1,056 files / 5,834 passed / 14 skipped, 131.58 s. Clean strict, root-config touched-file lint, paths and ratchet pass; generated outputs were refreshed only inside the export.

Regenerate using `node --import ./scripts/sim-node-loader.mjs test/proof/pine-hollow/run.mjs checkpoints`, then `record`. Verify with `fresh`, `slice-dam/ridge/night/king/fallen/dawn`, `replay`, `ledger`. The `all` mode reports the open list and exits nonzero; `compatibility.json` stays `compatible:false`.

## Why compatibility stays false

Known outcome differences, rather than missing tapes, keep Pine refused: rest-pose King volumes omit animated chest/root motion (weak-point hits/damage); still-air arrows and standing spread change hit/miss, and absent arrow recovery changes ammunition; named prompts omit dialogue time and nearest/LOS eligibility; collectible, journal, lodge and miller producers still omit ledger outcomes; unhosted night-roaming thralls, millrace and lodge omit combat/quest outcomes; King victory resin (including refights) has no item reward, and the first bow is granted before the page pickup; rain wander goals change creature positions. Browser `pine.bosses` versus host flags additionally leaves save/refight interoperability unproved.

Coverage gaps are separate: alternate routes, other elite encounters and repeat fights lack uninterrupted tapes, and the recorded quest tape is standalone. The separate native grid-entry proof removes walls; it is not a recorded grid quest tape. These gaps alone do not establish a different outcome in an already-hosted rule. The real compatibility receipt lists both categories explicitly.

## Shared feat law — first outcome-parity slice

The page and headless host now call quest/featLaw.ts for all 19 bounded counters, variant overlap, flag-driven totals and the native thrall predicate. Only an actual actor.died event files a kill; restoration is silent. Counters submit newly reached stable IDs only. Legacy page migration still replays its saved identities. Re-emitting an old ID on a later headless tick would incorrectly grow a not-yet-earned achievement; the two-thrall/two-tick fixture proves exactly two increments, while the shipping Progress oracle covers all 19 feats. The King achievement saturates once across refights, as on the page.

Re-recorded input fingerprint: `91a9c4b66d76139ae327d9853986b450b820dca18f33f95492ed922188f3dcfa`. King/dawn ticks are unchanged; arm64/x64 full receipts remain identical. Nine native coverage proofs plus seven runtime-row checks pass, worst native proof 12.00 s under coverage (<20 s budget). The existing 40 native/page checks also pass under coverage. Rebased clean full suite: 1,059 files / 5,861 passed / 14 skipped, 115.53 s. Strict, root-config touched-file lint, paths and ratchet pass. Generated outputs were refreshed inside the export only. The final arm64/x64 full receipts are exactly equal. The remaining producers and other outcome differences above still keep compatible:false.
