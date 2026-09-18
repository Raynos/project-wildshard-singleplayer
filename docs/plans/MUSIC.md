# Project Wildshard — the first original music

One theme, written once, used three ways: the 30 s trailer cut, the title screen, and the game itself as an
adaptive score. It has to be *ours* (no licensing, no AI-generated audio of uncertain provenance), it has to
weigh nothing on the phone, and it has to sound like the world: a place that does not exist yet, arriving one
chunk at a time — wonder first, adventure second, a little melancholy underneath.

## The decision: the music is code, like everything else here

Every sound in the game is already synthesised in WebAudio (`src/audio/Audio.ts`, no files). The music follows
the same rule: a **score written as data** (notes, bars, layers) played by a small **WebAudio instrument set**.
The same score renders offline (OfflineAudioContext → WAV) for the trailer and plays live in the game, where
layers fade in and out with what the player is doing. Zero bytes downloaded, one source of truth, exportable
to MIDI the day a human composer joins.

Rejected: a commissioned track (later, once the theme is proven), AI-generated audio (ownership + not adaptive),
a soundfont/sample player (megabytes on the phone, one fixed mix).

## The theme

- **Key / mode:** D Lydian (the raised 4th is the "wonder" note; it also keeps the island bright).
  Combat and the wreck darken it to D Dorian without changing the melody notes.
- **Tempo:** 104 BPM (the 30 s cut was timed to a 104 pulse; the game plays it at 96 for calm, 112 in combat).
- **Motif (4 bars, the thing you hum):** `D  A  G#  A | E  D  · · | D  A  B  A | G# E  D  ·` — a rising fifth,
  the Lydian 4th leaning on the 5th, and a fall home. Two bars of question, two of answer.
- **Sound palette (instruments = WebAudio patches, all in `src/audio/Music.ts`):**
  - *Drone*: two detuned saws through a slow low-pass, an octave apart — the "this world is huge" floor.
  - *Pad*: 4-voice chord, triangle + sine, slow attack, chorus by detune — the sky.
  - *Pluck*: Karplus-Strong-ish (noise burst → feedback delay) — the wooden pier / the crossbow's world. Carries the motif.
  - *Marimba*: sine + 4th-harmonic sine, short exponential decay — the island's colour, carries the motif on Driftwood.
  - *Bass*: sine + a little saw, sidechained to the pulse.
  - *Pulse*: filtered noise "shaker" + low sine kick, four-on-the-floor only in combat; a soft 2-and-4 tap otherwise.
  - *Bell / sting*: FM (2 operators) for the pickup and the end-card hit.
- **Form (32 bars ≈ 74 s at 104; loops at bar 32 → bar 9):**
  A intro (drone + pad, 8 bars) · B theme (pluck/marimba motif over the pad, 8) · C build (bass + soft pulse,
  motif harmonised in thirds, 8) · D lift (full layers, motif up an octave, 8) · ring-out (2 bars).

## The 30 s trailer version (fits `scripts/trailer/edl-30.txt` exactly)

| time | picture | music |
|---|---|---|
| 0.0 – 1.5 | title card | drone fades in, one pad chord (Dmaj7♯11) |
| 1.5 – 3.5 | the citadel vision | pad swells; the bell states the first two motif notes (D → A) |
| 3.5 – 8.0 | Pine Hollow trail / ridge | pluck plays the full motif once, sparse, no pulse |
| 8.0 – 12.8 | pier walk, planet, boars | marimba takes the motif (brighter), bass enters, soft 2-and-4 |
| 12.8 – 16.4 | sword combo, heavy, swim, dive | pulse to four-on-the-floor at 12.8 (the first swing); Dorian colour on the heavy; underwater = low-pass sweep on the whole mix at 15.0–16.4 |
| 16.4 – 21.5 | stairs, bridge, wreck | build: motif in thirds, filter opening; at 21.5 (the sailor rises) one bar of the minor turn |
| 21.5 – 24.6 | shrine | lift: motif up the octave, all layers |
| 24.6 – 28.1 | hero shot → end card | the resolve chord lands on 24.6; bell hit + ring-out on the end card at 24.6+; silence by 28.1 |

Rendered offline at 48 kHz stereo → `scripts/trailer/score-30.wav` → `cut.sh` uses it instead of the synth bed
(`-i score-30.wav` replaces the lavfi inputs). The 15 s cut gets a 15 s edit of the same render (intro → motif → hit).

## In the game

`src/audio/Music.ts` — `new Music(audio)` (shares the AudioContext and the master bus; its own `music` gain
with a pause-menu volume), `music.play(theme)`, `music.setState({ shard, mode, intensity, underwater })`,
`music.sting('pickup' | 'death' | 'chunk')`. State changes crossfade layers **on the next bar** so nothing
jumps mid-phrase; the sequencer schedules 2 bars ahead on the AudioContext clock (no per-frame work).

| where | what plays |
|---|---|
| title / menu | A + B, full, the trailer voicing (this is the "Wildshard theme") |
| Pine Hollow calm | drone + pad only, motif every ~40 s on the pluck, 96 BPM |
| Driftwood calm | drone + marimba motif, gulls and surf carry the rest, 96 BPM |
| alert (an animal has noticed you, `AnimalManager` state alert/stalk) | bass + soft pulse fade in |
| combat (a charge, a hit taken, a swing landing) | four-on-the-floor, Dorian, 112 BPM; decays to alert 8 s after the last hit |
| underwater (`player.submerged`) | whole music bus through a 600 Hz low-pass + slow chorus |
| pickup (iron sword, skins) | `sting('pickup')`: the bell plays the first four motif notes |
| death / respawn | `sting('death')`: the minor turn, one bar, then silence for 6 s |
| entering a chunk (first frame) | `sting('chunk')`: the resolve chord — the same hit as the trailer's end card |

Hooks already exist for all of it: `animals.onCharge`, `onHit`, `player.onSubmerge/onSurface`, the pickup
`onPickup`, `respawn()`, `hud.onResume/onExitToMenu`. `Music` is wired in `src/main.ts` next to `Audio`.

## Budget and acceptance

- ≤ 12 oscillators + 6 filters live at once, no ScriptProcessor / AudioWorklet (phone-safe); measured CPU < 2 %
  of a frame on the phone tier.
- No clicks: every voice through an envelope; layer crossfades ≥ 1 bar; tempo changes only on a bar.
- Loop point inaudible (the pad's tail overlaps the loop by one bar).
- The theme is recognisable from the marimba alone in 4 bars (play it to someone, they hum it back).
- The trailer render and the in-game title theme are the same code path (`renderOffline()` vs `play()`).
- A MIDI export (`scripts/music/export-midi.mjs`) of the score, so a composer can take it further.

## How it gets built (one agent, ~a night)

1. `src/audio/Music.ts`: instruments (7 patches), a bar/beat sequencer on the AudioContext clock, the layer
   mixer with bar-aligned crossfades, `setState` mapping, stings.
2. `src/audio/score/wildshard-theme.ts`: the theme as data (motif, harmony per bar, per-layer patterns, the
   Lydian/Dorian switch), plus the 30 s trailer arrangement as a second arrangement of the same material.
3. `scripts/music/render.mjs`: Playwright page → `OfflineAudioContext` → WAV for `score-30.wav` / `score-15.wav`
   / the loop; `scripts/trailer/cut.sh` takes `--score <wav>`.
4. `src/main.ts` wiring (parent): state from the hooks above, the pause menu's MUSIC volume switch.
5. Listen on the phone; re-cut the 30 s trailer with the real score; deploy.

Later, if it earns it: a second theme per biome (the citadel / centre chunk gets its own), a composer pass from
the MIDI export, a diegetic version (the shrine hums the motif's first interval).
