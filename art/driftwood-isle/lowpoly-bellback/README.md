# Bellback low-poly source study

Target: the owner-approved 2026-10-18 15:30 low-poly image revision in
`../concepts/lowpoly-revision-2026-10-18/bellback-lowpoly.webp`.
Original crab/monkey, broad boulder facets and shrine timber/stone language were
inspected. This is an editable full-3D study, not an accepted implementation.
Previous rejected Bellback assets are untouched.

## Reproduce

From repository root, with Blender 4.3.2:

```sh
blender -b -t 2 --python-exit-code 1 -P art/driftwood-isle/lowpoly-bellback/build_bellback_v2.py -- --out tmp/lowpoly-bellback --render
python art/driftwood-isle/lowpoly-bellback/review_board.py
```

Reserve the coordinator's heavy-work lane before building/rendering. Omit
`--render` for GLB and metrics only. `--view rear`, `side`, or `low` produces
additional inspection views. Outputs go under ignored `tmp/lowpoly-bellback/`;
selected compact review artifacts may be preserved here by the coordinator.
No `.blend`, archive, third-party textures or external dependencies are needed
beyond Blender; review-board assembly uses Pillow.

## Construction

- A continuous thick, sixteen-sided bell shell has a genuinely open mouth,
  inward-facing cavity and closed crown. Separate clapper stem and weight are
  solid geometry. The bell is tilted back to expose its mouth from the front.
- Four continuous bent timber legs carry stout faceted stone feet. Broad hull,
  ship-rib uprights and rails form a recognizable structure rather than a
  scatter of decorative primitives.
- Broad pointed timber head, swept wooden cheek horns and amber eyes retain
  the aggressive target identity; ivory teeth are separate tapered volumes.
- Rope is sparse thick binding geometry, with no modeled strand grain.
- Palette literals are **sRGB**. Each channel is explicitly decoded to linear
  before assignment to Blender Principled Base Color and diffuse color.
  Materials are matte, flat shaded, with no procedural texture or random noise.

## Honest status

V1 exported and rendered successfully: 2,106 triangles, 54 mesh objects,
174,980-byte GLB. The inspected comparison rejects v1 as a final match: studio
lighting washes the intended palette, one bronze band is too wide, rectangular
frame uprights are too crude and the clapper is partly hidden.

`build_bellback_v2.py` exported and rendered successfully: 2,618 triangles,
54 mesh objects and 199,840-byte GLB. It fixes the oversized bands and washed-out
lighting, adds chamfered tapered beams and lowers the camera. V1 remains preserved.

V2 is still visibly below the target: frame uprights are too regular, the head
reads as a simple horned mask rather than layered timber anatomy, the clapper
remains dark and partly hidden, and the mouth/face needs more deliberate planes.
The intended matte palette now reads clearly. The full figure is actual 3D;
there are no billboard or texture substitutions. These findings come from the
inspected real color render, not runtime Model Explorer or arena evidence.
Both GLB headers and length fields were checked; no external images are needed. No armature, animation, runtime integration,
combat verification, mobile performance or human acceptance is claimed.
