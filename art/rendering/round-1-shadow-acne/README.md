# rendering / round-1-shadow-acne: the receiver-plane shadow bias (E435)

Real in-game captures (Chromium as an iPhone 16 Pro portrait, muted, phone tier, Developer on), one build, the two
choices of pause ▸ Settings ▸ Debug ▸ Look ▸ **Shadow bias** (New is the default, Old is the plain filter).

| Row | What it shows |
|---|---|
| 1 | Blender Template, hall front from the spawn: the regular light / dark bands on the big clay wall and floor are gone |
| 2 | Blender Template, a hub marker from the side: its cast shadow keeps the same shape and stays on the marker's foot |
| 3 | Pine Hollow, the spawn trail: photoreal PBR on the plain filter, the tree shadows on the trail unchanged |
| 4 | Driftwood Isle, the pier: on the phone it keeps its own tent filter (which already had the bias), unchanged |

**Cause.** three r186's PCF compares each of its 5 Vogel taps, up to `shadow.radius` (2) texels away, against the
fragment's own depth. On the phone tier's one 1024² cascade (≈ 12.6 cm a texel) a flat face under a 40° sun changes
depth by ≈ 0.3 m across the disc, against 7 cm of depth bias and 5 cm of normal bias: the outer taps land under the
surface itself. Measured live: radius 0 removed the bands; a larger constant bias would only lift contact shadows.

**Fix** (`src/engine/world/shadowFilter.ts`, `src/engine/render/nodes/planeBiasShadowFilter.ts`): each tap compares
against the receiver's depth moved along its own plane to the tap (the depth slope from the screen derivatives of the
shadow coordinate), only toward the light. Same taps, kernel and noise, so every shard's penumbra keeps its look. No new
draws, maps or memory; desktop tier 60 fps old and new on Driftwood and Blender Template.

**Not shadows:** the thin dashed lines on far Blender Template decks (seen from the bridge) are the same in both
choices: coplanar faces in the world GLB, not acne.
