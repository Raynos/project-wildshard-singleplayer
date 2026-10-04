# hud / round-19-ui-kit: one platform UI kit (V16)

**Question: what one style do the platform panels (SF28: quest panel, trader / shop panel, counter, toast, map marker) take?** Pine Hollow's trader Mott, with the trader panel, the quest chip, the bolts counter, a "+10 BOLTS" toast and a marker. Reference: the HEAD build at Mott's stall with his dialogue open. HUD mockup only: a real change goes over herdr (E332).

| File | What it shows |
|---|---|
| `A-tightened.jpg` | Today's language tightened: a compact docked trader panel ("MOTT · TRADER", BUY / SELL tabs, rows with prices, "BUY"), the usual quest chip, a small toast and a "TRADER" marker |
| `B-big-cards-accent.jpg` | Larger cards in Pine Hollow's moss-green accent: big item tiles ("BOLTS ×10 · 15", "PELT · SOLD OUT", "RESIN · 8"), a wide "BUY BOLTS ×10 · 15", a two-line quest card |
| `C-text-first.jpg` | Minimal text-first: no boxes, a dotted price list on a dark scrim, the quest chip as plain text, a plain-text toast |
| `board.jpg` | The pick board: A / B / C side by side |

**Recommended:** **A**: one HUD across shards (E332), and earlier HUD reskins were judged no better than the game (E122); A only tightens what is already there.

**How they were made** (ask E438, SHARD-PLATFORM mockups, 2026-10-04): codex `image_gen` edits of fresh iPhone 16 Pro portrait captures (402 × 874 @3×, muted, through the browser lane) of a `serve-build.sh --head` build of `3d06668e4` (the live deploy is 251 commits behind and has no grid entry). Every UI string was quoted in the prompt. 1024 × 1536 frames, JPEG q88. Mockups only: nothing here is built.
