# Conch Duelist: approved-target reconstruction

Status: **authored anatomy study, unaccepted**. Quality acceptance remains **0**.
This directory is editable source and compact inspection evidence only. It neither
replaces rejected V1/V2 assets nor registers anything in the live game.

## Approved reference

[Owner-approved Explorer/gameplay concept](../concepts/2026-10-18/conch-duelist-explorer-gameplay.webp), approved 2026-10-18.
It is an AI concept, not a game capture. The target is a tall predatory conch
warrior, with cream/coral shell occupying roughly the upper half of its height,
burgundy armored crustacean anatomy, stalked amber eyes, asymmetric shield claw
and rapier claw, and a wide bent-legged stance. Matching it is the gate; this
source does not claim that gate passed.

## Construction

- Custom continuous helical shell surface with four-to-five growth whorls and a
  left-leaning apex. Facets and growth ridges are geometry, not a stack of balls.
- Authored pointed aperture contour swept through thick outer lip, inner lip,
  recessed wall and narrow deep throat. The opening has actual spatial depth.
- Section-authored arrowhead face, hooked rostrum and long eye stalks with almond
  orbital rims. Amber eyes are recessed inside the rims.
- Section-authored bent legs, overlapping ventral armor, asymmetrical shield and
  thrust claw, opposing pincers and ground-contacting toe blades.
- Neutral clay mode intentionally suppresses all palette variation. Silhouette,
  proportions, aperture construction and anatomy must survive this view before
  barnacles, chipped growth rims or other tertiary detailing earns time.

## Rebuild

From the repository root, after coordinating the shared heavy lane:

```sh
blender -b -t 2 --python-exit-code 1 \
  -P art/driftwood-isle/approved-conch/build_conch.py -- \
  --out tmp/approved-conch --render --clay
```

`--view side` and `--view rear` provide alternate orthographic inspection views.
Omit `--clay` for the authored warm shell / burgundy body palette. Source needs
only Blender's bundled Python and mathutils. Outputs are an inspection `.blend`,
GLB, JSON metrics and optional PNG in the ignored output folder. Do not commit
those raw outputs. No model downloads, hidden textures or external assets are
needed to reconstruct this study.

## Rig boundary

Existing game channels are `body`, `head`, `shell`, `guard`, `thrust`, `foot` in
`driftwoodRegularBodies.ts`. The old one-foot gastropod rig cannot faithfully
articulate this approved bent-legged anatomy. Reuse semantic attack channels,
not incorrect old pivots. The study uses +Z up / +Y facing and exports glTF Y-up.
It is not yet skinned or animated. New hips/knees/ankles, eye stalk control and
separate claw articulation require a reviewed rig after anatomy passes.

## Unverified gates

- Matched-camera clay silhouette and three-quarter anatomy comparison
- Rear/side continuity, self-intersection, watertightness and collision audit
- Shell growth texture, barnacles, chipped rim and material fidelity
- Bone pivots, deformation, motion clips and engine admission
- Actual Explorer and first-person captures, arena behavior and device performance

No runtime acceptance, quality tier or hardware performance claim is made.
