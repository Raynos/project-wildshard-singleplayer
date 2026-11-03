# Open plots: morning listening batch

**Status:** `unread` 2026-11-03 — Bayou passes native playback; Frostline recordings are ready for activation. Three plots follow.
**Link:** https://wildshard-singleplayer.vercel.app/assets/music/ob7-listening.html (ships with the automatic deployment)
**Plan:** OPEN-PLOTS, [build-out OB7](../plans/open-plots/build-out-mini-plan.md)
**Made by:** E521, sp-x2 / Codex

One listening list holds both MiniMax Music 3 takes for each completed plot.
The measured recommendation ships; the other take stays available for comparison.

| Plot | Recommended score | Package | Native bar 10 |
|---|---|---:|---|
| Lantern Bayou | A, seed 701 | 1.67 MB | pass, `d649309a52` |
| Frostline Peaks | B, seed 702 | 1.22 MB | pending playback |
| Ember Forge | pending | — | open |
| Mosslight Ruins | pending | — | open |
| Coral Drift | pending | — | open |

Bayou A passes the voice check at 0.01% separated vocal energy. B measures
28.79%, so it is labelled comparison-only and cannot become the active score.
These are measured recommendations, not ear-reviewed taste verdicts.

Bayou's ambience, boardwalk, house chimes, owl, boat bump and cypress rustle
each have MOSS-SoundEffect v2 and Stable Audio 3 Medium takes. The chosen set
uses two MOSS and four Stable Audio recordings. Five winners rank first;
cypress rustle ranks second against the sound briefs and music/speech/silence
foils. All pass the existing top-five bar. The boat needed
paired retakes to produce a clear wooden knock; the original takes remain
documented in generation provenance.

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
