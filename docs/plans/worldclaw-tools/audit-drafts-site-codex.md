Findings ranked by severity. Paths are relative to the repository; “met” reflects source and recorded evidence, not fresh browser verification.

1. **P1 — Day-zero creation fails without art.** `drafts/tools/build-atlas.ts:159` requires an existing art directory; `:202–203` requires a key-art image before P3/P4. An in-memory P0 fixture with empty key art returned `keyArt  is not an image under art/thin-ice`. This breaks the entry procedure in `.claude/skills/worldclaw-interactive/SKILL.md:37`.
2. **P1 — Offline progress can falsely report completion.** `drafts/src/pwa.ts:99–101` counts resolved fetches without checking HTTP status or cache persistence. A simulation returned **3/3 saved after three HTTP 500 responses and zero cached images**.
3. **P1 — First-install and direct-link visits can miss offline warming.** `drafts/src/main.ts:110` warms only the draft home; `drafts/src/pwa.ts:89` returns when no worker controls the page. There is no retry on initial `controllerchange` or restored connectivity. Opening a stage directly does not save the whole draft.
4. **P1 — “New version” can reload onto the same old build.** `drafts/src/update.ts:43–46` lights the pill from server version alone; `:32–34` reloads even without an installed waiting worker. `drafts/src/sw.js:69` then returns the old cached document. A failed install leaves a repeatedly advertised update that the tap cannot adopt.
5. **P2 — Playable prototypes are absent, and their navigation would be intercepted.** All **3** prototype cards have `play:null` and `peakMB:null`; the CLI has no prototype-copy implementation (`drafts/tools/atlas.ts:106`). The worker answers **every navigation** with `/` (`drafts/src/sw.js:66–69`); a simulated `/data/thin-ice/proto/example/` navigation returned the drafts root document.
6. **P2 — Map Lab moves pins across frozen terrain.** Heights, labels, slope and roads never change (`drafts/src/maplab.ts:34–38,159–173`). Moving the village to **(−200,−100)** changed its gentle share **100%→55%**, but global walkability stayed **86.7%**. This measures relocation, not the promised region re-stamp, terrain regeneration and pad.
7. **P2 — A/B/C checks describe earlier prototype layouts, not P5’s painted variants.** `drafts/shards/thin-ice/variants/a-slab-stats.json:2` names `out/layout-a.png`; A reports **90.9%** walkable versus approved revision 2’s **86.7%**. `drafts/src/maplab.ts:210–228` shows numeric summaries only, inside Map Lab; P5 has no adjacent pass/fail, route or sightline checks.
8. **P2 — Camera “Check ✓” omits known failures.** `drafts/shards/thin-ice/content.json:684` records wrong minimaps and missing ice paths across all views, but the generator drops `camChecksAll`. Five cameras show ✓ (`drafts/src/explore.ts:153`). Two camera records also contain null heights: `blockout/cams.json:113,118,125`; casts accept them as numeric tuples.
9. **P2 — SETS is substantially unimplemented.** Thin Ice has **0 sets** (`drafts/shards/thin-ice/content.json:685`). Even populated data only produces region panels and member chips (`drafts/src/explore.ts:73–88`): no set detail route, bounds box, planned triangles/draws or member “PART OF” view. Delaying planned sets to P11 is not Jake’s J57 deferral.
10. **P2 — Coverage depicts illustrative marks as coverage.** `drafts/src/explore.ts:247–269` treats one current FP image as a mocked-up place and makes bars from image counts. Camera view hatching covers the entire map beneath translucent cones (`:275–280`), including supposedly seen areas. Cone reach is invented from target distance; unseen area is not measured.
11. **P2 — The promised data contract is missing provenance and source ingestion.** `drafts/tools/build-atlas.ts:27–41` accepts manually duplicated stage answers/run state; its `design` path is unused. It reads neither design/verdict logs, decisions nor the style bible. `drafts/src/atlas.ts:82–98` has no `ref.build`; mockups without references cannot fail validation as W1 requires.
12. **P2 — History is retained, but lineage and comparison are incomplete.** The **9 p5b world views** and approved `p5r2-3in1.jpg` lack lineage IDs (`drafts/shards/thin-ice/draft.json:235,261`). World markers open the latest grey blockout rather than the approved painting (`drafts/src/explore.ts:119`). Only the stage hero gets a lineage strip (`pages.ts:169`); no two-image comparison slider exists.
13. **P2 — Validation failures still write publishable output.** `drafts/tools/atlas.ts:125–159` records problems, writes atlas/index/game-card files, then exits 1. The spoiler guard therefore does not prevent invalid generated files from being left behind. Boss look images also have `spoiler:false`, because filename/view subjects are not classified (`build-atlas.ts:196`; `atlas.ts:282`).
14. **P2 — Artifact parity will diverge as the draft grows.** `drafts/tools/artifact.ts:174` hard-codes “Sets: none”; `:53` hard-codes model/in-game absence. It omits lineage and coverage. At **>254 distinct image hashes**, `:205–213` still copies every thumbnail, exceeding the stated 255-file publishing limit.
15. **P2 — Resource cleanup and route recovery have gaps.** Map Lab creates a worker without terminating it (`drafts/src/maplab.ts:78`); the walk has no history/foreground cleanup (`walk.ts:95–132`). Async renders have no stale-route guard (`main.ts:95–105`), rejected JSON promises remain cached (`data.ts:15,22`), and malformed percent escapes throw outside the route’s `try` (`main.ts:83`).
16. **P3 — “Uploaded once” is keyed by source path, not content.** Thin Ice’s **226 items represent 196 unique hashes**; duplicate sources can upload the same Blob pathname repeatedly (`drafts/tools/images.ts:109–125`). Changing `ENC` also overwrites unchanged URLs, while the worker keeps them cache-first indefinitely.
17. **P3 — The splash does not track home-screen loading.** All stage thumbnails are lazy, so the home usually supplies **0 eager images** and dismisses immediately; key-art loading is untracked (`drafts/src/main.ts:51,62–71`).

Done-when audit, applying J61/J67 and Jake’s explicit deferrals:

| Item | Result | Evidence |
|---|---|---|
| 1 — Live from P0 | **Partly** | Thin Ice card/pages exist (`src/game/draftTitles.ts:14`; E387); new art-free P0 fails, finding 1. |
| 2 — Complete front history/artifact | **Partly** | Rebuild matches all 226 committed items; answers are selective manual copies, provenance/comparison/artifact gaps remain. |
| 3 — Public spoiler protection | **Partly** | Current game card uses approved key art (`draftTitles.ts:21`); classification/output guard gaps, finding 13. Draft-page secrecy was superseded by J67. |
| 4 — Map Lab agrees with build | **Partly** | Baseline reproduces 86.7% walkable and 35.8% close; movement does not regenerate terrain. Physical iPhone evidence absent. |
| 5 — Composition | **Not met; deferred J57** | W10 remains todo (`docs/plans/WORLDCLAW-TOOLS.md:367`). |
| 6 — Built Coverage/census/memory | **Not met; deferred J57** | W11 remains todo (`WORLDCLAW-TOOLS.md:368`); draft coverage is an illustration. |
| 7 — No game regression | **Partly** | Separate bundles and Blob card exist; `drafts/test/weight.test.ts:21–32` checks paths, not bundle/request/capture equivalence or GPU results. |
| 8 — Keep/cut review | **Not met; due after pilot** | Still explicitly open (`WORLDCLAW-TOOLS.md:420–421`). |

W-row audit:

| Row | Result | Evidence |
|---|---|---|
| W0 | **Not met; deliberately deferred J8** | `WORLDCLAW-TOOLS.md:351`. |
| W0b | **Not met; deliberately deferred J8** | `WORLDCLAW-TOOLS.md:352`. |
| W1 | **Partly** | Types/generator exist; no schema, design ingestion or reference validation; findings 1, 11, 13. |
| W2 | **Partly** | All 226 sources have copies; 196 unique pictures, duplicate-upload/immutable-cache gap, finding 16. |
| W3 | **Partly** | Stage pages/swipe and artifact generator exist (`pages.ts:130`; `artifact.ts:24`); parity and numeric Simulator memory evidence missing. |
| W4 | **Met, as revised by J67** | Carousel, waiting state, 17 ticks, OPEN DRAFT; no switch (`pages.ts:14–52`). |
| W5 | **Partly** | Four content overview images and stage answers; **0 `board` items**, no question/options/recommendation fields. T11 integration explicitly remains future. |
| W6 | **Partly** | Layers, relocation metrics and walk exist; A regeneration/C checks/phone FPS proof incomplete, findings 6–7. |
| W7 | **Partly** | Three explanatory cards; **0 playable pages, 0 Simulator peaks**, finding 5. |
| W8 | **Partly** | Run stage/waiting/next and limited lineage (`pages.ts:59,114`); no rows-done/total, last build, judge decisions, clips or comparison slider. |
| W9 | **Partly** | Thin Ice card opens the drafts site (`src/game/titleDeck.ts:223`); generic day-zero creation fails. |
| W10 | **Not met; deferred J57** | Composition row todo (`WORLDCLAW-TOOLS.md:367`). |
| W11 | **Not met; deferred J57** | Built Coverage row todo (`:368`). |
| W12 | **Not met; deferred J57** | Place checkpoint row todo (`:369`). |
| W13 | **Partly** | Interactive boundary instructions exist (`.claude/skills/worldclaw-interactive/SKILL.md:44`); auto inherits them, sketch is an outline; P0–P2 fixture proof absent. |
| W14 | **Not met; deferred J57** | Built Beats row todo (`WORLDCLAW-TOOLS.md:371`). |
| W15 | **Partly** | Source isolation tests and splash exist; no measured regression gate; finding 17. |
| W16 | **Met on recorded evidence** | Separate build/manual deployment/PWA; E387 records live project with no Git link. Live configuration could not be rechecked. |
| W17 | **Partly** | Five tabs, 6 models, 12 beats, **15 mechanics**; 0 sets, incomplete coverage/camera checks and future model transition handling. |
| W18 | **Partly; absorbed into W17** | FP/blockout/map pairing exists (`explore.ts:133–162`); finding 8 prevents a reliable check. |

Verification: `pnpm exec tsc --noEmit -p drafts` passed. Both Vitest attempts were blocked by required filesystem writes; no tests executed. Curl failed DNS resolution, so live JSON/SW/version and the published artifact were not independently verified. No files were changed and no browser was opened.

Goal weighting: 70% draft workflow/history, 30% built Explore; draft portion ≈65%, built portion 0% → **high-level goal ≈45% complete**.
Draft-side weighting: 45% history/data, 35% Explore/tools, 20% publishing/PWA; discounted for the findings above → **draft-side ≈65% complete**.