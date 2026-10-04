# menu / round-5-grid-arrival: entering the grid (V10)

**Question: what do you see between tapping EXPERIMENTAL Wildshard and playing?** The loading screen and the first frame.

| File | What it shows |
|---|---|
| `A-loading-grid-map.jpg` | A loading card "ENTERING THE GRID": the 3 × 3 map fills in cell by cell (Driftwood READY, Pine Hollow 62 %, the rest QUEUED), "LOADING 2 / 9 CELLS · 340 MB", "SELECT A SHARD IF THIS FAILS" |
| `B-sky-down-reveal.jpg` | A sky-down reveal mid-descent onto Driftwood's pier, the highway ring and the neighbours visible; strip "EXPERIMENTAL WILDSHARD / DRIFTWOOD ISLE", "TAP TO SKIP" |
| `C-straight-in-toast.jpg` | Straight in at Driftwood's pier with the normal HUD and a one-line "EXPERIMENTAL WILDSHARD" toast under the quest chip |
| `board.jpg` | The pick board: A / B / C side by side |

**Recommended:** **A**: it shows true progress where memory is the risk (G58), names the way back, and needs no camera sequence.

**How they were made** (ask E438, SHARD-PLATFORM mockups, 2026-10-04): codex `image_gen` edits of fresh iPhone 16 Pro portrait captures (402 × 874 @3×, muted, through the browser lane) of a `serve-build.sh --head` build of `3d06668e4` (the live deploy is 251 commits behind and has no grid entry). Every UI string was quoted in the prompt. 1024 × 1536 frames, JPEG q88. Mockups only: nothing here is built.
