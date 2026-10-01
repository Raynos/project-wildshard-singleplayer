# NORMALIZATION-PICKS — every pick, decision, question and review for Jake (E357)

**State:** `blocked` 2026-10-01 — open: P14–P15 (review wave 5: J13 reload, J14 brace+jump), P16–P19 (review wave 4: Signal Dunes first look, B1/B2 cover fixes, Pine drum), P20 (review wave 6: Sky Reach first look); waiting on Jake; asked in plain chat while herdr builders are live; must be empty before GAME-NORMALIZATION is archived.

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
| P14 | **J13** a touch RELOAD button for magazine weapons (Pine lever rifle, practice rifle) | A first-row RELOAD above JUMP · B tap the ammo chip · C on FIRE's rim | review wave 5 (https://claude.ai/artifact/LKxwqqcsJCG5HTw7JMhLzi); `art/hud/round-16-reload-brace/` Q1 | 2026-10-01 |
| P15 | **J14** jump while holding the spear (BRACE takes JUMP's place on touch) | A BRACE above JUMP · B BRACE in the LOCK slot · C hold ATTACK = brace | review wave 5 (https://claude.ai/artifact/LKxwqqcsJCG5HTw7JMhLzi); `art/hud/round-16-reload-brace/` Q2 | 2026-10-01 |
| P16 | **Z3 shard 5** Signal Dunes first build: right direction? | right direction · change the look | review wave 4 (https://claude.ai/artifact/8fMvfeXwKBKnM3BGnpcbkz) Q1; `art/sunscar-dunes/round-3-build/board-c2fdc72d.jpg` | 2026-10-01 |
| P17 | **B1** spear thrust blocked by cover (was hitting through walls) | keep the fix · revert | review wave 4 (https://claude.ai/artifact/8fMvfeXwKBKnM3BGnpcbkz) Q2; `progress/normalization/wave2/b1-*.mp4` | 2026-10-01 |
| P18 | **B2** Naizagai crescent blocked by cover | keep the fix · revert | review wave 4 (https://claude.ai/artifact/8fMvfeXwKBKnM3BGnpcbkz) Q3; `progress/normalization/wave2/b2-*.mp4` | 2026-10-01 |
| P19 | **Pine drum cadence** (the woodpecker scheduler moved) | fine · sounds off | review wave 4 (https://claude.ai/artifact/8fMvfeXwKBKnM3BGnpcbkz) Q4; `progress/normalization/wave2/pine-drum-*.mp3` | 2026-10-01 |
| P20 | **Z3 shard 6** Sky Reach first-look board | right direction · change the look | review wave 6 (https://claude.ai/artifact/Upca7W83HatGZEYNrFzsWB) Q1; `art/far-reach/round-2-build/board-8dbba343.jpg` | 2026-10-01 |

## Answered

| # | What | Jake's answer | Date |
|---|---|---|---|
| P3 | **X1 input board** | Wave 3: keep 100 ms coyote time (Q1), keep the dodge buffer (Q2), desktop key bindings layout A (Q3, J10 building) | 2026-10-01 |
| P10 | **B35 / X9** title-deck summary strip | Wave 1 Q5: neither: the selected shard's line + the Wildshard total; built J8 (6c352b12), shipped in wave 2 Q1 | 2026-10-01 |
| P2 | **M1–M4 milestone board items** (11 differences the classifier won't auto-accept, e.g. Nine Dragon's walk with jump buffer / coyote, Pine's fx cadence drum) | One review page later: before/after images + clips per board item with the milestone build (decision 102 defaults meanwhile) | 2026-10-01 |
| P4 | **B47** Driftwood phone keeps FXAA with Settings ▸ anti-aliasing Off (as Nine Dragon already does) | Keep: the tier wins (FXAA on phone even with the setting Off), same rule on every shard | 2026-10-01 |
| P5 | **B58** Pine's shared sound listener kept at the origin for parity (distant quest-glyph sound stays silent, as before) | Fix now: one listener for every voice inside this plan; Pine's sound log re-records at the milestone | 2026-10-01 |
| P6 | **B63** Nalati's marmot colony keeps simulating far away (behaviour identical, a little CPU) | Pause far marmots: save the CPU; the whistle timing change re-records at the milestone (reverses B63) | 2026-10-01 |
| P7 | **B69** build chunk groups off (three tries broke boot) | Retry after S4.4: one more try now main.ts is the 3-line entry; must boot all four shards off-branch first | 2026-10-01 |
| P8 | **X7 tier threshold**: desktop quality only at RTX 3060 class or above (Geekbench OpenCL projection; Apple GPUs benchmark); M5 + iPhone unchanged | Keep the RTX 3060 rule as built | 2026-10-01 |
| P9 | **X3 T3**: 54 unreferenced original texture files, 27.05 MiB | Delete the 54 unreferenced original textures (27 MB) | 2026-10-01 |
| P11 | **Earlier wave boards** still unseen: weapons (B1 / B2 wall fixes), creatures (big crab 14, decision 86), look (the shared Captain BossBar, decision 91) | Same review page as P2 | 2026-10-01 |
| P12 | **Calibration publish** needs a quiet machine (budgets become measured, not projected) | Run it at the next quiet gap (no builders live), before the milestone pin if possible | 2026-10-01 |
| P1 | **E362 ARCH-GUARDS**: which static-analysis guards to build (lint rules, TS boundaries, import graph, shard layout, fast pre-commit) | First batch now, in E357 (AG16, AG17, AG1, AG14, AG13, AG11, AG20, AG9 as Z4 rows, before the template + new shards); second batch after | 2026-10-01 |

| P13 | Z3 shard concepts | shard 5: **C · Signal Dunes** (round 2, typed); shard 6: **B · Sky Reach** + hoverboard-only bridges (typed) | 2026-10-01 |

## Milestone board items found by sol-m2 on 39223a5f (go on the review page with P2 / P3)

- **Pine BOLTS HUD + gate / cabin pose SSIM** (3 fields): the X1 reserved-verb A/B; recommended A (as built). Evidence: `progress/normalization/x1-board/`.
- **Pine ambient drum** (1 field): the Creatures-board fx cadence row; recommended as built.
- The intended deltas Jake already picked: coyote (P3, 12 fields), J1 glyph (P5), J2 marmot whistles (P6).

## Re-confirmed in plain chat (2026-10-01)

The pop-up answers can be typed over by a builder's herdr message (that is how the withdrawn shard picks happened). Jake re-confirmed P1 (guards), P5 (Pine listener), P6 (far marmots), P4, P8, P7, P9 (delete after a re-audit) and the staggered review pages in plain chat: all his. P13 (the two shard concepts) is still open.

## Wave 1 answers (2026-10-01, typed in chat)

- **Q2 input buffer (120 ms): fine** (keep). The dodge clip showed no visible difference (caption only); re-captured by sol-roof.
- **Q3 Settings ▸ Controls: makes sense, but hide it on iOS / touch-only devices** (key bindings mean nothing there); show it only in desktop mode with a keyboard. Jake wants to see the desktop version: build row J7 (sol-ctrl).
- **Q5 title summary strip: neither A nor B.** Show only the selected shard's name + its feats ("Driftwood Isle · 2 feats") and the Wildshard total ("Wildshard · 5 feats"), in A's style; it changes as you swipe the carousel ("we're going to have so many shards"). Build row J8 (sol-title).
- **Q4 reserved action slot: A, first row** ("definitely first row") — as built.
- **Q1 coyote / late roof jump:** the clip was broken (no visible edge; the capture fixture dropped the player through the street). sol-roof re-captures it on a real edge and checks for a real fall-through bug; Q1 asked again after.
- Jake's finding: crouch (and other actions) exist only on the keyboard, with no touch control: ask E365, a keyboard-vs-touch audit.

## Wave 2 answers (2026-10-01, typed in chat)

- **Q1 title summary (J8): looks good** — ship.
- **Q2 key bindings:** iPhone with none is right; the desktop version is "just a mobile layout on desktop" — redesign the key bindings screen (and the desktop Settings menu) in a desktop layout with better defaults. Build row J9: mockups A/B/C first (a wave), then build Jake's pick.
- **Q3 Captain's shared boss bar: looks great** — keep. Jake: "I don't know why the art style of the Drowned Captain changed completely in the two screenshots" — investigated as R9.
- **Q4 big crab hits for 14: fine** — keep.

## Wave 3 answers (2026-10-01, typed in chat)

- **Q1 coyote (pier → boat): looks great** — keep 100 ms.
- **Q2 dodge buffer:** "choose whatever you think is best" → keep (lead's call).
- **Q3 desktop key bindings: A** (two panes + table) with the proposed default changes → J10.
- **Q4a:** disable crouch outside Nalati, on desktop too → J11.
- **Q4b:** "we need a reload button" for a part-empty magazine → mockups of where it goes first → J13.
- **Q4c:** show a mockup of BRACE + JUMP both available while holding the spear → J14.
- **Q4d:** drop the Pine longbow auto-shot (F) → J12.

