# Marketing site · round 1 · the direction (MARKETING-SITE MS2, E465)

Three directions for the Project Wildshard home page, each built as a real phone-first HTML page on real in-engine
captures, so the words are sharp and the winner becomes the site's starting code. Jake picks one direction (or
mixes) from the board; later rounds go section by section.

| | Direction | The idea |
|---|---|---|
| **A** | **The Lattice** | Night sky and the glowing grid from the concept art. The page *is* the world map: dark navy, cyan and violet seams, light columns; the game's own UI language (navy glass, 1 px cyan hairlines with corner brackets, letter-spaced monospace labels). Feels like the MMO already exists. |
| **B** | **The Atlas** | An explorer's atlas. Warm paper, big serif type, each shard a full-bleed plate with a caption like a field guide; the grid drawn as a hand-inked map. Calm, editorial, unlike every other game site. |
| **C** | **The Prompt** | Claude Code is the level editor, so the page starts in a terminal: a typed prompt (`> build me a frozen fjord where you are the last ferryman`) and the world opens out of it. Black, one hot accent, monospace + one grotesk; the author door is as loud as the play door. |

## Rules (every direction)

- **Phone first:** designed at 402 × 874 (iPhone 16 Pro), captured with `agent-browser set device "iPhone 16 Pro"`.
- **Real captures only** for anything shown as playable; the two concept paintings carry a visible "Concept art" label.
- **Name:** "Project Wildshard" (one spelling). No domain anywhere. No dates.
- **One self-contained `index.html`** (inline CSS / JS; Google Fonts allowed), images by relative path to the repo.

## The sections and their words (use these; tighten, don't invent claims)

1. **Hero** — "Project Wildshard" · "One world. Every shard built by a player." · sub: "Play it in the browser. Build it in
   Claude Code." · buttons: "Play now" (→ the live game) and "Become an author".
2. **The world** — "A world made of shards." · "Each shard is 500 × 500 × 500 metres, built by one author and placed on
   a shared grid. A server-owned highway runs between them; glowing seams stitch them together. The first grid is
   five by five around a fixed centre." · concept art (labelled).
3. **Shards you can play today** — "Seven shards. Seven looks. One engine." Cards, one line each:
   - Driftwood Isle — "A bright low-poly island in a toon ocean: pier, sailboat, shrine and wreck."
   - Pine Hollow — "A boreal hunt from dawn fog to lantern-lit night. Face the Antler King."
   - Nalati Grasslands — "The painted steppe on horseback. Tame horses, open the Golden King's kurgan."
   - Signal Dunes — "Crack the bullwhip, drive off the dune rays and light the signal fire."
   - Sky Reach — "Grassy islands over a sea of cloud, joined by glowing bridges only a hoverboard can ride."
   - Nine Dragon Stack — "Lantern Square, halfway up a neon city stacked 500 metres high."
   - The Template — "The greybox every new shard starts from."
4. **How a shard is made** — "Claude Code is the level editor." Steps: 1 "Get a creator key" · 2 "Install the Wildshard
   skill and SDK in your own Claude Code" · 3 "Describe it. Claude builds it on a floating cube" · 4 "`wildshard build`
   and `validate` check every budget and edge" · 5 "Walk it locally" · 6 "Upload it in the game".
5. **The upload ritual** — "Uploading is a set piece." · "Plant a beacon at each of the eight corners, a ninth at the
   centre, and watch your shard rise onto the grid." (a mockup, labelled "Coming").
6. **Safe by construction** — "Strangers' worlds, safe on your phone." · "A shard ships data and baked assets, never code
   that can touch your browser. Every shard is metered, deterministic and built against a versioned API."
7. **A living grid** — "Shards that grow." · co-edit with friends · renovate abandoned shards · your name and title travel
   with you · two wallets, so no shard can break the economy.
8. **The road** — "Where we are." ✅ Seven single-player shards on one engine · ✅ The shard package · ◐ The grid:
   seamless travel between shards · ◐ Every shard as data · ○ Multiplayer · ○ Upload · ○ The 25-shard world.
9. **Who's building it** — "Built the way its authors will build: two humans and a fleet of Claude Code agents."
10. **Author door / footer** — "Become an author" · "Join the waitlist" (email + "What would you build?") · "Join the
    Discord" · "project.wildshard@gmail.com" · "Play now".

## Assets (paths from the repo root)

- Concept art: `docs/design/mmo/concept-art/shard-grid-overview.jpg`, `docs/design/mmo/concept-art/jungle-volcano-frontier.jpg` (768 × 432).
- Portrait title cards: `public/assets/title/{driftwood-isle,pine-hollow,nalati-grasslands,nine-dragon-stack,main-crossroads}-portrait.jpg`.
- Heroes: `art/hero-images/round-4-pine-hollow-in-engine/hero-pine-hollow-portrait.jpg`, `…/candidate-4-king-lanterns-portrait.jpg`,
  `art/hero-images/round-3-nalati-in-engine/hero-nalati-grasslands-portrait.jpg`.
- Per-shard in-engine shots (`h1..h4-*.jpg`, `aerial-overview.jpg`): `progress/driftwood-isle/20261002-0011-0d59505c/`,
  `progress/pine-hollow/20261002-0011-0d59505c/`, `progress/nalati-grasslands/20261002-0011-0d59505c/`,
  `progress/nine-dragon-stack/20261002-0011-0d59505c/`, `progress/sunscar-dunes/20261003-1458-a37cbc42/` (Signal Dunes),
  `progress/far-reach/20261003-0952-6066f959/` (Sky Reach).
- The grid: `art/grid/round-15-cell-aerial/board.jpg`.

## Output (per direction `<x>` = a, b, c)

- `art/marketing-site/round-1-direction/<x>/index.html` (the page; images by relative path).
- `<x>-hero.jpg`: the first phone screen (402 × 874 at 3×, saved ≤ 400 KB).
- `<x>-full-1.jpg`, `<x>-full-2.jpg`, … : the whole page at phone width, cut into ~3-screen tall slices, each ≤ 450 KB.
- `board.jpg`: A / B / C first screens side by side (made by the marketing agent).
