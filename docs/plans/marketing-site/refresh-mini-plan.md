# Mini plan: refresh the marketing site (E506)

**State:** `in progress` 2026-10-27 (E506): waves 1 and 2 landed (288ddbceab tiles, 26c2058d25 site), every page at or under
its old length; open: MR17 and the video rows MR7 / MR16, all later (RD17). Part of [MARKETING-SITE](../MARKETING-SITE.md).
Jake's picks (§5) go to him later as A / B / C boards.

Jake (E506, 2026-10-27): *"We haven't updated it in ages. We definitely want to put that new world map, the concept,
the vision of the new world map on the marketing plan. Give me all the suggestions of how we can update the marketing
website. … we've made a lot of progress in the last couple of weeks since we built the marketing website, especially
the shard platform plan."*

**Length rule** (Jake, 2026-10-27: *"we did a lot of work on the marketing website to make it not too long and not too
full of bullshit and fluff … we don't want to just blow it and triple the size of the page … we need to be super
focused on everything that's there"*): **swap, don't add.** Each page stays at its MS25 / MS29–MS31 length or shorter
(home 11.5 phone screens, /play 12.1, /build 10.1, /mmo 10.4, measured as round 8 did). A row that adds height removes
the same height in the same commit; fixes are rewrites in place. `/map/` is the one new page, a picture behind one link.
Under this rule MR2 is a rewrite of the existing status line, MR5's diagram is desktop-only (MS26's sticky column), MR9
keeps the journey's row count, and MR18 folds into the road and the FAQ instead of a new block.

**Where it stands:** https://wildshard.io last deployed 2026-10-11 (`version.json`: build `441bb32b`; the last `site/`
commit is 351a20e05c). About 10,400 commits have landed since 2026-10-10. Every word is in `site/COPY.md`; a push that
changes `site/` redeploys it (`site-deploy.yml`).

## Grill decisions (Jake, 2026-10-27)

| # | Decision |
|---|---|
| RD1 | **Length: same or shorter.** The length rule above is the cap; nothing grows. |
| RD2 | **The map replaces the Frontier Atlas painting** in "What is Wildshard" (Heart crop + "Explore the map" to `/map/`). P3 settled. |
| RD3 | **Map names as drawn.** The site shows the map with every name it has, homages included; the caption says every name is invented. P2 settled (A). |
| RD4 | **Hero: the title's 5 × 5 aerial**, a clean retake with no labels. P1 settled (B). |
| RD5 | **Cartridge story: one line on home, the full story on /mmo** in place of its stale "truth today" text. |
| RD6 | **The Night Market is not built.** Jake: *"Night market is not built bro it's placeholder open plot slop."* The site never shows or names the in-game Night Market as content; no gate, figure or plot-dressing captures. Coming worlds: RD9. |
| RD7 | **Journey keeps its row count**: early rows merge so the new milestones fit today's height. |
| RD8 | **The grid shows, tagged "In testing"**: real captures, the road says public is a state, not a date. |
| RD9 | **Coming worlds keeps its six paintings** (labelled concept art). MR8 and MR21 are dropped; P6 settled (A). |
| RD10 | **Trailer: keep the alpha trailer**; cut a "one world" trailer from real footage once MR7's travel clip exists. P5 settled. |
| RD11 | **`/map/` is the pinch-zoom tiled map with the legend and "Most played" list as text** under it (MR4 as written). |
| RD12 | **Discord stays "coming"**; MR22 drops the Discord part. |
| RD13 | **Memory: 1.2 GB per shard** on the site; SHARDS.md's 1,000 MB is fixed to match. |
| RD14 | **Numbers come from the game's files** at site build time (MR11, MR12), plain scripts, no new tooling. |
| RD15 | **/build: rewrite steps 3–4 in place** (MR13), same six steps, same length. |
| RD16 | **Build wave 1 now** (Jake, 2026-10-27): MR9, MR10, MR11, MR12, MR15, MR18 (folded), MR2 (rewrite), MR3, MR4, MR6, MR1. Then wave 2 in the same run (Jake via the coordinator): MR13, MR5, MR17, MR19, MR22. |
| RD17 | **No video changes this refresh**: the trailer, the loops, MR7 and MR16 are for later (Jake, 2026-10-27: *"we are not changing the videos … Don't do it."*). |

## 1. What's stale

What the site says today, what's true now, and the proof in the repo.

| Page · block | The site says | True now | Proof |
|---|---|---|---|
| Home · journey intro | "Three weeks, one engine, seven shards" | Six weeks (16 Sep → 27 Oct) | git log |
| Home · journey 7 | "The grid goes public: walk from one shard into the next" | The grid is real but **only with Settings ▸ Developer on**; the public title doesn't offer it yet | `src/game/grid/menu.ts` `GRID_GATES_PASSED = false` |
| Home · journey | Stops on 9 Oct | Missing: every shard rebuilt as data (23 Oct), the 5 × 5 grid with open plots (20 Oct), the road between shards with no loading panel (24 Oct), the new title (26 Oct) | 27dd969127, 8076aec207, 1a5ffecb7c, d8598ec213, 1873e9ca2c |
| /mmo · status, grid | "a 3 × 3 grid you can walk across", "three open plots" | A **5 × 5**: seven shards in the middle ring, 18 open plots round them (14 plot ideas) | `src/game/grid/singleplayer.json` (`grid.cells`, 25) |
| /mmo · grid, seam | "centres sit 555 m apart", "a 20 m strip, the 15 m highway, a 20 m strip" | 562.5 m apart: a 62.5 m gap round each 500 m cell, 15 m of road in it | ae2dca27dc (G638 A) |
| /mmo · layers "truth today" | "The six older shards still carry their own TypeScript … 80/20, then 90/10" | **Every shard is at zero custom code**: data, baked assets and sandboxed scripts; the old copies stay only until Jake's phone check | 27dd969127 (M3 100 %), SHARD-PLATFORM State |
| /mmo · road 2 and 3 | "on iPhone, frame pacing still misses"; "none at 80/20 yet" | Format: done. Grid: 5 × 5 in testing, crossing and loading speed still being cut | STATE.md, grid-crossing and loading-speed mini plans (open) |
| /mmo · budgets note | "an iPhone … inside 1.0 GB" | Three numbers in the repo: SHARDS.md 1,000 MB playing; AGENTS.md 1.2 GB per shard (G534, G556); the site 1.0 GB | AGENTS.md, docs/SHARDS.md |
| /mmo · shardfile note | "Version 0.1: 6,018 schema paths" | Hand-copied on 10-10; the schema has grown since | `src/format/shardSchema.ts` history |
| Home · coming worlds | Lantern Night Market is "an idea, not built" | Still true for the site: the in-game Night Market is placeholder open-plot dressing, not a built shard (Jake, RD6) | Jake, 2026-10-27 |
| Home · What | The "Frontier Atlas" GPT painting stands for the world | The code-drawn world map is the newer and truer picture of the vision | `art/world-map/round-4-plots/` |
| /build · status | "the SDK and its checks build the shards of our own alpha" | Still true, and stronger: **all** seven now go through it with no exceptions | 27dd969127 |
| /build · claim grid | "seven shards and the centre placed, seventeen cells still empty" | 18 open plots, each already showing an idea as a hologram | `singleplayer.json`, `src/shards/open-plots/README.md` |
| Author door | "Discord: coming" | Still no invite since 10-09 (MS7) | `site/COPY.md` |
| `site/README.md` | lists `press/index.html` | The press page was removed on 10-11 (MS20) | MARKETING-SITE MS20 |

Still true, keep: the seven shards and their lines, the badges (Driftwood open; Pine and Nalati early access; Sky Reach,
Signal Dunes, Nine Dragon experimental, per each `manifest.json`), multiplayer / uploads / creator keys not built, the
8 m road opening (`docs/SHARDFILE.md`), the sandbox numbers.

## 2. The world map (Jake's "definitely")

**What it is:** a code-drawn chart of Wildshard 1.0 after its first hundred uploads (E505): a flat world adrift in
space, a 10 × 10 grid of plots, the Boulevard between them, the most-played shards at the Heart, quiet and half-built
ones at the frontier, placeholder plots and the world's edge beyond. Drawn by `art/world-map/round-4-plots/worldmap.py`
(map v3, 27f9d0e8c8), which redraws at any scale since 7bc62f1f93 (scale 2 = 8800 × 10600 in ~48 s). It matches the
vision: busy shards move toward the centre, quiet ones drift out (`docs/design/mmo/VISION.md` "Avoid a ghost-town
centre"; VISION links the map since 8967d8afae).

**Which round:** round 4 (map v3, plots adrift in the void). It is the one that follows Jake's rules: nothing crosses a
seam but the road, each plot ends at its own edge, one entry lane per side.

**Where it goes:**
1. **Home**, right after the shards you can play: a new block, *"Wildshard at a hundred shards"*: the Heart crop
   (`heart.jpg`) full-bleed on the phone, one line of text, a *"Explore the map →"* button. It replaces the Frontier
   Atlas painting in "What is Wildshard", so the page doesn't get longer.
2. **A new page, `/map/`**: the whole chart, full screen, pinch to zoom on the phone, drag on desktop. Jake loved the
   pinch-zoom artifact (E505 v3: *"the infinitely zoomable artifact is fucking great"*), but that artifact is private
   to his account, so the site needs its own viewer: the 2× render cut into zoom tiles that load as you zoom (first
   screen under ~300 KB). Under it: the legend and "The most played" list as real text, so it reads and searches.

**How it's labelled** (on the image and in the text, per §1.1 of the main plan):
- A tag on the picture: *"Concept · a draft of the world after 100 shards"*.
- One honest line under it: *"Every name on this map is made up. None of these shards exist yet: this is what the
  grid could look like once players start uploading."*
- The map's own footer already says *"Every name on this chart is invented for the draft"*: keep it.

**What it needs before it ships:**
- **The names (pick P2).** A fifth of the hundred are pop-culture homages and mini versions of real games, named after
  them: Pocket Hyrule, Mini Stormwind, Tilted Towers, Totoro Hollow, Shrek's Swamp, Gotham Rooftops, "Bikini Bottom,
  Unofficial". On a page that sells the game, those read as promises and borrow other companies' trademarks. Recommended:
  a **site edition** with original names only (the generator already takes its name lists as data; swap the 40 homage
  and real-game names for originals of the same kind), and the full version stays for social posts if Jake wants it.
- One fact to square: the map draws a 3 × 10 m entry lane (Jake's v3 note); the format today opens 8 m at each edge.
  Fine for concept art; the caption must not state either number.
- A 2× render, tiled, plus phone (800 px) and desktop crops of the Heart in WebP; no `.png` over 1 MB committed.
- Image-model check: none needed, it's drawn by code, not an image model, so it gets "Concept", not "GPT mockup".

## 3. All suggestions

Effort: S = an hour or two, M = half a day, L = a day or more. "Pick" means it waits on a Jake board.

| # | What | Why (the progress it shows) | Media | Effort | Pick |
|---|---|---|---|---|---|
| MR1 | ✅ 2026-10-27 26c2058d25: a clean 2560 × 1440 canvas capture of the title camera from production, framed below the placeholder market plots (RD6), so it shows Driftwood between Sky Reach and Nalati; also the share card · **Hero image**: the new title's 5 × 5 aerial (seven shards in their own looks on one grid, open plots beyond) in place of the Driftwood pier | The first screen shows *one world of many shards*, the whole pitch at a glance; it's what the public title shows today | Real capture: `public/assets/title/main-crossroads-{square,landscape}.jpg` (1873e9ca2c); needs a 2400 px desktop retake with no labels | S–M | **P1** |
| MR2 | ✅ 2026-10-27 26c2058d25 · **Status line under the hero**: *"Alpha today: seven shards, one engine, every shard built from data alone. Next: one open world, then multiplayer and uploads."* | Says the platform milestone in one line | text | S | no |
| MR3 | ✅ 2026-10-27 26c2058d25: the Heart crop in place of the GPT painting, tag, note and "Explore the map →" · **World map block on home** (§2) | Jake's "definitely": the vision, drawn | Concept, code-drawn, labelled | S | **P2, P3** |
| MR4 | ✅ 2026-10-27 288ddbceab + 26c2058d25: 444 WebP tiles (6.9 MB), first phone screen 184 KB of tiles; legend without the lane width · **`/map/` pinch-zoom page** (§2) | The map is only great when you can zoom | Concept; 2× render, tiles | M | P2 |
| MR5 | ✅ 2026-10-27 26c2058d25: desktop only, the card in view lights its cell; zero height on the phone · **Shards become places on one grid**: "Seven shards. Seven looks. One engine." becomes "Seven shards, one grid": a small 5 × 5 diagram above the cards, each card lit on the grid | The shards aren't separate games any more; they sit side by side | Diagram drawn at build time from `singleplayer.json` (can't drift), real card stills | M | **P4** |
| MR6 | ✅ 2026-10-27 26c2058d25: 98,854 lines cut (ruler at 27dd969127) · **The platform story, in plain words**: *"The game is the console. A shard is a cartridge."* A shard ships only data, baked art and small sandboxed scripts; the game runs any shard the same way. Proof line: *"Every shard you can play today was rebuilt this way: about 99,000 lines of one-off code down to zero."* | The biggest thing done since the site launched (SHARD-PLATFORM M3, 23 Oct); also why a stranger's shard is safe on your phone | text + the existing shard.json excerpt (regenerated) | M | no |
| MR7 | ⏸ later (RD17) · **Seamless travel clip** (was MS27): ride the road out of Driftwood into the next shard, no loading screen | The MMO's best proof: one world, not a menu of levels | Real HEAD capture, iPhone 16 Pro, overlays off; tag *"In testing · not in the public build yet"* | M | no |
| MR8 | ✂️ dropped (RD9) · **Open plots, waiting for authors**: the 18 empty cells already show an idea as a turning hologram with a "coming soon" sign (never the Night Market dressing: placeholder, RD6) | Shows exactly where a new author's shard would go | Real captures (a hologram plot); tag *"In development"* | M | **P6** |
| MR9 | ✅ 2026-10-27 26c2058d25 · **Journey to today**: "six weeks"; fix row 7 to *"The grid, in testing"*; add *Every shard on one format* (23 Oct), *A 5 × 5 world with open plots* (20 Oct), *The road between shards* (24 Oct); "Next" unchanged | Shows the pace honestly | Real captures for each row | S | no |
| MR10 | ✅ 2026-10-27 26c2058d25: six rows (travel and plots folded into the grid row) · **The honest road, redone** (home "Next" and /mmo road): the package ✓ · every shard on the format ✓ · the 5 × 5 grid: in testing · faster travel and loading: in progress · open plots: in progress · multiplayer: not started · uploads and creator keys: not started · the first player-built grid: not started. A dated *"as of"* line | The road is where trust is won; today's version undersells the done parts and is stale on the rest | text | S | no |
| MR11 | ✅ 2026-10-27 26c2058d25: SVG drawn from `singleplayer.json` at build time · **/mmo grid numbers**: 5 × 5, 562.5 m apart, a 62.5 m gap with a 15 m road, open plots; redraw the grid and seam pictures from `singleplayer.json` at build time | Fixes four wrong numbers and stops the drift for good | Diagram (SVG) | M | no |
| MR12 | ✅ 2026-10-27 26c2058d25: `site/tools/facts.ts`; memory 1.2 GB a shard (RD13) · **/mmo facts read at build time**: the schema count, the layers "truth today" (zero custom code), one memory number from one source (SHARDS.md or Jake's 1.2 GB, his call when he reads the copy) | Hand-copied numbers rot within days on this project | text | S | no |
| MR13 | ✅ 2026-10-27 26c2058d25: steps 3–4 in place · **/build: how authoring works now**: one SDK path for every shard (build → report card → validate), build-time generators that fill the cell, looks written as data (material graphs), the ground streamed in tiles near you, one shard folder that makes many shards (the open-plots kit makes 14) | The six steps are right; the inside of steps 3–4 changed completely | text + a real report-card print from `wildshard build` | M | no |
| MR14 | **/build: one template, any look**: the Template beside Pastel Plain and Ink & Cel, the same level in three looks | Shows looks are data an author swaps | Real captures (Developer fixtures) | S | no; **would cut**: the fixtures are test shards, not content |
| MR15 | ✅ 2026-10-27 26c2058d25: speeds 30 / 14 m/s match `rules.ts` · **/play "Live today, coming next"**: add *"The world: all seven shards on one 5 × 5 grid, joined by a road. In testing."*; move "Infinite Wildshard" from "coming" to "in testing"; recheck every travel speed against the code | The player page should say what a player can almost do now | text | S | no |
| MR16 | ⏸ later (RD17) · **Trailer**: keep the alpha trailer; when MR7's clip exists, cut a 20–30 s *"one world"* trailer (the title's aerial → the road → into the next shard) | Today's trailer predates the grid | Real HEAD footage only (CINEMATICS.md: motion is the bar) | M | **P5** |
| MR17 | ⏸ later, with the loops (RD17): on the phone each card's loop covers its still within a second, so new stills under the old loops would cut between two different shots · **Fresh media for the cards and loops**: retake the seven card stills and loops from HEAD (Driftwood's new toon clouds 1d4a4f738f, the lighter post look, Pine and Nalati's streamed ground) | The cards are 10-10 captures; the game looks better now | Real HEAD captures, overlays off (every `art/` capture in this round has labels or the HUD burned in) | M | no |
| MR18 | ✅ 2026-10-27 26c2058d25: folded into FAQ 1 and the road · **"What's not here yet"**, one short block (home FAQ + /mmo): no multiplayer, no uploads, no creator keys, no sign-in or accounts (progress saves on your device), no Discord yet, no store apps yet; the grid and open plots are in testing | Honesty is the site's rule; the new grid and plot pictures make it easy to over-read | text | S | no |
| MR19 | ✅ 2026-10-27 26c2058d25: og per page (home, /play, /build, /mmo, /map); no structured data added · **Share cards and search**: a new `og.jpg` (the 5 × 5 aerial or the map's Heart, with the wordmark), one card per page (/play, /build, /mmo, /map), `/map/` in the sitemap, descriptions that say *one world*, structured data for a free browser game | Links shared on X / iMessage will carry the map; today every page shares the same Sky Reach card | Real capture or the concept map (labelled) | S | no |
| MR20 | **Claim a plot, not a cell**: the waitlist's claim map becomes the real 5 × 5, and you claim one of the 18 open plots (its idea shown) | Ties the author door to the actual grid | Diagram from `singleplayer.json`; same waitlist storage | M | no; **would cut** until uploads are near: claims on a 25-cell map fill fast |
| MR21 | ✂️ dropped (RD9) · **Coming worlds become open plots** (with MR8): retire the six GPT paintings for the plot ideas that stand in the game | Real 3D over image-model art, Jake's 10-11 direction | Real captures | S | P6 |
| MR22 | ✅ 2026-10-27 26c2058d25: README, /build budgets; Discord stays coming (RD12) · **Small chores**: the Discord link or drop the button (Jake sends an invite), `site/README.md`'s press page line, the build page's budgets (1 GB, same source as MR12) | Loose ends | none | S | no |
| MR23 | **A live 3D map on the page** | Would wow on desktop | | L | **would cut**: heavy on a phone, against "stays light" (main plan §3) |
| MR24 | **A commit / build counter** ("10,000 commits in two weeks") | Shows pace | | S | **would cut**: Jake retired the commit-fed devlog (MS14); the journey carries the pace |
| MR25 | **"What's next for the format"** on /mmo (live zones, from SHARDFILE-NEXT and the Roblox audit) | Shows we've thought past single player | | S | **would cut**: SHARDFILE-NEXT is parked; promising it now over-claims |

## 4. Recommended order

**Wave 1 (ship first, the truth and the map):**
1. **MR9 + MR10 + MR11 + MR12 + MR15 + MR18**: the truth pass. Every stale line in §1 fixed; no pick needed.
2. **MR3 + MR4**: the world map on home and `/map/`, after pick P2.
3. **MR6**: the cartridge story with the zero-custom-code proof.
4. **MR1**: the new hero, after P1.

**Wave 2:** MR5, MR8 + MR21, MR13, MR17, MR19, MR22. **Wave 3 (waits on capture):** MR7 then MR16.

## 5. Picks for Jake (boards later, one recommendation each)

| Pick | Question | Options | Recommended |
|---|---|---|---|
| P1 | Hero image | A the Driftwood pier (today) · B the title's 5 × 5 aerial · C the world map's Heart | **B**: it's the game, and it says "one world" |
| P2 | Map names on the site | A as drawn (homages and real-game minis) · B a site edition with original names only · C homages kept, real-game minis renamed | **B**: no other companies' names on the page that sells ours |
| P3 | Where the map lives | A replaces the "What is Wildshard" painting · B its own home block after the shards · C only on `/map/` | **B** plus `/map/`, with the painting dropped |
| P4 | Shards section | A seven cards as today · B cards under a lit 5 × 5 diagram · C the grid diagram only | **B** |
| P5 | Trailer | A keep the alpha trailer · B a new "one world" cut when the travel clip exists · C the engine-true Part E trailer (TRAILERS, its verdict still open) | **A now, B when MR7 lands** |
| P6 | Coming worlds | A keep the six paintings · B swap them for the open plots in the game · C both | **B** |

## 6. Out of scope, and what the site must not promise

- **No dates.** States only (main plan §1.1).
- **Not "the grid is live"**: it's in testing, behind Developer, until its gates pass. Pictures of it say "in testing".
- **No multiplayer, uploads, creator keys, accounts or sign-in shown as working.** None is built; multiplayer has no
  plan yet and SHARDFILE-NEXT is parked.
- **No map shard as a real shard.** Every name on the map is invented; none is "coming".
- **No load-time or frame-rate numbers** for the grid: the crossing and loading-speed plans are still open.
- **No store apps** until NATIVE-APPS ships (blocked on store accounts).
- **No WorldClaw "one sentence → shard" as done**: still a dry run (WORLDCLAW-SHARD, THIN-ICE are drafts).
- **No AI images standing in for the game**: concept art only for ideas, labelled (main plan MS33).
- Out of scope here: the upload API, keys, accounts, the MMO itself (main plan §5), and building any of the rows
  above until Jake says build.
