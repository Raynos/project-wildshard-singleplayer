# Round 8 · look loop 9 (E169, 2026-09-25): the repair, and the four mockup views join the loop

Dome A's ninth set of frames: anchor P = the spawn, the same 9 cameras, `time(6.5)`, blue hour, no HUD. The targets
are round 1's (`../round-8-look-loop-1/target-1…9.jpg`), plus, from this round, the four round-6 mockups. The frames
export the shared working tree, so dome B's work in progress (the gate, the banyan, the crowd, the balustrade relief,
the stalls) is in them too.

**Why a repair.** Jake asked why the latest cards "don't feel as great as round 6/7/8". Round 8's P5 paint was part of
it. At full strength it turned the wet ground into grainy grey granite that broke up the neon streaks, and it made the
balustrade's stone and frieze loud and grey. ΔE had improved, but ΔE cannot see texture noise.

| File | What |
|---|---|
| `capture-1…9.jpg`, `sheet-ingame-3x3.jpg` | the 9 loop frames |
| `mock-A…D.jpg`, `sheet-mockups.jpg` | **new every round:** the four round-6 mockup views WITH the HUD (iPhone portrait 402×874 @3): A spawn (`style-A-jiehua-neon.jpg`), B well-edge (`comp-B-well-edge.jpg`), C stair-street (`comp-C-stair-street.jpg`), D well-down (`comp-D-well-down.jpg`); the sheet is in game \| mockup |
| `eye-check.jpg` | **new every round:** previous round \| this round \| target for capture-1, 2, 6 and mock-A…D (the mockups are the targets of those four). It is looked at before a report, and anything that looks worse by eye is reverted |
| `../round-8-look-loop-8/board.jpg` | round 8 \| this round \| the round-1 target, FP 1, FP 6, aerial 7 |
| `warm-vs-cool.jpg`, `stats.txt` | A blue hour \| B warm silk; draws and triangles per camera |

Capture: `--round=9 --only=loop,mock,warmcool,cards,teasers`, then `--only=eye --prev=<round 8's folder>`.

## What changed (all in dome A's files)

1. **The ground, back to round 7's crisp wet gloss.**
   - The painted granite on the flagstones is at 18 % strength (`uPaintFlag`), and only where the stone is dry. Wet
     areas stay smooth and dark.
   - The puddles are the round-7 noise puddles again. The paint's cavity map made per-stone blotches.
   - The sky sheen is round 7's.
   - The smaller flagstones stay (0.62 m courses, 0.64–0.92 m stones), with the joint ink 0.85 → 0.6 so the finer grid
     is not busier.
2. **The streaks, crisp again.** They no longer break on the paint's dabs (`paintWetDapple` is gone). Their jog,
   striation and dashes follow virtual stones of the old size (`stone(p * 0.7 + 37)`). On the small slabs every streak
   had become a staircase. The joints and the puddles still use the real stones.
3. **The balustrade and the Well lip.**
   - The painted frieze texture is off (`uPaintStone.y = 0`). The ruled inset frame and the procedural ruyi carving are
     back: the targets carve the panel in ink lines.
   - Bare stone (kind 9: rails, posts, the lip) is at 20 % (`uPaintStone.x`).
   - The grey S-ribbon still visible in FP 2 is dome B's relief geometry in `square.ts`, not paint.
4. **Walls.** The painted concrete is at 65 % (`uPaintStone.z`, was 90 %). At phone size it reads as weathering, not
   noise.
5. **The Well, mistier and paler for mockups B and D.**
   - A shaft mist: the stretch of each ray inside the shaft's box (an analytic slab test) fills with pale silk. It
     starts at nothing and reaches full density 25 m below the rim or the eye, whichever is lower. `uShaft` and
     `uShaftK` hold the box and density 0.085/m.
   - The shaft's silk bands are paler (`#c2cad6` at +101 m, `#b1bccb` at +36 m, `#9eabbe` at −30 m).
   - The base air under the square thickens faster (× up to 3.6).
   - Views from the rim now fade into pale mist like the mockups.
6. **Stair risers** are wet stone (`#75747a`, kind 9) instead of a pale beige plain.
7. **Capture script:** `--only=mock` (the four HUD views + `sheet-mockups.jpg`) and `--only=eye` (`--prev`,
   `--targets`).
8. **Sign atlas:** the colour sign atlas is 1024 × 2048 (was 1024²). Dome B's stalls and gate filled it and the page
   failed to load ("colour atlas full").

## Reverted by eye (the eye-check rule)

- **Catwalk decks as dark wet timber:** a heavy dark diagonal across B and D, worse than round 8's pale deck. Reverted;
  the pale deck now fades into the mist.
- **The first shaft mist,** measured below the rim only, whited out aerial 8 (the camera 80 m down, looking up). The
  mist is now measured below the eye too, so the stretch above a camera inside the shaft stays clear. Aerial 8 is back
  to round 8.
- **Paint at 25 % on the ground plus the cavity puddles:** still blotchy by eye in FP 6. Lowered to 18 % and the
  cavity dropped.
- **Painted frieze at 35 %:** still a grey scroll by eye. Turned off.

## ΔE per region (round-1 targets; blind to texture, so the eye-check decides)

| Region | Round 7 | Round 8 | Round 9 |
|---|---|---|---|
| wall | 2.1 | 2.1 | 1.6 |
| wet ground | 2.2 | 1.5 | 2.0 |
| streaks (neon) | 4.0 | 4.0 | 3.7 |
| stone (balustrade) | 5.7 | 3.5 | 5.6 |
| silk sky | 1.7 | 1.6 | 1.6 |
| lit windows | 3.2 | 2.9 | 3.0 |
| cinnabar (dome B) | 0.8 | 1.9 | 1.8 |

## The mockup views: gaps (for the next rounds)

- **A spawn:** close. The mockup is warmer and darker around the gate, and its ground reflections are softer and less
  saturated.
- **B well edge:** the mist now matches in tone. The mockup looks along a narrower canyon: verandas and walls close on
  both sides, bridges crossing low down, a gondola. Ours is a wider shaft with long catwalks. The composition and the
  Well's geometry are the gap now, not the colour.
- **C stair street:** the mockup lines the stairs with lit shops, lanterns, signs close on both sides, a crowd on the
  steps and silk haze at the top. Ours has dark towers and long bare treads. The next dome-A item.
- **D well down:** as B, plus the mockup's paifang bridge across the shaft and the lions on the balustrade (dome B).

## Rulers

- 80–103 draws (≤ 200); 1.60–1.95 M triangles (≤ 2.5 M). The rise from round 8 is dome B's new props.
- Gates: the clean room typechecks clean on its own (an include-only config, deleted after); oxlint is clean on
  `src/dev/nine-dragon` and the capture script.
