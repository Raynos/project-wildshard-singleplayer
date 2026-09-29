# Round 9: Model Explorer studio light, bolts that ride the dummy (E289, 2026-09-29)

Live local dev build, headless Chromium on Metal, iPhone portrait 390 × 844 at 3×, the 18-bone GLBs.

| File | What it shows |
|---|---|
| `model-explorer-driftwood.jpg`, `model-explorer-pine-hollow.jpg` | Model Explorer ▸ Training dummy, the three variants on the turntable, lit by the arena's studio set (`src/practice/DummyStudio.ts`). The old emissive = base-map trick is gone (every dummy material reads emissive 000000) |
| `catalog-thumbnails-driftwood-pine-hollow.jpg` | The catalog card: the whole figure now fits the 4:3 thumbnail (it was cropped at the neck and the shins) |
| `crossbow-bolt-rides-pine-hollow.jpg` | A crossbow bolt stuck in the straw dummy's chest, 0.2 s into a charged-blow rock (left) and settled (right): it rides the Spine bone (the red dot is the traced bolt's nock) |
| `nine-dragon-catalog-before-after.jpg` | Nine Dragon's Model Explorer catalog: before (top strip, white silhouettes), after (the grid). The thumbnail render moved the camera but the shard's silk fog was still measured from the turntable's eye (`uCam`, set in the render grade's `frame()`), so every Nine Dragon material fogged out to white. `Game.shardFrame()` now runs before the thumbnail render |
| `bow-arrow-rides-nalati.jpg` | The same with Nalati's bow: the arrow tilts with the rocking torso and comes back with it |

Crossbow bolts used not to stick in a target at all; now they stick in a practice dummy (only there, through
`TargetAnimal.stuckFrame`). Arrows (Projectiles) rode the target's position and yaw; in a dummy they now ride the bone
they hit.
