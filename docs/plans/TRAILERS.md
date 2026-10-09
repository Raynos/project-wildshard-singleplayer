# Plan: TRAILERS — an alpha in-engine trailer and a cinematic vision trailer (E466)

**State:** `in progress` 2026-10-09 — **Part A done: the 63 s alpha trailer is on wildshard.io** (`55d4cc841`; the six
shards in engine at HEAD, a real Claude Code session beside the Sky Reach time-lapse, the grid fly-in, alpha said three
ways). Open: TR9, a shard-to-shard crossing shot (the grid's loading never settles under the capture clock). Part B,
the cinematic, starts now that Part A is done (CT1, the bake-off); its research is in.

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

### 3.1 What it shows (a first script, for Jake to rewrite)

~60–90 s, labelled **Concept trailer · not gameplay**. A dark sky lattice → an author types one sentence into Claude
Code → a 500 m cube of world grows from the line → the author walks it → nine beacons light at its corners and centre,
the upload ritual → the shard flies up and docks into the glowing grid → players cross the seams from one shard into the
next, each in its own look → the camera pulls out over the 5 × 5 grid → "Play it in the browser. Build it in Claude
Code." · wildshard.io.

### 3.2 How it could be made (Jake, 2026-10-09)

A straight Blender render is out (Jake: *"making a video in Blender is going to be absolute dog shit … we know that"*).
Blender's job is the **grey blockout and the camera**: boxy shapes, our real GLBs where they help, a directed camera,
and the passes a model can follow (depth, normals, line art, flat colour IDs). An AI model makes it look good. The
source can also be **a capture from the alpha game**, remastered. Three ways, all local (CT0: no paid cloud model):

| Way | How | Strength | Risk |
|---|---|---|---|
| **A · Image-to-video** | a keyframe still (codex `image_gen` or Qwen-Image-2.1, in the concept-art style) animated 5–10 s at a time by an open video model | the fastest to a cinematic look | the camera and layout are the model's guess, not directed; shot-to-shot consistency |
| **B · Blender grey → video-to-video** | the grey blockout (or an in-game capture) rendered with its passes and fed as the control video to an open video model that remasters it (VACE / control-style), first frame and style from a remastered still | we direct the camera and the layout; the model only paints | does an open model on this Mac hold the look over 5–10 s; speed on MPS |
| **C · Per-frame image-to-image** | every frame of the grey blockout or the in-game capture restyled by an image model (img2img with depth / edge control, never text-to-image), then made temporally consistent (keyframe propagation, flow warping, deflicker, "on twos" at 12 fps) | exact framing; the image models we already run well | flicker: text-to-image per frame is a shit show (Jake); 24 images per second is slow |

Research before the build (2026-10-09, two research lanes): which open video models do control-video and image-to-video,
their licences for a shipped asset, and whether they run on the M5 Max; and the community's best practice (Reddit, X)
for grey-blockout previs into AI video, camera direction, per-frame restyle and the finish. Findings:
[trailers/research-2026-10-09.md](trailers/research-2026-10-09.md) (lead: B = LTX-2.5 + the Layout-To-Render IC-LoRA;
Qwen-Image-2.1 is non-commercial, so shipped frames need an Apache-2.0 image model).

**CT1 tests all three on the same shot** (the shard docking into the grid, ~6 s, one Blender grey blockout plus one
in-game capture as sources) and shows Jake one labelled A / B / C video. Then we feel it out: the winner, or a mix per
shot, makes the trailer.

### 3.3 Rows

| # | Row | Done when | Owner |
|---|---|---|---|
| CT0 | ✅ **Jake's picks** (2026-10-09): the bake-off, local models and Blender only, no paid cloud model (§5) | answers recorded | Jake |
| CT1 | **Bake-off** — the docking shot as a Blender grey blockout (script-built, `scripts/blender/`) and an in-game capture, then made ways A, B and C with open models run locally (fetched to `~/projects/weights` under the model lock, each licence checked for a shipped asset); one labelled A / B / C video, iPhone portrait board plus the 16:9 clips | Jake picks a way, or a mix per shot | trailer agent |
| CT2 | **Script and boards** — the §3.1 script rewritten with Jake, then a storyboard of 12–20 keyframes in the concept-art style | Jake has read the board | trailer agent + Jake |
| CT3 | **Shots** — every shot made the picked way | the shots exist at 1080p | trailer agent |
| CT4 | **Score, cut, ship** — a MiniMax cue, MOSS / SA3 SFX, the cut, the "Concept trailer · not gameplay" label, the site's slot | wildshard.io plays it | trailer agent |

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
