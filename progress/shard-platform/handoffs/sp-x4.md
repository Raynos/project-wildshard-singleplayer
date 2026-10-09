# sp-x4 handoff — SF72 Sky Reach, 2026-10-08

Status: bounded Sky policy/bake source LANDED locally as `ac04ae5f82fbb9217c80efb1b9228cfb7eb8811b`; full Sky compatibility remains OPEN. Coordinator `wildshard-new` owns pushes and approved Far→engine +4. No new multi-hour work under the 3% Codex budget notice.

Landed prerequisites:
- `04cb19f9954e285daff22c2be81dfbed74742656`: Node-safe Sky lift declarations (`data/isletLift.ts`), real partial ledger proof, official map rebake; clean full suite 984 files / 5502 passed.
- `c2981e816`: SDK `headlessRuntime` caller-selected trusted file-module factory and one real host; install before restore, no install-time effects; finish refuses absent entry proof.
- `0f82dbeb8`: `SimHost.spawn/retire` and optional decoded install `context.snapshot`; reinstall the saved roster before restore, immutable actor recipes, retire cancels targets.
- `bd5336bd7`: Opus Sky isle-probe binning speedup + map; final candidate builds on it.

Committed source and diagnostic:
- Source commit `ac04ae5f82fbb9217c80efb1b9228cfb7eb8811b`, parent/shared API seam `454811f1a7fbaba67c8a9e66c68ce93e9e9c085b`. Engine type/export hunks landed once through sp-x1 and are excluded from Sky. Final candidate/index: `sky-land-candidate.json` / `sky-land.index` in the scratchpad.
- Unreferenced diagnostic `86634b6c759e9541c808ff01c601b49259b4771f`, parent `bd5336bd7`; private candidate/index in `/private/tmp/claude-501/sp-builders/sp-x4/sky-policy-final-candidate.json` and `sky-policy-final.index`.
- Renderer-free `runtime/stormRocBrain.ts`, exact shipping decisions with a defaulted type-only `CreatureBrain<S,A,C=ThinkCtx>` port. Native species retains its WeakMap wrapper; visuals unchanged. Full policy/strike continuation validates before mutation. Public existing validator export `engine ./ai/strikeState` approved.
- Test-only source-hashed shipping policy (`b478f70cfebd7a350251e56de1617b319e99a08a`) and exact 10k-tick oracle across all three strikes, calm/reach/token/death/restart plus three restore suffixes/no extra RNG/effects.
- `runtime/crownLayout.ts` and plain `data/storm.ts` remove renderer-dependent policy imports, preserving math.
- Trusted browser metadata tool `scripts/bake-sky-physics.mjs`, input hasher, `runtime/physics.baked.json`, freshness guard. Captures actual model-derived specs/seeds/scales for 13 actors and 43 native collider pieces; two repeated same-page captures must match exactly. This is not yet an executable headless runtime.
- Own pending encounter extraction was removed from the shared tree and preserved only at scratch `rocEncounter.ts.pending`; it is NOT proved or part of this candidate. Shipping `combat/stormRoc.ts` changes only its RocPhase type import.

Exact next step after this commit:
1. Add `src/shards/far-reach/runtime/headless.ts` exporting SDK `PrepareHeadlessRuntime`. Use baked native static colliders and real actor specs; set ground:false and real WORLD floor queries (no fake global plane).
2. Start the eight flying actors in shipping order; spawn five goats on the shipping deferred first-fixed-post boundary via `host.spawn`. On restore reinstall the roster from `context.snapshot` before host restore; never consume setup RNG on restore. AnimalManager owns private RNG `new Rng(SEED+31)`, six setup draws/actor (scale, rig seed, actor seed, timer, fleeUntil, callT). Do not substitute the app AI stream. Preserve that RNG via onStep adapter and compare baked seed/scale.
3. Use existing RamGrazer/OrbitDiver/BurstFlyer policies and extracted Roc with real flight/contact/token/body ports, six-tick decisions / per-tick body. Pure strike declarations currently still live in rendered species modules: move their defining constants carefully and update strike-table readers if needed.
4. Compose native movers (data/MOVERS plus admitted islet lifts) and actual bridge AS module, real quest progression and Roc BossBrain/encounter continuation. The WarFan cone/heavy/impulse recipe is native G51 and must be extracted as a real adapter, not replaced with a placeholder weapon. Saved quest/ledger facts must come from actual completion events.
5. Flip `test/proof/far-reach/{headless,replay,ledger}` only after real SDK 10k/replay/ledger gameplay proof. `finish` needs genuine four-entrance lift/physics traversal proof; until then compatibility=false stays honest. Then contracts, boot smoke and one muted Chromium iPhone 16 Pro browser; map input changes require official rebake.

Validation: clean exported candidate + pnpm gen, root strict, FULL root-config type-aware oxlint, ratchet and private-index hooks GREEN. Queued full Vitest ticket549: **989 files / 5507 passed / 14 skipped**, 135.16s. Real muted Chromium phone-profile Sky boot and repeated metadata capture passed; 13 actor/43 collider recipes match the earlier capture exactly. Official map rebaked on the latest isle-probe code. No full gameplay/entry compatibility claim.

Resources: all owned browsers closed, :4405 preview STOPPED, no Simulator owned. Temporary final clean export removed after validation. Small diagnostic logs/candidates and the explicitly unproved encounter draft remain in `/private/tmp/claude-501/sp-builders/sp-x4/`. Other agents' package/index hunks untouched; only own landed paths synchronized. Hooks, old-value CAS, subject/stat and ancestry verified. Coordinator pushes; this lane goes IDLE under the budget notice.
