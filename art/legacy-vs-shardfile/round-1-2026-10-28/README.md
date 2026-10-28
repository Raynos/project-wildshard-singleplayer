# CO6 — LEGACY versus SHARDFILE (G834)

Six sheets cover every registered frozen legacy pair. Each has four
matched phone cameras: LEGACY on the left, SHARDFILE on the right.
Every panel and sheet has burned-in labels. All six final sheets were
visually inspected. This is the batch for Jake's legacy-deletion pick;
it does not delete legacy or declare visual/gameplay parity.

| Shard | Comparison sheet | Bytes |
|---|---|---:|
| Driftwood Isle | [Driftwood](driftwood-isle-board.jpg) | 438050 |
| Pine Hollow | [Pine](pine-hollow-board.jpg) | 476416 |
| Nalati Grasslands | [Nalati](nalati-grasslands-board.jpg) | 489508 |
| Sky Reach / Far Reach | [Sky Reach](far-reach-board.jpg) | 453330 |
| Signal Dunes / Sunscar | [Signal Dunes](sunscar-dunes-board.jpg) | 419188 |
| Nine Dragon Stack | [Nine](nine-dragon-stack-board.jpg) | 493578 |

The sheets are 840 × 3128 portrait JPEGs, each below 500000 bytes.
Native-only shards have no registered LEGACY entry and are outside
this six-pair comparison.

## Capture boundary

- Source: `93eb52800fae6bff8a1b672ab3410f59214e19b3`.
- Served build: `93eb528-mvsh0fuq`; reused the shared pinned preview.
- Chromium, iPhone 16 Pro portrait, phone tier, 2× rendering, muted.
- Fresh browser context per entry; Developer enabled solely to expose
  the existing LEGACY / SHARDFILE buttons and diagnostic camera port.
- Each entry went through SHARD SELECT and its actual mode button.
  All twelve session choices and installed level identities matched:
  `<slug>-legacy` for LEGACY and `<slug>` for SHARDFILE.
- Seed 357; the same saved midday / clear settings for both modes.
  The shard's own authored sky remains its own.
- Ninety actual drawn frames after each player pose. The legacy
  standing camera supplies the exact eye, rotation and FOV reused by
  the native frame. All 24 pairs match within `1e-6`.
- [cameras.json](cameras.json) records the actual canonical cameras.
  Authored cameras supply the first views; Driftwood, Pine and Nalati
  have a fourth view looking back from spawn.
- Twelve entries, 48 captured views, zero page errors. Diagnostic perf
  and memory overlays are hidden consistently; ordinary gameplay HUD
  stays visible. These are live frames, without image synthesis.

Animation, creature positions, toasts, clouds and reflections can
differ between the two visits. No pixel-equality or performance claim
is made. An initial camera experiment put the authored Driftwood eye
below the pier; it was rejected. The delivered pair uses the actual
standing eye and the same coordinates in both modes.

## Visible difference requiring review

**Sky Reach (fixed by `18aaab1583`, 2026-10-28, sp-o3: world.scenes drives its own tiled parts when a plan has no host;
board `art/legacy-vs-shardfile/round-2-far-reach/board.jpg` matches LEGACY at all four cameras; the rest is the
[Far Reach regressions plan](../../../docs/plans/shard-platform/far-reach-regressions-2026-10-28-mini-plan.md)):** on this captured pin the native spawn / hover / windmill
views lack rock underbodies and vegetation visible in LEGACY. The
sheet explicitly labels this difference. This graphical gap has no
confirmed owner: sp-o5 confirms its CO1 stand-in work covers Driftwood
only and no landed Sky Reach fix is known. A causal first bad commit
is not established. STATE links this batch for coordinator routing;
the difference is retained in BURN-DAMAGE-LIST.

## LD4 Node gaps, retained explicitly

Source audit: [legacy-deletion plan](../../../docs/plans/shard-platform/legacy-deletion-mini-plan.md),
with exact identifiers in its `legacy-explorer-lists.json` inventory.
These are declaration-adapter coverage gaps, not proof that runtime
content disappeared. The boards do not substitute for Node registration
coverage or clear these rows.

| Row | Remaining qualification |
|---|---|
| LD4-DW | Declared 14 models, 9 Sets, 6 POIs and 1 arena match. World-placed models and conditional Set membership remain unqualified. |
| LD4-PH | Declared 19 models, 18 POIs and 1 arena match. `pine-hollow/mill-hamlet` is absent from the declaration-only Set adapter; runtime-placed models and late map registrations remain unqualified. |
| LD4-NG | Declared 27 models, 17 Sets, 17 POIs and 2 arenas match. Runtime-placed models, conditional Sets and late map registrations remain unqualified. |
| LD4-ND | `nine-dragon-stack/fp-arms` and six Sets are absent from the declaration-only adapter: `crossings`, `lantern-square`, `night-market`, `stair-street`, `well-galleries`, `well-rim`. Native adds eight POIs: `lantern-square`, `night-market`, `portal-east`, `portal-north`, `portal-south`, `portal-west`, `stair-street`, `well-rim`. Both arenas match. First-person arms are visible on the sheet; that does not repair the Node adapter's coverage. |
| LD4-FR | Declared 8 models and 1 arena match. Native adds `islet-east`, `islet-north`, `islet-south`, `islet-west` POIs. World-placed models remain unqualified. |
| LD4-SD | Declared 10 models and 1 arena match. World-placed models and conditional/computed Set registrations remain unqualified. |

LD5–LD8 and the legacy button remain until Jake gives his deletion word.
