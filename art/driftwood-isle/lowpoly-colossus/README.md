# Tide-Root Colossus: low-poly reconstruction

Current status: source study, not accepted and not wired into runtime.
The owner approved the revised image target on 18 October 2026 at 15:30 UTC;
that approval is not model acceptance. Existing rejected assets are preserved.

Target: `../concepts/lowpoly-revision-2026-10-18/tide-root-colossus-lowpoly.webp`.
Style anchors: original ring shrine, boulders and Driftwood world references.

## Build

From the repository root, using Blender 4.3.2:

```sh
blender -b -t 2 --python-exit-code 1 \
  -P art/driftwood-isle/lowpoly-colossus/build_colossus.py \
  -- --out tmp/lowpoly-colossus --render
```

Omit `--render` for geometry export only. The default render is one three-quarter
view; add `--views front,three-quarter,back` for a later turn-around review. Generated GLB, actual renders
and metrics stay in the ignored output directory. The GLB excludes review
floor, lights and cameras. OpenImageDenoise is explicitly disabled.

The palette is defined as sRGB hex colors, converted to scene-linear material
values with the exact sRGB transfer function. Materials are matte with low
heart/eye emission and no bloom. Every leaf has physical thickness. Chest
frame, fingers and crown have actual negative spaces. There are no textures,
fine bark grooves, scatter systems or view-facing body cards.

## Review requirements

Compare the actual front, three-quarter and back render with the approved
target before any runtime changes. Check crown height, wedge face/eyes, open
chest frame, heart dominance, shoulder breadth, elongated hands and grounded
stone feet. Fix silhouette or material defects before rigging. Named separate
mesh parts support future articulation; no skeletal rig or tested animation
exists yet. First-person arena, combat, performance and fun remain untested.

## Validation to date

- Python source compiles.
- Blender export and one three-quarter actual render completed, exit 0.
- 2,138 triangles; 114 named mesh parts; GLB 302,772 bytes.
- Actual render comparison: recognizable crown, open heart frame and hands,
  but too symmetric/block-jointed with overly pale wood, repetitive leaf
  clusters, simplified boulder feet and insufficient heart facets.
- Source/export/evidence frozen as first-pass WIP; refinement required.
- No quality score assigned; construction count is not acceptance.
