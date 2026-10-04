# hud / round-22-script-error: what the player sees when a shard's script breaks (G115, SF11b; ask E449 M5)

**Question: when a shard's script is switched off after three strikes, what message does the player get?**

SF11b (built, `bcd993e65`): a trapping script instance is discarded and its last good snapshot restored; its entity
freezes and stops being interactive; a repeat offender (three strikes) is disabled. Today only a dev-only toast names
it. G115 asks for a player-visible message before outside authors ship scripts. All four frames are codex `image_gen`
edits of fresh live captures of Driftwood Isle (HEAD `0d6129b`, `serve-build.sh --head`, agent-browser as an iPhone
16 Pro, muted): the pier with the wooden sword, the pause menu, and the bag's MAP page. The broken thing in the story
is a door script, `door.wasm`.

| File | Variant | What it shows |
|---|---|---|
| `A-toast.jpg` | **A: a small toast** | One toast stacked under the quest chip (where quest and achievement pop-ups go, round 10), amber hairline and a warning triangle: "SOMETHING IN THIS SHARD" / "STOPPED WORKING". Shown once, then gone |
| `B-pause-line.jpg` | **B: pause + journal**, part 1 | No toast in play. The pause menu gets a notice row under "PAUSED / DRIFTWOOD ISLE": "SOMETHING IN THIS SHARD STOPPED WORKING" / "ONE THING HERE IS PAUSED · YOUR SAVE IS SAFE" |
| `B-journal-note.jpg` | **B**, part 2 | The bag's MAP page (the shard's quest journal) gets a card under the quest: "SHARD NOTE" / "Something in this shard stopped working" / "A door near the plateau stays shut. Your save is safe." |
| `C-dev-banner.jpg` | **C: quiet for players** | Players see nothing (the door is just stuck). With Settings ▸ Developer on, a red strip under the coin counter: "DEV" "SCRIPT DISABLED · door.wasm · out of fuel ×3" |
| `board.jpg` | | The pick board: A, B (pause), B (journal), C |

**Recommended: A, with C's banner kept for Developer mode.** A frozen door with no word is the worst case: the
player thinks the quest is broken or that they missed something. A one-time toast says it in the moment, costs one
line of HUD that already exists for pop-ups, and needs no new screen. B only reaches players who open pause or the
bag, after they are already stuck. C is G115's Part A state (silent for players) and stays useful as the Developer
readout in any variant: SF11b's dev-only toast can become this banner.

Strings to build (quote exactly): "SOMETHING IN THIS SHARD STOPPED WORKING"; for B also "ONE THING HERE IS PAUSED ·
YOUR SAVE IS SAFE", "SHARD NOTE"; for C "SCRIPT DISABLED · <module> · <reason> ×<strikes>".

Source captures (not committed): Driftwood pier, pause menu and bag MAP page from HEAD `0d6129b`, 2026-10-04. Frames
are 852 × 1846 JPEG q86; no frame needed a re-roll. Mockups only: nothing here is built; a HUD change goes over herdr
first (E332).
