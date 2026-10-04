# grid / round-16-fade-reload: what the player sees at a fade-reload shard exit (SF57b, G154 / G159; ask E449 M1)

**Question: which fade does SF57b use when the player leaves a shard onto the road with fade-reload on?**

SF57b (default-off behind the Debug row "Fade-reload at shard exits"; turned on only by a SF57 retention failure or a
tab kill in Jake's SF22c playtest): only **shard → road** exits reload. The traveller stands on the road deck past the
safe transfer line; G119's durable save completes ("SAVING…" on the shimmer line); a one-use handoff is written; motion
is held; a 250 ms fade; `location.replace`; the new page skips the menu and the reveal and fades in at the same road
pose with SAFE ZONE, hands and the hoverboard restored (§3.3's crossing table). Reload-to-playable is ≤ 3 s warm / ≤ 8 s
cold, so frame 3 is what the player looks at for those seconds.

Each variant is a 4-frame storyboard (Nalati → road) and a 3.2 s clip built from the frames. Frames 1 and 4 are shared.

| File | What it shows |
|---|---|
| `1-nalati-exit.jpg` | Frame 1 (all): inside Nalati Grasslands, painterly sky, the saber, the HUD in Nalati's accent EMBER `#fe8169`; the dirt road runs to the east exit, the boulevard crosses beyond it, a cyan shimmer line lies where dirt meets asphalt |
| `4-road-safe.jpg` | Frame 4 (all): faded back in on the boulevard at the same spot, bare hands, dimmed "ATTACK", the "SAFE ZONE" chip, HUD cyan (the road colour), Nalati's rise and warm sky on the right |
| `A-2-black-dip.jpg`, `A-3-reload.jpg` | **A: black dip.** The view and HUD dip ~85 % to black with one centred chip "SAVING…" and a progress hairline; during the reload, pure black with the chip "SAVED" |
| `B-2-grid-sweep.jpg`, `B-3-reload.jpg` | **B: VR-void grid sweep.** A bright cyan scan line wipes right to left, turning the road into the VR void (black floor, cyan grid, rail; G89's language), "SAVING…" on the line; during the reload, only the void grid, no HUD |
| `C-2-leaving-card.jpg`, `C-3-reload.jpg` | **C: "LEAVING" title card.** The view dims and G82's border title card appears: "LEAVING" / "NALATI GRASSLANDS" / "SAVING…"; during the reload the card is held on black with "SAVED" |
| `A-black-dip.jpg`, `B-grid-sweep.jpg`, `C-leaving-card.jpg` | Each variant's 4-frame storyboard strip |
| `A-black-dip.mp4`, `B-grid-sweep.mp4`, `C-leaving-card.mp4` | 3.2 s, 540 × 1170, H.264: 1 (0.9 s) → 2 → 3 → 4 (1 s), 0.25 s transitions (A and C fade through black, B wipes) |
| `hold-save-failed.jpg` | The save failed: the player is held on the road just before the line, the MOVE stick greyed out, an amber chip "SAVE FAILED, RETRY" over the shimmer line; no fade, no reload, the world stays visible |
| `board.jpg` | The pick board: rows A / B / C, columns 1–4 |

**Recommended: C.** The reload lasts 3–8 s whatever we draw, and C turns that wait into a deliberate beat: the
player reads where they are leaving, in the card they already know from entering shards (G82), with the save state
inside it. It needs no new UI, and the new page can redraw the same card from the handoff in its boot HTML before any
script runs, so the card never blinks. A is the cheapest fallback and honest, but 3–8 s of black with a tiny chip reads
as a crash. B is on-theme, but a full-screen grid held for seconds looks like a loading screen and must be drawn by
the new page before three.js is up.

How they were made: codex `image_gen` edits of real captures: `progress/e319-hud/rules-nalati-1-explore.jpg` (Nalati
with the HUD), `progress/shard-platform/grid-hud/safe.jpg` (the boulevard with the "SAFE ZONE" chip, a real grid
capture), `grid-hud/title.jpg` (G82's card as built), `art/grid/round-12-vr-void/A-tron-grid-rail.jpg` (G89's void).
Frames 2 and the hold frame were then re-rolled from frame 4 so the road scene matches across the storyboard (the first
takes still showed Driftwood's white cliff; C's first take garbled the fps chip; A's second take dropped a dot of
"SAVING…"). Frame 1 shows no fps chip or coin counter because the Nalati source capture had none. Frames are
852 × 1846 JPEG q86. Mockups only: nothing here is built; a HUD change goes over herdr first (E332).
