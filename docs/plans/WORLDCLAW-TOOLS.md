# WorldClaw tools: Draft mode, the drafts site, and the Explorers a shard needs before it is a world

**State:** `draft` 2026-10-01 — a plan only, the companion to [WORLDCLAW-SHARD](WORLDCLAW-SHARD.md); GAME-NORMALIZATION is archived (2026-10-01); the rows start with WORLDCLAW-SHARD N0 on Jake's go. Done: the Nine Dragon audit ([worldclaw-tools/audit-nine-dragon.md](worldclaw-tools/audit-nine-dragon.md)), the concept, rows W0–W17, three mockup rounds (16 + 15 + 25 images, the [Tools page](https://claude.ai/artifact/2r8TXFS57ze8EAJ9CdN6BQ)), Jake's grill J1–J52, every mockup board picked (two websites with the drafts site deployed at every step boundary and its images on Blob; a COMING SOON card in the game from day zero; review in chat, every page read-only; a draft = STAGES + Draft Explore, the mock-up mirror; Map Lab, Composition, Coverage and Beats with all their parts as experiments kept or cut after the pilot; just-in-time build, ~23 agent-days). Open: this plan's council (later); the keep / cut review after the pilot (J32). On `main` since 2026-10-01 (merged from branch `worldclaw`; the prototypes and the review copies at the local tag `worldclaw-archive`, D76).

## 0. Read this first

### 0.1 Jake's words (2026-10-01, verbatim)

> "what new tools can be built for Workflow? What new mock-ups of tools can be built for Workflow? We have World
> Exploration, we have Model Explorer, Set Explorer, World Explorer, but maybe we need more explorers. Maybe even before
> we go in engine, in game engine, we have a very specific, you know, frameworked HTML page that can be one shot of onto
> Vercel or can be an artifact or can be a ChatGPT site. … Or maybe we have a new coming soon shot on the website."

> "Basically, everything that we do in this flow before we even get to having a partial world that can be loaded in the
> World Explorer can go as a draft shard, right? We can go with a new draft shard mode and it doesn't have Model
> Explorer, Set Explorer, World Explorer. It just has coming soon. And if the developer tools are on, you can go into
> draft mode, which is a mode that exists before the World Explorer … before Explore World. And it's just going through
> the draft, the mock-ups, … throwaway prototypes, clean room stuff. We can build all kinds of draft tools for the first
> couple of hours."

> "the idea here is that as you start working on a new shard, you immediately get to go into draft mode on the deployed
> website and you get to like touch and feel and iterate and whatever we can do before we have a partial shard. Because
> when you look at Nine Dragon, it's a partial shard. It has models, it has sets, there's a partial world. There's
> something to walk through. The HUD Explorer works. The new mechanism for traversal has its own mini thing. … But
> before that, if you look at the play-by-play document for Nine Dragon, everything was just image in Claude, image in
> Claude, ask user, ask user, ask user. It had a clean room experimentation and it was just staring screenshots and
> progress."

> "get a new audit and review research agent to start thinking about everything. The new tools, the draft mode, really
> start thinking about that stuff. And we want a secondary companion plan: we have a WorldClaw plan, now we have a
> WorldClaw tools plan."

### 0.2 Why: Nine Dragon before it was walkable ([the audit](worldclaw-tools/audit-nine-dragon.md))

From the ask (09-25 19:19) to the first build Jake could walk (`3719d1d`, 09-26 01:43): **6 h 24 min**.

| Measure | Count |
|---|---|
| Jake's prompts | 37 |
| Decisions on AskUserQuestion | 6, in 2 calls |
| Files pushed into chat | **48 images + 1 video**, in 27 sends |
| Images committed to `art/nine-dragon-stack/` | 505, in 38 rounds (147 from the clean room and 9 labs) |
| "% done?" | 3 (7 over the whole session) |
| Asks for a lineage or a side-by-side | 3 ("mockup → attempt 1 → … → current"; "I thought we were further ahead"; "clean room vs in-game, side by side") |
| "Mockup or in-game?" / "a way for me to enter shard 4?" | 1 / 1 |
| COMING SOON card deploys | 3 before walkable, 4 in all; the mechanism was deleted by E318 on 09-30 |

The clean room and the nine labs ran only on a dev server: Jake saw them as screenshots. The labs found the look, and
Jake's three method fixes moved the frames most. **The tools don't replace that work. They replace the push-and-ask
friction, keep the history browsable, and let Jake touch what exists.**

### 0.3 Jake's picks today (binding)

| # | Pick |
|---|---|
| J1 | Mock up first: **Draft mode / Shard Atlas**, **Map Lab**, **Composition Explorer**, **Coverage Explorer** (§3). Round 1 is made: 16 portrait mockups on 5 boards (`art/worldclaw-tools/round-1-draft-and-explorers/`), on the [Tools page](https://claude.ai/artifact/2r8TXFS57ze8EAJ9CdN6BQ); Jake's picks wait (J14) |
| J2 | The Shard Atlas has **two audiences**: a private review surface for Jake during a run, and a public "coming soon" teaser with spoilers left out |
| J3 | The WorldClaw skills become **three**: `worldclaw-auto` (fully autonomous), `worldclaw-interactive` (Jake in the loop: review boards, a checkpoint board for **every place** during the build, steering, polish), `worldclaw-sketch` (fast low-poly) |
| J4 | **Polish every seen m²**, the close band first |
| J5 | **The verb gate moves to after the mockups** |

### 0.4 Lead resolutions (this plan's design choices; Jake or the council may reopen one)

| # | Resolution | Why |
|---|---|---|
| WT1 | **(Superseded by J16, J25: a drafts site plus an auto-made artifact page.)** **One page, two hosts, one data file.** The Shard Atlas is one framework-free TypeScript page that reads one `atlas.json`. Host 1 is a Claude Artifact (`db` + `assets`); host 2 is the game's Draft mode. A host adapter is the only difference. No ChatGPT host, no separate Vercel project (§1 non-goals) | Jake's "frameworked HTML page … an artifact"; a chat link opens the Artifact in the Claude app, while the PWA is reached from its own deck (audit §5.6) |
| WT2 | **(Superseded by J6: committed under `public/`.)** ~~Draft content lives in Vercel Blob~~, served by a new `api/draft.ts` like `api/inbox.ts`. Git keeps the sources (`art/<slug>/…`, `design/`); Blob holds phone copies and the generated `atlas.json`. Nothing goes into the build or the PWA precache | "immediately on the deployed website": content needs no deploy, so neither the deploy pin nor the hourly deploy delays it |
| WT3 | **(Superseded by J7: Developer mode alone.)** ~~Private = Developer mode + the review password.~~ Developer mode (Settings ▸ Developer, E140) is a switch any player can flip, so the private Atlas also needs the review password the inbox already uses (`src/engine/ui/review.ts`). The public sees only `teaser.json` | spoilers (J2) |
| WT4 | **A draft is data-only.** From P0 a slug has a design folder and an Atlas, but no `manifest.ts` and no code. The manifest (`status: 'hidden'`, E10's flags) arrives when there is something to load: P7's playground or P8's grey world. The manifest status union is unchanged | zero code per draft; nothing for the gpu-gate, the bakers or the boot to know about |
| WT5 | **(Superseded by J17, J21: read-only pages, answers in chat.)** **Verdicts go where Jake is.** In the game: a note through the existing `POST /api/inbox` with `context.draft`. In the Artifact: its `verdicts` collection. AskUserQuestion still announces each decision with its board image (the sound chime). The first answer wins; a different second answer gets one clarifying question (06 §10.3) | one inbox, no new write API; the chime keeps decisions from being missed |
| WT6 | **Pre-engine tools run the build's own code.** Map Lab imports T4's terrain operators and T5's band maths in a web worker, so its numbers are the build's numbers | two implementations would disagree |
| WT7 | **(Revised by J42, J43: Beats and Coverage are top-level Explore tabs, Composition a World mode.)** **In-engine tools are Explore panes**, developer-only hub cards beside the Practice Arena. Never overlays in the World Explorer, which stays a pure viewer (D23) | D23; the hub already lists developer-only cards (`Explore.ts`) |
| WT8 | **A throwaway prototype opens as its own page** (a top-level navigation, the game unloads), never in an iframe over a loaded shard. Each lists its Simulator peak before it is marked playable | phone memory (1.8 GB loading / 1.0 GB Explorer) |
| WT9 | **No URL switch.** Entry is a deck button; a hand-off to the cold title (Map Lab's walk) uses a saved slot like `travel()`'s, never a query param; `lint/url-params.json` is unchanged | AGENTS.md ▸ No URL switches |

### 0.5 Jake's answers (2026-10-01) — binding; they override §0.4 where they differ

| # | Answer | Jake |
|---|---|---|
| J6 | **(Superseded by J16, J28.)** **Draft content is committed under `public/draft/<slug>/`** and ships with a deploy. Supersedes WT2 (Blob, `api/draft.ts`): `atlas.mjs --publish` becomes `atlas.mjs --build` (phone copies + `atlas.json` into `public/draft/<slug>/`, a pathspec commit, pushed with `scripts/push-main.sh`); a draft update reaches the phone with the next deploy (after the archive: the hourly :17 deploy, or `gh workflow run deploy` for an immediate one) | Q1: "Committed under public/" |
| J7 | **Developer mode alone opens Draft mode.** Supersedes WT3's review password. Accepted: any player who flips Developer mode sees the drafts; the public teaser stays spoiler-free | Q2: "Developer mode alone" |
| J8 | **W0 / W0b are not built now** | Q3: "Not now" |
| J9 | **Every prototype is playable** on the deployed site: a built page under `public/draft/<slug>/proto/<id>/`, opened as its own page (WT8), its Simulator peak on its card; look labs too | Q4: "Always playable" |
| J10 | **The Artifact host stays** after the in-game Atlas ships | Q5: "Keep it" |
| J11 | **(When: superseded by J19.)** **The public COMING SOON card appears from P3**, on Jake's PUBLISH | Q6 |
| J12 | **Route & Beat Explorer is planned now** (W14 is a row, not a candidate); its mockups come in round 2 | Q7: "Plan it now" |
| J13 | **The public sees the teaser page** (round-1 board 2, mockup C): key art, the title, one tagline, FOLLOW THE BUILD; no progress strip | "C · Teaser page" |
| J14 | **The round-1 mockup picks wait**: Draft mode's home layout, Map Lab, Composition and Coverage Explorer | "I can't focus on two things at once. I'll review the tools and draft later"; "I can't fucking review it now. Just make sure it's all on the fucking plan." |
| J15 | **Drafts must cost the deployed game nothing** (§2.8, W15): "we're adding a lot of weight with the drafts to the deployed game. Um, how do we make these drafts super cheap? How do we make a unique loading bar for the drafts? How do we not cause performance regressions for all the, all the JavaScript and HTML for the drafts?" | Jake, verbatim |
| J16 | **Two websites.** The game site keeps every shard and partial shard in the engine, deployed as today. A **second, lightweight drafts site** has the same title screen but only the drafts (none of the four shards), and is **deployed by hand whenever a draft changes**: no continuous deployment, so frequent draft updates don't run into the Vercel account's cost problems with continuous deployment. Supersedes J6's "under the game's `public/`" and most of §2.8's in-game budgets (§2.9) | "we deploy two websites. We deploy the full website with all the shards and partial shards in engine. And then we deploy a second website. Second website has the same title screen, has only the drafts … gets deployed as is … no continuous deployment. Just deploy whenever there's an update to the draft … really lightweight … doesn't contain any of the existing four shards … we won't run into the issues with the Vercel account … cost issues with continuous deployment" |
| J17 | **Review surfaces are read-only; Jake answers only in chat** (Claude iOS, AskUserQuestion). The Atlas, the boards and every review page show his answers as text and take no input. Supersedes WT5's verdict posts (the Atlas's VERDICT buttons, the Artifact's `verdicts` collection, `api/inbox` with `context.draft`) and W5's verdict half | "I want the artifacts to be in read-only mode … I don't want to be able to like edit the notes … I really want the notes to be only in the Claude iOS … I don't want to be able to click stuff" |
| J18 | **Thin Ice is the first draft** (WORLDCLAW-SHARD D74): the fjord dry run's front (pitch, style, concepts, the map, the content boards, the views) seeds the drafts site's first Atlas, and W1–W5's fixtures use it | "Yes, Thin Ice is the pilot" |
| J19 | **A COMING SOON card in the game from day zero.** From P0 (the day the draft is made), the game site's deck shows the draft's COMING SOON card, shipped with the game's hourly deploy: a static card (the name, one spoiler-free line, one key-art image ≤ 100 KB once P3 / P4 make one) with no ENTER / EXPLORE, linking to the draft's teaser page on the drafts site. Every other piece of a draft (the Atlas, the boards, the prototypes, the images) stays on the drafts site, deployed by hand (J16). Answers Q8; supersedes J11's "from P3" for when the card appears (Jake's PUBLISH still decides the teaser shots, J11 / J13) | "Yes, coming soon cards in the game from day zero … all the draft content is going … in a separate site with … ad hoc deployment. The coming soon card is in that hourly deploy cycle" |
| J20 | **The prototypes become the tools.** What the WorldClaw prototypes proved is converted into the tools, or redone as tools, by the rows that own it (WORLDCLAW-SHARD D76 lists which); the prototype code never goes to `main`. The round-1 tool mockups go to `art/worldclaw-tools/round-1/` | "everything that [the prototypes have] proved, we're just gonna put it into tools or convert it into the tools or redo it so the tools comes in" |
| J21 | **Jake reviews in chat; the drafts site is the history.** Each stage's images go to chat as one titled set, the map first (as in the Thin Ice dry run), and Jake answers there. The drafts site is where he goes back: compare versions, follow a picture's lineage, play prototypes. Replaces Done-when 2's "≤ 1 image per decision in chat" | "Chat sets; site = history" (grill wave 1) |
| J22 | **A Developer switch on the drafts site** opens the Atlas (the spoiler part), as J7 does in the game: once per device, no password. The teaser pages stay public | "Developer switch" (grill wave 1) |
| J23 | **The drafts site lives in the game repo and is built after normalization** (as §2.9 and §5 have it): it shares the deck's code; a separate repo started now was declined | "Game repo, after normalization" (grill wave 1) |
| J24 | **Look and play; nothing saves.** On the drafts site Jake browses, zooms, compares, plays prototypes, and in Map Lab drags a place and walks the terrain to try what-ifs; nothing is saved or sent, he says it in chat. Map Lab's PROPOSE MOVE is dropped | "Look and play, nothing saves" (grill wave 1) |
| J25 | **The Artifact host stays, as an auto-made review page** (J10 confirmed): each draft gets one read-only Claude artifact, generated from the same `atlas.json` and republished at every stage, so Jake reads the Atlas inside Claude where he answers; Map Lab and the playable prototypes stay on the drafts site. It replaces hand-built review pages like the Thin Ice page | "Keep it, auto-made" (grill wave 2) |
| J26 | **The drafts site deploys at every step boundary** (by hand from the run, J16; not per push): always current | "Every step boundary" (grill wave 2) |
| J27 | **(Upload: revised by J28.)** **Keep every image; rejects smaller.** Nothing is pruned from the drafts site, during the run or after the shard ships: picks, boards and current images as phone copies (~150 KB), rejected and superseded ones as ~50 KB thumbnails that open larger on tap; ~50–60 MB per shard. Phone copies are made at deploy time from `art/` (cached), never committed, so no image is in git twice. Supersedes the 40 MB cap and `--prune` | "Keep all; rejects smaller" (grill wave 2) |
| J28 | **Draft images live on Vercel Blob, uploaded once** (the CDN the inbox already uses, `@vercel/blob`; a public store, since the inbox's is private). Each phone copy and thumbnail is made at the step that makes its original, uploaded once under a content-hashed name, never re-uploaded; `atlas.json` points at the Blob URLs. A drafts deploy then carries only the shell and `atlas.json` (a few hundred KB), so J26's deploy per step boundary stays cheap; the game's COMING SOON card loads its key art from Blob, so the game deploy carries no draft image. Revises J27's "made at deploy time" and brings back WT2's Blob for images only. A Blob URL is public but unguessable: the same exposure J22 accepts | "we also have a CDN where we can upload images … Uploading images to [Vercel] inside the website as … files in the public directory … that stuff is more expensive … increases the storage and the uploads and the build times … Uploading the images to the CDN once … might be significantly cheaper" |
| J29 | **A draft's home is the stage list, with a Map tab** (round-1 board 1: C home + D as a tab): go back by stage (P1 → P17, each opening to its images and Jake's answer as text) or by place (concept → mockup → built, its beat). Read-only: the mockups' PICK / MIX / NOTE / KEEP / CHANGE buttons are gone (J17, J21) | "C stages + D map tab" (grill wave 3) |
| J30 | **Originals stay in git `art/<slug>/round-<n>/`** (today's art rule; ~100 MB per shard, pushed with `push-main.sh`). Blob (J28) holds only the derived phone copies and thumbnails the drafts site and the game card show | "Git art/ (today's rule)" (grill wave 3) |
| J31 | **Map Lab has all three parts** (round-1 board 3): A layers + live numbers as its main screen (drag a place, the walkable / flat / close-band numbers update); B the eye-height 3D walk, full screen on a button (its own chunk, loaded on tap); C each map variant's pass / fail checks, shown on the P5 stage page beside the variants. Read-only: no PICK MAP button | "A layers + live numbers, B the 3D walk, C the variant checks" (grill wave 3) |
| J32 | **Every tool part is an experiment, kept or cut by use.** Jake picked "all" for Map Lab without knowing yet what he wants from it, so every part is built lean for the Thin Ice pilot, and after the pilot each part gets a keep / cut review from how much Jake used it (a one-line note per part in the pilot's final board: used, ignored, wanted more). "All three" means "try all three", not "keep all three" | "I really don't know what I want from a map lab, so I'm tempted to say that I want all the things … a bunch of this stuff is going to get [culled] or removed based upon [use] and experimentation" |
| J33 | **The Composition Explorer has all three parts** (round-1 board 4): A the painting vs built slider as the main view; B the lifted objects as labelled 3D boxes (flagged ones amber), a toggle; C the judges' score and must-fix as a small read-only panel (no ROUND 2 / ACCEPT buttons: J17). Under J32 | "A painting vs built slider, B the objects as 3D boxes, C the judges' score" (grill wave 3) |
| J34 | **The Coverage Explorer has all three parts** (round-1 board 5): A the map heatmap as the main screen (status colours, % seen-and-polished, close / mid / far filters); C the places list as a tab (close / mid coverage, status, triangle + draw budget bars); B the in-world overlay as a World Explorer toggle. Under J32 | "A the map heatmap, B the in-world overlay, C the places list" (grill wave 3) |
| J35 | **Coverage's status ladder has a mock-up step:** unseen (never seen; nothing to do) · **to do** (seen, still empty or grey) · **mocked up** (a mock-up of what fills it exists: a composition painted at a camera that sees the cell, P12's paint step) · **composed** (its objects lifted from that mock-up and placed: P12's lift) · **signed off** (the judges passed it, and in `worldclaw-interactive` Jake's place checkpoint said GO). Jake's notes are pins on the map, not a status. Replaces §3.7's untouched · grey · composed · polished · judged · Jake-noted | "It is missing the mock-up phase … the space is empty, still to do. We need to make a mock-up … Then do we compose the mock-up? Then do we sign off" |
| J36 | **Two new drafts-site tools; no assets board.** (1) **Quest & mechanics board** (W17): the journey, each step's 2x2 board (T20) and a tracker of every NEW mechanic from the step boards (its engine row, state, a test clip once built), so content is never drafted unseen (WORLDCLAW-SHARD D70–D73). (2) **Camera check** (W18): each first-person view beside its camera drawn on the map and the blockout render from the same spot (T19), so a mismatch shows before Jake has to spot it (the dry run's flipped lighthouse, the phantom village, the wrong minimaps). **No assets board and no sounds:** models exist only from the build, when the shard has a manifest and the game's Model Explorer shows them; the stage page links to it. Both under J32 | "Quest & mechanics board, Camera check … No sounds. Just model assets board. But then again why do we need model asset boards in drafts when we have model explorer lol" (grill wave 5) |
| J37 | **The tools are built just in time.** After the archive: the drafts site, the Atlas (stage list + Map tab), the auto-made artifact page and the Quest & mechanics board first (~7 agent-days), with Thin Ice's dry run as the first draft (J18); then each other tool lands right before the Thin Ice stage that needs it (Map Lab before P5's re-check, the Camera check before P6, Coverage before P8, Composition before P9b, Route & Beat before the slice), and each is tried the moment it exists (J32) | "Just in time" (grill wave 6) |
| J38 | **The game's COMING SOON card as drawn** (round-2 board 1): day zero (a plain card, a crack line, "IN DRAFT", "COMING SOON · NOT YET PLAYABLE", a FOLLOW THE BUILD link) → with the key art ("COMING SOON", FOLLOW THE BUILD opens the drafts site) → with Developer on (DRAFT + stage tags, DRAFT MODE). **The key art may show the boss as a tease** (the Bellkeeper under the ice): an exception to §2.6's boss-is-a-spoiler rule for the key art only | "Approve; the eel is a fine tease" (grill wave 4) |
| J39 | **The drafts site's title is the game's carousel with a stage bar** (round-2 board 2: A + C's bar): swipe between drafts over each one's key art; each card shows its stage, what it waits on and a 17-tick stage bar; OPEN DRAFT; the Developer switch at the bottom (J22). Its public state is board 2 B (COMING SOON, FOLLOW THE BUILD, PLAY DRIFTWOOD ISLE NOW) | "A carousel + C's stage bar" (grill wave 4) |
| J40 | **A stage page is "decision first", and a tap opens the swipe** (round-2 board 3: A + B): the picked image large, Jake's answer as a quote, the lineage (A → rev 1 → rev 2), the rejects greyed; tapping any image opens the full-screen swipe with a title strip and a counter | "A + tap opens B" (grill wave 4) |
| J41 | **The draft splash is the key art and a bar** (round-2 board 4 A): full-screen key art (the name alone before P3), "DRAFT · <name> · <stage>", a thin bar with an image count | "A key art + bar" (grill wave 4) |
| J42 | **Beats is its own top-level explorer:** Explore's tabs become MODELS · SETS · WORLD · **BEATS** (developer-only, like WT7's tools), not a pane inside World. It has all three parts of round-2 board 5 under J32: A the path on the map by leg type with numbered beats (main screen; a leg's card has PLAY FROM HERE); B the legs as a list with times, test chips and beats (a tab); C the path as a ribbon in the world (a toggle) | "A the map, B the list, C in the world, I think beats should be its own top level explorer next to world explore" (grill wave 4) |
| J43 | **Coverage is top-level too; Composition is a mode inside World.** Explore's tabs: MODELS · SETS · WORLD · BEATS · COVERAGE (developer-only beyond WORLD). Composition lives at a camera, so it is World's mode with the sub-tabs Capture · Composition · Built · Target (round-1 board 4 A). Revises WT7's "panes" for these three | "Coverage top; Compose in World" (grill wave 4) |
| J44 | **Draft Explore, a mock-up mirror of the game's Explore.** A draft has two views: **STAGES** (the history in run order, J29's home) and **EXPLORE**, whose tabs mirror the game's Explore, filled with mock-ups: **MODELS** (the character, creature and gear concepts), **SETS** (each place's concept, its first-person views and the blockout render from the same camera: this absorbs W18's Camera check), **WORLD** (a carousel of the map, the World Explorer views, the 3-in-1s), **BEATS** (the journey on the map and each quest step's 2x2 board with its NEW mechanics: this absorbs W17's Quest & mechanics board), **COVERAGE** (which places and areas have a mock-up yet: to do → mocked up). EXPLORE replaces J29's Map tab (map-first becomes its WORLD tab). The real Beats and Coverage are built in the game's Explore (J42, J43); as the shard is built, each game tab takes over from its mock-up tab | "If [beats] and coverage are in the explore world flow, then they're built inside the explore world flow … Maybe the draft mode has an entire draft explore page with mock-ups of models, mock-ups of sets. Mockups of the world … a carousel of images. Mockups of the beats. Mockups of the coverage … a mockup mirror in the draft page" → "Yes, mirror + draw it" |
| J45 | **Draft Explore MODELS: a grid, a tap opens one model** (round-3 board 10 A + B): six concept cards with their status (CONCEPT ✓ · MODEL —); a tap opens the model's path concept → model → in game | "A grid, tap opens B" (grill, round 3) |
| J46 | **SETS are sets, not places** (round-3 board 11 rejected): a Set is the models placed in one spot, as the game's Set Explorer shows them in the four shipped shards (`placeSet`: the members, their copies, triangles and draws; a list by region; a set opens framed from the air in a blue box with its member rows; a member opens its model card, "PART OF"). Draft Explore's SETS mirrors that with mock-ups: each set's **planned** members and copies over an aerial concept, each member linking to MODELS. **The camera check moves to WORLD** (the first-person views at their cameras, beside the blockout render and the cone) | "No it's sets not the list of places. They are different. See the 4 existing shards" (grill, round 3) |
| J47 | **Draft Explore BEATS: the journey, a step, the tracker** (round-3 board 13): A the quest on the map as the tab's main view; a tap opens B, the step's 2x2 board with its mechanics (NEW / ENGINE, row, state) and ‹ › between steps; C the mechanics tracker as a second view | "A journey → B step, C 2nd view" (grill, round 3) |
| J48 | **Draft Explore COVERAGE has all three views** (round-3 board 14): A the map (mocked up / to do / unseen), B the places with their mocked-up bars and view counts, C the mock-up cameras' cones with the gaps hatched. Under J32 | "All three" (grill, round 3) |
| J49 | **Draft Explore SETS approved as the Set Explorer's mirror** (round-3 board 11 redrawn): the sets list by region (aerial thumbnail in a blue box, planned counts, member chips) → a set opened (the aerial concept in its bounds box; models, copies, tris and draws planned; member rows, each CONCEPT with a count) → a member (concept on a plinth, CONCEPT / MODEL / IN GAME, copies planned, PART OF) | "Approve all three levels" (grill, round 3) |
| J50 | **Draft Explore WORLD: viewpoints + first-person** (round-3 board 12 B + D): the map with its camera markers, a tap opening that world view; a FIRST-PERSON sub-view where each first-person view sits over its camera on the map and the blockout from the same camera, with its check flag and a counter | "B viewpoints + D first-person" (grill, round 3) |
| J51 | **The game's Explore bar has two rows** (round-3 board 15 B): MODELS · SETS · WORLD as today, and a thinner amber developer row BEATS · COVERAGE with a DEV chip; a player's Explore is unchanged | "B two rows, DEV row" (grill, round 3) |
| J52 | **Coverage's colours and funnel** (round-3 board 16): red to do · violet mocked up · amber composed · green signed off · dark unseen; a funnel bar of the close band's shares on top of the heatmap | "Approve colours + funnel" (grill, round 3) |

## 1. Goal, done-when, non-goals

**Goal.** From P0 of a WorldClaw run, a new shard is a **draft**: a COMING SOON card in the game, and a draft on the
drafts site where Jake goes back through everything that exists before the world does (the pitch, the look, the
concepts, the map, the views, the content, the prototypes, his own answers), by stage or as a mock-up mirror of the
game's Explore. From P8 on, the game's Explore shows the built shard's Beats and Coverage, and World's Composition mode
shows how each camera's painting became the world. Jake reviews and answers in chat (J21); every page is read-only (J17).

**Done when:**
1. **The draft is live from P0.** The game's deck shows the pilot's COMING SOON card with the next hourly deploy (J19);
   the drafts site shows the draft after P0's first step boundary (J26); with the drafts site's Developer switch on (J22),
   its STAGES and EXPLORE views open on Jake's home-screen app (a capture on a fixture slug).
2. **The front's history is in the draft** (J21). Through the pilot's P0–P6, every image Jake decided on is an Atlas item
   with his answer as text, by the next drafts deploy, and its auto-made artifact page (J25) matches.
3. **The public stays spoiler-free, the key art aside.** Public pages (the game card, the teaser page) carry no
   `spoiler` item; the key art may show the boss (J38); a test proves the generator refuses any other spoiler on a public
   page.
4. **Map Lab agrees with the build.** On Jake's iPhone, dragging a place updates its gentle-ground %, the walkable %, its
   sightlines and the band shares within 1 s; on a fixture spec the numbers equal T4 / T5's within 0.5 points.
5. **Composition mode** shows, for every close-band camera of the pilot, capture · composition · objects · built at one
   camera (J33); T8's flagged objects are amber; a tap opens the model's card (E3).
6. **Coverage** shows every 2 m cell's band and status on J35's ladder and every pose's census (equal to T10's);
   physical-iPhone Explorer memory ≤ 1.0 GB with the tab open (06 §7's method).
7. **Drafts cost the game nothing** (J15): the game carries only the COMING SOON card (data + a Blob image URL); with no
   draft, the game's entry bundle, its boot request list and every shard's captures are identical to main's; no URL param
   added; the four CI gates and the gpu-gate green.
8. **Every tool part gets a keep / cut line** on the pilot's final board (J32): used, ignored, wanted more.

**Non-goals:** editing anything from the drafts site (it is read-only: J17, J24); notes or verdicts posted from a page
(answers go in chat); a ChatGPT host; multi-reviewer threads; backfilling the history of shipped shards.

## 2. The concept: the draft shard

### 2.1 Two websites, one card (J16, J19, J23, J26, J28, J30)

| | The game site (`wildshard-singleplayer`) | The drafts site (a new Vercel project, e.g. `wildshard-drafts`) |
|---|---|---|
| What | every shard and partial shard in the engine | only the drafts: the title, each draft's STAGES and EXPLORE, Map Lab, the prototypes; no three.js world, none of the shipped shards |
| A draft's footprint | **one COMING SOON card** from P0 (J19): ≤ 2 KB of data + a Blob image URL | everything else |
| Deploy | as today (hourly, from the archive on) | **by hand from the run at every step boundary** (J26): `scripts/worldclaw/deploy-drafts.sh` builds from a clean export of HEAD and uploads with `vercel deploy --prebuilt --prod`; Git auto-deploy off |
| Images | none of a draft's | **phone copies and thumbnails on Vercel Blob** (J28), uploaded once, content-hashed; a deploy carries only the shell and `atlas.json` (a few hundred KB) |
| Code | the game repo | **the game repo too** (J23): `vite.drafts.config.ts` → `dist-drafts/`, the page source in `src/drafts/`, the card in the deck |
| Originals | — | stay in git `art/<slug>/round-<n>/` (J30) |

The drafts site is its own home-screen app ("Wildshard Drafts"), with its own storage.

### 2.2 The lifecycle

| State | What exists | The game's deck | The drafts site |
|---|---|---|---|
| **draft** (P0 → P7 / P8) | `src/shards/<slug>/design/`, `art/<slug>/`, the draft's `atlas.json`; no manifest (WT4) | the COMING SOON card (J19, J38): day zero, then the key art | the draft's card; STAGES and EXPLORE (mock-ups) with the Developer switch on; the teaser page for everyone |
| **hidden** (P7 / P8 → P17) | + the manifest (`status: 'hidden'`, `bakeWhileHidden`, `gateExempt`: E10, R33), a grey then final world | the same card; with Developer mode on (J7), ENTER WORLD / EXPLORE WORLD via `showHiddenShards` (R22) | the same; each EXPLORE tab links to its built twin in the game once it exists (J44) |
| **experimental** (Jake's word after P17) | the shard | the Experimental badge, playable | the draft stays as the shard's history |
| **earlyAccess / live** | — | as today | as above |

### 2.3 Getting in (no URL switch)

1. In the game: swipe the deck to the draft's COMING SOON card. Its button is FOLLOW THE BUILD (the teaser page on the
   drafts site); with the game's Developer mode on (J7) it reads DRAFT MODE (the draft's page on the drafts site).
2. On the drafts site: its title is the game's carousel with a 17-tick stage bar on each card (J39); its Developer switch
   (J22, once per device, no password) shows STAGES and EXPLORE; off, the public sees each draft's teaser (J13).
3. Offline or with no drafts: no card in the game, no error.

### 2.4 A draft: STAGES and EXPLORE (J29, J40, J44)

- **STAGES** (home): the run's stages P0 → P17 as a timeline. A stage page (J40) is decision first: the picked image
  large, Jake's answer as a quote, the lineage (A → rev 1 → rev 2), the rejects greyed; a tap opens a full-screen swipe
  with a title strip and a counter. The header shows the step, what the run waits on and what comes next.
- **EXPLORE**, the mock-up mirror of the game's Explore (J44):

| Tab | Mock-ups it holds | Its built twin in the game |
|---|---|---|
| MODELS | the character, creature and gear concepts, each with concept → model → in game | Models |
| SETS | each set's planned members (the models and their copies) over an aerial concept in a bounds box, a member opening its MODELS card (J46) | Sets |
| WORLD | a carousel of the map, the World Explorer views, the 3-in-1s, and the first-person views with the camera check (each beside the blockout render from its camera and its cone on the map: J46); **Map Lab** opens from here (J31) | World |
| BEATS | the journey on the map, each quest step's 2x2 board (T20), and every NEW mechanic with its engine row, state and a test clip once built | Beats (J42) |
| COVERAGE | which places and areas have a mock-up yet (to do → mocked up), and where the mock-up cameras look | Coverage (J35, J43) |

- **Read-only** (J17, J24): browse, zoom, compare, play prototypes; in Map Lab, drag a place or walk the terrain as
  what-ifs that save nothing. No pick, note or verdict buttons anywhere; Jake answers in chat.
- **Keep everything** (J27): picks, boards and current images as phone copies (~150 KB WebP); rejected and superseded
  ones as ~50 KB thumbnails that open larger on a tap; nothing is pruned, during the run or after.

### 2.5 How it updates during a run

- **Each image, once:** when a step makes an image, `scripts/worldclaw/atlas.mjs <slug> --publish` makes its phone copy
  (or thumbnail), uploads it to Blob under a content-hashed name if it isn't there, then regenerates `atlas.json` from the
  design files, the art READMEs and the frames.
- **Every step boundary** (J26): `scripts/worldclaw/deploy-drafts.sh` deploys the drafts site (`run_in_background`), and
  the draft's artifact page (J25) is republished from the same `atlas.json`.
- **In chat** (J21): the stage's images go to Jake as one titled set, the map first, with the question; his answer goes
  into `design.md`'s verdict log and shows on the stage page after the next deploy.
- **The game card** changes only with the hourly game deploy (J19): its data file and the Blob URL of its key art.
- **Under the E357 lock** none of this ships; the rows start after the archive (J23, WORLDCLAW-SHARD D1).

### 2.6 The public card and the teaser

- **The game's card** (J19, J38): on day zero a plain card ("IN DRAFT", the name, one line, COMING SOON · NOT YET
  PLAYABLE, a FOLLOW THE BUILD link); from P3 / P4 the key art and FOLLOW THE BUILD; Developer mode on adds DRAFT + stage
  tags and DRAFT MODE. No ENTER / EXPLORE until the shard is playable.
- **The teaser page** (J13), on the drafts site, public: the key art, the name, one tagline, FOLLOW THE BUILD; its extra
  shots only on Jake's PUBLISH in chat (J11).
- **Spoilers:** items of kind map, boss, secret, critical path and verdict are `spoiler: true` by kind and never reach a
  public page; the key art is the exception (J38: the boss may show as a tease).

### 2.7 Data and paths

| What | Where |
|---|---|
| A draft's design | `src/shards/<slug>/design/` (`design.md` with §run and the verdict log, `decisions.md`, `style-bible.md`, `spec.json`) |
| Originals | git `art/<slug>/round-<n>-<label>/` with a README per round (J30) |
| Phone copies, thumbnails | Vercel Blob (a public store), `draft/<slug>/<hash>.webp` (J28) |
| The Atlas data (generated, never hand-edited) | `drafts/<slug>/atlas.json` (committed; its image URLs point at Blob) |
| Prototypes (built static pages, J9) | `drafts/<slug>/proto/<id>/` (≤ 5 MB each, the Simulator peak on its card) |
| The game card | `src/shards/<slug>/design/card.json` (name, line, key-art Blob URL), read by the deck |
| Generator, publisher, deployer | `scripts/worldclaw/atlas.mjs` (`--publish`), `atlas.schema.json`, `deploy-drafts.sh`, `atlas-artifact.mjs` (the artifact page) |
| The drafts site's source | `src/drafts/` (the title, STAGES, EXPLORE, Map Lab, the splash), `vite.drafts.config.ts` |
| The game's Explore tabs | `src/engine/explore/BeatsExplorer.ts`, `CoverageExplorer.ts`; Composition as a World mode (`CompositionMode.ts`) |
| Coverage data | `src/shards/<slug>/design/coverage.png` (2 m cells; R = band, G = status) + `coverage.json` from T5; `budgets.json` from T10 |
| Placement results | `src/shards/<slug>/design/objects/<place>.placed.json` (T8) |

An `atlas.json` item: `{ id, view: stages | explore, stage, tab?, kind, title, images[] (Blob URLs, size: full | thumb),
answer?, source (art path), made: codex | qwen | engine | cleanroom | lab | blender | hand, ref?: { build }, lineage?,
round?, spoiler, teaser }`.

### 2.8 Weight and budgets (J15)

- **The game:** only the card's data and button (≤ 1 KB gzip of code); its image is a Blob URL, lazy; no draft JS, CSS,
  HTML or image in the game build (W15 checks it).
- **The drafts site:** DOM only, no WebGL, except Map Lab's walk (its own chunk, loaded on a tap). The shell ≤ 60 KB gzip
  JS + 15 KB CSS; `atlas.json` ≤ 100 KB per draft; ≤ 24 thumbnails decoded at once; a prototype ≤ 5 MB.
- **The splash** (J41): the key art full screen (the name alone before P3), "DRAFT · <name> · <stage>", a thin bar with an
  image count, fed by `atlas.json` and the first screen's images.
- **Blob:** ~50–60 MB of phone copies and thumbnails per shard (J27), uploaded once each.

## 3. The tool catalogue

| Tool | Where | Stages | Rows | Days |
|---|---|---|---|---|
| The drafts site + its title (J16, J39) | drafts site | P0 → | W16, W4 | ~1.5 |
| STAGES + stage pages + the artifact page (J29, J40, J25) | drafts site + Claude | P0 → | W1, W2, W3, W8 | ~5 |
| Draft Explore, the mock-up mirror (J44) | drafts site | P0 → P8 | W17 | ~2 |
| Map Lab (J31) | drafts site, WORLD tab | P5, re-checked before P8 | W6 | ~3 |
| Prototype gallery (J9) | drafts site | D56, P7 | W7 | ~1 |
| The game's COMING SOON card (J19, J38) | the game's deck | P0 → | W9 | ~0.5 |
| Composition, a World mode (J33, J43) | the game's Explore | P9b, P10, P12, P15–P16 | W10 | ~2.5 |
| Coverage tab (J34, J35, J43) | the game's Explore | P8, P12–P17 | W11 | ~2 |
| Beats tab (J42) | the game's Explore | P8–P9, P17 | W14 | ~2 |
| The place checkpoint board (J3) | chat (interactive) | P12 | W12 | ~0.5 |
| Weight gate + splash (J15, J41) | CI + drafts site | every stage | W15 | ~1 |
| Skill wiring | the three skills | every step | W13 | ~1 |

Every part is an experiment (J32): built lean for the pilot, kept or cut after it.

### 3.1 STAGES and the stage page (W3, W8)
See §2.4. Plus: the run header (step · waiting on · next · rows done / total · last build); a lineage per view (concept →
mockup → grey capture → composition → each built round → now), any two compared by a slider; milestone clips and the
time-lapse (T13); "decided for you" (the judges' calls in `decisions.md`, read-only).

### 3.2 Draft Explore (W17)
§2.4's five tabs. WORLD carries the camera check (J46): each first-person view beside its blockout render from the same camera
and its cone on the map (T19), with a flag when a landmark disagrees ("lighthouse flipped"). BEATS carries the mechanics
tracker. Each tab links to its built twin in the game once the shard is loadable.

### 3.3 Map Lab (W6; J31)
- **A, the main screen:** the painted map (or the schematic) with layers (layout, terrain, slope ≤ 30° / 30–40° / > 40°,
  sightlines, polish bands); live numbers: walkable %, places flat ≥ 80 %, the close band's share, the dragged place's
  flat %. Dragging a place re-stamps its region disc (T3), re-runs Eq. 6 (T4), its pad (R5), the sightlines and bands near
  it, in a worker; delta chips show the change. Nothing saves (J24).
- **B, the walk:** an eye-height lite walk on the bare terrain, full screen on a button; a three.js heightfield in the
  sketch look, a stick and a drag, slope under the feet; > 40° blocks; its own chunk.
- **C, the variant checks:** each P5 map variant's checks (places in region, routes on walkable ground, places flat,
  sightlines) beside the variants on the P5 stage page.
- **Data:** `spec.json`, T3's region weights, T4's operators, T5's viewpoint maths (WT6).

### 3.4 Prototype gallery (W7)
A card per prototype in WORLDCLAW-SHARD §10's format (question, what was built, the answer, what it changed, Jake's
answer, its images); PLAY opens the built page as its own page with "← Drafts" (WT8), or for P7 a link to the game's
playground.

### 3.5 Composition mode in World (W10; J33, J43)
World's sub-tabs Capture · Composition · Built · Target at a camera. **A** the painting vs built slider (the main view);
**B** the lifted objects as labelled 3D boxes, flagged ones amber, NEXT CAMERA (a toggle); **C** the judges' score and
must-fix as a small read-only panel. A camera list grouped by place. Data: `design/cams/*.json`, `design/objects/*`,
the phone copies of captures, targets and compositions.

### 3.6 Coverage tab (W11; J34, J35, J43)
**A** the map heatmap (main): each 2 m cell coloured by J35's ladder (unseen · to do · mocked up · composed · signed off),
a funnel of the close band's shares, close / mid / far filters; Jake's notes as pins. **C** the places list (a tab):
each place's close / mid coverage, its status and its triangle + draw bars against R28. **B** the in-world overlay (a
World toggle). A tap on a cell: its band, status, the cameras that see it, the last step that touched it, FLY HERE.
2D canvas, no extra GPU work. Data: `coverage.png` / `.json` (T5), `scripts/worldclaw/coverage.mjs` (status from P12 /
P15 and Jake's note positions), `budgets.json` (T10).

### 3.7 Beats tab (W14; J42)
**A** the critical path on the map as typed legs (walk, rope, sled lane, climb…) with numbered beats; a leg's card:
length, time, its walk-test result (`leg-test.mjs`: pass / N stuck / not tested), the beat, **PLAY FROM HERE**
(`travel({ to, mode: 'enter', arrive })`). **B** the legs as a list with time and test chips and the beats between them
(a tab). **C** the path as a ribbon in the world with beat markers (a World toggle). Developer-only.

## 4. Rows

State per row: `todo` · `in flight (<owner>)` · `done (<commit>)` · `needs pick` · `dropped`.

### W0: now, throwaway (D56)

| Row | What | Done when | State |
|---|---|---|---|
| W0 | The Atlas as an Artifact prototype over Nine Dragon's pre-walkable phase | Jake opens it on his phone | not now (J8) |
| W0b | Map Lab as an Artifact prototype on the fjord fixture | the numbers match the Python prototype within 1 point | not now (J8) |

### W: after GAME-NORMALIZATION is archived (WORLDCLAW-SHARD N0 re-grounds these paths too)

| Row | What | Done when | State |
|---|---|---|---|
| W1 | **The data contract**: `atlas.schema.json`; `atlas.mjs` builds `atlas.json` from `design.md` (§run, §vision, the verdict log), `decisions.md`, `style-bible.md`, the art READMEs and the frames; views, tabs, kinds, lineage ids, spoiler by kind with the key-art exception (J38), `ref.build` per mockup | fixtures: a design folder → the expected `atlas.json`; a spoiler on a public page fails; a mockup with no `ref.build` fails | todo |
| W2 | **Publish** (J28, J27): phone copies (~150 KB) and thumbnails (~50 KB) made once and uploaded to Blob under content-hashed names; `atlas.json` with Blob URLs into `drafts/<slug>/`; nothing pruned | a re-publish with no new art uploads 0 files; a rejected image gets a thumbnail; the Thin Ice fixture is ~35 MB on Blob | todo |
| W3 | **STAGES + the stage page + the artifact page** (J29, J40, J25): `src/drafts/` STAGES and the decision-first stage page with the tap-to-swipe; `atlas-artifact.mjs` makes the read-only artifact page from the same `atlas.json` | the Thin Ice fixture renders the same in both (a capture each); page memory on the Simulator ≤ 300 MB with 300 items | todo |
| W4 | **The drafts title** (J39, J22): the carousel over key art with a 17-tick stage bar per card, OPEN DRAFT, the Developer switch; the public state (COMING SOON, FOLLOW THE BUILD, PLAY DRIFTWOOD ISLE NOW) | Developer off shows only teasers; on, STAGES and EXPLORE open | todo |
| W5 | **Boards as items** (J17, J21): T11's boards are `board` items with the question, the options, the recommendation and Jake's answer as text from the verdict log; no verdict posts | a fixture decision shows its board and its answer after the next publish | todo |
| W6 | **Map Lab** (§3.3; J31): A, B and C on T3 / T4 / T5's code (WT6) | Done-when 4; the walk holds 30 fps on the phone tier | todo |
| W7 | **Prototype gallery** (§3.4): `atlas.mjs --proto <dir>` copies a built page into `drafts/<slug>/proto/<id>/`; a card per prototype from its README | a fixture prototype opens as its own page and "← Drafts" returns; its Simulator peak is on its card | todo |
| W8 | **Lineage + run header + decided for you** (§3.1): T13's step frames published; lineage by view id; the header from §run | a fixture run of 3 steps shows a 3-frame lineage and the right step / waiting on / next | todo |
| W9 | **The game's COMING SOON card** (J19, J38): `card.json` read by the deck; day zero, key art, Developer on (DRAFT MODE opens the drafts site); its image a lazy Blob URL | Done-when 3 and 7; a deck with no draft is identical | todo |
| W10 | **Composition mode in World** (§3.5; J33, J43); T8 writes `*.placed.json` | Done-when 5 on a fixture place; Explorer memory ≤ 1.0 GB (Simulator pre-check) | todo |
| W11 | **The Coverage tab** (§3.6; J34, J35, J43); T5 writes `coverage.png` / `.json`, T10 `budgets.json`; `coverage.mjs` | Done-when 6 on the fixture fjord; a status change after a fixture P12 step shows up | todo |
| W12 | **The place checkpoint board** (J3, `worldclaw-interactive`): built from W10's data at the end of each place's P12, sent to chat (J21) | a fixture place's board reaches chat; GO and "revise one thing" both route | todo |
| W13 | **Skill wiring**: the three skills publish at every step (W2), deploy the drafts site at every step boundary (J26), republish the artifact page (J25), send each stage to chat as one titled set (J21) | a dry run of P0–P2 on a fixture: the draft shows the vision, the pitch board, the answer | todo |
| W14 | **The Beats tab** (§3.7; J42) | the fixture slice's legs listed with their tests; PLAY FROM HERE starts at a leg | todo |
| W15 | **The weight gate + the splash** (J15, J41): `scripts/worldclaw/draft-weight.mjs` in CI with §2.8's budgets; the game build has no draft file; the key-art splash | the game's entry within +1 KB gzip; no draft URL in the game's boot list; a fixture splash shows within 1.5 s on the phone tier | todo |
| W16 | **The drafts site** (J16, J23): the Vercel project (named first, Git auto-deploy off), `vite.drafts.config.ts` → `dist-drafts/`, `deploy-drafts.sh`, the PWA manifest "Wildshard Drafts", a public Blob store | a fixture draft deploys in ≤ 3 min; a push to main deploys nothing on the drafts project | todo |
| W17 | **Draft Explore** (§3.2; J44): the five mock-up tabs; SETS' planned members (J46); WORLD's camera check (T19's cones and blockout renders); BEATS' mechanics tracker (T20's boards, `design.md`'s mechanics list) | the Thin Ice fixture: 6 models, 11 sets with their checks, the world carousel, 12 beats with 14 mechanics, coverage of 11 places | todo |
| W18 | (absorbed into W17: the camera check is in WORLD, J46) | — | merged |

Every row: the other-shards proof (WORLDCLAW-SHARD §3, rule 3) where it touches the engine or the deck; a test; evidence.

## 5. Order and estimate (J37: just in time)

**Now:** nothing (J8, J23).

**After GAME-NORMALIZATION is archived:**
1. N0 (WORLDCLAW-SHARD) re-grounds this plan's paths with the rest.
2. **Before the pilot's P0:** W16 → W15 → W1 → W2 → W3 → W4 → W5 → W8 → W9 → W17 → W13. Thin Ice's dry run is the
   first draft (J18). These replace T15 in the stage-entry table (§8).
3. **Just before the Thin Ice stage that needs it:** W7 (prototypes, any time after W2); W6 before P5's re-check (after T3,
   T4); W11 before P8's report (after T5, T10); W14 before the slice (after T5, T16); W10 before P9b (after E4, T6, T8),
   then W12.
4. **After the pilot:** the keep / cut review of every part (J32).

| Part | Rows | Days |
|---|---|---|
| Before P0 | W16, W15, W1, W2, W3, W4, W5, W8, W9, W17, W13 | ~12 |
| Map Lab, prototypes | W6, W7 | ~4 |
| The game's Explore tools | W10, W11, W12, W14 | ~7 |
| **Base after the archive** | W1–W17 | **~23** (T15's ~0.5 absorbed) |

## 6. Risks

| Risk | Mitigation |
|---|---|
| A spoiler reaches a public page | spoiler by kind; the generator refuses a spoiler on a public page; the key art is the only exception (J38) |
| The Developer switch is public: anyone who flips it sees the drafts | accepted by Jake (J7, J22) |
| A Blob URL is public | unguessable content-hashed names; the same exposure J22 accepts |
| Vercel cost of a deploy per step boundary (J26) | prebuilt, a few hundred KB each (images on Blob: J28); Git auto-deploy off |
| The game's card adds weight | ≤ 1 KB gzip of code, data ≤ 2 KB, a lazy Blob image (W15 checks the build) |
| Repo growth from originals (J30) | ~100 MB per shard in `art/`; accepted (today's rule) |
| The drafts site and the game's title drift | one deck component in the repo, two thin shells (J23) |
| The artifact page and the drafts site drift | one `atlas.json`, two renderers; W3's fixture renders in both |
| A prototype page crashes Safari | its own page, never over a loaded shard; a Simulator peak before PLAY; a physical reading for anything that ships into the shard |
| Phone memory of the Explore tabs | 2D canvas and DOM overlays; Done-when 6's physical reading |
| Tools built and never used | J32's keep / cut review after the pilot; J37 builds each just before its stage |
| A stale reference under a mockup (Nine Dragon 19:49) | `ref.build` on every mockup; a "stale ref" chip |

## 7. Jake's answers and what is still open

**Answered:** J1–J52 (§0.3, §0.5), from the grill of 2026-10-01 (waves 1–6 and rounds 1–3 of mockups, every board picked).

**Still open:**
- this plan's own council (later; docs/process/COUNCIL.md);
- after the pilot: the keep / cut review of every tool part (J32).

## 8. How it changes WORLDCLAW-SHARD (applied 2026-10-01 where they still stand)

**Applied:** T15 superseded (D64, D65); T4 / T5 / T8 / T10's outputs for Map Lab, Coverage and Composition; E10's draft
state; P0 creates the draft and its card; P9's PLAY; the three skills (D62); P7 after the mockups (D57); the close band
first (D60); the place checkpoint (D63, W12). **New with J21–J44:** each stage goes to Jake in chat as one titled set
(J21) and to the drafts site at every step boundary (J26); P5 reviews the map variants with Map Lab's checks (J31); P6's
views carry the camera check in Draft Explore's WORLD (J44, J46); P8 onward uses the game's Beats and Coverage tabs (J42, J43).
