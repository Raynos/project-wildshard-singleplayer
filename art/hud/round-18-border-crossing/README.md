# hud / round-18-border-crossing: crossing a shard border (V11)

**Question: what tells you that you've entered the next shard?** Per G68 the highway and no-man's land are a safe zone: bare hands, the weapon stowed silently on leaving a shard, the next shard's weapon (Pine Hollow: the crossbow, "FIRE") equipped on entry, no toast. Each variant has two frames: **-1** on the highway (hands, action button "HANDS") and **-2** the entry into Pine Hollow (crossbow). The highway look is a stand-in (the world agent owns it). HUD mockup only: a real change goes over herdr first (E332).

| File | What it shows |
|---|---|
| `A-title-card-1.jpg / -2.jpg` | A centred title card "PINE HOLLOW" / "PHOTOREAL PINE FOREST" on entry; the highway frame has no extra UI |
| `B-slim-banner-1.jpg / -2.jpg` | A slim banner under the quest chip: "HIGHWAY · SAFE ZONE" on the road, "ENTERING PINE HOLLOW" / "CROSSBOW EQUIPPED" on entry |
| `C-rim-and-chip-1.jpg / -2.jpg` | Only the minimap rim recolours (grey on the highway, moss green in Pine Hollow) and the quest chip leads with the place: "HIGHWAY | …", "PINE HOLLOW | FIND THE RANGER" |
| `board.jpg` | The pick board: A / B / C side by side |

**Recommended:** **C**: G68 says silent and no toast; the weapon appearing in your hands is the event, and C adds no new HUD element.

**How they were made** (ask E438, SHARD-PLATFORM mockups, 2026-10-04): codex `image_gen` edits of fresh iPhone 16 Pro portrait captures (402 × 874 @3×, muted, through the browser lane) of a `serve-build.sh --head` build of `3d06668e4` (the live deploy is 251 commits behind and has no grid entry). Every UI string was quoted in the prompt. 1024 × 1536 frames, JPEG q88. Mockups only: nothing here is built.
