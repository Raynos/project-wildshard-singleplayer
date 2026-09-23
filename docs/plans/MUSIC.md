# Project Wildshard — the music

**State:** `in progress` 2026-09-22 — rows 1–3 done: the user picked **MiniMax Music 3 as the one model** ("everything else nah") and asked to **remaster all the music and audio in Wildshard with it** (E5); the losing models are deleted (weights `258eb5b`). Open: rows 4–10 (generation agent + integration agent).

## What changed (2026-09-22, the user after listening — ASKS D41 → E5)

v1 made the music out of code: a D-Lydian motif played by 7 WebAudio patches. It works, costs zero bytes, and
sounds like a chiptune. The user's verdict: *"It's super basic, we need better music — how do we generate music
with top tier local open weight models?"* v1 had rejected AI audio (provenance, not adaptive); the user overrules
the first reason, and v2 solves the second with stems.

| decision | the user's pick |
|---|---|
| model licences | permissive **or revenue-capped** is fine: HeartMuLa, MiniMax Music 3 (free < $20M revenue), Stable Audio Open (free < $1M), Magenta RT (Apache); a bake-off decides by ear |
| the melody | **the model composes**; the v1 motif is not kept for its own sake |
| the style | **generate three and let me switch in game**: ① sparse piano + ambient (BotW), ② warm orchestral (Ghibli / Ori), ③ folk-adventure (Sea of Thieves) |
| the sound bar | better synth **and** real instruments, **and** open-weight models making it locally |
| byte budget | **~3–5 MB per style, lazy**: loads after the player is in; the synth theme plays until it arrives and stays the offline fallback; cold load (P5) untouched |
| second theme (D42) | **Driftwood Isle** gets its own theme (Pine Hollow keeps the first) |
| shrine hum (D42) | **always, by proximity**: spatialised, ~20 m, the score ducks a little near it |

## The pipeline: generate locally, ship stems, mix adaptively

Everything is generated on this Mac (M5 Max, 128 GB unified memory); nothing leaves the machine, no per-track fees.
Weights live in `~/projects/weights/manual/` (fetched with its `bin/fetch-repo.sh`); the per-model notes (backend,
speed, memory, launch) are in `~/projects/localai`. **One model in memory at a time** — two music models at once
filled 30 GB of swap on 2026-09-22 — and check `sysctl vm.swapusage` before each run.

**ACE-Step 1.5 is dropped** (the user, 2026-09-22: too heavy for this machine) — its repaint / layering / stem-extract
steps below fall to whichever model wins, or to plain audio editing (bar-exact trims + crossfades, `ffmpeg`).

1. **Bake-off** (`scripts/music/gen/`): each candidate model gets the same brief per style — key, BPM, mood
   ("a world arriving one chunk at a time: wonder first, adventure second, melancholy underneath"),
   instrumentation for the style, instrumental only. ~10 takes per model per style → a local listening page.
   Weighed on: does it sound like a real recording, does it loop, does it hold a melody you can hum, licence.
2. **Pick per style** — the user listens to a shortlist (best 3 per style) and picks one theme per style.
3. **Make it adaptive from the pick**: fixed BPM/key/time signature (prompted; checked by beat-tracking), so every
   piece sits on the same bar grid —
   - *calm* bed (the picked track, trimmed to a bar-exact loop; the seam fixed with **repaint**),
   - *tension* layer (**lego/layering**: percussion + low strings/bass added over the calm bed, same grid),
   - *title* cut (the full-arrangement take, 60–75 s),
   - **stem extract** where one track needs to become layers.
   Driftwood gets its own calm bed per style, same method, a brighter brief.
4. **Stings + shrine hum** as short one-shots (pickup, death, chunk-entered; the shrine drone) — from the same
   model (Stable Audio Open is strong at one-shots) or a CC0 sample, whichever fits the style.
5. **Encode**: AAC-LC `.m4a` (plays and `decodeAudioData`s everywhere incl. iOS Safari), ~96 kb/s stereo, loops
   with a bar-exact length written into a manifest (`public/assets/music/<style>/music.json`: files, BPM, bars,
   loop points, LUFS). Loudness normalised to one target across styles so switching doesn't jump.

Everything above is reproducible: prompts, seeds, model + version, and the trim points live in
`scripts/music/gen/<style>.json`, so a re-roll is one command.

## In the game

`src/audio/Music.ts` keeps its API (`play`, `setState`, `sting`) and gains a **stem player** beside the synth:

- Sources per style: `synth` (v1, zero bytes, improved: a convolver reverb + better pluck/pad), `piano`,
  `orchestral`, `folk`. The selected style's files load **after** the player enters the world (never during
  boot); until they decode, the synth plays; if they fail (offline), the synth stays.
- Vertical mixing: calm bed always; the tension layer's gain follows `intensity` (alert 0.5, combat 1), faded on
  the bar grid; underwater = the existing low-pass + chorus on the music bus. Title screen = the title cut.
- Shard: Pine Hollow → theme 1, Driftwood → theme 2 (crossfade on the bar when the shard changes).
- **The switch**: pause menu → **Music style** cycler (Synth · Piano · Orchestral · Folk), next to the Music
  slider; persisted in Settings (`musicStyle`); `?music=<style>` in the URL for quick links. Switching
  crossfades on the next bar and lazily loads that style (one style resident at a time — the budget is per style).
- Shrine hum: a `PannerNode` at the shrine, audible within ~20 m, the score ducked −3 dB inside 10 m.

## Budget and acceptance

- ≤ 5 MB per style on the wire (both biomes' beds + tension layers + title + stings); 0 bytes before the player is
  in the world; ≤ 1 decoded style resident (~40 MB of PCM at 48 kHz stereo for ~3.5 min — check the phone tier,
  mono tension layers or 44.1 kHz if it pinches).
- No clicks: loops bar-exact and seam-repainted; crossfades ≥ 1 bar; no audible gap when the stems take over
  from the synth.
- Loudness: all styles within ±1 LU of each other.
- CPU: stem playback is `AudioBufferSourceNode`s — no worklets; the synth is off while stems play.
- Provenance recorded per shipped file (model, version, licence, prompt, seed) in the manifest.

## v3 — MiniMax Music 3 does everything (2026-09-22, the user after the bake-off)

*"Minimax m3 is the winner everything else nah. Remaster all the music and audio in wildshard using minimax m3 audio."*

- **One model:** MiniMax Music 3 (diffusers 0.40 on MPS, ~28 GB peak, ~4 min per 75 s take — one job at a time).
  HeartMuLa, Stable Audio Open and ACE-Step are deleted. Licence: free under $20M revenue, **"MiniMax-Music3" shown in
  the game's UI** — a credits line in the pause menu (Settings) and on the title screen.
- **Music, three styles kept** (piano / orchestral / folk) with the in-game switch — the user picked the model, not a style.
  Per style: a Pine Hollow theme, a Driftwood theme, a title theme, stings (pickup / death / chunk).
- **Adaptive without ACE-Step:** MiniMax ignores key / tempo, so layers can't be generated separately and line up. Instead,
  **demucs splits each chosen take into stems** (drums / bass / other): *calm* = other + soft bass, *tension* adds the
  bass + drums back on the same timeline (aligned — it is one recording). Loops: bar-exact trims found by
  beat-tracking, crossfaded seams.
- **"All the audio":** MiniMax is a *music* model, so every sound effect gets a feasibility pass before anything is
  replaced: ambient beds (Pine Hollow wind + birds, Driftwood surf + gulls, underwater) and the tonal sounds (pickup
  hum, shrine hum, stings) are likely; percussive one-shots (crossbow, sword, rifle, footsteps, splashes, animal
  calls) are doubtful. Whatever MiniMax renders convincingly ships as a sample with the synth version as fallback;
  whatever it can't keeps the synth and is listed in the report for the user.

## How it gets built

| # | checkpoint | status |
|---|---|---|
| 1 | Local model set-up on the Mac: HeartMuLa (MLX), Stable Audio Open (Small + 1.0), MiniMax Music 3 (MPS, diffusers 0.40 — no port needed); ~~ACE-Step 1.5~~ dropped (too heavy); speeds / memory in `~/projects/localai/docs/music-models.md` | done `ec5665e` |
| 2 | Bake-off: ~10 takes × model × 3 styles (Pine Hollow brief) → `art/music/round-1-bakeoff/` + a listening page (and an Artifact for the phone) | done `ec5665e` — 102 takes, shortlist 3 per style; SAO 1.0 scores best but stops at 47 s, MiniMax writes full themes but ignores the key, HeartMuLa hums |
| 3 | **User pick** — MiniMax Music 3, all three styles; everything else deleted | done (user, 2026-09-22) |
| 4 | Music generation (MiniMax): per style × {Pine Hollow theme, Driftwood theme, title} ~6 takes each, auto-ranked; stings; a listening page for the user's veto | open |
| 5 | Stems + loops: demucs split, calm / tension layers, bar-exact loops, −18 LUFS, AAC into `public/assets/music/<style>/` + `music.json` manifest (≤ 5 MB per style) | open |
| 6 | SFX / ambience feasibility with MiniMax: ambient beds, pickup / shrine hum, a test take for each one-shot family; ship what convinces, report what doesn't | open |
| 7 | Music.ts stem player (lazy after enter, synth fallback, bar-grid crossfades, intensity drives the tension layer, underwater LP) + Audio.ts sample beds / one-shots with synth fallback | done `03ed269` (build `03ed269-mudjkiwh`) — code live and verified on a local fixture; plays the synth until the generation agent's `music.json` / `sfx.json` ship (files the build does not list are never fetched) |
| 8 | Pause-menu **Music style** switch + `?music=`; Settings `musicStyle`; **"Music: MiniMax-Music3" credit** in Settings + title | done `03ed269` — a Piano · Orchestral · Folk · Synth picker under the Music slider, default piano |
| 9 | Shrine hum by proximity (Driftwood) | done `03ed269` — `src/audio/ShrineHum.ts`: equal-power panner, ~22 m, music −3 dB inside 10 m; the synth drone until `hums.shrine` ships |
| 10 | Re-cut the 15 s / 30 s trailers with the new score; deploy; the user listens on the phone | open |

## v1 (landed, D35 — still the synth fallback)

`src/audio/Music.ts` + `src/audio/score/wildshard-theme.ts`: D-Lydian motif `D A G# A | E D · · | D A B A | G# E D ·`,
104 BPM (96 calm / 112 combat, Dorian), 7 WebAudio patches (drone, pad, pluck, marimba, bass, pulse, FM bell),
32-bar form looping 32 → 9, 2-bar-ahead sequencer, bar-aligned crossfades, stings, `renderOffline()` for the
trailer (`scripts/music/render.mjs`), MIDI export (`scripts/music/wildshard-theme.mid`). Wired in `src/main.ts`
(menu / calm / alert / combat / underwater / pickup / death / chunk). Trailers `/trailer-15.mp4`, `/trailer-30.mp4`.
