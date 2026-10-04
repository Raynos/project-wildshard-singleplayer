# settings / round-2-new-game: New game per shard (V15)

**Question: where does pause ▸ Settings put a per-shard New game, and how is it confirmed?** (Jake, E439 / SF33b: reset one shard's quests, inventory and flags; the profile and other shards stay.) Each variant: **-1** the row, **-2** its confirm.

| File | What it shows |
|---|---|
| `A-row-per-shard-1.jpg / -2.jpg` | A "SAVES" section with a row per shard ("DRIFTWOOD ISLE · 3 QUESTS · 12 ITEMS", "NEW GAME"); a centred dialog "NEW GAME — PINE HOLLOW?" with "CANCEL" / "RESET PINE HOLLOW" |
| `B-current-shard-hold-1.jpg / -2.jpg` | One row "NEW GAME — DRIFTWOOD ISLE" with "RESET" for the shard you are in; a hold-to-confirm dialog "START OVER ON DRIFTWOOD ISLE?" with "HOLD TO RESET" and "CANCEL" |
| `C-save-cards-sheet-1.jpg / -2.jpg` | A "SAVES" section of shard cards (picture, "QUESTS 2 / 5", items, "NEW GAME"); a bottom sheet with before → after: "QUESTS 1 / 4 → 0 / 4", "INVENTORY 4 ITEMS → EMPTY", "KEPT: PROFILE, FEATS, OTHER SHARDS" |
| `board.jpg` | The pick board: A / B / C side by side |

**Recommended:** **B**: you reset the shard you are standing in, one row with no list of six template copies, and hold-to-confirm stops a mis-tap on the phone.

**How they were made** (ask E438, SHARD-PLATFORM mockups, 2026-10-04): codex `image_gen` edits of fresh iPhone 16 Pro portrait captures (402 × 874 @3×, muted, through the browser lane) of a `serve-build.sh --head` build of `3d06668e4` (the live deploy is 251 commits behind and has no grid entry). Every UI string was quoted in the prompt. 1024 × 1536 frames, JPEG q88. Mockups only: nothing here is built.
