# E0e: HUD I: the XP bar, the LV chip, the level-up moment, the death line

Slice rule: [README.md](README.md) · east index: [INDEX-east.md](INDEX-east.md). Absorbs **HC1** (XP bar + LV chip),
**HC2** (level-up: in-combat chip + ring + sting; the Fire Emblem tick-up card only out of combat), **HC7** (the death
card's XP line), **LVH1** and **LVH5**. Shared HUD (E332): a herdr notice to the HUD owners before, the SHA after; a
labelled board to Jake first (a HUD change that isn't a bug fix needs his pick).

## 1. The showcase piece

- A thin **XP bar** along the bottom above MOVE / LOOK with an **"LV n"** chip at its left (mockups S1, S2,
  `art/showcase-template/round-11-remaster/`); it fills on kills.
- **Level-up in a fight never blocks** (19aa): a ring burst, the `levelUp` sting (E15b; a stand-in until then), the chip
  flips, a one-line chip by the bar ("LEVEL 7 · +11 VIT"). **Out of combat** (5 s without a hit, no new fight) the
  tick-up card plays each gain in turn, gold on a big roll, grey on 0, tap to skip.
- The "Killed by…" card gains one line: "−340 XP (25 % of level 7)".

## 2. Engine / game / host work, just in time

Research:

- HUD slots: `src/engine/client/ui/HUD.ts` (686 lines) and `src/engine/client/ui/hudSlots.ts`; the bottom edge above the touch
  controls is free in portrait (E319 layout: the left edge is HORSE · HOVER · SWAP; VITALS hide at full health).
- The death card is `src/engine/client/ui/HurtArc.ts` ("Killed by…", KITCHEN-SINK §2.21: already generic). Toast and banner
  helpers exist in `HUD.ts`.
- No XP, level or progression UI exists anywhere (grep `xp`, `LV`, `levelUp`: none in `src/engine/client/ui`).

Work:

| Piece | Shape | Layer |
|---|---|---|
| progress bar slot | a generic "meter" slot: `{ value 0..1, chip text, flash }`, hidden unless a provider registers | engine `hudSlots.ts`, `HUD.ts`, `styles/game.css` (no "XP" word: the game supplies the text) |
| level-up chip + ring | a generic HUD "burst" (ring + one-line chip, 2.5 s) | engine UI |
| tick-up card | a modal-free card in the game layer, shown only when the experience host says "out of combat" and no fight starts; tap to skip | game `src/game/progression/levelCard.ts` (new) over engine panel pieces |
| death line | `HurtArc` card accepts an extra line from a provider | engine `HurtArc.ts` |
| provider | the experience host (E0d) feeds the meter, bursts and the death line | game |

Host bar: generic engine slots with one provider (the levels host). Guards: `engine-words` (no "xp"/"level" text in
engine UI strings: the game passes them), the E332 notice. Tests: `test/hud-pins.test.ts`, `test/hud-slot-layout.test.ts`
(if present) extended with the meter hidden by default; a DOM snapshot of the showcase HUD; new
`level-card.test.ts` (never shows while in combat; skips on tap).

## 3. Other shards in this slice

Every shard shares the HUD: with no provider the meter, burst and death line never mount, so every other shard's HUD
DOM is identical (DOM snapshot per product, as W1b's quest list did). One look in game at Driftwood and Nalati (portrait
captures as "iPhone 16 Pro"). No save risk.

## 4. Done when, hours, blockers

**Done when:** Jake's board pick is in; the bar fills on kills in the pen; a level-up in a fight shows only the burst and
chip; the card plays after 5 s calm and is skipped by a tap; the death card shows the XP line; other HUDs unchanged.

| Engine | Migration | Shard | Total |
|---|---|---|---|
| 14 h (Opus: UI, the card's feel) | 1 h | 1 h | **16 h** |

**Blockers:** E0d. The board goes to Jake on day one (the rows don't wait for the pick; the look does).

## 5. Risks

- The bottom edge in portrait is close to the MOVE thumb; the bar must sit above the touch dead zone on an iPhone 17
  Pro safe area (a capture with the controls showing).

## 6. Questions for Jake

1. **Where the XP bar sits.** (a) along the bottom above the controls, full width (S1); (b) a short bar under the
   vitals, top left. **Recommended (a):** your 11-02 pick; a board of both with the controls showing goes to you first.
2. **The tick-up card.** (a) auto-plays once out of combat, tap to skip; (b) a "LEVEL UP" button you tap when ready.
   **Recommended (a):** no extra button on a phone HUD, and it never blocks a fight either way.
