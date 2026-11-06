# Round 8 · look loop 10 (E169, 2026-09-25): lab P8's viewmodel merged

Dome A's tenth set of frames: anchor P = the spawn, the same 9 cameras, `time(6.5)`, blue hour, no HUD. The targets are
round 1's, and the four round-6 mockup views are the shared scoreboard of all four domes. The frames export the shared
working tree, so domes B, C and D's work in progress is in them.

| File | What |
|---|---|
| `capture-1…9.jpg`, `sheet-ingame-3x3.jpg` | the 9 loop frames |
| `mock-A…D.jpg`, `sheet-mockups.jpg` | the four mockup views with the HUD \| the mockups |
| `eye-check.jpg` | round 9 \| this round \| target for capture-1, 2, 6 and mock-A…D |
| `warm-vs-cool.jpg`, `stats.txt` | A blue hour \| B warm silk; draws and triangles per camera |

## What changed: the first person is lab P8's

(`round-9-lab-viewmodel/README.md`)

- **The modules**: `geo`, `materials`, `jian`, `cloth`, `trail`, `assets` and `viewmodel` are copied into
  `src/dev/nine-dragon/vm/`. The assets stay at `/assets/nine-dragon/lab/viewmodel/`.
- **What it draws**: the procedural jian with its heat-shimmer halo (edge emission kept at 1.5, per P8's bloom warning),
  the Blender-remastered dragon guard, the gloved hand and sleeve, and the verlet tassel and talisman. The Fei Zhua
  gauntlet has bandage wraps and its talons as a separate part, which P9 will animate. The slash trail is the 飞白
  dry brush.
- **`main.ts`**:
  - `await vm.load()` replaces the TRELLIS-guard block.
  - `resize()` sets `uRes` and `uPx` on every `vm.materials` entry.
  - Attack: a tap is `vm.play('light')` and holding it past 0.3 s is `vm.play('heavy')`. A desktop click plays the light
    cut; `E` parries and `R` draws.
  - `vm.gravity` follows the view pitch, so the tassel and talisman hang true.
- **Framing**: `vm/viewmodel.ts` `LAYOUT_PORTRAIT` is the spawn framing of round-6 `style-A-jiehua-neon.jpg`. The guard
  sits low right (NDC 0.55, −0.45, at 1.1 m) with the tip at the centre, so the long jian diagonal is back. The Fei Zhua
  sits low in the left corner (wrist −0.5, −0.76 at 1.3 m; elbow −2.2, −1.05, elbowDepth 0.8), reaching in almost level
  with the talons toward the middle, as in the mockup. P8's own pose had the gauntlet large and upright at the left
  edge. P8 is now rebuilding the arm rig and motion (Jake: "the hand rotates independently of the arm"). `vm/` is
  P8's until it reports back, and this static pose is the reference it must hit.
- The old `hero/viewmodel.ts` is no longer imported. `hero/weapon-parts.ts` stays: `buildClaw` draws the flying claw
  until P9 lands.

## Eye check

- **Better:** the gauntlet reads as a real object (wraps, drum, talons) in the corner where the mockups have it. The
  guard, glove and sleeve are much richer. The blade keeps its cyan edges with no grey veil.
- **Worse, not reverted:** the red tassel and the fu talisman are smaller and less visible than in the round-1 targets
  and the mockups, where a big red tassel hangs under the guard. P8 owns `vm/` now, so this is a note for P8: a
  larger tassel (`cloth.ts` `TASSEL`).
- **Reverted:** nothing.

## ΔE per region (round-1 targets)

| Region | Round 9 | Round 10 |
|---|---|---|
| wall | 1.6 | 1.6 |
| wet ground | 2.0 | 2.0 |
| streaks | 3.7 | 3.1 |
| stone (dome B) | 5.6 | 5.9 |
| silk sky | 1.6 | 1.6 |
| lit windows | 3.0 | 2.2 |
| cinnabar (dome B) | 1.8 | 2.2 |

These were measured on the 1400 px copies of the captures, so the pixel counts are lower than in earlier rounds; the
means are comparable.

## Rulers

- Draws 89–111 per frame (≤ 200). Triangles 1.92–2.28 M (≤ 2.5 M): the viewmodel adds ~330 k rasterised triangles with
  its ink hulls, and the domes' props add the rest. **Close to the budget.** P8's phone levers are the guard 60 k → 30 k
  and merging the sword body with the guard.
- Frame time: the spawn at 804×1748 took 14.7–15.5 ms with the machine's load average at 7 (other agents' jobs), so
  that is an upper bound; the last quiet reading was 4.5–4.9 ms on round 4's build. P8 measured the viewmodel alone at
  ≈ 0.3–0.4 ms.
- Gates: the clean room typechecks and lints clean on its own.
