# Open plots: morning listening batch

**Status:** `unread` 2026-11-03 — Published sets below carry native bar-10 proofs; both score takes and ambience beds are on the shared listening list.
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


Jungle's corrected boundary now qualifies on **61a326a292**: O1 geometry
`9c82257231`, final eight-view board/goldens `42fd0da110`, and the western
plaza leg `61a326a292`. Both maintained legs reach every waypoint with
0 stuck / 0 out under 240 s each (188.043 / 74.297 s; command 268 s).
The fixed road clip proves a drifting white egret and separate lamp
flicker, both owner-confirmed. Final full native bar 10 passes in 19 s;
all eight audio bodies and the audio section remain exact. Matched
Chromium, separate memory and the official quiet Simulator window are
whole; raw CPU/draw and strict timing misses remain explicit in the
[readings](open-plots-wave-a-readings.md#jungle-corrected-source-qualification).
The original four-stuck and unproven-life records above remain historical
failures. This completes Jungle's Codex half without changing a gate.

Saltwind publication (2026-11-03, sp-x6) is **1,145,443 B including the
231,398 B shared bed**, below 3 MB. It is not activated by publication.
Both MiniMax takes remain: A is comparison-only at 22.06 s (below 25 s),
B qualifies at 67.31 s with zero measured vocal energy. Five chosen local
spots ship: foghorn, southeast boat rigging, basin gulls, slate-roof rain,
and quay net/rope. Their selected MOSS takes rank 1/3/2/2/4 against the
paired Stable Audio comparisons. The northwest rigging comparison stays
unshipped under the coordinator's five-spot roster, including its later
rank-five take; this is an explicit roster omission, not a failed rank.

The own bed remains rejected after all three paired attempts: initial
ranks 56/49, stronger-rain retake 35/27, deterministic same-engine rain,
wind and faint-horn composition 42/28. All six wave/metadata hashes,
original comparisons and composition component provenance remain in
`sfx.json`; no threshold, descriptions or foils were relaxed.

On the coordinator's ruling, Saltwind instead references Coral Drift's
already-qualified coastal surf/wind bed, original paired ranks 1/1.
The canonical **6243d1442260** AAC stays at its original Coral path;
no audio copy or new generation. One-hop references retain counted native
reads and explicit original loop metadata. The source catalogue/body
hashes, licence and credits are recorded. O3 accepts the calmer sea as a
harbour fit; the named gap is **no squall rain or foghorn in the bed**.
The foghorn stays a local 100 m spot, under the unchanged validator.
Native bar 10 and body/wire proof remain required before activation.

Activation **f8a1406288** follows the working candidate
**27bccfb89e-mw15zf5m**, which passes full
native bar 10 before landing, **15 s**: own recorded B, six decoded cue
loops including Coral's shared bed, sustained score/bed, native pause and
resume, all five gains **0.391958..0.399364**, and heading pan flips
**-0.698112..+0.696140**; page errors[]. No synth or copied bed.

The frozen `300a65548b` BEFORE has 158 files and 34 sections. All **158
old binary bodies and 32/34 sections stay exact**, with no removals.
Seven audio files and the 242 B native client plan join; audio/audio
changes intentionally. The map image stays
`350593f4b296abf5933bfaa7c1d5054bff550a7aae06c6ae8aab57ededcf1023`;
only the 164 B section's defining-source tilesHash stamp changes (G872).
All 200 served candidate body hashes match the normal producer in order.
Phone served **1,171,486 → 2,175,528 B**; approved ceiling
**1,171,496 → 2,175,538 B** adds only **1,004,042 B** audio and preserves
the old **10 B** margin. The normal producer first refused the old cap;
no admission bypass. Raw records: `tmp/wave-a-audio/saltwind-readings/`.
X1/X8 final readings remain open on the ensuing immutable audio source;
this is no official timing/memory or row-close claim.

Sky Harbor audio publication is `38e01a3407`; source roster `5307fd5d8f`
keeps five qualified spots and the named **no airship hum, rigging or
tower flag** gap. A measures 27.06 s, zero separated vocal energy and
0.00465% clipped samples, passing the existing checks. B measures 20.77 s
and 0.01987% clipped samples, so it remains comparison-only. Both MiniMax
takes stay on the listening page. There is no ear-reviewed taste claim.

Three paired bed and airship attempts remain in the catalogue with all
12 raw-wave and metadata hashes. The five shipping winners rank
3 / 3 / 1 / 1 / 1 against the pinned 94-description comparison roster
(`d6092e34c4`): basin water and dock crane use Stable Audio, wharf gulls
and cottage chimes use MOSS, and road entry uses Stable Audio. All meet
the unchanged top-five bar. No failed cue or rank allowance ships.

G872 accepts Coral's canonical `ambience-6243d1442260.m4a`, 231,398 B,
through the native shared reference, with **no copied bed file**. O2's
fit is measured/descriptive: 28 s, -24.9 LUFS integrated, LRA 4.9 LU,
peak -6.7 dBFS; 59% energy at 500 Hz–2 kHz, 21% at 2–6 kHz, less than
1% below 150 Hz, spectral flatness 0.21 without tonal peaks, envelope
CV 0.66. Soft irregular water and breeze match Sky's open harbour basins;
local spots supply harbour clutter. This is not an agent ear check.
The exact canonical hash, original paired provenance, licence, measured
fit and missing airship layers are in the reuse credit bundle. The
listening page now exposes the actual bed and source credits as well as
both scores, so Jake can judge it by ear.

The package is **800,979 B including the shared bed**, with only
**569,581 B newly published**. Each file stays below 1 MB and the package
below 3 MB. Seven active AAC bodies total 629,636 B; native packet
admission and decoded loop bounds pass. Full native bar 10 passes in
15 s before landing on ordinary working candidate
`3dbfcb0fc1-mw16svtm`: own recorded A, six decoded cue loops, sustained
score and bed, native pause/resume, five positional gains
0.392995–0.397831 and heading pans -0.698945–+0.696033; no page errors.
The muted phone profile is 402 × 874 at 2× render scale. Browser closed.

Immutable BEFORE `300a65548b` and the actual candidate reconstruct all
**158 prior file bodies, 8,822,239 B, exactly**, with no removals;
**32/34 old sections** are exact. Only audio/audio and the defining-source
tilesHash stamp change; the map image stays exact. Seven audio files and
the exact 242 B native audio-only client plan join. All served candidate
index, body and pack bytes match the normal producer. Phone wire moves
**3,768,825 → 4,384,382 B**, exactly **+615,557 B** audio; G872 approves
that exact ceiling while preserving the prior **0 B margin**. The old-cap
refusal is retained; no verification or admission is skipped.

Raw bridge and native records: `tmp/sp-x2-ob7/`. X1/X8's final matched
Chromium/control, maintained walk, golden bridge, separate memory and
official Simulator remain open on the ensuing immutable audio source.
This audio landing makes no performance, memory or full OP11 close claim.

Starfall Observatory publication `aa4523e79a` selects **B, seed 702**:
68.16 s, 0.22% separated vocal energy, no clipping or internal silence.
A is 56.54 s but measures 39.89% vocal energy, above the unchanged 10%
limit, and stays comparison-only. Both candidates and the canonical
bed can be auditioned on the listening page; no agent ear verdict is
claimed. Six local spots pass the pinned 94-description comparison bar
at ranks **4 / 1 / 3 / 1 / 1 / 2**. Both engines and all four failed
own-bed takes retain their exact wave and metadata hashes.

G872 and O3 accept the measured/described fit of Lantern Bayou's
canonical frogs, crickets and lapping water for the night canal ring
and garden ponds. That exact **224,980 B** recording is referenced
without copying. Its original loop remains 8.25–26.25 s with catalogue
duration 27.25 s; ffmpeg reads 27.30 s, **-24.22 LUFS**, LRA **1.70 LU**,
peak **-7.04 dBFS**. Original paired comparisons both rank first. Keep
the named **no continuous fountain or chimes in the bed** gap; the canal,
pavilion chimes and four other local spots remain. The normal -24 LUFS
bed target, native 0.45 bed mix and -20 LUFS score target are retained.
Source licence, exact hashes, measured fit and the gap are recorded in
the reuse credit bundle. This is a descriptive fit, not an ear check.

Package **1,425,196 B**, including the shared bed; **1,200,216 B** newly
published, each file below 1 MB. Eight active AAC bodies total
**1,058,353 B**. Native packet admission and decoded loop bounds pass.
Full source-bound native bar 10 passes in **17 s** before landing on
ordinary candidate `060198eb6c-mw17gbp0`: own B recording, seven decoded
cue loops, sustained score/bed, native pause/resume, six positional gains
0.392454–0.398463 and heading pans -0.698204–+0.696526, no page errors.
Muted iPhone 16 Pro, 402 × 874, phone tier and 2× render scale; browser
closed. An earlier receipt with an incorrect full pin was discarded;
only the fresh check bound to verified commit
`060198eb6cee7d32cb7a1938ecd80497a1322ee6` qualifies.

Against immutable BEFORE `300a65548b`, all **158 prior file bodies,
9,173,791 B**, and **32/34 old sections** stay exact, with no removals.
Only audio/audio and the defining-source map tilesHash stamp differ;
the map image stays exact. Eight audio bodies and the exact native
242 B audio-only client plan join. Complete candidate index, bodies
and packs match the ordinary producer. Phone wire is
**4,873,412 → 5,911,520 B**: G872 approves the exact **+1,038,108 B**
audio ceiling change, preserving the old **0 B margin**. The original
old-ceiling refusal remains; no admission or verification is skipped.

Raw records: `tmp/sp-x2-ob7/starfall-*`. X1/X8's final matched/control,
walk, golden bridge, separate memory and official Simulator remain
open on the ensuing immutable audio source. No final performance,
memory or full OP15 close is claimed by this audio landing.

## Fossil Badlands — offline publication

The package is **1,226,129 B**, including the **220,893 B** canonical
Night Market bed; **1,005,236 B** is newly published. All individual files
stay below 1 MB. Eight active AAC bodies total **931,231 B**. Full native
bar 10 passes in **17 s** before the local activation; final immutable
readings remain open. This is no performance or memory clearance.

Both MiniMax Music 3 candidates pass the original score checks. The
measured recommendation is **A / seed 701**, 51.62 s and 6.09% separated
vocal energy, below the unchanged 10% limit. B is 75.08 s with zero
measured vocal energy and remains available for comparison. These are
objective checks, not an agent ear verdict.

Six local spots qualify against the unchanged **122 descriptions plus
three foils**: rib-wind, sump drips, tent canvas, mesa wind, brushing and
cart rails rank **1 / 1 / 2 / 4 / 1 / 1**. Every pair and retake retains
its original wave and metadata hashes. All **28 comparisons** are kept.
The six failed bed takes and six failed crane takes remain in the credit
bundle. After the final authorized pair, generation stops. **Timber crane
and rope pulley audio is a named gap**, with no rank waiver.

Sp-o2 agrees to the measured/descriptive fit of Night Market's canonical
cricket chorus at the dusk dig camp. The original recording, hash, credits,
licence and 9.5–25.5 s loop are referenced directly; no bed copy is made.
It measures 26.5 s, -23.8 LUFS, LRA 1.5 LU and peak -11.4 dBFS. Keep
the explicit **no dry wind layer** gap. The rejected Frostline fallback
is a near-tonal motor drone; it is not used. Source and comparison context
are retained under `tmp/wave-a-audio/fossil-readings/`.

Native candidate **7c9f46e0c2fae7fb697fe6a07704dc6ebbbae448** /
`7c9f46e0c2-mw1brs9p` passes as muted iPhone 16 Pro, phone tier, 402×874
and 2× render scale: own recorded A, seven decoded cue loops, sustained
score and shared bed, native pause/resume, all six positive positional
gains and heading pan flips, errors empty. The browser is closed.

All **158 prior file bodies** and **32/34 old sections** stay exact.
Only audio/audio and the 164 B look/map stamp differ; eight AAC bodies and
the 242 B audio client plan join. All **201 served bodies** match the
normal producer. Four packs, 200 entries and 7,615,459 B are fully checked,
including retained entry order. The map image is the same **20,598 B**
body, hash `6a9fd00954c686159ba3f9d42d905e947bd237407579a298d81461039f1347d8`.
The baseline has exactly one image; its original strict MapSchema and
product admission prove image identity. The old 164 B map body was not
retained after preview release, so no literal old-map-byte claim is made.
Only the other native map field, tilesHash, differs semantically (G872).

The ordinary producer first refuses the old ceiling. Phone wire measures
**2,927,540 → 3,838,831 B**; the coordinator approves only the exact
**+911,291 B** audio change, retaining the **0 B** margin. The candidate
then builds normally in 39 s, with no bypass. Activation remains local
under the release push hold.

The final immutable source is **0e0f1ba1c35e2ff4ea16ac25260a29cf5f0a6e47**,
build `0e0f1ba-mw1c0i2g`. Its ordinary all-product build takes **74 s**;
full native bar 10 passes again on that committed runtime in **18 s**,
with the same seven decoded loops and all six positional controls. All
**200/201** candidate bodies are exact; only the native map source stamp
moves, with its image unchanged. Four final packs reconstruct all 200
entries and 7,615,459 B; phone wire remains exactly 3,838,831 B.
`tmp/wave-a-audio/fossil-readings/final-bridge.json` binds the raw index,
canonical parsed index, bodies, packs and playback result. X1 has this
source for matched Chromium/control, walk and eight goldens; X8 has it
for separate memory and the official Simulator. Those final scopes
remain open, and no performance or memory clearance is implied.

Thin Ice publication `68e91f6a7f` keeps both qualified MiniMax scores.
**A, seed 701** ships: 47.21 s, zero measured vocal energy, clipping
and internal silence. B is 35.43 s and also passes those checks. Six
local spots qualify at ranks **1 / 3 / 5 / 1 / 1 / 5** against the
unchanged 122 descriptions plus three foils. The paired open-ice 702
retake supplies its rank-three winner; every source take is retained.
All four own-bed takes fail (41 / 41 / 28 / 42), without a rank waiver.

O2 and G872 accept canonical **Mosslight** wind, leafy rustle and distant
small birds as a measured/described fit: **-25.5 LUFS, LRA 4.9 LU,
flatness 0.30**, irregular broadband 20 Hz–11 kHz. The exact original
**193,966 B** body and its 3.5–22.5 s loop are referenced without copying;
catalogue duration 23.5 s, original paired ranks four and one. Named
mismatch and gap: **leaf rustle in an icy plot; no ice creaks or pings
in the bed**. The six local spots carry the ice details. No ear claim;
Jake judges the actual recording on the listening page.

The initially proposed Frostline bed was refused by O2, not shipped:
75% of its energy lies below 150 Hz, 21% at 150–500 Hz, under 2% above
500 Hz; flatness 0.001, -24.1 LUFS, LRA 0.5 LU and peak -9.1 dBFS.
That steady near-tonal machinery drone mismatches a plot with no
chairlift. This refusal and the accepted Mosslight measurements/gaps
are retained in the published reuse credit bundle.

Package **1,112,919 B** including the canonical bed; newly published
**918,953 B**, each file under 1 MB. All source hashes, AAC packet
admission and decoded loop bounds pass. Full native bar 10 passes in
**17 s** before landing on `b218735623-mw1bc2bp`, bound to full pin
`b21873562365ce9cfc361e7086a6454ad0377927`: own A recording, seven
decoded cue loops, native pause/resume, sustained score and bed,
six positional gains **0.358182–0.398463** and heading pans
**-0.699414–+0.696525**, no page errors; browser closed. Muted iPhone
16 Pro, 402 × 874, actual phone tier and 2× render scale.

Against immutable BEFORE `300a65548b`, all **158 prior file bodies,
4,349,661 B**, and **32/34 old sections** stay exact, with no removals.
Only audio/audio and the defining-source map tilesHash stamp differ;
the map image remains exact. Eight active AAC bodies total **926,035 B**
and the exact 242 B audio-only native client plan joins. Complete
candidate bodies, index hashes and ordered pack entries verify.
Phone wire **2,053,521 → 2,961,101 B**: G872 approves the exact
**+907,580 B** audio delta, retaining the original **0 B margin**.
The original old-ceiling refusal is retained. O2's duplicate stand-in
metadata cleanup `b218735623` is a separate source change.

Raw records: `tmp/sp-x2-ob7/thin-*`. X1/X8's matched/control, maintained
walk, golden bridge, memory and official Simulator stay open on the
ensuing immutable audio source. This native playback proof makes no
performance, memory or complete OP18 claim. Committed locally while
Jake's audio/plots/docs push hold remains in effect.

Pastel Alien Plain publication `54573d2778` keeps both qualified MiniMax
scores. **A, seed 701** ships: 75.08 s, **2.23%** measured vocal energy;
B is 62.28 s and **0.50%**. Both meet the unchanged 10% voice, duration,
clipping, silence and loop checks. Six local spots pass at ranks
**2 / 2 / 1 / 2 / 1 / 1** against 122 unchanged descriptions plus
three foils. All original and paired retake sources remain retained;
four own-bed takes fail **21 / 20 / 13 / 26**, without a rank waiver.

O3 and G872 accept canonical **Frostline** as a measured/described
Alien fit: the near-tonal steady low sub-hum is the defining layer of
the brief. **-24.1 LUFS, LRA 0.5 LU, peak -9.1 dBFS, flatness 0.001**;
75% of energy below 150 Hz, 21% at 150–500 Hz, under 2% above 500 Hz.
Its exact **152,848 B** body is referenced without copying: original
2.5–17.5 s loop, catalogue duration 18.5 s and paired ranks one/one.
The original source prompt names an alpine chairlift; no actual
chairlift in the Alien plot is claimed. Named gaps: **no continuous
glassy insect chirps and no breeze in the bed**; six local spots carry
detail. Credits retain all measurements, provenance and gaps. No ear
claim; Jake judges the original recording on the listening page.

Package **1,542,658 B** including the canonical bed; newly published
**1,389,810 B**, each file under 1 MB. All source hashes, native AAC
packet admission and decoded loop bounds pass. Full native bar 10
passes in **18 s** before landing on `0a547b2ee0-mw1c29d9`,
bound to verified full source `0a547b2ee01fc63e74d0e147cd59ee5ab815bbf2`: own A recording,
seven decoded cue loops, native pause/resume, sustained score and bed,
six positional gains **0.356883–0.399081** and heading
pans **-0.698203–0.696526**, no page errors; browser closed.
Muted iPhone 16 Pro, 402 × 874, actual phone tier, 2× render scale.

Against immutable BEFORE `300a65548b`, all **158 prior file bodies,
6,131,379 B**, and **32/34 old sections** remain exact, no removals.
Only audio/audio and the defining-source map tilesHash stamp differ;
the map image stays exact. Eight active AAC bodies total **1,079,779 B**
and the exact 242 B audio-only native client plan joins. Full candidate
listed bodies and ordered pack entries verify. Phone wire
**3,029,418 → 4,088,773 B**: G872 approves exact **+1,059,355 B**,
retaining the original **0 B margin**; the old-ceiling refusal remains.

Raw records: `tmp/sp-x2-ob7/pastel-*`. Final matched/control, maintained
walk, golden bridge, memory and official Simulator remain open with
X1/X8 on the ensuing immutable source. No performance, memory or full
OP20 close is claimed. This source is committed locally under Jake’s
audio/plots/docs push hold, without a push request.

The ensuing immutable carriers also pass full native bar 10: Thin Ice
**`6ce898ee5fd69dc3a9a7ac3820a6ad562473bb26` /
`6ce898e-mw1buojk`**, 18 s, and Pastel Alien Plain
**`5fcb0ac75ac4d47e695dfec2953b280e80445cbc` /
`5fcb0ac-mw1c7hz2`**, 17 s. Both retain phone 2×, own recorded score,
seven decoded loops, active bed, six positional gain/pan checks,
native pause/resume and zero page errors; browsers closed. Each final
product has all **166 file bodies and 34/35 sections** exact to its
native-checked candidate, with only the defining-source map stamp
changing. Full final listed-body/hash/ordered-pack audits pass.
Receipts are `tmp/sp-x2-ob7/{thin,pastel}-final-native.json` and the
corresponding `final-audit` / `final-native-bridge` JSONs.

X1 and X8 have literal final source, build, body/pack/wire bridges and
Opus camera pins for their existing reading split. Those final cohorts
remain queued behind required CI work; this playback qualification
claims no frame-floor, memory or physical-phone result. The shared
listening page has all fourteen currently published sets and forty-two
score/bed players, including both Fossil candidates and its canonical
Night Market bed. No agent listening verdict is claimed. All local
model work for these four plots has exited; completed candidate and
baseline preview uses are released through the ordinary owner path.
No audio/plots/docs push request was made under Jake's hold. Local Git
ancestry now confirms the Pastel activation is already contained in
`origin/main` through the coordinated carrier; no CI-green or live
claim follows from that publication alone.

## Clockwork Canyon — preparation and guard refusal

Two MiniMax Music 3 takes finish in **392 s**. A / seed 701 decodes to
**39.08 s**, B / seed 702 to **75.08 s**. Both pass the unchanged
25 s minimum, clipping and internal-silence checks; their measured
loop scores are **0.381 / 0.315**. Vocal-energy qualification and CLAP
theme comparison remain pending. Neither take is activated or claimed
fully qualified, and no listening verdict is inferred.

The first MOSS batch exits in **15 s**, before generating any take.
The existing per-take `mem-ok2.sh` guard reports pressure 1 (normal),
80% free and 3,068.69 MB swap, but another process, Codex PID 9728,
reports **16 GB**, above its unchanged **15 GB** process bound. The
model's own process is correctly excluded. The outer shared admission
had passed at 40.6 GiB anonymous memory; the stricter inner refusal is
retained, not relabelled as general memory pressure. The owned model
process exits and releases its lock. No failed audio take exists.

The coordinator accepts the refusal: this is a seven-day peer session,
about 12 GB resident, which nobody kills or evicts. **MOSS stays parked
until that session ends or shrinks.** No guard edit, unchanged retry,
new seed or substitute route around the refusal is authorized. The six
spot families and bed keep their original ranking descriptions.

Model-free preparation binds both raw score/metadata hashes, measured
loops, required MiniMax and Stability credits, and the existing native
source identity `clockwork-canyon`. The six real anchors and seven cue
IDs match the maintained full bar-10 checker: own stems score, sustained
bed, six positive positional gains and heading pan flips, pause/resume,
iPhone 16 Pro phone tier at 2x, and no errors. This is a wiring audit,
**not a native playback pass**. The working preparation manifest stays
in `tmp/wave-a-audio/clockwork-canyon-readings/publication-prep.json`;
no partial catalogue or active binding is published. Both-engine SFX,
full score qualification, bounded AAC/credits publication, body/wire
proof and full native playback remain open.


### Four-set handover and Clockwork Medium progress

The coordinator transferred Clockwork, Desert, Floating Island Race and
Showcase audio to sp-x1 while sp-x6 measures DL9. The four prepared job
sets (`06dffdf848`) each retain two MiniMax score takes, one bed and six
anchored spot families, with both MOSS v2 and Stable Audio 3 Medium
required for every SFX. No fallback or omission is approved for these sets.
The four final-audio C/control reports remain open.

The one authorized Clockwork resume check runs the original
`~/ml/music/mem-ok2.sh` unchanged at **19:48:39** and returns **1**:
pressure 1, 86% free, swap 3,068.69 MB, peer Codex PID 9728 reported
**18G** in the guard's own `top` MEM column, above its unchanged 15 GB
bound. The earlier approximately 14.5 GB RSS observation is a different
field and does not override this refusal. No model is loaded by this
check; no peer is excluded, no guard or bound changes, and no unchanged
MOSS retry follows. Raw output is
`tmp/sp-x1-audio/clockwork-resume-guard.log`. MOSS remains parked until
the original condition changes and its guard admits.

At sp-x6's literal model-free gap, the original maintained
`ob7_run.sh medium clockwork-canyon` completes in **22.358 s**, exit 0,
under the normal shared model lock, outer memory admission and 30-minute
cap. All seven original seed-701 takes exist: a 30 s bed and six 12 s
spots, stereo 44,100 Hz PCM. Each sidecar's family, prompt, ranking
description and seed matches the prepared job; wave/metadata SHA-256
and positive frame counts are independently checked in
`tmp/sp-x1-audio/clockwork-medium-inventory.json`. The maintained raw log
is `tmp/ob7-audio/clockwork-canyon-medium.log`. The process exits, owned
cleanup finishes and the shared lock is released before sp-x6 resumes
its corrected DL9 cohort.

These are raw integrity checks, **not measured fit or publication**.
Clockwork vocal/theme qualification, the MOSS pair, CLAP ranking, bounded
AAC/credits publication, body/wire proof, complete native bar 10 and final
C/control remain open. No by-ear verdict, activation, new fallback or
audio/documentation push is claimed.


### Clockwork vocal check and Desert raw pair

Clockwork's original locked vocal-analysis batch completes in **24.315 s**,
exit 0. Both MiniMax takes report vocal-energy share **0.0000** under the
maintained source-separation measurement, below the unchanged 0.10 limit.
This is a measured check, without an agent listening verdict; CLAP theme
and paired SFX qualification remain open.

Desert's two original MiniMax Music 3 takes (seeds 701/702) complete in
**452.800 s** under the normal shared lock, outer memory admission and
30-minute cap. Independent headers and SHA-256 checks bind stereo
44,100 Hz PCM of **75.082 / 40.403 s** to their exact raw wave/metadata
files. The maintained model-free analyzer reports loop scores
**0.391 / 0.423**, clipping fractions **0.0000114765 / 0**, and zero
internal silence gaps. These pass the existing duration, clipping and
internal-gap checks. Its separate locked vocal-analysis batch completes
in **22.480 s**, exit 0: vocal-energy shares **0.0046 / 0.0067**, both
below 0.10. Theme comparison and AAC/decoded-loop qualification remain
open; no score has been selected or activated.

Desert's original Stable Audio 3 Medium batch then completes in
**22.900 s**, exit 0, under its normal lock/guards. All seven original
seed-701 wave/sidecar pairs match their prepared family, prompt and
ranking description, with positive PCM frames and independent source
hashes. These remain raw takes, pending the MOSS pair and CLAP ranking.
The short batches finish and release their owned processes/model locks
before the next separately admitted model turn.

The model-free `top` snapshot at **20:50:44** still reports peer PID 9728
at **19G** in the original guard's MEM field. The MOSS resume condition
is not met; no repeated guard/model attempt, exclusion or bound change
follows. Race and Showcase still require their complete audio sets; all
four final-audio C reports remain open.

Raw evidence: `tmp/ob7-audio/{clockwork-canyon-vocals,desert-ruin-score,
desert-ruin-vocals,desert-ruin-medium}.log`, their original raw sidecars
and metrics, plus `tmp/sp-x1-audio/{desert-score-inventory,
desert-medium-inventory}.json`. No partial publication or push.


### Clockwork MOSS resumes under the original guard

After the confirmed-live release and the coordinator's fresh CI-lane
session, the normal resume condition changes. At the assigned CPU turn
after sp-o2's literal cohort END, the original `mem-ok2.sh` runs unchanged
at **23:20:41** and passes: pressure 1, 89% free, swap 2,780.62 MB and
`big=[]`. Earlier refusals and the 19G observation remain retained.
No bound, guard, peer exclusion or source policy changes.

The original `ob7_run.sh moss clockwork-canyon` then completes in
**358.282 s**, exit 0, under the normal shared lock, outer admission and
per-take checks. All seven seed-701 takes are source-verified mono
48,000 Hz PCM: a 30 s bed and six 12 s spots. Every family, prompt,
ranking description, wave and sidecar matches its prepared source and
independent hashes. The model's existing self-only exclusion remains
unchanged; every per-take guard admits. The owned process exits and
releases the model lock before sp-x8's six-command DL17 baseline turn.

Clockwork now has both original SFX engine sets plus its two score takes
and passing vocal checks. **Paired CLAP/theme qualification, AAC publication,
full native playback and its final C report remain open.** No recording
is selected, published or activated by this raw-take completion. Evidence:
`tmp/sp-x1-audio/clockwork-resume-guard-after-release.log`,
`tmp/ob7-audio/clockwork-canyon-moss.log`, and
`tmp/sp-x1-audio/clockwork-moss-inventory.json`.

Race's two MiniMax takes separately finish in **358.059 s**, exit 0:
**52.698 / 38.603 s**, stereo 44,100 Hz, exact prepared prompts and
independent source hashes. The maintained model-free analysis gives loop
scores **0.662 / 0.502**, clipping fractions **0 / 0.000000293703**, and
zero internal gaps. Duration, clipping and gap checks pass; vocal and
theme checks remain open. Evidence: `tmp/ob7-audio/sky-race-score.log`,
the original raw sidecars/metrics and
`tmp/sp-x1-audio/race-score-inventory.json`. No by-ear or final-fit claim.


### Four MOSS sets complete; publication preparation

The remaining original MOSS batches finish under the unchanged shared
lock and memory guards: Desert **331.562 s**, Race **329.786 s**, Showcase
**336.083 s**, all exit 0. Together with Clockwork's preceding batch,
**28/28 MOSS takes** now have independent source-sidecar, PCM-header and
SHA-256 checks. Every plot keeps its original 30 s bed, six 12 s spots,
seed 701 and ranking descriptions. Earlier guard refusals remain retained.
No SFX winner, public asset or activation follows from raw completion.

Clockwork and Desert's model-free preparation measures **28 SFX takes
across 14 complete two-engine pairs**. Raw integrated loudness spans
**-45.2 to -20.7 LUFS** for Clockwork and **-45.4 to -17.5 LUFS** for
Desert. Descriptive diagnostics include 1,179 samples at absolute amplitude
>=0.999 in Medium's Clockwork boiler, 368 in Desert's ruins-west and 542
in Desert's entry. MOSS's Clockwork garden-birds has a 2.45 s internal
interval below -45 dBFS. These facts add no rejection rule and do not
replace CLAP fit comparison. No model loads during these serial measures.

All four existing score takes pass the unchanged duration, clipping,
internal-gap and vocal checks. Clockwork's loop scores are **0.381/0.315**
and vocal shares **0/0**; Desert's are **0.391/0.423** and **0.0046/0.0067**.
The prepared publication inputs bind every wave, sidecar and score metrics
file by SHA-256, retain six original anchors and both required credits,
and keep the existing 64 kb/s AAC, decoded-loop, 1 MB blob and 3 MB package
checks. Nothing is selected or encoded before the original CLAP ranking.

Fresh physical before-audio inventories use committed **8fff8eded7**,
build **8fff8ed-mw1owpzr**, read-only from sp-o3's normal preview. Every
loose body and dense ordered pack member verifies against its exact hash.
Files/sections/packs are Clockwork **158/34/5**, Desert **159/34/5**, Race
**158/34/4**, Showcase **158/34/5**. These are physical-byte inventories;
semantic native admission and actual phone wire remain separate proofs.

Evidence is under `tmp/sp-x1-audio/`: the three new MOSS inventories,
`prepare-pairs.py` and its log, the two
`{clockwork-canyon,desert-ruin}-publication-prep.json` inputs and
`baseline-8fff/`. CLAP is a model load and explicitly waits until the fifth
resource turn, after sp-o2's Auto/KTX2 cohort, sp-x6's isolated bisect and
sp-o1's P1 goldens. Remaining generation, measured selection, bounded AAC
publication, native bar 10 and all four final-audio C reports stay open.


### Race and Showcase model-free publication preparation

The coordinator's next model-free turn describes the remaining **14 MOSS
takes**: seven original seed-701 recordings for Race and seven for Showcase,
each set totaling 102 s (one 30 s bed and six 12 s spots). Every wave and
sidecar has independent SHA-256 checks before and after measurement;
family, prompt, ranking description, mono 48,000 Hz PCM and duration match
the prepared jobs. The seven defining job/helper/anchor source hashes also
remain unchanged across the bounded serial process. No model loads.

Race's raw integrated loudness spans **-41.6 to -7.7 LUFS**. Its circuit
and paddock takes have **163 / 14 samples at absolute amplitude >=0.999**;
pit-garages has a **2.549 s** internal interval below -45 dBFS. Showcase's
raw loudness spans **-47.3 to -27.6 LUFS**, with no samples at that amplitude
threshold; gardens and houses have **3.911 / 4.618 s** internal quiet
intervals. These descriptive diagnostics neither add shipping guards nor
select or reject a recording. No by-ear judgement is claimed.

The two publication-prep inputs retain both credits, six original anchors,
exact source and metrics hashes, the existing score recommendation formula,
paired-engine top-five CLAP rule, 64 kb/s AAC normalization targets and
decoded-loop/package/blob checks. Race's existing two raw score measures
remain included with vocal checks explicitly unmeasured. Showcase's two
score slots and both plots' seven Medium slots explicitly say **not
generated**. All SFX winners remain null; no catalogue, asset or activation
is written.

Evidence: `tmp/sp-x1-audio/prepare-moss-only.py`, its log and hashed
`raw_descriptive.py` helper, plus
`{sky-race,showcase-template}-publication-prep.json`. The source-bound
physical before-audio inventories remain `baseline-8fff/`; native semantic
and actual phone-wire proofs are still open. CLAP and all remaining model
batches wait for the coordinator's model slot, after the updated DL21,
sp-o2 DL17/goldens, sp-x6 bisect and sp-o1 P1 sequence. All four final-audio
C/control reports remain open.


### Remaining models and one bounded retake round

After the coordinated machine handoff on November 4, all remaining
initial generation and measured comparisons finish serially through the
unchanged shared lock and model guards: Race/Showcase Medium, Showcase's
two MiniMax scores, their four vocal checks, and CLAP for all four sets.
Every initial SFX pair is complete. All eight score recordings pass the
existing vocal-share check. Showcase take 702 is **23.34 s**, below the
unchanged 25 s minimum; it remains an explicitly unqualified comparison
take. Showcase 701 is **70.80 s** and passes the existing raw checks.

Initial SFX top-five counts are Clockwork **6/7**, Desert **4/7**, Race
**5/7**, Showcase **6/7**. One bounded round generates Medium seed 702
only for those seven misses, followed by MOSS seed 702 for Clockwork's
bed, Desert's bed/gateway/ruins-west and Race's bed/race-tower. The new
Showcase road-entry Medium take ranks **1st**, so no additional MOSS
take is generated for that now-qualified family. All prompts and ranking
descriptions remain exact; the original 701 sources and each comparison
snapshot are retained. This yields **69 measured SFX takes**, each bound
to its exact wave/sidecar SHA-256. No by-ear claim or new fit threshold.

Final unchanged top-five counts are Clockwork **6/7**, Desert **4/7**,
Race **7/7**, Showcase **7/7**. Clockwork's bed still misses at best rank
**6**. Desert's bed, gateway wind and ruins-west still miss at best ranks
**13 / 8 / 17**. These four families remain open; no fallback or omission
is introduced. Race's new MOSS race-tower takes rank **4**. Its unchanged
701 bed varies from rank **7** in the initial comparison to **5** in later
runs; that variation is explicitly retained, not credited to a new take.

Race and Showcase alone pass the existing bounded AAC/catalogue writer:
**1,211,749 B / 1,218,245 B**, eleven files per plot, each below the 1 MB
blob bound and each package below 3 MB. Every chosen SFX retains both
engine comparisons and source hashes; native AAC indexing and decoded
loop-bound checks pass. Both score takes and required credits remain in
each plot's own folders; take 701 is the measured recommendation for
both. Showcase 702 stays available as comparison-only with its failed
duration check. These are offline catalogue publications, **not gameplay
activation or a native-playback pass**. No binding, template, output row
or shared listening page is changed. Native bar 10, body/pack/wire proof,
activation and all four final C/control reports remain open.

Evidence: `tmp/sp-x1-audio/final-model-turn-fit.json`, each plot's initial,
post-Medium and final-turn CLAP snapshots, the two 702 raw inventories,
Race/Showcase Medium and Showcase score inventories, and the two
publication logs. Maintained model logs remain under `tmp/ob7-audio/`.
No further model retake round is queued in this machine turn.


### G872 accepts the four remaining measured fits

The coordinator rules on November 4 that these plots are grid filler
(G990/G994), with **no extra retake rounds**. Ship the best measured take
for each of the four remaining families, explicitly labelled
**best measured, below top-5**. This supersedes the preceding open-fit
status for these four sources only; it does not turn their ranks green.

| Family | Best measured take | Rank | Disposition |
| --- | --- | ---: | --- |
| Clockwork bed | MOSS 701 | 6 | best measured, below top-5 |
| Desert bed | Medium 701 | 13 | best measured, below top-5 |
| Desert gateway wind | Medium 702 | 8 | best measured, below top-5 |
| Desert ruins-west | MOSS 701 | 17 | best measured, below top-5 |

The reviewed source decisions bind exact family, engine, seed, rank,
probability and wave/sidecar SHA-256. A different source or measurement
still refuses. The original top-five rule remains for every unapproved
family. Focused controls retain unknown-family/engine and changed
rank/probability/seed/hash refusal, alongside the existing source and
canonical shared-bed checks. No measured rank, original prompt, scoring
description or comparison file is edited; no fallback or omission.

Clockwork and Desert pass the bounded AAC publisher at **1,575,060 B**
and **1,430,622 B**, eleven files each, with both score comparisons,
native AAC indexing, decoded-loop bounds and required credits retained.
The four chosen SFX provenance rows carry the decision and the label
above. Gameplay binding, native bar 10 and final C/control qualification
follow separately; this publication alone claims none of them.


### Four final gameplay activations and C reports — November 4

Clockwork, Desert, Floating Island Race and Showcase are activated by
`b00b361bd5`, with the four source-bound G872 fit decisions retained in
`73f65674ef` and labelled **best measured, below top-5** above. The final
admitted source is **b752d49037c8ed98611376418069becb7c2599c0**, normal
immutable all-product build **b752d49-mw26ziu7**. Both score comparisons,
loop checks and all required model credits remain in each plot's own
folders. The shared listening page now includes all four sets. No ear
judgement or further retake round is claimed.

Wildshard-new explicitly approves these exact G990 audio content ceilings
under G872, with no margin; `b752d49037` records the approval trailers.

| Plot | Before content B | Before ceiling B | Final content and ceiling B |
|---|---:|---:|---:|
| Clockwork | 5,277,693 | 5,503,249 | 6,516,702 |
| Desert | 5,525,056 | 5,525,056 | 6,654,231 |
| Floating Island Race | 3,767,340 | 3,767,340 | 4,660,075 |
| Showcase | 6,646,908 | 6,646,908 | 7,679,142 |

The original candidate correctly refuses before this approved policy change;
its raw refusal is retained. The successful final build admits all products.
Before source `d6ec6b963f` and final inventories validate literal file/section
hashes, complete pack hashes, dense member offsets, member bytes and lengths.
All **633 original files / 44,500,053 B** and **128 unchanged sections** are
exact. Per plot, only old `audio/audio` and `look/map` sections change, and
`client/plan` is added. Every map image string stays literal-exact; only its
`tilesHash` source stamp changes. Retained pack-member order remains exact.
No visual or collider source changes; no physics walk is warranted.

All four maintained native bar-10 runs **PASS** on the final immutable pin:
own score/stems slot, bank of one bed plus six spots, sustained score/bed
gains, six spatial anchors with opposite-heading pan, and pause/resume.
Each reports iPhone 16 Pro, 2× render, muted browser and errors empty; all
browsers close normally. This proves live playback after the maintained
admission boundary, not complete-at-control download readiness.

The four C/control commands each complete six 120-frame windows, **2,880
paired frames in total**, on the same final pin and matched Night Market.
Cadence is 30.03 fps / p95 33.4 ms, with no skipped samples, page errors,
context losses or standing builds. All draw windows fit 150; the original
30 µs/draw CPU target misses on every plot and control window, and strict
33.3 ms flags remain false. Detailed pose numbers are in
[final readings](open-plots-final-readings.md). This earns no official
Simulator or physical-device timing credit. Walks, golden bridges and four
new memory/official windows remain open; full cohorts stay 3/10.

Evidence: `tmp/sp-x1-audio/audio4-{body-proof,native-bar10,C-summary}.json`,
`audio4-before-wire.json`, `audio4-after-wire.json`, original refused build
log and four retained native/C logs. Focused audio/catalogue suites pass
13 cases in three files; four provenance tests pass, including changed
approved-source refusal. No gate, comparator or measured rank is weakened.
