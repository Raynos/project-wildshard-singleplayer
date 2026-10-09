# Nalati runtime-owner binding (E435, SF48-p)

Nalati's three unchanged chapters, seventeen feat rules, four native equipment objects, fixed Golden King body,
and durable per-placement records now have declared platform owners. Gameplay, geometry, materials and controls
remain native. This is a functional binding proof, not a memory-cap or frame-floor claim.

The defining ports are `6f0c98036` (optional Boss/Elite persistence), `70e2a5094` (read-only Progress projection and
the emitting ledger's flush/achievement ports), and `245591848` (generic bound state, sp-x4). Nalati's current-save
migration/helpers landed in `28fe9f479`. Active wiring landed in `a4ffb1c2d1156a795e926db2d1e26847babfce31` after the green clean full-suite result below.

## Current-save migration

The C26 fixture begins with current saves for a bonded Argymaq, named camp horse, worn/owned skins, two Golden King
wins with its reward already taken, the Aqbars elite timer/reward, wolf counters, worn title and play time. It migrates
once into bounded host state and stable ledger facts, then checks reload, independent placements, refused oversized
writes and unchanged legacy documents. The original title and 40 seconds of play time survive. Bound quest completion
is observed through the existing chapter graph; rebinding does not grant again.

Actual runtime writes use platform state, flags and the emitting ledger. Legacy slots are read only for first durable
initialization. Progress's count/earned view reads that same ledger; its checkpoint preserves real state/ledger refusal
and retry. First auto-wear persists title metadata only.

## Real Chromium phone proof

Run with `scripts/browser-lane.sh --max 12 node progress/shard-platform/sf48/runtime-owner/capture.mjs <base> <out>`.
One muted Chromium browser, iPhone 16 Pro portrait, Developer ON, seed 357, normal main-menu grid card. The preview was
an unreferenced clean candidate `cfe4122b33635dac3679bda0f95bc84b9983b5b9`, build `cfe4122-mv04r9ej`.

`browser-run.json` records all five passing stages:

- Standalone: bow, sabre, spear and rifle retain their native legacy IDs, bound to `weapon.bow`, `weapon.sabre`,
  `weapon.spear` and `weapon.rifle`. Ammo remains bow 24, spear 3, rifle 30. The focused fixture additionally verifies
  exact native object identity and presentation preservation.
- Save/reload: the bound horse name Kara, Tulpar completion and count 1 / earned true survive reload.
- Real held-input Driftwood → road → Nalati: 21.785 seconds, final world feet `(335.164, 0.020, 0.001)`,
  local x `-219.836`, **30.164 m inside** the west boundary. Gameplay ready; same saved name, quest and feat as SHARD SELECT.
- Nalati → road: 11.573 seconds, final `(278.834, 0.451, 0.000)`, current instance null.
- Browser errors 0, disposal errors 0; all 15 scope counters, native bodies/colliders and adjusted GPU counts zero
  after unload. The browser was closed in `finally`.

The target was 31.5 m inside; the shared route's 1.5 m arrival tolerance accounts for the measured 30.164 m.
Two driver refusals remain failure-inclusive: `attempt-1-menu-navigation.json` used a root query that boots a shard
instead of the renderer-free title; `attempt-2-source-admission.json` asked the route to start on a road while the
current region was Driftwood. That second attempt also blocked service workers while the bare title tried to register
one. The final run uses the bare title, normal service-worker behavior and the correct Driftwood source; no app switch
or runtime seam was introduced.

The screenshot's Developer memory warning is real (about 1,113 modelled MB at Nalati entry). This work makes no memory
saving or admission-cap claim.

## Map and validation

Because `shard.config.ts` is a map-hash input, active wiring includes the map rebake from the clean candidate.
The initial bake preceded the newly committed geometry bake `9b8885ad9`. A second clean candidate,
`a0e83ff1b5487e54a2def86d1fcc8c1372204b59`, preserves that geometry, the committed voxel wrapper and autosave changes,
and adds only this wiring plus the scope correction. Its map was rebaked again and the exact current source hash checked:
`adc9732dfd0fe0a1de3731f44b93feb510e19854cc3c07ae2dac3dc4a30f1b8a`; WebP 134,476 bytes.
The phone route used the earlier candidate; this binding introduces no terrain, placement or look changes.

Focused original Nalati contracts and binding/migration fixtures, root strict types, root-config typed oxlint,
ratchet and private pre-commit guards passed. The first clean full suite passed 5,390 tests / skipped 14, with one
failure: the older regional-runtime fixture used an empty input registry. The fixture now installs the same platform
input contexts as the real page, under its page scope, and its original assertions pass. `full-first-red.log.br`
preserves that complete result. The revised clean full suite on `0431850a2` passed **949 files / 5,418 tests**, skipped
14, in 177.19 seconds (exit 0), through heavy-lane ticket 435. `full-green.log.br` preserves the complete result.
Coordinator-approved cumulative graph increases: Nalati → engine +6, game +11,
SDK +5; no raw reach/debt increase, and no generated outputs are committed by this builder.

The coordinator's late ownership correction wraps the existing boss, elite and titan bind calls in the runtime
scope's `run`, so their bars/registrations retire with that placement after asynchronous setup. The defining
`Scope.run` ownership, real Nalati elite restore and item-binding checks pass (3 files / 8 tests), with typed lint.
This focused addition follows the coordinator's explicit approval to retain the queued full proof.

## Trusted transitional runtime

Declared identities, UI and input contexts are authoritative. The original bow/rifle projectiles, spear throwing and
mounted controls, combo logic, Golden Bow/Naizagai reward families, dynamic herd/pack/night controllers and mesh-only
Storm Titan remain trusted G51 behavior. Horse names and cosmetic wear are platform state, not runtime metadata.
The fixed Golden King body's row preserves the existing ordinal allocation policy and prewarm timing.
