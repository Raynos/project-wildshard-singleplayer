# minimap / round-2-grid-map: the 3 × 3 grid on the Map and the minimap (V12)

**Question: how do the pause Map tab and the minimap show the grid** (cell names, the highway, your cell, cells not yet loaded)? Each variant: **-1** the BAG ▸ MAP tab, **-2** the minimap on the highway north of Driftwood.

| File | What it shows |
|---|---|
| `A-tiled-schematic-1.jpg / -2.jpg` | Map: nine equal top-down tiles with names, the highway between, "YOU" outlined, unloaded tiles hatched "NOT LOADED". Minimap: local view with "PINE HOLLOW" / "DRIFTWOOD" labels inside the rim |
| `B-painted-fog-1.jpg / -2.jpg` | Map: one painted top-down world with the unloaded cells under fog and a tiny 3 × 3 key. Minimap: rim split into coloured arcs toward each neighbour |
| `C-schematic-list-1.jpg / -2.jpg` | Map: a small 3 × 3 schematic plus a list ("PINE HOLLOW · 410 M N · READY" …). Minimap: unchanged, with a tiny 3 × 3 chip beside it |
| `board.jpg` | The pick board: A / B / C side by side |

**Recommended:** **A**: cell state reads at a glance on both, and the tiles scale to a bigger grid unchanged.

**How they were made** (ask E438, SHARD-PLATFORM mockups, 2026-10-04): codex `image_gen` edits of fresh iPhone 16 Pro portrait captures (402 × 874 @3×, muted, through the browser lane) of a `serve-build.sh --head` build of `3d06668e4` (the live deploy is 251 commits behind and has no grid entry). Every UI string was quoted in the prompt. 1024 × 1536 frames, JPEG q88. Mockups only: nothing here is built.
