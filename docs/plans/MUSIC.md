# Project Wildshard — the music

**State:** `in progress` 2026-09-22 — v1 (the synth score, D35) is live; the user heard it: "super basic, we need better music". v2 = music composed locally by open-weight models, three styles side by side with an in-game switch; decisions below are the user's (E5). Open: every row of the v2 table.

## What changed (2026-09-22, the user after listening — ASKS D41 → E5)

v1 made the music out of code: a D-Lydian motif played by 7 WebAudio patches. It works, costs zero bytes, and
sounds like a chiptune. The user's verdict: *"It's super basic, we need better music — how do we generate music
with top tier local open weight models?"* v1 had rejected AI audio (provenance, not adaptive); the user overrules
the first reason, and v2 solves the second with stems.

| decision | the user's pick |
|---|---|
| model licences | permissive **or revenue-capped** is fine: ACE-Step 1.5 (MIT), MiniMax Music 3 (free < $20M revenue), Stable Audio Open (free < $1M), Magenta RT (Apache); a bake-off decides by ear |
| the melody | **the model composes**; the v1 motif is not kept for its own sake |
| the style | **generate three and let me switch in game**: ① sparse piano + ambient (BotW), ② warm orchestral (Ghibli / Ori), ③ folk-adventure (Sea of Thieves) |
| the sound bar | better synth **and** real instruments, **and** open-weight models making it locally |
| byte budget | **~3–5 MB per style, lazy**: loads after the player is in; the synth theme plays until it arrives and stays the offline fallback; cold load (P5) untouched |
| second theme (D42) | **Driftwood Isle** gets its own theme (Pine Hollow keeps the first) |
| shrine hum (D42) | **always, by proximity**: spatialised, ~20 m, the score ducks a little near it |

## The pipeline: generate locally, ship stems, mix adaptively

Everything is generated on this Mac (M5 Max, 128 GB unified memory — the ACE-Step 4B XL DiT + 4B LM fit without
offload); nothing leaves the machine, no per-track fees.

1. **Bake-off** (`scripts/music/gen/`): each candidate model gets the same brief per style — key, BPM, mood
   ("a world arriving one chunk at a time: wonder first, adventure second, melancholy underneath"),
   instrumentation for the style, instrumental only. ~10 takes per model per style → a local listening page.
   Weighed on: does it sound like a real recording, does it loop, does it hold a melody you can hum, licence.
2. **Pick per style** — the user listens to a shortlist (best 3 per style) and picks one theme per style.
3. **Make it adaptive from the pick**: fixed BPM/key/time signature (ACE-Step conditions on all three), so every
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

## How it gets built

| # | checkpoint | status |
|---|---|---|
| 1 | Local model set-up on the Mac: ACE-Step 1.5 (XL + LM), Stable Audio Open, MiniMax Music 3 if open weights run locally; smoke test: one 60 s take each, timed | open |
| 2 | Bake-off: ~10 takes × model × 3 styles (Pine Hollow brief) → `progress/music/bakeoff/` + a local listening page (and an Artifact for the phone) | open |
| 3 | **User pick** — one track per style from the shortlist (the user's ears; blocks 4) | open |
| 4 | Adaptive assets per style: calm loop (repaint seam), tension layer (lego), title cut, Driftwood bed, stings; encode + normalise + manifest | open |
| 5 | Music.ts stem player + synth fallback + lazy load after enter; synth patches improved (reverb, pluck, pad) | open |
| 6 | Pause-menu **Music style** switch + `?music=`; Settings `musicStyle` | open |
| 7 | Shrine hum by proximity (Driftwood) | open |
| 8 | Re-cut the 15 s / 30 s trailers with the user's favourite style; deploy; the user listens on the phone | open |

## v1 (landed, D35 — still the synth fallback)

`src/audio/Music.ts` + `src/audio/score/wildshard-theme.ts`: D-Lydian motif `D A G# A | E D · · | D A B A | G# E D ·`,
104 BPM (96 calm / 112 combat, Dorian), 7 WebAudio patches (drone, pad, pluck, marimba, bass, pulse, FM bell),
32-bar form looping 32 → 9, 2-bar-ahead sequencer, bar-aligned crossfades, stings, `renderOffline()` for the
trailer (`scripts/music/render.mjs`), MIDI export (`scripts/music/wildshard-theme.mid`). Wired in `src/main.ts`
(menu / calm / alert / combat / underwater / pickup / death / chunk). Trailers `/trailer-15.mp4`, `/trailer-30.mp4`.
