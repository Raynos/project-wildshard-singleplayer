# menu / round-6-needs-upgrade: an older shardfile's card (V14)

**Question: how does a Select a shard card look for a shardfile from an older version** (§3.4: "needs upgrade"; source and saves untouched)? "CORAL DEPTHS" is a made-up outside-author shard.

| File | What it shows |
|---|---|
| `A-dimmed-badge.jpg` | The card picture desaturated, an amber "NEEDS UPGRADE" badge where "LOADED" sits, subtitle "BUILT FOR SHARDFILE V0"; the button disabled: "NEEDS UPGRADE" / "YOUR SAVE IS KEPT" |
| `B-band.jpg` | A solid navy band across the picture "NEEDS UPGRADE" / "V0 → V1"; the button becomes "HOW TO UPGRADE" / "WILDSHARD UPGRADE · SAVE KEPT" |
| `C-info-panel.jpg` | The card face becomes an info panel: "NEEDS UPGRADE", "BUILT FOR SHARDFILE V0", "THIS GAME RUNS V1", "SAVE KEPT · NOTHING DELETED", link "RUN: WILDSHARD UPGRADE"; button "ENTER WORLD" / "UPGRADE FIRST" disabled |
| `board.jpg` | The pick board: A / B / C side by side |

**Recommended:** **A**: the card stays recognisable, one badge plus a disabled button says it, and the save line removes the worry.

**How they were made** (ask E438, SHARD-PLATFORM mockups, 2026-10-04): codex `image_gen` edits of fresh iPhone 16 Pro portrait captures (402 × 874 @3×, muted, through the browser lane) of a `serve-build.sh --head` build of `3d06668e4` (the live deploy is 251 commits behind and has no grid entry). Every UI string was quoted in the prompt. 1024 × 1536 frames, JPEG q88. Mockups only: nothing here is built.
