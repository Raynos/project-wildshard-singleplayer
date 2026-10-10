# op-look30: SF63 part 3, the last grid look bugs (E435, 2026-10-10)

Successor of op-look28 (`../look28/README.md`). Captures: DEVSERVER previews of the candidate `0364c6b9e` (HEAD `683fc79de`
plus fix 1, identical in content to the landed `62b7dd38a`) and of `683fc79de` itself for "before"; muted Metal iPhone 16 Pro portrait, phone
tier, 2×, Developer on, Memory saver on, the Developer memory card hidden. No shot ran inside a `.git/quiet` window.

`capture.mjs` is op-look28's with three additions: a hidden shard (`_…`) or `SELECT_MENU=1` enters standalone the way
SHARD SELECT does (main menu ▸ SHARD SELECT ▸ its card ▸ ENTER WORLD, or SHARDFILE for a shardfile-only shard; no URL
switch); `PROBE=4 BAND=x0,x1,y0,y1` clips a screen band once per scene object hidden in turn (`measure.py band` ranks
them); the chain readout carries `bypass`. `measure.py sat <box> <png…>` gives the HSV saturation of a screen box.

## 1. Nine Dragon's whole-chain composite leaked the page chain: fixed (`62b7dd38a`)

With `gridCellComposite` on, the frame placed Nine's Jiehua display after the page's tone mapping. The page's other
colour effects still ran around it: chromatic aberration, bloom, vignette, HueSat, BrightnessContrast, Grade, GradeLook,
LUT, noise and GridFrameGrade. Their knobs were neutral for a whole-chain carrier. Even so, the engine `GradeEffect` has a
hard-coded deep-shadow desaturation (25 % at luminance 0), and the SRC-blended effects ignore their opacity. So the dark
wet floor lost saturation. Now `GridFrame` keeps a `chainBypass` while a `replaces: 'chain'` composite is resident.
Every effect of the shell's colour pass except the tone mapping and the displays fades out by the carrier's owner weight,
blended across the 16 m edge band like the tone mapping. SRC effects blend NORMAL instead, which is identical at opacity 1
and recompiles with the placement. Opacities are written last before the draw and restored first, so the page's own fades
never read a faded value back. Readout: B's colour pass is now every effect `@0` except `NdJiehuaEffect@1`, `bypass 1`.

Dark wet-floor box (x 0.66–0.82, y 0.52–0.57; HSV saturation median, 0–255):

| shot | sat |
|---|---|
| SHARD SELECT (before / after runs) | 122 / 118 |
| grid B before (`683fc79de`) | 104 |
| grid B after (`62b7dd38a`) | 121 |

A lit floor box (x 0.22–0.40, y 0.50–0.56): standalone 57–58, B before 55, B after 57. Board `nine-dragon-stack.jpg`.
**Sky Reach** (`replaces: 'tone'`) keeps its NEUTRAL tone with the page chain as before (`bypass 0`): `far-reach-tone.jpg`.
Unit tests: `test/grid-cell-composite.test.ts` (fade by weight, edge half, no read-back drift, SRC back on release, tone-only
untouched).

## 2. Signal's dark left-horizon strip: the void floor, by design (taste item)

`PROBE=4` on grid B, left horizon band. Hiding `/grid-void` turns the black strip into Signal's pink horizon mountains.
Hiding the neighbour cell `blender-template-1` removes the lavender slab under it. The strip is G89's VR void floor (black,
cyan grid lines, `voidLook.ts`) past the outer rail: Signal sits on the grid's edge, so looking outward you see the void to
the horizon, and it covers the foot of Signal's own far mountains. No seam, skirt, sky-dome gap or depth bug. Board
`sunscar-dunes-horizon.jpg` for Jake: the frame's design, not changed.

## 3. The template's SHARD SELECT shot

The slug is `_template` (`?chunk=template` was never a shard, hence Driftwood). The template is a Developer-only card
on SHARD SELECT that is shardfile only: LEGACY is disabled and SHARDFILE enters it. `capture.mjs` now takes that path. The
deck's track captures the pointer for its swipe, so the card is tapped through its own click listener.
`template-board.jpg`: same pose, same grey-box yard and orange 2×3 test boxes in all three. The differences are these.
- The grid shows neighbours' far proxies on the horizon. That is by design.
- The grid has the grid loadout's HUD: no JOURNAL, LANTERN or ATTACK. That is equipment.
- Standalone has a grey block at the lower left, a dark diagonal at the right and the Grey blob creature with its label.
  The `template-2` cell does not show these at this pose. That is untraced: likely `template-2` is a seeded grid copy
  (`copyLayout.ts`) and not the canonical template layout, or the cell runtime does not spawn the template's creatures.

## Not done

- The frame floor with the row on for Nine (desktop / Simulator): no window free of quiet and of pending pushes before
  the lane's cap.
- Item 3's prop and creature difference is not traced.
