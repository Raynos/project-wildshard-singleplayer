# Cinematics: generated video, trailers and cutscenes — what works here

Linked from [AGENTS.md → Mockups](../../AGENTS.md). Written 2026-10-10 from the E466 / E471 / E472 / E474 trailer
session (TRAILERS Parts A–E, `docs/plans/TRAILERS.md`), at Jake's ask (E475): *"The techniques that we use for visual
generation, those are really useful techniques. Let's get them written down. Everything in the session that we learned
about cinematic trailers."* The plan that uses this for the game itself: [IN-GAME-CUTSCENES](../plans/IN-GAME-CUTSCENES.md).

## 1. Jake's verdicts (the bar, in his words)

| Made | Jake | Lesson |
|---|---|---|
| CT1 #4–#6: per-frame image-to-image repaint (EbSynth / frame-by-frame) | *"way too fucking jarring … the frame-by-frame drift"* | per-frame repaint is out |
| CT1 #7, #8: Wan 2.2 | failed / *"barely moves"* | Wan is out; LTX-2.5 is the video model |
| CT1 #9 (LTX Layout-To-Render on a Blender grey) and #10b (LTX from a Qwen repaint of the grey) | *"way better than #10"* | a calm keyframe → LTX beats a busy one |
| CT2: 67 s, 15 unrelated generated shots | *"insanely AI … really like AI software clips put together"* | never a montage of unrelated pretty clips |
| T15 V4: a camera push over one painting (camera projection) | *"not a moving trailer"* | a camera move over a still is not motion |
| T15 V3: printed cards dealt on a map | *"just images"* | stills moving around are not a trailer |
| T15 V1 (a real Claude Code session → glyph mosaic) and V2 (an ink map drawing itself) | *"have potential"* | authored motion design reads as made by a person |
| P15: three 15 s player cinematics in the WoW-2004 spirit (one hero per trailer, character sheets, LTX) | *"great"* — but *"suggest a AAA game … imply a product that would cost millions"* | the promise must match what the game can deliver |

The two that matter most:
- **Motion is the bar.** A real thing must move (a rider, a fall, a party walking); designed motion (strokes drawing,
  glyphs flying) also counts. A camera over a still does not.
- **Promise only what you can ship** (Jake, 2026-10-10, after the P15 cinematics). Concept art in the image model's own
  taste promises AAA. Start from the game's real look (in-engine captures, our models) and polish lightly. A friend:
  *"you could even incorporate high quality cut scenes into the game, then it's not false advertising"*.

## 2. Structure: what makes a 15-second cinematic work

- **One hero or one party carried through every shot**, from one **character sheet** used as the reference for every
  keyframe. Give the hero identity anchors that survive any art style: a white horse, a long red cloak, a yellow scarf,
  a striped glider.
- **Three or four shots, cut on motion**, ending on **one reveal** (the transformation, the monster, the dragon). The
  2004 WoW cinematic's grammar: heroes, action, scale, one reveal. Heroes seen **from behind**, facing the reveal, hide
  faces (LTX's weak spot) and read as the WoW pose.
- **Cut on the score's hits.** Generate the cue first (MiniMax Music 3, ~16 s, with timed sections in the prompt),
  find its onsets (energy-flux peaks), and set the shot boundaries on them (P15: the Antler King on the 6.0 s hit, the
  glider on 7.65 s). The P15 cutter: `scripts/steam-trailer/p15/assemble.py`.
- **A style change is a cut, never a morph.** The Crossing changes the rider from painterly to toon by cutting at the
  top of a leap: two keyframes in the same pose and framing, side-on, a locked direction of travel.
- **Muted first:** captions carry the pitch (large, ≥ 44 px cap height at 1080p, phone-readable); a corner tag
  *Concept trailer · not gameplay* on every frame of anything that isn't gameplay; the end card (logo, a line for that
  audience, `wildshard.io`).
- **Two audiences, two trailers** (Jake, E472): builders (Claude Code makes a shard) and players (the worlds). Don't mix
  the pitches; the end card's line follows the audience.

## 3. The pipeline (what to run)

| Step | Tool | Notes |
|---|---|---|
| Character sheet | OpenAI Image 2.5 via `codex exec` image_gen (`docs/process/MOCKUPS.md`) | one image: the hero in every style or pose needed; plain grey background |
| Keyframes (first frames) | codex image_gen with the sheet + the shard look as `-i` references | ~3 min each, run 4–6 in parallel; poll `~/.codex/generated_images/<session>/` and copy the PNG the moment it lands (runner pattern: scratch `p15/lib.sh`); 1280 × 704 crop for LTX |
| Gate the keyframe | read it | composition, identity, style kept apart, time of day; reject before spending video time |
| Shot | LTX-2.5 image-to-video, `scripts/steam-trailer/cinematic/ltx-run.sh <log> i2v --image … --prompt … --frames 97` | under the model lock; 8n + 1 frames (73 = 3 s, 97 = 4 s, 121 = 5 s); ~5–8 min a shot; `--seed` for a re-roll |
| Directed shot | `ltx-run.sh layout --video grey.mp4 --still look.png` (Layout-To-Render on a Blender grey) | holds the layout ~2 s, then drifts to the grey's style (CT2 b06); image-to-video from the look still held better |
| Gate the shot | a contact sheet (`select='not(mod(n\,16))',tile=4x2`) | one take + two re-rolls; by failure kind (below) |
| Score | MiniMax Music 3 (`scripts/music/gen/gen_minimax.py --jobs <jobs.json>`) | 2 seeds; pick by the per-second loudness shape against the brief; cut on its onsets |
| SFX | Stable Audio 3 Medium + MOSS v2, CLAP pick (`sfx_pick.py`) | MOSS waits while swap > 8 GB (its own gate); hooves, splashes, roars, steel |
| Cut | conform 1280 × 704 → 1964 × 1080 → crop 1920 × 1080, 60 fps; `edit.mjs` (clips, titles, the corner tag overlay, the mix at −14 LUFS) | end card over a held last frame |
| Phone copy | 960 px, ~1.3 Mb/s, AAC 128k | SendUserFile caps at 30 MB and 30 s of upload |

## 4. LTX-2.5: what holds and what breaks

- **Holds:** wide shots, silhouettes, slow motion, walking away from the camera, a rigid body (a skydiver spread-eagle,
  a rider at the top of a leap), big rigid giants rising slowly, a camera push-in toward a fixed composition, gallops
  toward or away from camera.
- **Breaks:** fast limbs and close faces (smear); big splashes (the rider dissolved into spray, P15 X3 — re-rolled with
  "a small splash, the rider staying solid"); things entering frame mid-take (worlds "whipping past" melt); shape changes
  mid-shot (never show a glider opening — start with it open); **requested actions often don't happen** (the horse
  galloped on instead of jumping; the runner stopped at the edge and turned) — fix the keyframe (start mid-action:
  the horse already airborne), not the seed; long takes drift (the hero turns to face the camera after ~2 s; LTX keeps
  detail best at a clip's start — use the first 2–3 s, or generate a push-in and play it reversed).
- **Re-roll by failure kind** (CT2 gates): topology / action failure → change the keyframe; limb failure → smaller,
  slower figures; style drift → change the references or the keyframe. After two re-rolls, cut around it (P15 L1: cut
  at 1.4 s, mid-air, before she lands back).
- **Prompts:** one motion per shot, physical and plain ("gallops toward the camera, dust rising; the camera tracks
  backward"), plus "consistent art style throughout, the style of the first frame never changes".
- **Ops:** close stdin (`< /dev/null`) when calling `ltx-run.sh` inside a `while read` loop — the job eats the list's
  bytes; `ltx_comfy.py` tolerates a stalled `/history` poll (a timeout once orphaned a 40 GB ComfyUI server and stalled
  the queue on the memory gate).

## 5. Images: what reads as AI and what doesn't

- **AI tells:** golden-hour maximalism, everything filled in, glow and lens flare, a centred road to a vanishing point,
  a pretty clip per world. Every brief carries a *leave out* list: one light, a limited palette, few objects, no
  glow, no flare.
- **Keep styles apart in one frame:** make each hero from its own sheet and light each by its own world's colour (warm
  toon sun, amber paint, cool real light, magenta neon). One prompt with four styles blends them unless the sheet anchors
  them (P15's four-style sheet held).
- **Qwen-Image-2.1 repaints grey well and finished frames badly** (night turned to day, neon lost, CT2 R2B-5); use it on
  Blender greys, use OpenAI for finished keyframes.
- **Camera projection** (`cinematic/still_mesh.py` → `still_cam.py`: MoGe-2 depth mesh, every vertex on its pixel's ray,
  Blender films it unlit): the first frame is the painting exactly, small pushes give real parallax; moves over ~10–20 %
  of the subject distance smear thin things (streetlights, palms). Good for a hold or an insert, not as the trailer.

## 6. Authored motion design (the builder trailer's techniques)

- **Real capture:** a real Claude Code session recorded with asciinema (`--setting-sources project,local` so personal
  hooks don't show; type the prompt key by key), replayed into screen snapshots with pyte
  (`scripts/steam-trailer/t15/v1-glyphs/cast_frames.py`: strip APC and kitty-keyboard CSI, blank the account's usage
  banner), drawn glyph by glyph in a canvas page; the glyphs fly into a mosaic of the painting and resolve cell by cell.
- **Frame-exact HTML rendering:** `titles.mjs --titles-html=<page>` renders any page that defines `window.pose(card, t)`
  at 60 fps (a `window.ready` promise for preloads); ink strokes that really draw on (vector centre lines ordered as a
  hand would draw them, T15 V2 `scripts/steam-trailer/t15/v2-map/`).

## 7. Process

- **Council for picks:** twenty or ten ideas → three fresh seats (one Codex) score wow and makeability against a frozen
  ledger of Jake's words → the majority picks; a second round reviews the made cuts from per-second frame sheets plus
  notes (seats can't play video). `docs/process/COUNCIL.md`.
- **Gate everything before Jake sees it:** every keyframe and every shot through a contact sheet; send phone copies;
  labelled boards for stills.
- **Production hygiene:** one local model at a time (the model lock); respect `.git/quiet` (pause heavy encodes);
  subagents get their own scratch subfolders; generated art committed as JPEG ≤ 500 KB with a README of prompts.
