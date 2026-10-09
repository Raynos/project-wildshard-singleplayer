# Plan: MARKETING-SITE — the home of Project Wildshard (E465)

**State:** `in progress` 2026-10-09 — Jake's picks are in (§7): key + ritual, the name is **Project Wildshard**, the
author door is waitlist + Discord + mail, public from day one. Now (Jake: "start building and more mockups in parallel"): **MS4 the scaffold + a public v1 from round 2**, and **MS2 rounds 3 (desktop) and 4 (logo)**; before that, **MS2, the mockup series** (Jake: *"make a series
of mock-ups for me to review with you so that we can actually figure that out and build it together"*). Open: which
domain(s) to buy (MS9, Jake's; the shortlist is in the row). Nothing built yet.

## 0. Why

Jake (E465, 2026-10-09): *"Project Wild Shard is progressing far enough that I need a marketing website for the
vision. … We have Wild Shard single player deployed. We have Wild Shard admin deployed. We have Wild Shard drafts
deployed. So we need the fourth website on Vercel, which is gonna be Project Wild Shard itself, the main website. This
website's marketing vision, it is telling the story of the end goal. The end goal is the MMO. The main end goal is that
anyone can install the developer tools, the skill, use their own Claude code, request an API key from the API that has
not been made yet, and upload content to the MMO. Everyone else who doesn't want to make user-generated content can
play the MMO."*

The site sells the **destination** (the MMO, built by its players in Claude Code) and proves it with the **road**
(seven playable shards today, a shard platform that is turning them into uploadable packages).

## 1. The story the site tells

The original pitch (Jake, `sources/WILDSHARD.md`, 2026-09-16) is already the copy:

> *"Unlike a game like minecraft where you build inside the game using the gameplay flows, with project wildshard, you
> use claude code as the UI for building … Then players can either build in claude code, or play in the browser."*

**Two front doors** (MMO-REQUIREMENTS §1): **play in the browser** (desktop and phone) or **build in Claude Code**.
Every section serves one door or the bridge between them.

| # | Section | What it says | Source | Media |
|---|---|---|---|---|
| 1 | **Hero** | "Play it in the browser. Build it in Claude Code." Two buttons: *Play now* (the live single-player build) and *Become an author* (§1.2) | WILDSHARD.md:9 | the 30 s trailer, re-encoded (§4) |
| 2 | **The world** | One world made of 500 × 500 × 500 m shards, each built by a player, stitched by a glowing lattice and a server-owned highway; the first grid is 5 × 5 around a fixed centre | VISION.md "The world" | `docs/design/mmo/concept-art/` (labelled **concept art**) |
| 3 | **Shards you can play today** | One card per shard, each in its own look: Driftwood Isle (toon), Pine Hollow (photoreal), Nalati Grasslands (painterly), Signal Dunes (dusk), Sky Reach (golden hour), Nine Dragon Stack (neon), the Template. One sentence, one in-engine hero, a *Play* deep link | `src/shards/*/manifest.ts`, `progress/<slug>/…/h1..h4` | real in-engine captures only |
| 4 | **How a shard is made** | Install the Wildshard skill and SDK in *your own* Claude Code → describe the shard → Claude builds it on a floating cube → `wildshard build` / `validate` checks budgets and edges → you walk it locally → you upload it | MMO-REQUIREMENTS §3.2, SHARD-PLATFORM shardfile | a terminal-plus-game split, then the grey-to-final time-lapse (`progress/far-reach/timelapse-heroes.mp4`) |
| 5 | **The upload ritual** | Plant beacons at the eight corners and a ninth at the centre, then the ~30 s upload sequence: uploading is a set piece, not a CLI | FUNDAMENTALS.md:31, VISION.md "Uploading is a set piece" | a mockup, labelled, until the ritual exists |
| 6 | **Safe by construction** | A shard ships data and baked assets, never code that reaches your browser's storage, network or other shards; metered, deterministic, versioned. Why strangers' worlds can run on your phone | MMO-REQUIREMENTS §1 constraint, SHARD-PLATFORM 80/20 | a simple diagram: author's machine (code) → shardfile (data) → the world |
| 7 | **A living grid** | Co-edit, renovate abandoned shards, the centre never goes ghost-town, live updates with players inside; your name and title travel with you; two wallets so no shard can break the economy | VISION.md "Ownership", MMO-REQUIREMENTS M6 / O1–O6 | concept art + icons |
| 8 | **The road** | Honest milestones: ✅ seven single-player shards on one engine · ✅ the shardfile package · 🟡 the grid (3 × 3, seamless travel) · 🟡 every shard at 80 / 20 · ⬜ multiplayer (two players in one shard) · ⬜ upload (an outside author through the ritual) · ⬜ the 25-shard grid | MMO-REQUIREMENTS §5, SHARD-PLATFORM State line | a progress strip generated at build time (MS6) |
| 9 | **Who's building it** | raynos and mattesch, and a fleet of Claude Code and Codex agents: the game is itself built the way its authors will build shards | Meta README | the WorldClaw board / drafts site as proof |
| 10 | **Footer** | Play · Become an author · contact (`project.wildshard@gmail.com`) · credits (the licence conditions the game's Settings ▸ Credits already lists, `src/engine/audio/credits.ts`) | | |

### 1.1 Honesty rules (they hold every row)

- **Concept art is labelled as concept art.** Everything shown as *playable* is a real in-engine capture (JAKE.md: no
  screenshot cheats). A future feature shown as a mockup says so on the image.
- **No dates.** The road shows states, not deadlines.
- **Status comes from the plans, not from copy.** The road strip is generated from the State lines and milestone rows
  at build time, so it can't drift (MS6).
- **Phone first.** Jake reads it on his iPhone 17 Pro, portrait Safari; every board and capture is iPhone portrait.

### 1.2 The author door, before the API exists

The upload API "has not been made yet" (Jake). The author door today is **all three** (Q3): a creator waitlist (a short form,
email plus an optional "what would you build?", that a Vercel function in `api/` writes to Blob, read in the admin
site), a Discord, and the mail link. When the platform's SDK is public (SHARD-PLATFORM Part B: `npm create
wildshard`), the door becomes *install the skill*; when the API exists, *request a key*.

## 2. Where things stand (2026-10-09)

- **Three live sites** on Vercel team `raynos-projects`: the game (`wildshard-singleplayer`, hourly from CI-green
  `main`), `wildshard-admin` (`admin/`, `admin-deploy.yml` on push) and `wildshard-drafts` (`drafts/`, by hand with
  `drafts/tools/deploy.sh`, pictures on Blob).
- **SHARD-PLATFORM** is `in progress`: the package (M1) ≈ 99 %, the grid (M2) ≈ 92 %, the seven shards at 80 / 20
  (M3) ≈ 51 %: 1 of 7 at 80 / 20 (the template), Signal Dunes the first shard to pass the headless replay witness.
  Servers, netcode, upload, moderation are explicitly not built there: they are the MMO's.
- **WORLDCLAW** (shards made by Claude from a sentence) is `draft`; its tools and the drafts site are live.
- **Brand:** none yet. No logo, palette or tagline in any repo. The name is spelled "Project Wildshard", "Project
  WildShard" and "Wild Shard" in different places (Q2).
- **Media on disk:** the 15 s and 30 s trailers (`progress/wildshard-trailer-*-music.mp4`, 51 MB raw), per-shard
  in-engine heroes (`progress/<slug>/2026100*/h1..h4-*.jpg`, `aerial-overview.jpg`), the hero rounds
  (`art/hero-images/round-3…5/`), the title portraits (`public/assets/title/*-portrait.jpg`), the grid aerial
  (`art/grid/round-15-cell-aerial/board.jpg`), two concept paintings (768 × 432: too small for a full-bleed hero; MS3
  re-renders them).

## 3. Shape

- **Where:** a new top-level `site/` in this repo, built like `drafts/` and `admin/` (Vite, static, its own
  `vite.config.ts` and `vercel-project.json`). It imports nothing from the game layers (no engine, no shards): it is a
  page about the game, and it must stay light on a phone. A live 3D scene on the page is a later row only if Jake asks.
- **Vercel project:** `wildshard-site`, **named before the first deploy** (global CLAUDE.md: deploying from an output
  folder names the project after the folder). Deployed by `site/tools/deploy.sh` from a clean export of HEAD, the
  same way as the drafts site. **Public from the first deploy** (Q4), no deployment protection; the domain(s) Jake
  buys are attached when he has them (MS9).
- **Media:** images re-encoded to AVIF / WebP at phone and desktop widths; videos to ~2–4 MB H.264 + a poster frame,
  on Vercel Blob like the drafts pictures, never committed raw.
- **Look:** decided on boards (MS2), not here. Each shard keeps its own look in its card; the site's own frame takes
  the lattice from the concept art (dark sky, glowing seams) so every shard's look sits inside one world.

## 4. Rows

| # | Row | Done when | Owner |
|---|---|---|---|
| MS0 | ✅ **Jake's picks** Q1–Q4 (§7) | his answers recorded here | Jake |
| MS1 | **Copy** — every section's words in one review page (`docs/reviews/marketing-site-copy.md`), from §1, in Jake's own phrasing where he has one | Jake reads it and notes land | marketing agent |
| MS2 | **Mockup series, reviewed with Jake** — rounds in `art/marketing-site/round-<n>-<label>/`, iPhone portrait, each a labelled A / B / C board built on real captures plus the lattice: round 1 the overall direction (hero + frame), then the sections one by one (world, shards, how-a-shard-is-made + ritual, safe-by-construction, the road, author door), then the desktop width. Each round's picks recorded here | Jake has picked a direction and every section's layout | marketing agent |
| MS3 | **Media pass** — pick and re-encode the hero video, one hero per shard, the grid aerial; re-render the two concept paintings at ≥ 2560 px from their prompts; poster frames; all on Blob | every §1 image has a ≤ 300 KB phone version | marketing agent |
| MS4 | ✅ **Scaffold** (2026-10-09: `site/`, Vercel project `wildshard-site` created by name, `pnpm build:site` / `deploy:site`, seeded from round 2; **v1 live and public at https://wildshard-site.vercel.app**, build `70108b79b`) — `site/` (Vite, no game imports), the `wildshard-site` Vercel project, `site/tools/deploy.sh`, `version.json` with the build SHA, the layout check and lint knowing `site/` | a blank page live at `wildshard-site.vercel.app` | marketing agent |
| MS5 | **Build the sections** §1 rows 1–10 in the picked look | every section on the live URL; Lighthouse mobile ≥ 90; no horizontal scroll at 390 px | marketing agent |
| MS6 | **The road strip** — a build step reads the milestone rows (SHARD-PLATFORM M1–M3, MMO-REQUIREMENTS §5) into the progress strip | the strip matches the plans at the deployed SHA | marketing agent |
| MS7 | ◐ **Author door** (Q3: all three; 2026-10-09: `api/waitlist.ts` + `api-tests/waitlist.test.ts` built, the site form posts to it; open: the admin tab, the Discord) — the waitlist form + `api/` function + Blob + an admin tab; the Discord server and its invite link; the mail link | a test signup reaches the admin site; the Discord invite works | marketing agent (the Discord account: Jake) |
| MS8 | **Sharing** — Open Graph / Twitter cards per section, favicon, the page title, `robots.txt`, sitemap | the link unfurls with the hero in iMessage | marketing agent |
| MS9 | **Domain** — Jake picks and buys one or more (he may buy several); the primary serves the site, the rest redirect to it. Unregistered on 2026-10-09 (whois): `wildshard.gg`, `wildshard.io`, `wildshard.game`, `wildshard.net`, `wildshard.org`, `wildshard.co`, `projectwildshard.com`, `playwildshard.com`, `getwildshard.com`, `wildshardgame.com` (likely `.dev` / `.app` / `.world` too: no name servers). `wildshard.com` is taken (registered 2025-02, live). Then attach apex + `www` to `wildshard-site`, DNS at the registrar, HTTPS | the primary domain serves the site and every other one redirects to it | Jake (pick + purchase), marketing agent (attach) |
| MS10 | **Keep it true** — when a SHARD-PLATFORM milestone, a new shard or the SDK ships, the site's road and cards follow (the deploy script is the one step) | a standing row; closes only if the site is retired | marketing agent |
| MS11 | **Motion** (idea 1) — the 30 s trailer as a muted autoplay loop in the hero; a ~5 s loop on each shard card from the per-shard capture clips (`progress/<slug>/<run>/clip.mp4`), re-encoded small, lazy, on Blob | the hero and every card move on the phone; first load stays ≤ 3 MB before any video | marketing agent |
| MS12 | **Play in a new tab** (idea 2) — each shard card's *Play* opens the live game in a new tab, in that shard where the game can take it there without a URL switch (AGENTS.md: no `?foo=` params); otherwise the game's title | every card's Play opens the game | marketing agent |
| MS13 | **One sentence → a shard** (idea 4) — the Thin Ice dry run as a scrolling case study: the sentence, the pitch, the style, concepts, the map, first-person views (`art/thin-ice/round-*`), labelled as the WorldClaw dry run | the section shows the whole chain on the phone | marketing agent |
| MS14 | **Build-in-public devlog** (idea 5) — generated at build time from the plans' State lines and the week's commits (no hand-written posts); newest first, a few lines a week | the deployed devlog matches the plans at the deployed SHA | marketing agent |
| MS15 | **Shardfile peek** (idea 6) — a short real `shard.json` excerpt (the template's) with its budgets, beside *Safe by construction* | the excerpt is read from the repo at build time, not pasted | marketing agent |
| MS16 | ◐ **Claim a cell** (idea 7; 2026-10-09: tap-to-claim on the site, stored with the signup; open: the admin map) — the waitlist lets you tap an empty cell on the grid map to say where you'd build (a wish, not a promise); the admin site shows the claims on the map | a test claim shows in admin | marketing agent |
| MS17 | **Founding authors** (idea 8) — the site promises the first authors to upload a permanent "Founding Author" title and a plaque on their shard. A real commitment: it is also written into the MMO's requirements so the MMO keeps it | the promise is on the site and in `docs/design/mmo/MMO-REQUIREMENTS.md` | marketing agent |
| MS18 | **Coming worlds** (idea 9) — a gallery of unbuilt shard ideas from `docs/design/mmo/SHARD-IDEAS.md` (Clockwork Tide, Skyforge Regatta, Lantern Night Market …), each with a concept image labelled "Idea · concept art" | the gallery is live, every image labelled | marketing agent |
| MS19 | **FAQ** (idea 10) — is it free, do I need a Claude subscription to build, which devices, who owns my shard, what can't a shard do. The pricing and ownership answers are Jake's words (asked as picks before they go live) | every answer is either a fact from the plans or Jake's | marketing agent + Jake |
| MS20 | **Press kit** (idea 11) — logo, screenshots, the trailer, one-paragraph blurbs, as one download page. Needs a logo first: a logo mockup round | the kit page and its zip are live | marketing agent |
| MS21 | **Install it** (idea 12) — "Add to Home Screen" for the PWA now; App Store / Play links when NATIVE-APPS ships | the install steps are on the site | marketing agent |

## 5. Not in this plan

The upload API, the creator key service, the SDK's public release, accounts and the MMO itself: they are their own
plans (SHARD-PLATFORM Part B, then the MMO's). The site only describes them and points at them when they exist.

## 6. Risks

- **Over-promising.** The MMO is the far end of a long road; the road strip and the labels are what keep the site
  honest.
- **Weight.** The trailer is 51 MB raw; the page budget is ≤ 3 MB on first load at phone width, video lazy.

## 7. Jake's picks (2026-10-09)

- **Q1 · Upload: key + ritual.** The key is your creator identity (it lets the game sign your upload); the upload
  itself is the nine-beacon ritual in the game. The site shows key → build in Claude Code → ritual. Keeps E465 and
  MMO-REQUIREMENTS U1 both true.
- **Q2 · The name: Project Wildshard** (the code name), spelled that way everywhere, no studio name. Jake: *"the code
  name is project wildshard"*. The domain in the first draft was a dictation error and is gone.
- **Q3 · The author door: all three**: the waitlist form, a Discord (to be made) and the mail link
  `project.wildshard@gmail.com`. MS7 builds all three.
- **Q4 · Public from day one.** Every deploy is public; no protection gate.
- **More ideas (Jake, 2026-10-09):** yes to motion (1), play in a new tab (2), one sentence → a shard (4), the devlog (5), the shardfile peek (6), claim a cell (7), founding authors (8), coming worlds (9), FAQ (10), press kit (11), install it (12); no to the soundtrack player (3). Rows MS11–MS21.
- **Open: the domain(s)** (MS9; Jake 2026-10-09: "I'll figure it out later").

## 8. Mockup rounds (MS2)

| Round | Folder | What | Jake's pick |
|---|---|---|---|
| 1 · direction | `art/marketing-site/round-1-direction/` | A The Lattice (the world map at night, the game's UI language), B The Atlas (an explorer's atlas, shards as plates), C The Prompt (a Claude Code terminal, the world opening out of a prompt). Real HTML pages (`<x>/index.html`), first screens `<x>-hero.jpg`, whole pages `<x>-full-<n>.jpg`, `board.jpg` | **C's layout and content with A's colour theme** (Jake, 2026-10-09); borrow C's prompt on each shard card, C's terminal for How a shard is made, B's inked grid map |
| 2 · merge | `art/marketing-site/round-2-merge/` | C's page in A's Lattice palette and UI language, B's map redrawn as a glowing lattice; three accent variants for the action colour (A cyan, B violet, C hot pink on navy), plus Jake's yes-ideas laid in (MS11, MS13–MS19, MS21). `index.html`, `<x>-hero.jpg`, `a-full-<n>.jpg`, `board.jpg` | **B · Violet** (Jake, 2026-10-09). The 18 September trailer stays ("Old trailer is fine"): MS11 uses it |
| 3 · desktop | `art/marketing-site/round-3-desktop/` | Three desktop layouts of the round-2 page (violet). **Desktop boards are an exception to the portrait-only rule for this site** (Jake, 2026-10-09: "Show me desktop boards"): A Wide column, B Two columns (sticky question column), C Map rail (a fixed grid map lights the cell you're reading); `<x>/index.html`, `<x>-hero.jpg`, `<x>-full-<n>.jpg`, `board.jpg` | **B · Two columns** (Jake, 2026-10-09); the site is re-seeded from it |
| 4 · logo | `art/marketing-site/round-4-logo/` | Three wordmark / mark directions for Project Wildshard as SVG (needed by the favicon, share cards and press kit, MS8 / MS20): A The Shard, B The Cell, C The Prompt; `<x>/*.svg`, `<x>-sheet.jpg`, `board.jpg` | **B · The Cell** (Jake, 2026-10-09); its favicon, touch icon and 512 px icon are in `site/public/` |
