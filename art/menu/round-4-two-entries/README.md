# menu / round-4-two-entries: the title's two entries (V9)

Today's build drops two half-transparent "SELECT A SHARD" / "EXPERIMENTAL WILDSHARD" buttons on top of the shard cards (`progress/shard-platform/sf21a/title-shipped-dev-on.jpg`). **Question: where should the two entries (G58) sit?** The experimental entry still shows only with Settings ▸ Developer on (G61 / G63). Reference: the HEAD build's title.

| File | What it shows |
|---|---|
| `A-two-tabs.jpg` | Two equal tabs "SELECT A SHARD" | "EXPERIMENTAL WILDSHARD" above the carousel; Select a shard active; ENTER WORLD "LOADS DRIFTWOOD ISLE" |
| `B-hazard-card.jpg` | No tabs: primary ENTER WORLD for the centred card, and a hazard-striped "EXPERIMENTAL / WILDSHARD" card as the last card of the carousel (last dot amber) |
| `C-segmented-switch.jpg` | A segmented switch under the logo, shown in EXPERIMENTAL mode: the carousel becomes a small 3 × 3 grid preview with cell names; button "ENTER WILDSHARD" / "STARTS AT DRIFTWOOD ISLE" |
| `board.jpg` | The pick board: A / B / C side by side |

**Recommended:** **A**: both entries visible at once at equal weight, nothing covers the cards, and with Developer off the tab bar simply goes away.

**How they were made** (ask E438, SHARD-PLATFORM mockups, 2026-10-04): codex `image_gen` edits of fresh iPhone 16 Pro portrait captures (402 × 874 @3×, muted, through the browser lane) of a `serve-build.sh --head` build of `3d06668e4` (the live deploy is 251 commits behind and has no grid entry). Every UI string was quoted in the prompt. 1024 × 1536 frames, JPEG q88. Mockups only: nothing here is built.
