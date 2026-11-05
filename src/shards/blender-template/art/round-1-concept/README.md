# blender-template / round-1-concept: the Blender Template's look and layout (SF55, G161 / G162, ask E449 M3)

**Question: which look should the Blender Template (slug `blender-template`, the eighth shard) have?** G161 fixes what
the level must contain: an overhang or bridge, one enterable interior, a textured material, a midpoint entry cut
through a rise over 14 m, and a playable loop (a door, one creature type, a two-step quest, a reward). It says nothing
about the art. All three variants show the same spot so only the look differs: the near end of the stone bridge over
the 6 m gap, a stone beetle on the bridge, the hall and its double door across the gap, the chest, and the entry cut
through the rise behind on the left. Each one is an iPhone portrait gameplay frame with today's touch HUD, the quest chip
"THE OLD HALL | HALL DOOR 42 M" and the Developer chip "DEVELOPER ONLY · BLENDER TEMPLATE".

| File | What it shows |
|---|---|
| `board.jpg` | The pick board: A / B / C side by side |
| `A-dev-map.jpg` | **A, the dev map shared with Template 1** (SF56's measure look, `art/_template/round-2-dev-look/board.jpg`): orange structures, grey trim, a light-grey gridded floor, a white 1 m grid and "12x6", "4x3", "14x3", "8x16" metre labels. The beetle keeps its plain look |
| `B-clay-hero.jpg` | **B, Blender "clay" grey with one textured hero material**: everything is warm grey matcap-like clay with soft occlusion; only the hall's double door is a real texture (weathered wood, iron straps and rings) |
| `C-textured-ruin.jpg` | **C, a small textured ruin**: a mossy stone-block bridge over a rocky ravine with a stream, a ruined stone hall (shingle roof broken at one corner, an arched wooden door), a layered-rock cliff with a tooled-stone entry passage, sunny sky |
| `layout.jpg` | The 500 m cell from above, north up, labelled: the four midpoint entries (8 m opening + 15 m asphalt socket at y = 0), the west ridge (+24 m) with the **W entry cut** (8 m wide, walls 18–24 m, floor at y = 0), the 6 m gap, the **stone bridge** (the overhang: the loop walks back under it), **the hall** (enterable interior, textured door), stone beetles, and the loop: 1 spawn + quest board → 2 bridge → 3 hall door, step 1 "OPEN THE HALL DOOR" (the Blender door with a stable id; opening it changes collision) → 4 the interior, step 2 "DEFEAT 3 STONE BEETLES" → 5 the reward chest, "25 COINS", once → 6 back under the bridge along the gap floor (ramps at both ends). Faint lines show the 62.5 m L0 tiles |
| `card.jpg` | Its SHARD SELECT card in the round-10 style (`art/menu/round-10-continue-progress/E-calm-crisp-1.jpg`): teal `#54cec2` border and button, a "DEVELOPER" tag, "BLENDER TEMPLATE", "BLENDER TEST LEVEL, NO GENERATORS", "QUESTS 0/1", "FEATS 0", "ENTER WORLD", and an eighth thumbnail with an amber "DEV" tag, selected. The card picture uses look B (the recommendation) and follows whichever look Jake picks |

**Recommended: B.** It reads as Blender at a glance, so in the grid and in SHARD SELECT nobody can mistake it for
Template 1's orange dev map. The single textured door makes G161's "a textured material" the most visible thing on
screen, and that is the KTX2 path SF55a has to prove. It is also the cheapest for one Opus lane to author and keep
legible: one clay material plus one texture. A would hide what this shard exists to show. The measure look is a
shader-only layer driven by roles that Template 1's generators write into UV0, so a Blender author would have to paint
those roles by hand, and it still needs a separate real texture for G161. C looks the best, but it turns a reference
shard into a content job (tiling textures on every surface, more texture memory) and blurs "authored geometry + data"
into "an art pass".

**How they were made** (ask E449, 2026-10-04): codex `image_gen`, one take each, editing the real capture
`progress/shard-platform/grid-hud/pier.jpg` (iPhone portrait, today's HUD); A also took the B frame of
`art/_template/round-2-dev-look/board.jpg` as its style reference; the card edited
`art/menu/round-10-continue-progress/E-calm-crisp-1.jpg`. No re-rolls: no garbled text or HUD drift. Known drift: in
the three gameplay frames the teal HUD accent came out close to the default cyan (the card shows teal correctly), and
the gap under the bridge is only partly visible. The layout is a hand-drawn SVG sketch (`layout.jpg`; not to final
scale), not a generated image. Frames are 1024 × 1536 JPEG. These are mockups only: nothing here is built.
