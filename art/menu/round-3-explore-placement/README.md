# menu / round-3-explore-placement (2026-09-25, ask E137)

The user, on the iPhone title screen: "I don't like this UI. Below the image I want one big banner that says ENTER
WORLD. And then the explore world has to go somewhere else. Give me three mockups of where else you would put the
explore world UI."

Every frame is the user's own iPhone screenshot of the live title (build `6e3ebff`, 1206×2622). All three share the
change the user asked for: the two side-by-side buttons are gone, and **one ENTER WORLD banner** spans the card's
width under the dots. It is dark navy glass with a cyan hairline and corner brackets, the sword glyph, and "PLAY ·
DRIFTWOOD ISLE" under it. Only where EXPLORE WORLD goes differs (amber, Explore's colour, with the eye glyph).

| File | Placement | Why there |
|---|---|---|
| `A.jpg` | **On the shard card.** An amber "EXPLORE" chip in the card image's top-left corner, the twin of the LOADED tag | Explore is per shard (`ChunkDef.explore`), so the entry lives on the shard. It swipes with the card and is simply absent on a shard that has no Explore. The smallest footprint of the three |
| `B.jpg` | **Top-right header**, under the build/reload chip: "EXPLORE WORLD" / "FLY · INSPECT" | Out of the thumb zone, so it can't be hit by accident. It reads as a side mode, like a photo mode, not a second way to play. It mirrors the wordmark on the left |
| `C.jpg` | **Footer row**, as a peer: "SETTINGS · EXPLORE WORLD · SOUND ON" | It stays one tap below the banner in the same thumb zone, but at utility size, so ENTER WORLD is clearly the one big action |
| `board.jpg` | The pick board: A / B / C side by side, each with a zoom on the Explore spot | |

**How they were made.** The old button row and footer were removed with a push-pull fill of the surrounding
blurred backdrop. Qwen-Image-2.1 inpaint was tried first (2 seeds), but it left a visible colour-shifted rectangle.
The banner, the Explore controls, the footer, the dots and the home bar were then drawn as HTML in the game's own
fonts (Rajdhani 700, JetBrains Mono) and CSS tokens from `src/ui/styles/menu.css`. They were composited at 402×874
@3× with Playwright, so every string is crisp and verbatim. No AI text was used.
