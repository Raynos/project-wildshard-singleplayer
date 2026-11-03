# G993 · Title hero with the centre 3x3 restored

[Labelled A / B board](board.jpg), iPhone portrait. G993 (Jake 08:50): G986's grid swap (5da5599c18) moved the centre
3x3, and it must not. The fix forward is 109ef326d6: the centre as before G986, with one change.

| | What | Camera |
|---|---|---|
| A | The G986 hero (64620db6c5): Night Market front centre, Pine and Nalati on the back row | eye (805, 520, 0) → Driftwood (0, 0, 0), 62° square, 43° landscape |
| B | **Re-shoot after the restore (shipped, G872)** | the same |

B's cells: Pine Hollow (0,1), Nalati (1,0), Night Market (-1,1), Driftwood, Sunscar, Far Reach, Nine (1,-1) and
_template as before G986; the Showcase Template takes Frostline's old (-1,-1). The back line (x = -2) is Frostline
(-2,1), Coral Drift (-2,0), Lantern Bayou (-2,-1); Mosslight (2,0) and Ember Forge (2,-1) are back behind the camera,
Saltwind at (0,2), Patchwork at (-2,-2).

Real canvas captures of preview `109ef32-mw0quei5`, desktop tier, muted:
`node scripts/capture-main-menu-hero.mjs --round=6 --only=SQ-NE-b,LS-NE-b --shipped-framing --url=<preview>`.
Shipped as the 1120 × 1120 square (232,342 B) and 1120 × 630 landscape (171,510 B); the native launch image is
`launch-1206x2622-6afc7dd7eee8.png` (1,644,367 B) from `scripts/generate-title-launch.mjs`.

**Ruling (G872):** B, the layout Jake gave; his pick overrides.
