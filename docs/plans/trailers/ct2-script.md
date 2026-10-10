# CT2 — the cinematic concept trailer: script, shots and how each is made (TRAILERS Part B, E466)

**Draft 2 (2026-10-10)**, rebuilt on Jake's CT1 verdicts and his highway note (the ledger:
[council/ledger.md](council/ledger.md)). Draft 1 (the blue-lattice storyboard of 2026-10-10 morning) is superseded: it
followed the concept painting instead of the engine. **Labelled "Concept trailer · not gameplay"** on the first and
last card. ~67 s, 16:9, generated at 1280 × 704, finished at 1920 × 1056, 24 fps.

## The world it shows (the engine's, painted)

- **Our six shards, each in its own style:** Driftwood Isle (toon tropical island, pier), Nalati Grasslands (painterly
  steppe, yurts, horses), Pine Hollow (photoreal pine forest, log cabin), Signal Dunes (dusk dunes, signal tower and
  fires), Sky Reach (golden-hour floating islands, windmill, rope bridges), Nine Dragon Stack (neon vertical city, rain).
- **The highway between them:** a 15 m two-lane road with markings, roundabouts where four shards meet, a road entry
  at the middle of each shard edge, streetlights, cars and hoverboards. No glowing walls, no blue lattice.
- **The vision's beats:** an author builds a shard in Claude Code, the nine-beacon upload ritual, the shard goes live in
  an empty plot, players travel the highway from world to world, the grid goes on to the horizon.
- **References:** `art/trailers/round-2-highway/` (the look: golden aerial, night aerial, the crossroads) and the six
  shard concept paintings (`art/trailers/round-2-highway/shard-*.jpg`), all painted from in-engine frames.

## How every shot is made (CT1's winners, Jake's pick)

| Kind | Method | CT1 evidence |
|---|---|---|
| **Directed** — the camera move or the layout must be exact (the empty plot, the build, the dock, the highway waking, the drive, the pull-out) | a **Blender grey blockout** of the shot from a shared kit (highway grid, plots, a floating shard, beacons, cars, a rider) → a **look still**: its first grey frame repainted by Qwen-Image-2.1 (or OpenAI Image 2.5) with the round-2 references → **LTX-2.5 Layout-To-Render** (grey video + look still) | #9 |
| **Atmosphere** — a place and a mood, the model may choose the drift (the author at the desk, the ritual, the crossroads, the shard vignettes) | a **keyframe**: an in-engine capture of that shard (where one exists) repainted by Qwen-Image-2.1 in the round-2 look, else a Qwen / OpenAI still from the references → **LTX-2.5 image-to-video** | #10b |
| Out | per-frame repaint (#4–#6: jarring drift), Wan (#7 static, #8 failed), a plain OpenAI keyframe → LTX (#10: weaker than #9 / #10b) | Jake, 2026-10-10 |

Rules from the research and CT1: one motion per shot; the camera carries the movement; big rigid things (land, roads,
cliffs, towers, cars) hold, limbs and faces don't, so figures stay small, far and slow; 4–6 s shots; never the same
slow push-in twice in a row; **text is never generated** (the typed prompt, the captions and the end card are overlays).

## The shots

| # | t (s) | Shot | Kind | What we see / the motion |
|---|---|---|---|---|
| 1 | 0–4 | **The empty plot** | directed | Night, very high: the grid of lit shards and highways, one dark empty square plot in the middle, its four road entries unlit. A slow push down toward it |
| 2 | 4–8 | **The prompt** | atmosphere | An author at a desk at night, from behind, a monitor's glow. Overlay: `> a fortress on a hill — pines, a stone tower, a river, dusk` typed out |
| 3 | 8–14 | **The build** | directed | On a floating platform in the void, grey blocks rise and settle into terrain, trees and a tower; the colour washes in (the grey-to-final time-lapse the engine really does, painted) |
| 4 | 14–18 | **Walking it** | atmosphere | Golden hour on the new shard: the small author walks the road entry to the shard's edge, the highway beyond |
| 5 | 18–22 | **The upload ritual** | atmosphere | Night: nine beacons light at the shard's corners, edge midpoints and centre, beams into the sky |
| 6 | 22–28 | **It goes live** | directed | The shard comes down into the empty plot between the highways; its four road entries meet the highway; its streetlights come on (CT1's shot, re-laid on the highway grid) |
| 7 | 28–32 | **The highway wakes** | directed | Night aerial: headlights stream along the highway and turn into the new shard's entries; the roundabouts glow |
| 8 | 32–36 | **The crossroads** | atmosphere | Dusk at the roundabout where four shards meet (beach, steppe, pines, an unbuilt plot), the signpost, a rider trots through (round-2 look C) |
| 9 | 36–40 | **The drive** | directed | A low tracking shot along the highway: Driftwood's toon beach on one side, Pine Hollow's photoreal forest on the other, one road between two styles |
| 10 | 40–44 | **Nalati** | atmosphere | Riders gallop across the painterly steppe toward a road entry, yurts and kurgans behind |
| 11 | 44–48 | **Signal Dunes** | atmosphere | Dusk: the signal tower's fire lit, a caravan on the dunes, the highway lamps at the shard's edge |
| 12 | 48–52 | **Sky Reach** | atmosphere | Golden hour: floating islands, a hoverboarder crosses a rope bridge, the windmill turning |
| 13 | 52–56 | **Nine Dragon Stack** | atmosphere | Rain and neon: the vertical city seen from the highway's entry road, crowds under umbrellas |
| 14 | 56–62 | **The pull-out** | directed | Up and back from the city: the 3 × 3, the 5 × 5, then shards and highways to the horizon, more lights coming on |
| 15 | 62–67 | **End card** | — | The night grid dims behind the overlay: the Cell logo, *Play it in the browser. Build it in Claude Code.*, wildshard.io, *Concept trailer · not gameplay* |

## Sound

The score job `scripts/steam-trailer/concept-jobs.json` (MiniMax Music 3, ~72 s): a deep-space open (1–2), a build
(3–4), the ritual swell (5), the first big hit on the dock (6), full drive through the travel montage (7–13), the peak
on the pull-out (14), a ringing end. Trailer SFX (MOSS v2 + SA3) on the cuts; the cars and the town as soft beds.

## Cost (local, from CT1)

~6 Blender blockouts (one shared kit, minutes each) · ~15 look stills / keyframes (Qwen ~30 s each under the lock, or
OpenAI remote) · 14 LTX runs (~5 min image-to-video, ~8 min Layout-To-Render) ≈ 1.5–2 h of model lock · the score ·
the cut, mix and conform on the existing pipeline (`cut.mjs`, `mix.py`, `edit.mjs`).
