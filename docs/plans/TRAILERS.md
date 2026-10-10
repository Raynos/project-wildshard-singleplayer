# Plan: TRAILERS — an alpha in-engine trailer and a cinematic vision trailer (E466)

**State:** `in progress` 2026-10-10 — **Part A done** (the alpha trailer, live on wildshard.io). **Part B: CT1 done**
(ten experiments, Jake's verdicts: LTX Layout-To-Render on a Blender grey (#9) and LTX from a Qwen keyframe (#10b) win);
**CT2 draft 2** of the cinematic plan is being reviewed by a council (the highway look, our six shards). Open: TR9, CT2–CT6.

## 0. Why

Jake (E466, 2026-10-09): *"We want to make a new trailer for the game. The existing trailer is old. This is a trailer
that should clearly say that this is alpha gameplay in engine, very much alpha. We probably also want to make a
cinematic trailer. That's a trailer for the vision. A cinematic trailer would be not using in-engine footage. I have no
idea how you would make it. … This is to go on the marketing website."*

Two trailers, two jobs, the same honesty rules as the site (MARKETING-SITE §1.1):

| | **A · Alpha trailer** | **B · Cinematic vision trailer** |
|---|---|---|
| Sells | the road: what you can play today | the destination: the MMO built by its players in Claude Code |
| Footage | 100 % captured in engine, at HEAD | none from the engine: made shots |
| Label | "Alpha · captured in engine · work in progress", start to end | "Concept trailer · not gameplay" |
| On the site | replaces MS11's trailer (the 21 s cut of the 18 September trailer) | the hero or the "The world" section, beside the concept art |

## 1. What exists

- **`scripts/steam-trailer/`** (E168, 2026-09): a clean-room in-engine pipeline: shots as code (spline camera rigs or
  the player's own inputs), a fixed-step capture at 3840 × 2160 / 120 Hz, titles as PNG sequences, a MiniMax Music 3
  score, MOSS + Stable Audio 3 trailer SFX, a −14 LUFS mix, a 1080p60 conform with motion blur and grain. It made the
  45 s Steam cut (Driftwood · Nalati · Pine) and the Nine Dragon portrait teaser.
- **It does not run on today's engine:** `capture.mjs` boots the game with URL switches (`?skipintro&nolock&tier=…`
  and per-shot params) that E451 / `wildshard/no-url-switch` removed, and the shots read `window.__wildshard.world`
  from before E357 / E432. Reviving it is TR2.
- **The site's trailer today:** `site/media.json` `trailer` (1280 px and 720 px MP4s on Blob, muted autoplay loop).
- **Seven shards** (the site's §3): Driftwood Isle (toon), Pine Hollow (photoreal), Nalati Grasslands (painterly),
  Signal Dunes, Sky Reach (`far-reach`), Nine Dragon Stack, the Template; plus the WorldClaw dry run (Thin Ice) and the
  grey-to-final time-lapse (`progress/far-reach/timelapse-heroes.mp4`).
- **No local video model** is fetched (`~/projects/weights/MODELS.md`); the machine is an M5 Max with 128 GB.

## 2. Part A — the alpha trailer

### 2.1 Shape (defaults until TR0 says otherwise)

- **~60 s, 16:9, 1080p60 master**, plus the site's muted loop encodes (1280 / 720 px) and a with-sound version behind a
  click-to-play.
- **Alpha, said three ways:** an opening card ("Alpha gameplay · captured in engine · everything here is work in
  progress"), a small corner bug on every frame ("ALPHA · IN ENGINE"), and the end card (wildshard.io · Play free in
  your browser · the credits the licences require).
- **Beats:** a cold open on the best single moment → one short run per shard in its own look (traversal, a fight, a
  ride, a vista) → the build door (a real Claude Code session building a shard, then the grey-to-final time-lapse) →
  the grid (crossing a seam between shards) → end card.
- **Nothing staged that the game can't do:** every shot is played or rigged in a real build at the captured SHA;
  the HUD may be hidden, the world may not be retouched.

### 2.2 Rows

| # | Row | Done when | Owner |
|---|---|---|---|
| TR0 | ✅ **Jake's picks** (2026-10-09): 60 s, card + corner bug + end card, the Claude Code beat in (§5) | his answers recorded in §5 | Jake |
| TR1 | ✅ **Shot list** (2026-10-09) — the old Driftwood / Nalati / Pine / Nine Dragon shots re-scouted at HEAD (the rope bridge and the reef dropped: one spawns underwater, one frames a road pad); new `shots/dunes.mjs`, `shots/sky-reach.mjs`, `shots/grid.mjs` (`6491be516`, sheet `progress/trailers/scout-dunes-sky-grid.jpg`) | a scouting board exists and each shard has its shots as code | trailer agent |
| TR2 | ✅ **The capture rig on today's engine** (2026-10-09) — it ran as it was: `capture.mjs` boots through the allowed harness params (`lint/url-params.json`), not removed switches; only the Storm Titan shots' `window.__titan` hook is gone (not used) | `capture.mjs --dry` writes stills for every shard from a clean export of HEAD | trailer agent |
| TR3 | ✅ **Score** (2026-10-09) — MiniMax take 304 of `alpha-jobs.json` (a drone, the hit at 14.9 s, a breath at 37–46 s, the drop at 65.5 s; the 44–56 s vocal-like line is wordless: Whisper finds no words); SFX regenerated with MOSS v2 and SA3 Medium, CLAP-picked | the cue and SFX are on disk with their credits | trailer agent |
| TR4 | ✅ **Titles** (2026-10-09) — the alpha card, the ALPHA · IN ENGINE corner bug, the shard lower thirds, two captions and the end card (the Cell logo, Play free in your browser, wildshard.io) in `titles.html` | titles render as PNG sequences | trailer agent |
| TR5 | ✅ **The Claude Code beat** (2026-10-09) — `build-beat.mjs`: an asciinema recording of a real session adding a lookout tower to Sky Reach in a scratch worktree (6.5 min, 55× faster, cut at /exit) beside two of Sky Reach's 25-commit time-lapses | the clip is cut from a real session | trailer agent |
| TR6 | ✅ **Capture, cut, mix, conform** (2026-10-09) — `cuts/alpha.mjs` on take 304's grid, 24 clips at 4K / 120 Hz, the mix at −14 LUFS, a 63.2 s 1080p60 master | the master plays whole with no dropped or stale frames | trailer agent |
| TR7 | ✅ **Ship it on the site** (2026-10-09, `55d4cc841`) — 1280 / 720 px silent loops on Blob, the alpha card as poster, COPY.md's trailer tag "Alpha · captured in engine"; a 7.7 MB phone copy with sound sent to Jake | wildshard.io plays the new trailer | trailer agent |
| TR8 | ✅ **Re-make recipe** (2026-10-09) — `scripts/steam-trailer/README.md` § The alpha trailer | the README's commands run as written | trailer agent |
| TR9 | **A crossing shot** — walking or riding over a seam from one shard into the next. Blocked: under the capture's fixed clock the grid's loading panel ("LOADING DRIFTWOOD ISLE") never clears and the neighbours never report ready (`shots/grid.mjs` notes); needs the grid's loading to settle under the capture clock, or a capture hook that waits for a cell. Then a re-cut swaps it in for the fly-in or beside it | a seam crossing in the trailer | trailer agent (the grid's owner for the loading) |

## 3. Part B — the cinematic vision trailer

**Draft 2 of the plan (2026-10-10):** the script, the shots and the method are in
[trailers/ct2-script.md](trailers/ct2-script.md); what is settled is in [trailers/council/ledger.md](trailers/council/ledger.md);
the bake-off is [trailers/ct1-shot.md](trailers/ct1-shot.md); the research [trailers/research-2026-10-09.md](trailers/research-2026-10-09.md).

### 3.1 What it shows

~67 s, labelled **Concept trailer · not gameplay**: an empty plot in the night grid → an author types one line into
Claude Code → the shard builds from grey to colour → the author walks it → the nine-beacon upload ritual → it goes live
in the plot between the highways → headlights stream in → the crossroads where four shards meet → a drive between two
styles → Nalati, Signal Dunes, Sky Reach, Nine Dragon → the pull-out over shards and highways to the horizon → *Play it
in the browser. Build it in Claude Code.* · wildshard.io. **The world is the engine's** (Jake, 2026-10-10): our six
shards in their own styles, divided by the 15 m highway with road entries and roundabouts; no glowing lattice.

### 3.2 How it is made (CT1, decided)

CT1 made one shot (a shard docks into the grid) ten ways locally (`trailers/ct1-shot.md`, board `art/trailers/round-1-bakeoff/`):

| # | Way | Result | Jake (2026-10-10) |
|---|---|---|---|
| 1 | Blender grey blockout (the input) | the directed layout + camera, grey | "can't tell what I'm looking at" — an input, never shown alone |
| 2 / 3 | style keyframes, Qwen-Image-2.1 / OpenAI Image 2.5 | both strong; OpenAI painterly, Qwen photoreal and closer to the blockout's framing | OpenAI picked for stills (before 10b) |
| 4 / 5 / 6 | per-frame repaint (every frame / keys + EbSynth / the alpha capture) | the look works, the camera holds; soft "breathing" between keys | "way too jarring" — out |
| 7 / 8 | Wan 2.2 image-to-video / Wan VACE on depth | barely moves (15 min for 3 s) / ignored the look | out |
| 9 | **LTX-2.5 Layout-To-Render on the grey + a look still** | follows the directed camera, painted | **"way better"** |
| 10 | LTX-2.5 image-to-video from the OpenAI keyframe | holds the look 6 s, ~5 min | "surprisingly good", but below 9 / 10b |
| 10b | **LTX-2.5 image-to-video from the Qwen keyframe** | — | **"way better"** |

**The method:** directed shots = a Blender grey blockout + a look still → LTX Layout-To-Render (#9); atmosphere shots =
a keyframe (an in-engine capture repainted, else a still from the references) → LTX image-to-video (#10b). Text is
always an overlay.

### 3.3 Rows

| # | Row | Done when | Owner |
|---|---|---|---|
| CT0 | ✅ **Jake's picks** (2026-10-09): the bake-off, local models only | answers recorded | Jake |
| CT1 | ✅ **Bake-off** (2026-10-10) — ten experiments on one shot, the board sent, Jake's verdicts recorded (§3.2, §5) | Jake picks a way | trailer agent |
| CT2 | ◐ **Script, look and storyboard, draft 2** — rebuilt on the highway (ct2-script.md), the round-2 look (`art/trailers/round-2-highway/`: three references, six shard concept paintings from in-engine views, the storyboard), put through a council (`trailers/council/`) | Jake has read the draft | trailer agent + Jake |
| CT3 | **The blockout kit** — `scripts/steam-trailer/cinematic/` grows from `dock_blockout.py` into a shared kit (highway grid with markings and roundabouts, plots, the floating shard, beacons, cars, a rider) and one blockout per directed shot (1, 3, 6, 7, 9, 14) | each directed shot has grey / depth / normal at 1280 × 704 | trailer agent |
| CT4 | **Look stills and keyframes** — one per shot (Qwen-Image-2.1 local, OpenAI for hero stills), from the blockout's first frame or an in-engine capture, in the round-2 look | every shot has its still | trailer agent |
| CT5 | **The shots** — LTX Layout-To-Render (directed) or image-to-video (atmosphere), 4–6 s each; weak takes re-rolled with a new seed | 14 shots at 1280 × 704 | trailer agent |
| CT6 | **Score, cut, ship** — the MiniMax cue (`concept-jobs.json`), trailer SFX, the cut on the cue's hits, overlays (the typed prompt, the end card, the label), upscale to 1920 × 1056, the site's slot beside the alpha trailer | wildshard.io plays it | trailer agent |

## 4. Not in this plan

A Steam page trailer (FINISH-LINE SC4 keeps the 45 s cut), the app-store previews (NATIVE-APPS), a voice-over.

## 5. Jake's picks (2026-10-09, question tool)

- **Length: 60 s.**
- **The alpha label: all three**: the opening card, the "ALPHA · IN ENGINE" corner bug on every frame, the end card.
- **The Claude Code beat: in**: a real session, sped up and captioned, into the grey-to-final time-lapse.
- **The cinematic bake-off: local models and Blender only**: no paid cloud video model.
- **The three ways (Jake, after the picks):** Blender for the grey blockout and the camera only, never the final render;
  then A image-to-video, B grey → video-to-video remaster, C per-frame image-to-image (never text-to-image) from the
  grey or an in-game capture. *"You have to test all these approaches and feel it out, vibe it out."*
- Shards (default, not asked): the six playable ones; the Template stays out.
- **Image models for the cinematic: Qwen-Image-2.1 and OpenAI Image 2.5** (Jake, 2026-10-09: *"Use qwen image it's a
  trailer fuck off with non commercial"*, *"you can use OpenAI image 2.5 as well as qwen image 2.1"*). No licence caveat
  on the trailer's image model.
- **The cinematic's method: keyframe → LTX-2.5** (Jake, 2026-10-10, on the CT1 board: *"Experiment 10 looks surprisingly
  good"*; *"Experiment 8 failed, experiment 7 barely moves"*). Keyframes by OpenAI Image 2.5 (his pick).
- **The look follows the engine, not the concept art** (Jake, 2026-10-10): *"way too heavily built around the concept art …
  What we actually did in the alpha in-game is we have the road network instead … the fact that there is a highway and not
  this blue is really important"*. Shards are our real ones in their own styles, divided by the 15 m server-owned highway
  (VISION.md), with road entries at each edge's midpoint; no glowing lattice walls.
- **On the site: beside the alpha trailer** (Jake, 2026-10-10), in "The world"; the alpha trailer stays the main one.
