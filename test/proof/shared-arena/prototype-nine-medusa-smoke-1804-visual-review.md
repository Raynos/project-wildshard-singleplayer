# Medusa corrected smoke: limited visual inspection

Reviewed 2026-10-21. This is a sampled visual smoke review, not complete
combat, animation/readability, matched-nine-view likeness, native-corpse,
or physical-phone acceptance.

## Evidence and method

Original recording SHA-256:
`0e8433bd95dc6e2afc64e86d011aff58ca314e0424a261249348275af38b5a76`.
Independent ffprobe: 402x874 pixels, 24 seconds, 600 frames, 25 fps recording
cadence. Recording cadence is not game performance.

Inspected 48 exact source frames: integer seconds 0 through 23, plus
half-second-near samples alternating .48 and .52 (0.48, 1.52, 2.48 through
23.52). Re-inspected eight at source resolution: 8, 9, 10, 10.48, 15, 16,
16.48 and 17 seconds. An additional fps-filtered contact sheet was only an
overview; the exact-frame sequence establishes the stated coverage.

## Direct image observations

The pastel turquoise/pink/gold faceted bell and hanging tentacles are
visible under the Pearlglass Medusa selector. The actor approaches during
7-10 seconds and again during 12-16 seconds. Orientation and tentacle
silhouette change. No obvious persistent exploded geometry or missing
textures appears in these samples.

Framing is imperfect: the actor partly crosses the left edge at 10.48
seconds, and the sword/lower controls overlap its tentacles around 16-17
seconds. A damage vignette and health reduction are visible. These samples
do not establish readable attack anticipation.

The recording includes loading, initial Mantis, Medusa, restart and return
or loading. It is not 24 uninterrupted seconds of Medusa combat.

## Trace evidence, distinct from visual observations

The retained trace has 97 frame records, 43 pose records, two hit records,
one trusted touch record and zero recorded errors. Position changes and
sidestep/attack states accompany health 100 to 90 to 80. The smoke report
records 5.1576 units of approach translation. Player-only diagnostic
repositioning explains the abrupt wider view around 11 seconds, so this is
not navigation-only evidence. Complete damage/death/loot/defeat cycles
remain untested in this recording.

Conclusion: the corrected actor visibly moves rather than remaining
obviously frozen. The bounded visual smoke supports neither all-nine
playable completion nor any quality score. Original recordings and raw
captures remain preserved.
