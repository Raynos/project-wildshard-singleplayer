# Plan: TRAILERS — an alpha in-engine trailer and a cinematic vision trailer (E466)

**State:** `in progress` 2026-10-09 — building Part A, the alpha trailer (TR1–TR6). The capture rig runs on today's
build as it is (`capture.mjs` boots through the allowed harness params). Part B waits until the alpha trailer is done
(Jake: no cinematic experiments before it); its research is in.

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
| TR1 | **Shot list** — 2–4 candidate moments per shard, scouted as stills from a HEAD build (`--dry`); the best per shard kept, written into `scripts/steam-trailer/shots/<shard>.mjs` (new files for Signal Dunes, Sky Reach and the grid crossing) | a scouting board exists and each shard has its shots as code | trailer agent |
| TR2 | **Revive the capture rig on today's engine** — boot through the engine's own hooks instead of URL switches (skip intro, no pointer lock, mute, desktop tier, the capture clock X8 added), shots re-pointed at today's world API; one shot per shard captured end to end | `capture.mjs --dry` writes stills for every shard from a clean export of HEAD | trailer agent |
| TR3 | **Score** — one ~60 s MiniMax Music 3 cue with a quiet open, a build and a peak (4 seeds, `music_scan.py` picks the hits); trailer SFX reused from E168's best takes, new families generated with MOSS v2 **and** SA3, the better take used | the cue and SFX are on disk with their credits | trailer agent |
| TR4 | **Titles** — the alpha card, the corner bug, the per-shard lower thirds and the end card in the site's look (Lattice violet, the Cell logo) | titles render as PNG sequences | trailer agent |
| TR5 | **The Claude Code beat** — a real screen recording of a Claude Code session building a shard (sped up, captioned "real session, sped up"), into the time-lapse | the clip is cut from a real session | trailer agent |
| TR6 | **Capture, cut, mix, conform** — `cut.mjs` on the cue's hits, the full capture, the mix at −14 LUFS, the 1080p60 master | the master plays whole with no dropped or stale frames | trailer agent |
| TR7 | **Ship it on the site** — the loop encodes and the poster through `site/tools/publish-media.ts`, `site/media.json` `trailer` replaced, COPY.md's trailer tag "Alpha · captured in engine"; a ≤ 4 MB phone copy sent to Jake | wildshard.io plays the new trailer | trailer agent |
| TR8 | **Re-shoot recipe** — README updated so the trailer is re-made after big changes with one command per step | the README's commands run as written | trailer agent |

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
