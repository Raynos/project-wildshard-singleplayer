# E357 S1.1b — scoped look and full Nine Dragon manifest

Builder: sol-s11b. 2026-10-01. No push or production-pin change.

Implementation: `30c82431` + correction `ab442341` (scoped LookStrategy/render events),
`8d4ec45b` (normalized manifest, authored bounds/Bag/Compare, full discovery and packs),
`30c11fb9` + `ba590e65` (unlimited director compatibility and warning HUD restoration).
The correction excludes concurrent audio main edits from the render commit without changing the worktree.
Audio/budget source was committed by its owning lanes.

Verification:

- `pnpm test`: 191 files / 1,568 tests passed, including generated paths, ratchet, liveness and bake checks.
- Clean Vercel export `82da1e7dacc75abd4d4cc1672bbf38a1b49e9ac1` passed CSS, generation,
  app/API typechecking, whole oxlint, ratchet, Vitest and Vite build. Commits after the phone proof
  through this SHA change tests/handoff only.
- Four-shard phone fingerprint+poses passed on
  `bc5e9fd89fc6d7027d2e70d6dbfd50ae5db37aa2`; shared with the audio lane to avoid duplicate captures.
  Report: `/private/tmp/e357-s15w/final/report.md`; raw captures and `legacy-compare.json` beside it.
  Browser contexts and preview closed.
- All 13 compared boot fields match `ab442341` exactly for Driftwood, Pine Hollow and Nalati.
  Nine Dragon matches the same fields except systems (scoped bounds rename, scoped audio system)
  and its planned audio requests. HUD, scene, colliders, render programs and GPU bytes match.
- ND world packs: 30 files, phone 6.27 MB / desktop 11.07 MB. Three manifest contracts verify
  declared-byte coverage, pack counts and engine-only projection. Bounds and render lifecycle tests pass.

The phone harness's exact baseline fields are null: this is threshold/boot census proof, not a full visual
golden verdict. The initial walk/combat/leak run on `8d4ec45b` passed the other three shards and caught
the now-fixed Infinity token-array boot regression in ND. The finite-director behavior passes C1's four
real-manager director cases. Full two-tier exact/visual/gameplay parity remains the lead's batch.

Remaining source grep hits, explicitly deferred by the lead until M1:

- `src/main.ts`: FEI_ZHUA / NINE_WEAPON_NAME import and isNine equipment/tool binding → S1.2 and S1.4.
- `src/engine/explore/Explore.ts`: grapple playground art → S1.4.
- `src/engine/practice/playground/{catalog,load}.ts`: ND playground registration/import → S1.4.
- Generated shard and byte tables are generated discovery/assets; comments are historical references.
- Old engine mockup-image copies remain for X3 asset trimming; ND now owns the imported copies.

`test/parity/renames/S1.1.json` records structures/bounds system renames and documentary pack metadata.
The current probe does not fingerprint generic world fetch requests, so the pack metadata is not an exact
fetch-list comparator. Both tier pack contents are checked by manifest/prefetch tests. `boot.explore.art`
is declared here and is consumed by X3, as specified in 05 §3.
