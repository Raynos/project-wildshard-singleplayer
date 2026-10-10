# CT2 — the cinematic concept trailer: script, shots and how each is made (TRAILERS Part B, E466)

**Draft 4 (2026-10-10)** — after council rounds 1 and 2 (`council/register.md`; the seats' files `council/round-<n>-seat-*.md`).
Built on Jake's CT1 verdicts and his highway note (the frozen ledger: [council/ledger.md](council/ledger.md)). Draft 1
(the blue-lattice storyboard) is superseded.

## The frame

- **~67 s**, generated at 1280 × 704 (≈ 1.82 : 1), mastered at **1920 × 1080**: each shot scaled to 1964 × 1080 and centre-
  cropped 22 px a side (R1A-11). 24 fps. Every generated length is 8n + 1 frames (97 = 4 s, 121 = 5 s, 145 = 6 s).
- **Labelled on every frame** (R1C-4): a corner tag *CONCEPT TRAILER · NOT GAMEPLAY* (the alpha trailer's bug, violet),
  plus the full line on the first image (from frame 1, over shot 1 — no extra card, R1A-10) and on the end card.
- **Muted-first** (R1A-10, R1C-3): four large captions carry the pitch with no sound (§Captions). Text is never generated.

## The world it shows (the engine's, painted)

- **Our six shards, each in its own style:** Driftwood Isle (toon), Nalati (painterly), Pine Hollow (photoreal), Signal
  Dunes (dusk), Sky Reach (golden hour), Nine Dragon Stack (neon). **Driftwood stays faceted toon** in every shot it is
  in; a take that paints it naturalistic is rejected (R1A-7, R1B-4).
- **The highway between them:** 15 m, two lanes, markings, roundabouts where four shards meet, a road entry at each edge's
  midpoint, streetlights, cars. No glowing walls (ledger 5). No hoverboard outside staging (VISION; R1B-9).
- **The new shard** (one canonical look, R1A-6, R1C-2): `art/trailers/round-2-highway/hero-shard.jpg` — a floating cube of
  land, a low hill, a pine wood, a river to a front-edge waterfall, **one round stone tower with a slate cone roof**, a
  cobbled road to the front edge, brown cliffs with roots. Every shot that shows it uses that image as a reference.
- **One neighbour map** (R1A-6, fixed to the pictures R2B-4): around the new shard's plot — Sky Reach north-west, Nalati
  north, Nine Dragon north-east, Pine Hollow west, Signal Dunes east, Driftwood south (`b07.jpg`; `b01` is b07 with the
  plot empty, `b15` a hold on b07). The crossroads (8) and the drive (9) happen elsewhere on the endless grid, at the
  engine's own junction (Driftwood, Nalati, Pine Hollow, a template plot: `look-crossroads`).
- **The hero has four roads** (R2A-2, R2B-3): cobbled roads from the tower to all four edge midpoints, where they meet
  the highway's entries; draft 1's blockout and shot-6 still carry them, `hero-shard.jpg` (one road) is re-made for draft 2.
- **No upload ritual** (Jake, 2026-10-09: "drop the upload ritual" for the site, MARKETING-SITE.md §7; R1C-new): the
  upload is the shard leaving its builder's staging space and arriving in the world.
- **Staging before the world** (VISION §Isolation; R1A-5, R1B-1): shots 3–5 happen on the floating shard **alone** (the
  void, the clouds), with no highway and no neighbours. The world first appears around it in shot 6.

## How every shot is made

| Kind | Method | CT1 evidence (corrected, R1B-5/6) |
|---|---|---|
| **Directed** (an exact layout or camera: 1, 6, 9, 14) | a Blender grey blockout from the shared kit → a **look still** repainted from its first grey frame (OpenAI Image 2.5 or Qwen-Image-2.1, references by role: `look-*` for roads and light, `shard-*` and `hero-shard` for local materials, R1A-7) → **LTX-2.5 Layout-To-Render** | #9 (its look still was OpenAI) — ~12 min of lock per shot |
| **Atmosphere** (a place and a mood: 2, 3, 4, 5, 7, 8, 10–13, 15) | a **keyframe** (the storyboard frame or an in-engine view, repainted by Qwen-Image-2.1 with calm, readable detail) → **LTX-2.5 image-to-video** | #10b (a Qwen repaint of the grey blockout) — ~8.4 min of lock per shot |
| Out | per-frame repaint (#4–#6, jarring), Wan (#7, #8), a busy OpenAI keyframe straight to LTX (#10) | Jake, 2026-10-10 |

**Draft 1 (2026-10-10)** — atmosphere shots: the OpenAI storyboard frame straight to LTX image-to-video (the Qwen repaint
of finished frames **failed the gate**: night turned to day, Nine Dragon's neon lost, R2B-5; Qwen stays for repainting
grey); shot 6: Layout-To-Render on the **highway** dock blockout (`dock_blockout.py --highway`, R2A-1) with a look still
painted from its first grey frame and the hero; shot 3: a wipe between the aligned half-grey and hero stills (R2C-7);
shot 15: a hold on shot 7. The full blockout kit (CT3) lands for draft 2.

**Gates** (R1A-4, R1A-8): reject a bad keyframe before any video (composition, the hero shard's tower, Driftwood's
facets, no lattice); each shot gets **one take plus two re-rolls**: a topology failure (roads, the plot, the tower) →
fix the guide or the still, not the seed; a limb failure → smaller, slower figures; style drift → swap the references.
After the cap the shot is replaced by a shorter stable insert of the same beat (a hold on its approved still with a slow
push in the edit); never grey or raw engine footage.

**Motion rules:** one motion per shot; never the same slow push-in twice in a row (R2B-7); the camera carries the movement; figures small, far and **slow** (walk, not
gallop, R1A-2); big rigid things hold. Shot 14 is generated as a **push-in and played in reverse** (R1C: LTX keeps detail
best at a clip's start); its keyframe has no water or smoke to run backwards (R2B-8). Light changes (streetlights coming on) are untested in CT1 (R1B-5): a re-roll, then a cut on
the change if it doesn't land.

**Draft 1 cut (2026-10-10)** — 67 s, sent to Jake; the board `art/trailers/round-3-draft1/board-draft1.jpg`. Gate per
shot: 1, 2, 4, 5, 7–11, 13, 14 pass on the first take; 6 passes on re-roll 1 (image-to-video from `b06look`: the
Layout-To-Render take kept the look ~2 s, then the highway grey's cones and boxes took over — style drift, so the still,
not the seed, R1A-8); 12 passes with a note (the bridge figure reads as riding a board, not walking; re-roll in draft 2);
5's last second softens. Driver fix: a stalled ComfyUI `/history` poll no longer orphans the server (5c8e62796).

## The shots

| # | t (s) | Shot | Kind | What we see / the motion |
|---|---|---|---|---|
| 1 | 0–4 | **The empty plot** | directed | Night, high over the lit grid: b07's exact view with the plot empty. A slow push down toward it. *The full concept label in the lower third (R2C-4), clear of the plot.* |
| 2 | 4–8 | **The prompt** | atmosphere | An author at a desk at night, from behind, a monitor's glow. Caption 1. Draft 2 adds a **real Claude Code session that builds this shard** on the monitor (R1C-6); TR5's recording is another job (a Sky Reach lookout) and is not used (R2C-3). |
| 3 | 8–14 | **The build** | atmosphere | The hero shard alone in the void, half grey blocks, half painted, the colour sweeping across. Draft 1: image-to-video from the half-grey keyframe; draft 2: two passes (grey, painted) wiped in the edit (R1A-3, R1C-5). Caption 2. |
| 4 | 14–18 | **Walking it** | atmosphere | Golden hour on the hero shard, alone above the clouds: the small author walks the cobbled road from the tower toward the waterfall edge |
| 5 | 18–22 | **The upload** | atmosphere | The hero shard rises out of the void trailing white-gold light. Caption 3. |
| 6 | 22–28 | **It goes live** | directed | Dusk aerial: the hero shard comes down into the empty plot between the highways; its road entries meet the highway |
| 7 | 28–32 | **Players arrive** | atmosphere | Night aerial: headlights stream along the highways into the hero shard's four entries. Caption 4. |
| 8 | 32–36 | **The crossroads** | atmosphere | Dusk at the roundabout where Driftwood (toon), Nalati, Pine Hollow and an unbuilt plot meet; the signpost; a rider walks along the road |
| 9 | 36–40 | **The drive** | directed | A low tracking shot along the highway: Driftwood's toon beach left, Pine Hollow's photoreal forest right |
| 10 | 40–44 | **Nalati** | atmosphere | Distant riders walk their horses across the painterly steppe toward a road entry |
| 11 | 44–48 | **Signal Dunes** | atmosphere | Dusk: the signal tower's fire, a small caravan, the highway lamps at the edge |
| 12 | 48–52 | **Sky Reach** | atmosphere | Golden hour: floating islands, a small figure walks a rope bridge |
| 13 | 52–56 | **Nine Dragon Stack** | atmosphere | Rain and neon: the vertical city from the highway's entry road |
| 14 | 56–62 | **The pull-out** | directed | Up and back over shards and highways to the horizon (a push-in, reversed) |
| 15 | 62–67 | **End card** | atmosphere | The night grid, dim, behind: the Cell logo · *Play it in the browser. Build it in Claude Code.* · wildshard.io · *Concept trailer · not gameplay* |

## Captions (overlays, large, phone-safe)

1. *Describe a world.* (shot 2) · 2. *Claude Code builds it.* (shot 3) · 3. *Upload it.* (shot 5) · 4. *Players arrive.*
(shot 7) · 5. *Every shard built by a player.* (shot 9, R2C-6). No upload API exists yet; the end card's *Build it in Claude Code* is the pitch, labelled concept (R1B-10).

## Sound

`scripts/steam-trailer/concept-jobs.json` (MiniMax Music 3, ~72 s): a quiet open (1–2), a build (3–5), the first big hit
on the dock (6), full drive through the travel montage (7–13), the peak on the pull-out (14), a ringing end. Trailer SFX
on the cuts; cars and towns as soft beds.

## Cost and order (R1A-9, R1B-6)

Measured lock time per shot: ~8.4 min (image-to-video) / ~12 min (Layout-To-Render), so one pass of 14 shots ≈ 2–2.3 h
of model lock, before re-rolls and other agents' queue. Order: the storyboard and keyframes (remote, parallel) → the
critical shots first (6, 3, 5, 7) → the rest → the score (it queues on the same lock) → the cut with overlays and a
temp mix while takes land. Production state: the scripts are in `scripts/steam-trailer/cinematic/` (`dock_blockout.py`,
`prep_concept.sh`, `ltx-run.sh`) and `cuts/concept.mjs`; the per-session job list and the shot prompts sit in the
lead's scratchpad and are written into CT5's row when a draft ships (R2B-9).
