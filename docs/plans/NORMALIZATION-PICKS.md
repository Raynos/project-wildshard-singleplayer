# NORMALIZATION-PICKS — every pick, decision, question and review for Jake (E357)

**State:** `blocked` 2026-10-01 — 3 rows open (P3, P10, P13); 10 answered 2026-10-01, waiting on Jake; the lead asks them with the question tool; must be empty before GAME-NORMALIZATION is archived.

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
| P3 | **X1 input board**: the 120 ms input buffer + 100 ms coyote time (decision 40), the Controls / rebinding screen | ship as built · tune the two numbers · revert | **`progress/normalization/x1-board/README.md`** (ready: Nine roof jump before/after, Driftwood mid-swing dodge before/after, 3 Controls images, Pine / Nalati reserved-verb A/B, trace); `x1-board/r6-coyote.md`: coyote adds one jump on Nine Dragon's route, which shifts its combat footsteps (desktop metal steps absent → 2, phone 2 → 1); grace audited exact (100 / 120 ms) | 2026-10-01 |
| P10 | **B35 / X9** title-deck Wildshard summary strip variant (A shipped as default, B a Debug row) | A · B | `progress/normalization/x9/title-{a,b}.jpg` | 2026-09-30 |

## Answered

| # | What | Jake's answer | Date |
|---|---|---|---|
| P2 | **M1–M4 milestone board items** (11 differences the classifier won't auto-accept, e.g. Nine Dragon's walk with jump buffer / coyote, Pine's fx cadence drum) | One review page later: before/after images + clips per board item with the milestone build (decision 102 defaults meanwhile) | 2026-10-01 |
| P4 | **B47** Driftwood phone keeps FXAA with Settings ▸ anti-aliasing Off (as Nine Dragon already does) | Keep: the tier wins (FXAA on phone even with the setting Off), same rule on every shard | 2026-10-01 |
| P5 | **B58** Pine's shared sound listener kept at the origin for parity (distant quest-glyph sound stays silent, as before) | Fix now: one listener for every voice inside this plan; Pine's sound log re-records at the milestone | 2026-10-01 |
| P6 | **B63** Nalati's marmot colony keeps simulating far away (behaviour identical, a little CPU) | Pause far marmots: save the CPU; the whistle timing change re-records at the milestone (reverses B63) | 2026-10-01 |
| P7 | **B69** build chunk groups off (three tries broke boot) | Retry after S4.4: one more try now main.ts is the 3-line entry; must boot all four shards off-branch first | 2026-10-01 |
| P8 | **X7 tier threshold**: desktop quality only at RTX 3060 class or above (Geekbench OpenCL projection; Apple GPUs benchmark); M5 + iPhone unchanged | Keep the RTX 3060 rule as built | 2026-10-01 |
| P9 | **X3 T3**: 54 unreferenced original texture files, 27.05 MiB | Delete the 54 unreferenced original textures (27 MB) | 2026-10-01 |
| P11 | **Earlier wave boards** still unseen: weapons (B1 / B2 wall fixes), creatures (big crab 14, decision 86), look (the shared Captain BossBar, decision 91) | Same review page as P2 | 2026-10-01 |
| P13 | **Z3 shard 5 + shard 6 concepts**: 3 mockups each (the A picks recorded earlier were NOT Jake's and are withdrawn) | — | `art/sunscar-dunes/round-1-proposals/`, `art/far-reach/round-1-proposals/` | 2026-10-01 |
| P12 | **Calibration publish** needs a quiet machine (budgets become measured, not projected) | Run it at the next quiet gap (no builders live), before the milestone pin if possible | 2026-10-01 |
| P1 | **E362 ARCH-GUARDS**: which static-analysis guards to build (lint rules, TS boundaries, import graph, shard layout, fast pre-commit) | First batch now, in E357 (AG16, AG17, AG1, AG14, AG13, AG11, AG20, AG9 as Z4 rows, before the template + new shards); second batch after | 2026-10-01 |


## Milestone board items found by sol-m2 on 39223a5f (go on the review page with P2 / P3)

- **Pine BOLTS HUD + gate / cabin pose SSIM** (3 fields): the X1 reserved-verb A/B; recommended A (as built). Evidence: `progress/normalization/x1-board/`.
- **Pine ambient drum** (1 field): the Creatures-board fx cadence row; recommended as built.
- The intended deltas Jake already picked: coyote (P3, 12 fields), J1 glyph (P5), J2 marmot whistles (P6).

## Re-confirmed in plain chat (2026-10-01)

The pop-up answers can be typed over by a builder's herdr message (that is how the withdrawn shard picks happened). Jake re-confirmed P1 (guards), P5 (Pine listener), P6 (far marmots), P4, P8, P7, P9 (delete after a re-audit) and the staggered review pages in plain chat: all his. P13 (the two shard concepts) is still open.
