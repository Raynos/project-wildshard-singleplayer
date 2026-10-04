# hud / round-21-crossing-storyboard: crossing out of one shard and into the next (G78, G82, G87)

**Question: when and where does the next shard announce itself as you cross Driftwood → boulevard → Pine Hollow?**
A four-frame storyboard read left to right, in two timings. Frames 1 and 2 are the same in both rows: inside Driftwood
with the sword and the HUD in Driftwood's accent (05 MARIGOLD), then the border with the shimmer line on the ground and
the sword stowing. On the boulevard (frame 3) you have bare hands, ATTACK is dimmed and a "SAFE ZONE" chip sits above it.
The HUD there is the reserved road colour: the HUD's own cyan `#8fe3ff`, as recommended in round 20. Frame 4 enters Pine
Hollow with the crossbow equipped and the HUD in Pine's accent (08 MOSS). The title card uses Pine's real biome line,
"BOREAL PINE FOREST".

| File | What it shows |
|---|---|
| `1-driftwood.jpg` | Frame 1: Driftwood's pier, the wooden sword, "ATTACK" / "HOLD = HEAVY", every HUD accent in MARIGOLD `#fbbb2d` |
| `2-border.jpg` | Frame 2: the sand path meets the boulevard; a thin cyan shimmer line lies across it at the border; the sword slides out of view and "ATTACK" is half faded; the HUD is still MARIGOLD |
| `3A-boulevard.jpg` | Frame 3, timing A: on the asphalt boulevard, hands empty, "ATTACK" dimmed, the "SAFE ZONE" chip above it, the HUD cyan, a green "PINE HOLLOW" sign at the turn-in |
| `3B-boulevard-next.jpg` | Frame 3, timing B: the same frame plus a slim "NEXT: PINE HOLLOW" chip with a moss-green bar under the quest chip |
| `4A-pine-title-centre.jpg` | Frame 4, timing A: Pine Hollow, the crossbow, MOSS `#89c06a` HUD, a centred title card "PINE HOLLOW" / "BOREAL PINE FOREST" |
| `4B-pine-title-compact.jpg` | Frame 4, timing B: the same, with a compact title card high up, under the quest chip |
| `board.jpg` | The pick board: row A (1, 2, 3A, 4A) and row B (1, 2, 3B, 4B) |

**Recommended: A.** G68 asks for a quiet crossing, and A keeps the road free of any new UI apart from the "SAFE ZONE"
chip. The centred card is one clear moment, timed with the crossbow appearing. B's "NEXT" chip repeats the green road
sign that already stands at every turn-in (G80). B's compact card is easy to miss next to the quest chip.

**How they were made** (ask E438, SHARD-PLATFORM mockups, 2026-10-04): codex `image_gen` edits. Frames 1 and 4 edit
fresh captures from the HEAD build `5ab6a3c08` (`serve-build.sh --head`), taken as an iPhone 16 Pro (402 × 874 @3×),
muted, through the browser lane: Driftwood with the sword, Pine Hollow with the crossbow. Frames 2 and 3 combine the
live Driftwood HUD capture with the G80 boulevard (`art/grid/round-10-asphalt/B-boulevard.jpg`). Every UI string was
quoted. The frames are 1024 × 1536, JPEG q88, and no frame needed a re-roll. These are mockups only: nothing here is
built, and a real HUD change goes over herdr first (E332).
