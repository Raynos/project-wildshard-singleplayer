# G630 · Nalati terrain restored at the hero camera

[Labelled shipped/fixed board](board.jpg). The shipped title images are unchanged.

This is a streaming coordinate bug, not a new terrain look or missing tile
budget. Painted-ground tile meshes are detached and already cell-local.
`GroundMerge` previously applied the inverse regional world transform to them
again. After entry rebased Nalati and the aerial camera moved its fine ring,
a coarse-mask rebuild moved the permanent terrain outside its own cell.

Source `0ce626a8f5` treats detached inputs as parent-local, keeping their own
matrix; attached inputs retain the original world-to-parent conversion.
The regression fails before with a vertex at -811.5 instead of -249 after
562.5 m rebasing. Coarse masks, tile counts, caps and artwork are unchanged.

Exact baseline `1138f0564c` reproduces the missing ground in [before.jpg](before.jpg).
The fixed pinned preview builds exit 0 (`0ce626a-mvne9q1v`). The original
`scripts/capture-main-menu-hero.mjs` captures the same shipped camera:
eye (805,520,0), target (0,0,0), 62° at 1440×1440 and 43° at 1920×1080,
Nalati entered, desktop tier, muted. Both views now show the whole terrain
and retain 18 L0 draws / 0 pending / 0 refused / 0 ghosts. Page and console
errors are empty. See [scalar observations](summary.json), [square](square.jpg)
and [landscape](landscape.jpg). No phone frame-floor or memory gain is claimed.
The older shipped world arrangement and lighting are not repinned here.

Six focused cases cover rebase/mask rebuild, a late translated fine tile,
attached nested transforms and real-GC lifetime. Game source/test declarations,
scoped typed lint and CF1's 131 related cases / 21 suites pass.
Browsers close and both owned preview borrowers release after capture.
