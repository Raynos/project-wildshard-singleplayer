# Handoff (sf72-nine) — 2026-10-09, Nine6

Coordinator `wildshard-new` pushes. This source-only commit closes the replay-budget and witness-classification
follow-ups from `codex-nine6.md`. No production source, native collider or map input changes. No owned browser,
Simulator or preview.

## What is proved

- The real `run.mjs all` passed twice in independent plain Node processes with identical output. The uninterrupted
  1,084-tick tape still proves both portal rides, the Jian combo / charged heavy (22 swings / contacts), the Fei Zhua's
  lifting Well crossing (cap open 151 ticks, all phases), 92 entry lanes and 8 portal transfers.
- Witness `transitional` is false, `open` is empty. Jian targets are explicitly not applicable (Nine has no creatures);
  ledger remains honestly `not-declared`. The structural platform classifier is unchanged.
- Committed checkpoints at ticks 400 (mid-swing / held mid-ride) and 940 (lifting zip, cap open) restore exactly in
  canonical state. Short in-process continuations compare canonical hashes, never raw Rapier bytes. Replay steps
  408 ticks instead of 1,768; separate replay and determinism tests own one saved point each, with 60 s budgets.
- Freshness covers every loaded repository input, including the command tape, trusted runtime, imported bake and
  engine simulation closure, plus Rapier WASM. Changed inputs refuse before checkpoint admission. Regenerate with
  `node --import ./scripts/sim-node-loader.mjs test/proof/nine-dragon-stack/run.mjs checkpoints` after closure changes.

## Open: hook placement extraction

Keep `nd.grapple` and `context.debug = 2`. `grapple/course.ts` has interfaces, not placements. Seven render builders
emit the 31 hooks: square, towers, stair-foot / upper street, rim, middle Well and bridges. The timber pavilion's
hook depends on seeded / clearance-adjusted placement and LOD; the stair-foot hook uses the sculpted jaw transform.
Copying baked coordinates is not a derivation. The exact next slice is to extract shared pure placement recipes and
random choices into data consumed by both builders and bake, prove browser equality, rebake physics and map, then
remove the debug expose and shrink the coupling cap. See the witness README for source-level evidence.

## Validation / scratch

Isolated local coverage (heavy-lane ticket 989, queue excluded): headless 8.002 s, ride replay 1.206 s, crossing
replay 2.349 s. All are below 20 s (one third of the restored 60 s timeout). The two independent-process replay
checks also passed under coverage (8.108 / 14.019 s on the busy shared machine). Focused witness 5 files / 7 tests,
root and layer strict, root-config lint, coupling, ratchet and graph checks pass. Clean-export full suite passed
1,053 files / 5,826 tests (222.72 s; heavy-lane ticket 999). The preceding run's only two failures were stale generated
Sky boot-file lists; `pnpm gen` fixed them, then the full suite reran without changing assertions. Scratch is
`/private/tmp/claude-501/sp-builders/sp-x1/nine6/`; no owned server to stop. Foreign shared-tree Nine plugin / VM /
world / physics-bake edits were excluded. The four coordinator-released stale proof / handoff copies are synced only
after landing. The coordinator owns serialized regeneration and push.

Plan-State: unchanged.
