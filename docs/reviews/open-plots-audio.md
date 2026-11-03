# Open plots: morning listening batch

**Status:** `unread` 2026-11-03 — All six plots pass native bar 10; both score takes are on the shared listening list.
**Link:** https://wildshard-singleplayer.vercel.app/assets/music/ob7-listening.html (ships with the automatic deployment)
**Plan:** OPEN-PLOTS, [build-out OB7 and OB10](../../project/archive/2026-11-03-open-plots-build-out.md)
**Made by:** E521, sp-x2 / Codex

One listening list holds both MiniMax Music 3 takes for each completed plot.
The measured recommendation ships; the other take stays available for comparison.

| Plot | Recommended score | Package | Native bar 10 |
|---|---|---:|---|
| Lantern Bayou | A, seed 701 | 1.67 MB | pass, `d649309a52` |
| Frostline Peaks | B, seed 702 | 1.22 MB | pass, `b51eee2ce3` |
| Ember Forge | A, seed 701 | 1.56 MB | pass, `a723810b29` |
| Mosslight Ruins | A, seed 701 | 1.06 MB | pass, `a6c5ce99cc` |
| Coral Drift | B, seed 702 | 1.42 MB | pass, `aa2ef8558f` |
| Night Market | A, seed 701 | 1.28 MB | pass, `2bdad75694` |

Bayou A passes the voice check at 0.01% separated vocal energy. B measures
28.79%, so it is labelled comparison-only and cannot become the active score.
These are measured recommendations, not ear-reviewed taste verdicts.

Bayou's ambience, boardwalk, house chimes, owl, boat bump and cypress rustle
each have MOSS-SoundEffect v2 and Stable Audio 3 Medium takes. The chosen set
uses two MOSS and four Stable Audio recordings. Five winners rank first;
cypress rustle ranks second against the sound briefs and music/speech/silence
foils. All pass the existing top-five bar. The boat needed
paired retakes to produce a clear wooden knock; the catalogue records
the final engine comparison, seed and generation provenance.

The package includes both score comparisons, the active score reference and
all six sound loops. Every loop boundary was checked after AAC decoding.
Music: MiniMax-Music3. Sound effects: MOSS-SoundEffect v2 · Stable Audio 3
Medium — Powered by Stability AI.

Frostline B has no measured separated vocal energy; A measures 0.03%.
Its bed and hearth use MOSS; lift wheel, ice, gate chimes and pine rustle
use Stable Audio. Five winners rank first and pine rustle ranks second.
The MiniMax batch took 548.8 seconds (takes 287.8 / 241.8 seconds); it
overlapped the earlier official window. Generation times are not isolated
performance comparisons. The MOSS batch also overlapped the later X6 cohort.

Bayou passes the real muted phone check at 402 × 874 and 2× render scale:
its own score plays as a recording, all six cue loops decode, the bed
stays active and all five spots have gains 0.389–0.397 with heading pan
flips near −0.698 / +0.696. No page errors; no performance claim.

Repeat the playback check through the ordinary browser lane:

```sh
scripts/browser-lane.sh --max 10 node scripts/open-plots/audio-check.mjs --base=PREVIEW_URL --pin=FULL_SHA --plot=lantern-bayou
```

It uses the native pause/resume owner, actual source buffers and clock,
and normal player placement. It does not add an audio graph or fake ticks.

Frostline passes the same real phone check on `b51eee2ce3`: own score
recording, six decoded loops, active bed and five positional gains
0.390–0.396 with heading pan flips near −0.698 / +0.696; no page errors.

Ember A measures 0.29% separated vocal energy; B measures 28.1% and
remains comparison-only. Five chosen sounds use MOSS and the crane chain
uses Stable Audio. Five winners rank first and ember crackle ranks second.
The bellows received a clearer brief and paired retakes; the comparison
selects the original MOSS 701 over Stable 702.

Mosslight A measures 5.09% separated vocal energy and B measures 0.95%;
the brief explicitly includes a wordless choir. Three chosen SFX use MOSS
and three use Stable Audio; all six winners rank first. The woodland bed
and hollow arch wind use the paired 702 retakes.

Ember passes on `a723810b29` at phone 2×: its recorded score sustains
a positive gain after all spot visits, all six loops decode, the bed
stays active and five positional gains measure 0.390–0.394 with heading
pan flips near −0.698 / +0.696. No page errors or performance claim.

Coral B wins the score comparison; both takes measure zero separated
vocal energy. Three chosen sounds use MOSS and three use Stable Audio.
Four rank first; palm rustle and pier creak rank second. The pier uses
paired 702 retakes focused on dry timber rather than lagoon water.

Exact package totals (including both score takes and catalogue JSON):
Bayou 1,668,813 B; Frostline 1,217,361 B; Ember 1,560,660 B;
Mosslight 1,058,164 B; Coral 1,416,553 B. All are below 3,000,000 B.

Final focused audio/native and legacy compatibility checks pass, including
Pine’s existing path, Nine’s frozen score-set inventory and Synth gates,
Nalati’s scene-loop inventory regression and strict missing-inventory
refusal. Every published AAC candidate passes native packet admission.

Mosslight passes on `a6c5ce99cc` at phone 2×: sustained recorded score,
six decoded loops, active bed and five positional gains 0.390–0.396,
with heading pan flips near −0.698 / +0.696 and no page errors.

Coral passes on `aa2ef8558f` (activation `27b857779a`) at phone 2×:
sustained recorded score, six decoded loops, active bed and five spot
gains 0.390–0.398, with heading pan flips near −0.698 / +0.696 and no
page errors. All check browsers and borrowed previews are closed.

Publication commits: Bayou `87efa08854`; Frostline `8821f3600a`;
Ember `49f5db5c90`; Mosslight `5f9e506c7b`; Coral `2a4ad076fc`.
Native activations include Ember `699ac2968c`, Mosslight `a6c5ce99cc`
and Coral `27b857779a`. The Nalati compatibility fix is `af6f2f8eb3`;
the explicit scene-owner client gate is `658a62b688`.

Night Market completes OB10 audio. The package is **1,279,210 B**,
including both MiniMax Music 3 score candidates and catalogues. A ships
with 0.02% separated vocal energy; B remains comparison-only for raw
clipping (0.0141% of samples, above the existing 0.01% check).
The ambience bed and six spots each compare MOSS v2 with Stable Audio 3
Medium. Paired bed and awning retakes improve both to rank one. Three
chosen recordings use MOSS and four use Stable Audio; six rank first
and garden crickets ranks third. Required credits are retained.

Night Market passes the same muted native phone check on `2bdad75694`
(activation `c61524b2c8`): sustained recorded score, seven decoded cue
loops, active bed and six positional gains 0.387–0.396 with heading
pan flips near −0.698 / +0.695. No page errors or performance claim.
All 158 prior product blobs and tile/collision/material sections stay
unchanged; eight deferred audio blobs join. The audio adds 860,868
served bytes: 7,902,859 → 8,763,727 B. Its exact 8,805,039 B ceiling
preserves the existing 41,312 B non-audio margin (G872, same OB7 rule).
Publication is `4f5e804f0c`; the containing build and wire pin are
`2bdad75694`. The check browser and both borrowed previews are closed.

Wave A publications: Jungle `add58749da` is 1,240,450 B; Fairground
`02c7ca0db0` is 1,341,748 B, including both scores and catalogues.
Both ship score B with zero measured separated vocal energy. Jungle A
(16.61%) and Fairground A (22.51%) stay comparison-only. Fairground uses
the existing triple-meter loop support; every chosen AAC passes native
packet admission and decoded loop bounds. Required credits are retained.
Jungle's bed and six spots choose five MOSS / two Stable Audio takes;
Fairground's bed and five spots choose one MOSS / five Stable Audio takes.

Fairground flags are unshipped by the coordinator's explicit OB7 ruling.
All eight paired engine/seed takes fail the unchanged top-five check;
the catalogue records every rejected prompt, rank, wave and metadata
hash. No failed take receives a waiver. The generation-source provenance
reader refuses changed wave/sidecar hashes before publication.

Fairground activation `8bdf53f635` passed full native bar 10 before
landing on working candidate `c71f1f4e53-mw0zwsw1`: its own recorded
score, sustained score/bed, six decoded cue loops, native pause/resume,
five positional gains 0.393–0.398 and heading pan flips near
−0.698 / +0.696. No page errors; browser closed. Earlier admission
timeouts executed no playback check and supply no native verdict.

All 158 prior binary bodies are exact; seven audio bodies join. Native
audio and the client audio.scene row change intentionally. Of the 34 old
sections, 32 are exact; look/map keeps its exact image and moves only its
source-derived tilesHash. Served phone bytes increase by 702,751:
2,758,968 → 3,461,719 B. The explicitly approved 3,506,012 B ceiling
preserves the old 44,293 B margin. No visual source changes.

Fairground's [OB8 readings](open-plots-wave-a-readings.md) complete on
committed activation `8bdf53f635`, following final visual board
`80ba3ebf58`: Chromium matched pair 240 s, separate memory 65 s,
maintained walk 166 s (0 stuck / 0 out), official quiet Simulator
95 s. Fairground and its four junction headings report 30 fps floor,
p95 34 ms; conservative native+GPU peaks are 263/491 MB playing/loading
for Fairground and 863/832 MB for the grid visit. Matched Chromium
30 µs/draw misses, strict timing flags and home-grid p95 35 ms remain
visible. All owned browsers, Simulator, quiet and preview uses released.
Jungle's real geometry `87d997316d` and final board `90957ed671` now
precede native activation `1c287c7c4b`. Full bar 10 passes before landing
on working candidate `c6d4f23295-mw12xkkz`: its own recorded B, seven
decoded cues, sustained score/bed, native pause/resume, all six positive
gains 0.389–0.398 and heading pan flips; no page errors. All 159 prior
binary bodies and 32/34 old sections stay exact. Eight audio bodies
and the native client audio.scene plan join; audio changes intentionally,
and look/map retains its image with a source-only tilesHash change.
Phone served bytes are 5,176,498 → 5,978,874 B; the explicitly approved
5,981,239 B ceiling preserves the old 2,365 B margin. Seventeen focused
native/template cases pass in 5.77 s. Package: 1,240,450 B, below 3 MB.

Jungle **does not close** over the retained walk/life failures. The
continuous 965 m horizontal route on sealed `0d9824ebd5` records four
stuck sites: stair approach (-0.007,0.022,-44.862), stair return
(0.009,2.418,-15.981), northwest plaza (-42.401,0.020,44.687), and
east avenue (119.756,0.020,26.150). Maximum y is 2.418 m, not ~42 m.
The harness's recorded stuck fallbacks reach the garden but cannot
qualify the walk. Command 197 s; no unchanged rerun or omitted top.

The maintained bar-7 road-entry clip on `c6d4f23295-mw12xkkz` retains
11 lossless 0..5000 ms frames and the original 72° vertical lens.
Its two-rectangle pixel check passes, but semantic bar 7 remains
**unproven**: lamps visibly flicker; the predicted egret region changes
only six fixed warm pixels at x378..379/y465..467 (channel delta ≤7),
without an identifiable egret. Two changing regions are not two distinct
life sources. Raw checker output is unchanged; independent source review
refuses the broader claim. O1 has both failures for its visual/native
response. No actor/camera change or visual-source edit by this lane.
Raw records: `tmp/wave-a-audio/jungle-readings/`. The row and final
performance milestone remain open until the corrected source boundary.
