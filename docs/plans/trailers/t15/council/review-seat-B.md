# T15 council, round 2 — seat B review (E471)

Read: `ledger.md`, `selection.md`, `ideas.md` §"What made draft 1 look like AI", the four `*-notes.md`. Looked at all four
`*-sheet.jpg` and `board-draft1.jpg`. I could not play the videos: motion, pacing and sound are judged from the 1 fps
sheets and the notes, and I say so where it matters. "Phone" means the 1920-wide frame shrunk to a 6-inch portrait screen
held sideways (a sheet thumbnail is roughly that size, which is a fair test).

The sentence to land muted: **a world of shards, each built by a player with Claude Code.** Three parts: *many shards*,
*each by a player*, *Claude Code*. No variant lands all three before the end card; the end card's *Build it in Claude
Code.* rescues the third part for V2, V3 and V4.

## V1 · Prompt to glyphs

- **Reads muted: 3.** *Claude Code* lands hard (real terminal + *CLAUDE CODE BUILDS IT.*), but there is one island and no
  grid, no other player, no shard: a stranger reads "an AI tool makes a picture", not "a world of shards".
- **Not AI: 4.** The terminal is real and the glyph mosaic (8.5–9.5 s) is plainly designed. The 7.5 s particle cloud is
  the stock "disintegrate" effect, and the 10.5 s island is a clean, generic low-poly stock illustration; neither looks
  like draft 1.
- **Finish: 3.** No caption from 4.5 to 9.7 s, exactly while the screen is tiny code (5.5 s, 6.5 s are unreadable on a
  phone); the terminal fills only the top-left third (0.5–4.5 s); 0.5 s shows the idle hint `Try "how does <filepath>
  work?"` and 4.5 s a `/private/tmp/claude-501/…` scratch path; *CLAUDE CODE BUILDS IT.* stays ghosted under the URL
  12.5–14.5 s.
- **Memorable: 4.** Letters settling into the red-and-white lighthouse (8.5 s).

Fixes:
1. **4.5–9.7 s, caption gap + tiny type:** scale the terminal crop ~1.6× so the prompt line spans the frame, and bring
   *CLAUDE CODE BUILDS IT.* forward to ~6.5 s (as the glyphs lift) so there is never 5 s of unreadable code without words.
2. **12.5 s, ghost caption:** fade *CLAUDE CODE BUILDS IT.* out by 12.0 s; it fights the end card's URL line.
3. **0.5 s / 4.5 s, dev residue:** start on the first keystroke (cut the idle `Try …` hint) and redact the scratch path
   to `~/lighthouse-isle`; trim the 6.5 s "model names are my guesses…" paragraph, it reads as hedging when skimmed.

## V2 · The map that draws itself

- **Reads muted: 4.** The best muted read: one plot, a road around it, then a grid of plots in different hands and an
  empty *yours* — *many shards* and *each by a player* land without a word. *Claude Code* only arrives on the end card,
  and the cartouche line is small handwriting tucked bottom-left.
- **Not AI: 4.** Ink on paper, a pen drawing in order, a locked hand-made palette: nobody calls this "AI clips". Tells:
  several vignettes (mountain 4.5 s, forest 5.5 s, pagoda / ferris wheel 8.5 s) look like generated ink clip-art revealed
  by a wipe rather than drawn, and the "different hands" read as one blue-and-black ink style at phone size.
- **Finish: 3.** The vermilion centre dash — the "one constant line" — is invisible at sheet scale; roads read as grey
  graph-paper lines. *yours* is a red word without a visible dashed vermilion border (9.5 s shows only "you"). A blank
  rectangle (the cartouche) sits over the lower-left plots at 8.5 s like a missing tile. The cartouche finishes at
  11.35 s, 0.65 s before the end card dims it, and stays ghosted under it 12.5–14.5 s. Roundabout cut by the frame at 2.5 s.
- **Memorable: 4.** The finished sheet of plots with a red *yours* among them (11.5 s).

Fixes:
1. **9.9–11.35 s, cartouche:** write *Every shard / built by a player / with Claude Code.*, enlarge the cartouche ~1.6×,
   centre it low, start writing at ~8.5 s so it holds finished ≥ 1.5 s before 12 s; fade it before the end card.
2. **4–12 s, the highway:** double the road-edge weight and make the vermilion dash solid and saturated so the highway
   reads as the one constant line; draw the dashed vermilion border round *yours* before the word, at full weight.
3. **8.5 s, empty box over plots:** draw the cartouche frame only where it writes (or over margin, not over plots), and
   make the first signature (*@mara*, 2.5 s, while the camera is close) large enough to read — it is the only handle
   anyone will see.

## V3 · Postcards

- **Reads muted: 3.** *Many places on one road map* and *your world* read; *each by a player* does not — the *BUILT BY
  @…* strip is ~4 px on a phone. *Claude Code* is only hinted by the `>` prompt. Six plots, one taken by the legend, read
  as a sheet, not an endless grid.
- **Not AI: 3.** The thrown-card physics on a locked camera is designed and reads as made. The giveaway is inside the
  cards: Nine Dragon (5.5 s) is a dark blue neon tower in mist and Pine Hollow (4.5 s) a misty forest cabin — draft 1's
  generator taste in miniature, and no visible halftone or print palette at this size.
- **Finish: 4.** Cleanest type of the four: *your world* is big and legible (11.5 s), timing is even (a card every 1.6 s).
  The Pine Hollow card crosses the corner tag in flight (3.5 s); the end card's logo sits over busy, colourful cards.
- **Memorable: 4.** The blank card typing *greetings from: your world* (11.5 s).

Fixes:
1. **0.7–5.5 s, who built it:** make the handle the loudest thing on each card's bottom strip (≥ 3× the size, stamped
   or handwritten), or add the shared caption *EVERY SHARD BUILT BY A PLAYER.* at ~6 s.
2. **5.5 s, Nine Dragon card (and Pine Hollow):** regrade / repaint under the leave-out list (daylight, print palette,
   visible halftone) so all four cards share one printed look and none carries the neon-mist taste.
3. **8.15–10.4 s, the blank card:** head it with a small *Claude Code* line (the real UI's orange mark + name) above
   `> greetings from:`, so the prompt reads as Claude Code, not a generic terminal.

## V4 · The seam

- **Reads muted: 2.** At phone size this is a coastal road with grassland on one side and beach on the other — a real
  place. The style seam (painterly vs. faceted toon) needs a big screen and a second look; no cubes, no grid, no Claude
  Code until the end card, and *someone else* is vague.
- **Not AI: 2.** A centred empty road to a vanishing point under a soft sky is the stock / AI wallpaper composition.
  Photoreal asphalt beside semi-real grass and low-poly palms reads as a generator mixing renderers, not as an authored
  seam. The camera projection does avoid boiling, but from the sheet 0.5 s and 11.5 s are nearly identical (a 0.6 m push).
- **Finish: 4.** Tidy: one big readable caption, cleanly faded before the end card. But 0–5.2 s has no words and almost
  no visible motion, and the palm fronds collide with the corner tag top-right on every frame.
- **Memorable: 2.** A pretty road; nothing a stranger would retell.

Fixes:
1. **0–12 s, the seam is invisible:** push the contrast in the composite — posterise the right half to a flat toon
   palette with hard-edged sand and sea, add brush texture / colour shift on the left — so the kerb is a visible style cut.
2. **0–5.2 s, nothing happens:** bring the caption in at ~2 s and enlarge the move (2–3 m push plus the planned rise) so
   the parallax is visible on a phone.
3. **5.2–11.6 s, caption + tag:** *EVERY SHARD IS BUILT BY A PLAYER, IN CLAUDE CODE.*; reframe so the palms clear the
   corner tag.

## All four (shared)

- The corner tag is ~2 mm tall on a phone, illegible; ledger 7 is met in letter only. Set it ~1.5× larger.
- The end card works (logo, then line, then URL); its *Concept trailer · not gameplay* line is too small to read muted.

## Ranking and the site pick

| | Muted | Not AI | Finish | Memorable | Total |
|---|---|---|---|---|---|
| **V2 map** | 4 | 4 | 3 | 4 | 15 |
| **V1 glyphs** | 3 | 4 | 3 | 4 | 14 |
| **V3 postcards** | 3 | 3 | 4 | 4 | 14 |
| **V4 seam** | 2 | 2 | 4 | 2 | 10 |

**Rank: V2 > V1 > V3 > V4** (V1 above V3 on the tie: it is the only one that shows real Claude Code, the half of the
pitch the alpha trailer cannot).

**For wildshard.io beside the alpha trailer: V2.** The alpha trailer already shows playing one shard; V2 is the only cut
that shows the other half — an endless grid where every plot is someone's, and one is yours — in a look that is plainly
hand-made, the opposite of draft 1. With fix 1 (*…with Claude Code.* in a bigger, longer-held cartouche) it carries the
whole sentence muted. Runner-up for the site: V1, if Jake wants the Claude Code half told instead.

**The single most important fix:** V2's cartouche — say *with Claude Code*, make it ~1.6× larger and centred, and hold it
finished ≥ 1.5 s before the end card.
