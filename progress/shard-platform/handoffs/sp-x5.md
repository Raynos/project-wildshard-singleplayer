## Handoff (sp-x5)

SF54 is active, non-graphical only; paused between slices for the Codex budget.
Coordinator wildshard-new owns pushes, plans and graph receipts. Never message wildshard-v.

Landed / pushed: combat router `1c83de900` (artifact cleanup `0bc57d178`),
commons bag `a04ac6e7b`, effects binding `e2b5f4cb5`, commons JSON layer fix
`acc27dcd6`, runtime terrain/props docs `254b19fe9`, audio systems `c5f8c03ea`,
preview readiness `60594ef39`. Audio keeps all DSP bodies unchanged except defining
imports; non-runtime Pine/Sun callers import game modules, runtime callers use SDK.
Full clean-export rerun 506: **959 files / 5450 tests passed, 14 skipped, 108.23 s**.
Root/layers/scripts strict, whole root oxlint, row-data, regenerated ratchet/graph green.
Covering gate `aeb76ea81` is green and contains both audio/readiness commits.

Exact next step: finish the already-approved **effects-data** slice; no new large job.
Its candidate is NOT a commit: patch `sf54/effect-data.patch` was prepared against
`7ce6398f2ead71ef5b3dd02e8900a8284761c860` and must be rebuilt from current HEAD.
All `sf54/` scratch paths below are under
`/private/tmp/claude-501/sp-builders/sp-x5/sf54/`.

- Candidate sources: `effect-data-files/`, `effects-data-prepared/`,
  `prepare_effect_data.py`; matching owned hunks already exist in the shared tree.
  Commons effects JSON/pack -> boot-generated literal game table -> SDK runtime/effects;
  remove kit/effects/starter, migrate Pine runtime import and the existing tests.
  Golden five-row bytes: `05a0699d225fca32613cd9fdb852a00973e819d539f0aea047a7f77c6cfa1a75`.
- Fix preparation BEFORE rerunning: enumerate old imports with git grep at HEAD,
  not rg over the already-migrated working tree (otherwise it omits the migrations).
  Fix gen-starter-effects.mjs's copied "commons bag pack" comment to "effects pack".
  Replace its obsolete handoff text; preserve the audio commits/manual docs/package
  exports. Rebuild HEAD + owned hunks only, never copy mixed working files wholesale.
- Approved effects-data edges: commons->sdk +1, game->engine +1, sdk->game +1,
  kit->engine -1, Pine->kit -1 / Pine->sdk +1. No UI/look/map-input change.
- Clean export: link with scripts/link-node-modules.mjs, await pnpm gen, run the new
  commons-starter-effects fixture + effect/lifecycle/row regressions, root/layers/scripts
  strict, root-config oxlint, ratchet; full vitest through heavy-lane. Generated-only
  failures may regenerate in the export and rerun those files. Other failures need full
  rerun. Land privately from current HEAD with hooks, old-value CAS, ancestor/subject check.

Keep logs `audio-full.log` (original preview readiness failure), `audio-full-r2.log`
(green rerun), `audio-*.log`, and `preview-*.log`; patches/scripts reproduce the slices.
Commit helper: `/private/tmp/claude-501/sp-builders/sp-x5/commit_patch.py`.
No owned browsers, Simulator, previews, builds, suites or queued work remain; temporary
clean exports were deleted. Forest profile/wind pack and species data follow effects;
lookApi/species-install still have callers. Opus owns rendering, weapon subclasses,
models, viewmodel and HUD. SF45 is closed (`4ba7ada99`, 5046 fields / 16 ABI calls;
full 434: 948 files / 5419 tests +14 skipped, log ../sf67/sf45-full.log).
