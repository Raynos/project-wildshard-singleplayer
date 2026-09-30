# Round 1 · Driftwood's first-person sword, hands and swimming hands: the remaster (E334)

Jake, 2026-09-30: "I want to remaster and improve the first person view of the sword and the hands as well as the
swimming animation hands. The Blender first person weapons and hands for Nine Dragon is like two or three steps above
what we have here." This round is research plus three decision boards. No game code changed.

## The boards

| File | What |
|---|---|
| `board-1-today-vs-nine-dragon.jpg` | Live captures of build `6ca63ec` (iPhone 16 Pro portrait, 402×874 @3×, touch, phone tier, muted, HUD hidden). A–E are Driftwood: wooden sword idle and mid-swing, iron sword idle and mid-swing, the swimming hands. F–H are Nine Dragon: idle and two mid-swing frames. |
| `board-2-sword-and-hands.jpg` | "How should Driftwood's remastered sword + hands look?" Four codex `image_gen` edits of the live wooden-sword idle frame (A castaway, B sailor, C adventurer, D the Nine Dragon rig re-coloured), plus the recommended look holding the iron sword. |
| `board-3-swimming-hands.jpg` | "How should the swimming hands look?" Three codex edits of a live swimming frame in the castaway look: A breaststroke, B front crawl, C dog-paddle. |

The per-variant frames are also saved as `b2-*.jpg` and `b3-*.jpg`, and the live captures as `live-*.jpg`.

## Nine Dragon's viewmodel: what it is

- **Blender parts, then a baked rig.**
  - Headless Blender scripts (`scripts/blender/nine-dragon-stack/viewmodel/`) model the right hand, arm, left fist and
    gauntlet, and bake their AO / curvature / detail maps and object-space normal maps.
  - A three.js bake in the old lab page (`rig/bake.ts.txt`, recovered from transcripts on 2026-09-29) adds the skeleton,
    the skin weights, the ink hulls and 16 clips. The result is one skinned GLB,
    `public/assets/nine-dragon/viewmodel/fp-rig.glb` (2.48 MB, 14 skinned meshes).
  - The rig per arm is shoulder → upper arm → forearm → 3 twist bones → hand → weapon (or claw). It has **no finger
    bones**: the fingers are skinned rigidly to a hand posed round the grip.
  - The 16 clips are idle, walk, light ×3, charge, heavy, parry, sheathe, draw, sheathed, idleL, walkL and the grapple's
    aim / fire / hold. They are authored as weapon paths with two-bone IK, on the engine's `SwordMoves` timing. The rig
    gate (round 13) passes 778 frames with no snaps.
- **Look.** One toon `ShaderMaterial` shades by material class (brass, steel, lacquer, matte) from the baked maps. An
  inverted-hull ink outline, a Verlet tassel and talisman (`cloth.ts`), and a dry-brush sword trail (`trail.ts`) sit on
  top.
- **How it plugs in.** `ChunkDef.sword` returns a `ShardSword` whose `arms` is a `SwordArms`
  (`src/player/Sword.ts:106`: `root`, `play(move)`, `update(dt, …)`, `blade(base, tip)`). `Sword.useArms` hides the
  code rig and draws the arms after a depth clear (a 0.001 m box at renderOrder 999 that calls `clearDepth()`).
  `vm/arms.ts` gives the arms their own 70° projection by scaling the root by `tan(worldFov/2) / tan(35°)`, so FOV kicks
  leave the arms still. The rig is marked `treatAsOpaque` so the AO pre-pass skips it.
- **Cost.**
  - About 214k triangles: 147k body, 62k hull, plus the cloth.
  - 23 draw calls and about 0.3 GPU ms on the M5 Max.
  - It ships 4.95 MB: 2.48 MB GLB and 2.47 MB of maps.
  - On the phone tier only the maps change (`.phone.webp`, 0.73 MB total) and the decal atlas halves. Geometry, hull and
    cloth are the same on every tier.

## Driftwood today

- **The sword and hands** (`src/player/Sword.ts` `buildSword()`, lines 252–313) are built in code:
  - a hexagonal lofted blade and a bar guard;
  - each hand is a rounded 2×1×2 box "fist" with four finger-ridge boxes and a thumb box;
  - each forearm is a 7-sided tube: skin wrist → cuff lip → cream sleeve.
- **Material and cost.** It is merged into 2 meshes (about 0.8k triangles) with flat `MeshStandardMaterial` vertex
  colours and no textures.
- **Animation.** Code keyframes in `SwordMoves.ts`, three keys per move. The arms are a rigid group that takes 45 % of
  the sword's rotation, "a cheap elbow". There is no skeleton and no off hand.
- **The iron sword** is the same rig with a grey blade (`IronSword.ts` is only the pickup). Driftwood's `ChunkDef` has
  no `sword` entry, so it gets the default.
- **The swimming hands** (`src/player/Hands.ts`) are white mitten gloves ("no finger detail by design") on a cylinder
  cuff and sleeve, 7 segments on the low-poly style. The wrists follow a CatmullRom breaststroke loop with the elbow
  fixed off screen. On the phone the sleeves read as grey slabs (board 1, E).

## What Nine Dragon has that Driftwood lacks

- A hand that wraps the grip: posed fingers and a thumb, knuckles, and a wrist that bends.
- A real elbow and forearm twist, so the arm bends through a cut instead of turning as one piece.
- An off hand in frame.
- 16 authored clips with crossfades, against three code keys per move.
- Secondary motion (the tassel cloth), an ink outline and material classes.

Driftwood's whole viewmodel costs about 1/250th of Nine Dragon's in triangles, and 2 draws against 23.

## What a Nine Dragon-grade rig for Driftwood would take

1. **Reuse the skeleton and clips, not the meshes.** Import `fp-rig.glb` into Blender. Keep its armature and its 16
   actions (they already run on `SwordMoves` timing, so Driftwood's combat timing is unchanged), and delete the jian,
   gauntlet and claw meshes.
   - Add **finger bones** (3 per finger plus the thumb), which Nine Dragon lacks, so a grip pose and a swim pose can
     share one hand.
   - Re-author the left arm's rest: Driftwood's off hand is empty, with no claw.
   - The wooden and iron swords are two meshes on the `R_weapon` bone, both kept.
2. **Driftwood meshes in its own style.** Faceted low-poly hands, forearms and sleeves in flat vertex colours (the island
   palette, no texture maps), plus an optional thin inverted-hull outline.
   - Budget on the phone tier: **≤ 12k triangles, ≤ 4 draws** (arms, sword, outline, trail), a GLB **≤ 400 KB** with
     meshopt, and 0 texture bytes.
   - That is about 1/18th of Nine Dragon's triangles and 1/12th of its bytes: a toon island does not need 102k skinned
     vertices.
3. **Plug in through the existing seam.**
   - Move `vm/arms.ts` + `fpArms.ts`'s mixer player out of `src/chunks/nine-dragon-stack/` into a shared
     `src/player/rigArms.ts`.
   - Give Driftwood's `ChunkDef` a `sword: async () => rigArms('driftwood')` entry, which keeps the depth clear and the
     70° projection.
   - Drop the ND-only parts: cloth, claw and the neon spill.
4. **Swimming on the same rig.** Add three clips to the same GLB: `swimStroke` (the picked stroke, looped, with its phase
   driven by `Player`'s `STROKE_PERIOD` as today), `swimTread` (sculling when still) and `swimIn` / `swimOut`. Then
   `Hands.ts` becomes a thin player of those clips on the sword rig with the weapon hidden, in place of its own meshes.
   One set of hands, the same sleeves, in and out of the water.
5. **Gate it like round 13.** Run the rig gate (joint limits, no snaps), a phone-tier capture board, and an iPhone
   memory check before it ships.

## The variants and the recommendations

- **Board 2**, the sword and hands:
  - **A castaway (recommended)**: rolled, patched linen sleeves, sun-browned hands, and a hemp-cord grip with a knotted
    tail. It is Driftwood's shipwreck story, and the same sleeves carry into the water (board 3).
  - **B sailor**: navy-and-white striped cuffs, a fingerless leather glove, and a tarred-rope hilt with a turk's-head
    knot.
  - **C adventurer**: a laced leather bracer over a moss-green sleeve, and a bare open off hand held out for balance.
  - **D the Nine Dragon rig re-coloured**: a teal-wood gauntlet with brass bands, a canvas glove and a red tassel. It
    reads heavy and foreign on a castaway island.
  - **A2** is A holding the iron sword.
- **Board 3**, the swimming hands:
  - **A breaststroke (recommended)**: today's stroke and pacing, both hands always in view, and one mirrored clip on the
    rig.
  - **B front crawl**: one arm reaching out of the water; the other hand is often hidden under the surface.
  - **C dog-paddle**: playful, but it reads as struggling.
- **Build route (recommended):**
  - Import `fp-rig.glb`'s armature and 16 clips into Blender, add finger bones, and model the castaway arms and both
    swords as flat-colour low-poly meshes (≤ 12k tris, ≤ 4 draws, ≤ 400 KB, no maps).
  - Add `swimStroke` / `swimTread` clips to the same GLB.
  - Share ND's `SwordArms` player as `src/player/rigArms.ts`.
  - Driftwood's `ChunkDef.sword` plays it, and `Hands.ts` plays the swim clips on it.

The codex runs used `-m gpt-6-sol` through a scratchpad copy of `scripts/horizon-matte/run_codex.py`. All 8 were first
takes, and none was re-rolled. Each one removed the ring at the top right of the live frame, as its prompt asked.
