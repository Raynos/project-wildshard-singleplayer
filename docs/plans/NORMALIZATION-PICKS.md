# NORMALIZATION-PICKS — every pick, decision, question and review for Jake (E357)

**State:** `blocked` 2026-10-01 — 13 rows open (P1–P13), waiting on Jake; the lead asks them with the question tool; must be empty before GAME-NORMALIZATION is archived.

A mini plan beside [GAME-NORMALIZATION](GAME-NORMALIZATION.md). Each row is one question the lead asks Jake through
the question tool (AskUserQuestion), with its options and the evidence to look at. Builders never decide a row: when
one reports a guess, a board item or a needs-pick, the lead adds a row the same turn. Decision 102 still lets the build
continue on the recommended option, but the row stays open until Jake has answered.

## How a row closes
1. The lead asks it (a batch of up to 4 per question call; the evidence images first when the row has them).
2. Jake's answer and the date go in the row; it moves to **Answered**.
3. If the answer differs from what was built, the lead turns it into a build row in GAME-NORMALIZATION (or its own ask)
   and links it here.

## Open

| # | What | Options (recommended first) | Where to look | Since |
|---|---|---|---|---|
| P1 | **E362 ARCH-GUARDS**: which static-analysis guards to build (lint rules, TS boundaries, import graph, shard layout, fast pre-commit) | the recommended first batch in the doc · a subset · none | `docs/plans/ARCH-GUARDS.md` (Opus subagent drafting) | 2026-10-01 |
| P2 | **M1–M4 milestone board items** (11 differences the classifier won't auto-accept, e.g. Nine Dragon's walk with jump buffer / coyote, Pine's fx cadence drum) | the recommended option per item (decision 102 applies it; Jake can reverse) | `progress/normalization/m-classification.md` (sol-m) | 2026-10-01 |
| P3 | **X1 input board**: the 120 ms input buffer + 100 ms coyote time (decision 40), the Controls / rebinding screen | ship as built · tune the two numbers · revert | `progress/normalization/x1-board/` (sol-x1b making the clips) | 2026-10-01 |
| P4 | **B47** Driftwood phone keeps FXAA with Settings ▸ anti-aliasing Off (as Nine Dragon already does) | keep · let the setting win on every shard | 13-lead-resolutions B47 | 2026-10-01 |
| P5 | **B58** Pine's shared sound listener kept at the origin for parity (distant quest-glyph sound stays silent, as before) | fix after the plan with a re-baseline (a follow-up ask) · fix now | 13 B58 | 2026-10-01 |
| P6 | **B63** Nalati's marmot colony keeps simulating far away (behaviour identical, a little CPU) | keep · pause far marmots at a Nalati re-baseline | 13 B63 | 2026-10-01 |
| P7 | **B69** build chunk groups off (three tries broke boot) | retry after S4.4 · leave off | 13 B69, `progress/normalization/x3-proof.md` | 2026-10-01 |
| P8 | **X7 tier threshold**: desktop quality only at RTX 3060 class or above (Geekbench OpenCL projection; Apple GPUs benchmark); M5 + iPhone unchanged | keep · other threshold | sol-x7 handoff in `docs/tasks/asks/E357.md`, `progress/normalization/x7-validation.json` | 2026-10-01 |
| P9 | **X3 T3**: 54 unreferenced original texture files, 27.05 MiB | delete · keep | `progress/normalization/x3-proof.md`, `x3-asset-deltas.json` | 2026-10-01 |
| P10 | **B35 / X9** title-deck Wildshard summary strip variant (A shipped as default, B a Debug row) | A · B | `progress/normalization/x9/title-{a,b}.jpg` | 2026-09-30 |
| P11 | **Earlier wave boards** still unseen: weapons (B1 / B2 wall fixes), creatures (big crab 14, decision 86), look (the shared Captain BossBar, decision 91) | the recommended options (applied) | the wave boards in E357.md / 13 | 2026-09-30 |
| P12 | **Calibration publish** needs a quiet machine (budgets become measured, not projected) | run it when no builders are live (lead) · skip | 03 §2.5, 13 B24 | 2026-10-01 |
| P13 | **Z3 shard 5 concepts**: the fresh agent proposes 3 portrait mockups per new shard (desert + whip; agent's choice) and Jake picks (decision 73) | — (comes at Z3) | — | later |

## Answered

| # | What | Jake's answer | Date |
|---|---|---|---|
