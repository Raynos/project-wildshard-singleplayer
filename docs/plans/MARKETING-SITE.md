# Plan: MARKETING-SITE — the home of Project Wildshard (E465)

**State:** `in progress` 2026-10-10 — **live at https://wildshard.io, four pages now** (home, /play, /build, /mmo, plus a 404). The 2026-10-10 clean-room audit (Opus + Codex, §9) opened MS23–MS32: done are the fixes, crisp phone media, the home page in 11.5 phone screens (Jake's B), the code tidy and the three saga pages (Jake: play, build, the MMO). **Open:** MS26 AAA wave 2 (a board for Jake first), MS27 the shard-crossing clip (waits on the grid), MS1 Jake reads the site ([review](../reviews/marketing-site.md)), MS7 the Discord link.
**Reviews:** [marketing-site](../reviews/marketing-site.md)

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
| MS1 | ◐ **Copy** — every section's words, read where they live: the site itself is the review page ([docs/reviews/marketing-site.md](../reviews/marketing-site.md), `unread`); Jake rewrites the words himself in **`site/COPY.md`** (every piece of text on the page, under readable `## Section · thing` headings; the build fills `site/index.html`'s slots from it and fails on a missing or unused heading, 2026-10-09) | Jake reads it and notes land | Jake (read), marketing agent (notes) |
| MS2 | ✅ **Mockup series, reviewed with Jake** (2026-10-09) — rounds 1–4 picked (§8: direction C in A's look with B's map, violet, two-column desktop, the Cell logo); round 5 the coming worlds, round 6 the grid concept redrawn | Jake has picked a direction and every section's layout | marketing agent |
| MS3 | ✅ **Media pass** (2026-10-09) — every image as WebP with an 800 px phone copy (`srcset`), lazy below the fold; the trailer and shard loops on Blob (MS11); the sharp desktop hero (MS22); the grid concept painting redrawn at 1672 px (round 6) | every image has a ≤ 300 KB phone version | marketing agent |
| MS4 | ✅ **Scaffold** (2026-10-09: `site/`, Vercel project `wildshard-site` created by name, `pnpm build:site` / `deploy:site`, seeded from round 2; **v1 live and public at https://wildshard-site.vercel.app**, build `70108b79b`) — `site/` (Vite, no game imports), the `wildshard-site` Vercel project, `site/tools/deploy.sh`, `version.json` with the build SHA, the layout check and lint knowing `site/` | a blank page live at `wildshard-site.vercel.app` | marketing agent |
| MS5 | ✅ **Build the sections** (2026-10-09) — every §1 section live, plus the ideas Jake said yes to; checked whole at 402 px (phone) and 1440 px (desktop): no horizontal scroll, no console errors, the videos load; Lighthouse mobile 99–100 performance (FCP 1.1 s, LCP 1.6–1.9 s, CLS 0.01), 100 accessibility, 100 best practices, 92–100 SEO; fonts self-hosted | every section on the live URL; Lighthouse mobile ≥ 90; no horizontal scroll at 390 px | marketing agent |
| MS6 | ✅ **The journey** (2026-10-09, replaces the generated road strip: Jake, "you should be talking about the journey") — a dated timeline of the seven biggest milestones of the first 21 days (day one Pine Hollow → the grid goes public), each with a real image, then "Next"; its words are in `site/COPY.md` | the journey is on the site and its words are Jake's file | marketing agent |
| MS7 | ◐ **Author door** (Q3: all three) — ✅ `api/waitlist.ts` (public POST from the site, password-gated GET for admin) + tests, the site form, the admin site's Waitlist tab (signups + the claim map), the mail link; **open: the Discord** — the button reads "Discord: coming" until Jake sends an invite link (Jake, 2026-10-09) | a test signup reaches the admin site; the Discord invite works | marketing agent (the Discord: Jake) |
| MS8 | ✅ **Sharing** (2026-10-09) — `site/public/og.jpg` (1200 × 630: the Cell lockup and the tagline over Sky Reach in engine), Open Graph + Twitter card meta, canonical, the favicon and touch icon, `robots.txt`, `sitemap.xml` | the link unfurls with the card | marketing agent |
| MS9 | ✅ **Domain** (2026-10-09) — Jake bought **wildshard.io** and **wildshard.dev** (Vercel, team raynos-projects, Vercel DNS). `wildshard.io` serves the site, `www.wildshard.io` 308s to it, `wildshard.dev` and `www.wildshard.dev` 307 to it (temporary: .dev becomes the author docs / SDK home later, Jake's pick). The site's canonical, share card, sitemap and press kit say wildshard.io; `/api/waitlist` accepts it. More domains later (Jake: "I'll get extras later") | https://wildshard.io serves the site and every other one redirects to it | Jake (bought), marketing agent (attached) |
| MS10 | ✅ **Keep it true** (2026-10-09) — `.github/workflows/site-deploy.yml` redeploys the site on every push that changes `site/`; Jake's words live in `site/COPY.md`, and the build fails on a missing or unused heading | the site redeploys itself when its sources change | marketing agent |
| MS11 | ✅ **Motion** (2026-10-09) — the trailer autoplays muted below the hero: since 2026-10-09 the 63 s alpha trailer (E466, TRAILERS, `55d4cc841`; it replaced a 21 s cut of the 18 September trailer); each shard card fades its ~5 s loop in over the still (phone: when in view; desktop: on hover, since the capture clips are 540 px); all on public Blob via `site/tools/publish-media.ts` → `site/media.json`, inlined at build time | the hero and every card move on the phone; first load stays small before any video | marketing agent |
| MS12 | ✅ **Play in a new tab** (2026-10-09) — every shard card's *Play ↗* and both Play buttons open the live game in a new tab (its title: the game has no shard deep link that isn't a URL switch) | every card's Play opens the game | marketing agent |
| MS13 | ✅ **One sentence → a shard** (2026-10-09) — the Thin Ice dry run: the line, the pitch, the style, the map, a first-person view, labelled "WorldClaw dry run · concept images, not the built shard" | the section shows the whole chain on the phone | marketing agent |
| MS14 | ✅ **The devlog is the milestones** (2026-10-09, Jake: "focusing on the major milestones") — folded into the journey (MS6); the commit-fed devlog and `site/devlog.json` are gone | the milestones are on the site | marketing agent |
| MS15 | ✅ **Shardfile peek** (2026-10-09) — the template's real `shard.json` (version, identity, sdk, author caps, server budget, `runtime: null`), fetched from the live game at build time into `<!--gen:shardfile-->` | the excerpt is read at build time, not pasted | marketing agent |
| MS16 | ✅ **Claim a cell** (2026-10-09) — tap-to-claim on the site, stored with the signup; the admin site's Waitlist tab shows the claims on the 5 × 5 map | a test claim shows in admin | marketing agent |
| MS17 | ✅ **Founding authors** (2026-10-09) — on the site's author door, and written into `docs/design/mmo/MMO-REQUIREMENTS.md` as O9 (with O10 ownership and pricing, U5 the creator key: the promises the site makes) | the promise is on the site and in the requirements | marketing agent |
| MS18 | ✅ **Coming worlds** (2026-10-09) — six concept images by codex image_gen in the concept-art style (`site/public/media/idea-*.webp`, copies in `art/marketing-site/round-5-worlds/`), labelled "Ideas · not built · concept art" | the gallery is live, every image labelled | marketing agent |
| MS19 | ✅ **FAQ** (2026-10-09) — Jake's answers: play free; build free with your own Claude Code (any plan that includes it), uploads never charged; you own your shard (we get a hosting licence; renovation keeps the original author's name); what a shard can't do, from the requirements | every answer is a fact from the plans or Jake's | marketing agent + Jake |
| MS20 | ✂️ **Press kit** (removed 2026-10-11, Jake: "I don't know why we have a press kit seems premature": /press, the zip step, the logo and screenshot downloads and the Press links went; the footer keeps the contact email; all in git history before 9c5396676) (2026-10-09) — the site's Press kit section (logo, both blurbs, contact, downloads) and `site/public/press/`: the Cell logo as SVG and PNG, the mark, six 1920 px in-engine screenshots, README.txt and `wildshard-press-kit.zip` | the kit page and its zip are live | marketing agent |
| MS21 | ✅ **Install it** (2026-10-09) — the Add to Home Screen steps; "iOS and Android apps: coming" until NATIVE-APPS ships (then a link, a MS10-style edit) | the install steps are on the site | marketing agent |
| MS22 | ✅ **A sharp desktop hero** (2026-10-09) — a 2400 × 1350 aerial of Driftwood Isle captured from a HEAD build, overlays hidden (`site/public/media/hero-driftwood-wide.webp`), the desktop source of the hero | the desktop hero is sharp at 1440 × 900 | marketing agent |
| MS23 | ✅ **Audit fixes** (2026-10-10; E473 §9, both seats, verified) — the honest status line under the hero buttons (*alpha today: seven single-player shards · next: multiplayer, uploads, creator keys*; §1.1) and "when keys open" on How steps 1 and 6; the coming-worlds images full-bleed (`.idea img` `max-width:none`, desktop margins); the author section on the page's grid (`.door-end` padding onto its `.wrap`); disclaimers (`.note`, footer) at `--mute`; the waitlist refuses a foreign `Origin`, taken cells and over-long ideas (`maxlength` on the field), keys each signup by its email's hash (a repeat overwrites; the read-time dedupe goes), a honeypot name autofill never fills, a `role=status` line for the result; the shared rate limit evicts only expired IPs (`api/inbox.ts`); reduced motion stops the trailer's autoplay; the press zip rebuilt from the site's names (Sky Reach, Signal Dunes; no ritual); the press page's own `h1` and share titles, `og:image:alt`, a title that says what it is, a 404 page; stale copy ("twenty-one days" → 23, "Jake picked", "WorldClaw dry run", COPY.md's `{braces}` line). Also Jake's wording pick: "Claude or any coding agent" wherever the page said Claude Code was the way to build (hero, How, the blurbs). The press kit's zip is now built with the site from `public/press/` and the press page's own words (README from COPY.md), and the press page shows the six shots | live, re-checked in WebKit (normal / reduced motion / no JS), waitlist tests for each refusal | marketing-site agent |
| MS24 | ✅ **Crisp on the phone** (2026-10-10, 279260577: fresh 4K HEAD captures cut to 1080 × 864 card stills `card-*.webp`, card loops 1080 × 864, desktop loops 1280 × 720, the phone trailer 1080p from the alpha master) — every shard card still at 1080 wide (crops of the in-engine captures, no inline `object-position` / `scale` hacks and no desktop `!important` undoing them), the card loops 1080 × 864, the phone trailer 1080p | no image or video upscaled on a 3× phone; Lighthouse mobile still ≥ 95 | marketing-site agent |
| MS25 | ✅ **The story in ~10 phone screens** (2026-10-10, Jake picked B on round 8: 14.4 → 11.5 phone screens; the shard.json now an FAQ answer, "What's inside a shard?"; COPY.md re-sorted to the page's order. Jake: "Show me a board first": a phone board of the new order beside today's; both seats: ~15 today) — hero + trailer → what (the grid art) → shards you can play → one world, many authors (Many authors + Grow merged; the shard.json to the FAQ) → how (Thin Ice inside its step 3) → journey → coming worlds → become an author → FAQ (install folded in) → footer; "Who's building it" folded into the journey | the order Jake picks, live | marketing-site agent, Jake |
| MS26 | ⬜ **AAA wave 2** (a desktop + phone board for Jake first) — the hero cycles 3–4 shards under its prompt; desktop's empty sticky column holds the 5 × 5 grid, the shard in view lit; the claim grid at the form's width and the claimed cell lighting up with the visitor's own idea on success; a real footer (Play, Press, email); a screenshot strip on the press page | Jake's picks, live | marketing-site agent, Jake |
| MS27 | ⬜ **One world, shown** — an in-engine clip of walking from one shard into the next with no loading screen, as the second beat after the hero (both seats: the best MMO proof sits at the bottom of the journey today) | the clip live, captured from a HEAD build | marketing-site agent, once the grid's seamless travel ships (SHARD-PLATFORM) |
| MS28 | ✅ **Code tidy** (Jake 2026-10-10: "Delete both") — ✅ the 70 dead CSS lines and the `!important` toggles of "+4 more"; ✅ the build-time shardfile fetch (`site/shardfile.json`, a checked-in excerpt); ✅ media.json read once; the copy test runs in the push gate (a CI step before the deploy was tried and reverted: the repo's test setup needs `pnpm gen`, so it broke the deploy); ✅ the shard cards' inline crop hacks and their desktop `!important` undo (with MS24) | the lines gone, the build green | marketing-site agent |
| MS29 | ✅ **/play: what playing is like** (2026-10-10; 12.1 phone screens: the seven shards in full with their badges, a drawn touch-controls diagram and the desktop keys, live today / coming, install) (saga 1, OCTOBER-BACKLOG) — every shard in full (its loop, its look, what you do there: fight, ride, explore, the boss), the controls on phone and desktop, the frontier concept painting the home page dropped, install to the home screen in full (the FAQ keeps one line and links here), what's live today and what's coming for players (travel between shards, multiplayer) | the page live, phone and desktop, words in COPY.md | marketing-site agent |
| MS30 | ✅ **/build: what building a shard is like** (2026-10-10; 10.1 phone screens: an example session, the six steps in full, Thin Ice's five stages, the template's folders, five budgets, the tools as in use / draft / next, ending at the waitlist) (saga 2) — the six steps in full; Thin Ice's whole five-stage chain (line, pitch, style, map, first-person view) that the home page cut to two; the template shard; "Claude or any coding agent", with Opus 5.5 best today; budgets and validation in plain words; shards that grow (co-edit, renovate, title travels with you); founding authors and the claim map, ending at the waitlist | the page live, phone and desktop | marketing-site agent |
| MS31 | ✅ **/mmo: how the MMO works, for the curious and for authors** (2026-10-10; 10.4 phone screens: the four-card pipeline, the shardfile and its json, budgets first, the sandbox, the 3 × 3 grid to scale in SVG, four layers, multiplayer as planned, ownership, the honest road; every block names its sources in a COPY.md note) (saga 3) — the shardfile from `docs/SHARDFILE.md` and `docs/api/SHARDFILE.md` (the full `shard.json`, what a package holds and never holds, budget-first admission, the script sandbox), the grid (500 m cells, seams, seamless travel), the engine and the SDK layers, ownership and pricing (MMO-REQUIREMENTS O9 / O10), server authority and multiplayer as planned, and the honest road (each plan's state) | the page live; every claim traced to a doc or the code | marketing-site agent |
| MS32 | ✅ **One site, four pages** (2026-10-10) — a shared top bar on every page (Play · Build · The MMO · Press, Play now ↗), a "More →" link from each home section to its page, the footer links, the sitemap; the build checks every page's copy as it does today | the four pages linked both ways, live | marketing-site agent |
| MS33 | ✅ **Image-model pictures say so** (SHARD-PLATFORM G332; Jake 2026-10-11: *"We actually want to remove as much mockups and gpt image ai slop from the game lol also from the marketing website"*, then on the site: *"they just need a little banner inside the image that's like a GPT mockup. Just GPT mockup is enough"*) — ✅ all 14 image-model pictures (the grid and frontier paintings, the six coming worlds, Thin Ice's four, journey 6) carry a small see-through "GPT mockup" banner inside the picture, one COPY entry (`Mockup · tag`); ✅ `hero-driftwood-aerial` (journey 7) trimmed of its fps readout; ✅ `og.jpg` re-lettered in the site font ("Build it with Claude or any coding agent"), its in-engine Sky Reach kept | every image-model picture labelled in the picture; every picture of the game a capture | marketing-site agent |

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
- **Jake's first read (2026-10-09):** say MMO above the fold and lead with playing; open with "what is Wildshard" (an infinite MMO, every piece of content a shard built by another player in Claude Code) over the concept art; drop the grid numbers (5 × 5, 500 m, 15 m); phones show three shards in full (Driftwood, Nalati, Sky Reach) and "+4 more"; keep the build terminal in the hero; drop the upload ritual; "safe on your phone" becomes how strangers' shards fit together; every Play opens a new tab; admin gets its own icon (A · amber gauge, `art/admin-icon/round-1-options/`).
- **Open: the domain(s)** (MS9; Jake 2026-10-09: "I'll figure it out later").

## 8. Mockup rounds (MS2)

| Round | Folder | What | Jake's pick |
|---|---|---|---|
| 1 · direction | `art/marketing-site/round-1-direction/` | A The Lattice (the world map at night, the game's UI language), B The Atlas (an explorer's atlas, shards as plates), C The Prompt (a Claude Code terminal, the world opening out of a prompt). Real HTML pages (`<x>/index.html`), first screens `<x>-hero.jpg`, whole pages `<x>-full-<n>.jpg`, `board.jpg` | **C's layout and content with A's colour theme** (Jake, 2026-10-09); borrow C's prompt on each shard card, C's terminal for How a shard is made, B's inked grid map |
| 2 · merge | `art/marketing-site/round-2-merge/` | C's page in A's Lattice palette and UI language, B's map redrawn as a glowing lattice; three accent variants for the action colour (A cyan, B violet, C hot pink on navy), plus Jake's yes-ideas laid in (MS11, MS13–MS19, MS21). `index.html`, `<x>-hero.jpg`, `a-full-<n>.jpg`, `board.jpg` | **B · Violet** (Jake, 2026-10-09). The 18 September trailer stays ("Old trailer is fine"): MS11 uses it |
| 3 · desktop | `art/marketing-site/round-3-desktop/` | Three desktop layouts of the round-2 page (violet). **Desktop boards are an exception to the portrait-only rule for this site** (Jake, 2026-10-09: "Show me desktop boards"): A Wide column, B Two columns (sticky question column), C Map rail (a fixed grid map lights the cell you're reading); `<x>/index.html`, `<x>-hero.jpg`, `<x>-full-<n>.jpg`, `board.jpg` | **B · Two columns** (Jake, 2026-10-09); the site is re-seeded from it |
| 4 · logo | `art/marketing-site/round-4-logo/` | Three wordmark / mark directions for Project Wildshard as SVG (needed by the favicon, share cards and press kit, MS8 / MS20): A The Shard, B The Cell, C The Prompt; `<x>/*.svg`, `<x>-sheet.jpg`, `board.jpg` | **B · The Cell** (Jake, 2026-10-09); its favicon, touch icon and 512 px icon are in `site/public/` |
| 7 · hero | `art/marketing-site/round-7-hero/` | Six real in-engine hero images on the phone first screen (A Driftwood pier, B Sky Reach windmill, C Nalati riders, D Nine Dragon square, E Driftwood from the air, F the Antler King), each with its shard's prompt; `board.jpg` | **A · Driftwood pier** (Jake, 2026-10-09), live as `site/public/media/hero-driftwood-pier*.webp` on phone and desktop |
| 8 · order | `art/marketing-site/round-8-order/` | MS25: A today's home page (14.4 phone screens, 15 blocks) beside B the audit's order (11.5 screens, 11 blocks: Grow into Many authors, Thin Ice's line and view into How step 3, Who into the journey, install into the FAQ, the author door before the FAQ; one concept painting; shard.json out of the main flow), measured on the real page in WebKit, each block as tall as on an iPhone | **B** (2026-10-10) |

## 9. The clean-room audit (E473, 2026-10-10)

Two read-only seats, one brief, the live site screen by screen (WebKit, phone 402 px @2x and desktop 1440 px):
[Opus 5.5](../audits/2026-10-10-marketing-site-opus.md) and [Codex gpt-6-astra high](../audits/2026-10-10-marketing-site-codex.md).

- **Verdict, both:** close to AAA, not there; the first screen sells the MMO; the code is KISS in spirit.
- **Where they agree** (and the coordinator verified): the page over-claims multiplayer as live (§1.1); the waitlist
  takes posts from any origin; the disclaimers fail contrast (~3:1); ~70 dead CSS lines; the build should not fetch the
  live game; the page is too long (~15 phone screens) with sections that repeat each other; the press page is thin.
- **One seat only, verified:** Opus: phone stills 390–555 px wide on a 1068 px card (blurry), the coming-worlds images
  short of the card edge, the author section off the page grid, the `website` honeypot autofill trap; Codex: the
  server takes taken cells and silently cuts ideas at 500, the rate limit's eviction frees limited IPs, the press zip
  says Far Reach and Sunscar Dunes (and the ritual), the press page has no `h1`, reduced motion still autoplays the
  trailer.
- **Rows:** MS23 (fixes) and MS24 (crisp media) need no pick; MS25 (order), MS26 (look) and MS28 (tidy) are Jake's;
  MS27 waits on the grid.
- **Jake's picks (2026-10-10):** build MS23 + MS24 now; MS25 "Show me a board first"; the agent line "Claude or any
  coding agent is better phrasing"; MS28 "Delete both" (the dead CSS and the live fetch).

- **Three saga pages (Jake 2026-10-10):** *"having this homepage, having this page about what it's like playing the game,
  having a page about what it's like building zones, shards in the game, and having that last page with the technical
  details of Project Wildshard"*: the October plan's three sagas (play, build, the MMO) become /play, /build and /mmo
  (MS29–MS32), and what the audit cut from the home page lands there.
- **Experimental shards (Jake 2026-10-11, "Tag them Experimental"):** Sky Reach, Signal Dunes and Nine Dragon Stack are
  locked in the public game (Developer off), so their home cards wear the game's own Experimental badge, and Pine
  Hollow (Early access) takes Sky Reach's place among the three phone cards.
- **Real images only (Jake 2026-10-11, G332):** the site had 12 image-model pictures (one grid painting, one frontier
  painting, six coming-worlds paintings, Thin Ice's four dry-run images); MS33 replaces or drops each. Already real:
  the hero, the seven cards and wide stills, the loops and trailer, the share card's Sky Reach; the logo is hand-made SVG.
- **Concept art that stays (Jake 2026-10-11):** Coming worlds and Thin Ice keep their image-model pictures: *"No that's
  a good use of ai images"*. The rule: concept art may picture an idea or a plan, labelled; it never stands in for the game.
- **Road-grid concept art (Jake 2026-10-11):** the two old paintings with glowing purple seams give way to the meta
  repo's approved refresh (project-wildshard-meta 4b0cb15, docs/concept-art/ALPHA-REFRESH.md and DRAFTS.md): A1
  Frontier Atlas on the home page's What, B1 Emerald and Ember on /play; both keep the GPT mockup banner.
