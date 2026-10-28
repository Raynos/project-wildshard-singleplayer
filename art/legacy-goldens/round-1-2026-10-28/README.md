# LEGACY reference goldens — 2026-10-28

LD4b / G843: six real entered LEGACY shards, six labelled phone views each.
These are a visual reference before legacy deletion, not a release check,
SHARDFILE parity verdict, look approval or permission to delete legacy.

Captured from the existing shared preview of
`dfe35732581c605ea27dbaa03ec75f8b04fa85db` (build `dfe3573-mvsjoz8y`).
No game source, materials, models, lighting or placement were changed.

- [Driftwood Isle](driftwood-isle-sheet.jpg)
- [Pine Hollow](pine-hollow-sheet.jpg)
- [Nalati Grasslands](nalati-grasslands-sheet.jpg)
- [Sky Reach / Far Reach](far-reach-sheet.jpg)
- [Signal Dunes / Sunscar](sunscar-dunes-sheet.jpg)
- [Nine Dragon Stack](nine-dragon-stack-sheet.jpg)

The first four panels reuse the exact eye, yaw, pitch and field of view of
[CO6’s board cameras](../../legacy-vs-shardfile/round-1-2026-10-28/cameras.json).
The additional panels turn the first camera left60° and the third90° at
the same standing position. They add views without flying to invented
positions. Exact camera transforms and actual entry identities are in
[cameras.json](cameras.json).

Chromium through `scripts/browser-lane.sh`, muted iPhone16Pro portrait,
phone tier, render2×, seed357, clear midday. Entered through the actual
LEGACY button;90 drawn frames settle each player pose before the camera
is held for capture. Every panel has burned-in mode, camera and source
labels. Any needed Escape uses `scripts/parity/browser-escape.mjs` trusted
CDP down/up, never agent-browser’s native Escape mapping.

The six sheets were inspected before commit. Every JPEG is below the
500000-byte board cap. The raw36 captures and entry receipts are retained
under `tmp/sp-x9-legacy-goldens/reading/`; no raw browser profile or session
data is committed. This batch does not qualify gameplay, performance,
physical memory, or the native Sky islet coverage gap from CO6.
