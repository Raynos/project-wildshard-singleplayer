# Per-plot templates

Run the Showcase example from the repository root:

```sh
node scripts/open-plots/template.mjs scripts/open-plots/recipes/showcase-template.json
```

The recipe supplies the slug, name, admitted accent, reference board, builder
set, shared kit families and palette. Optional rows select an eight-by-eight
tile layout; optional look keys and material bindings describe that plot's
look. Tile names and canal sockets are checked before any file is written.

The command writes a layout, a candidate output/style/map descriptor, eight
camera manifests and a capture-registry row. Cameras retain the canonical
500 m geometry and explicitly say TEMPLATE; they are not an art approval.
`--check` verifies those exact generated files without writing them.

An existing plot stays unactivated by default. Its current output, grid and
map are byte-preserved. `--activate-existing` explicitly selects the generated
layout and writes its output, look and map rows. Do this only in the plot's
approved build-out: it changes geometry and requires normal product admission
and the collider walk. After editing a layout by hand, own that source directly;
the template refuses to overwrite its modified content.

A new slug needs a `cell: [x,z]` and an explicit `replaces` old plot slug when
the selected cell is unique. The command keeps its instance and all 25 origins,
checks uniqueness, adds a standalone placement and registers discovery under
`out/.app` in the complete generated-input inventory, test coverage and zero
custom-section/tile debt. It grants no guessed wire ceiling or generated-src
allowance. Existing reviewed discovery locations stay unchanged.
Run the ordinary producer and retain its actual admission, wire and physics
results before calling that plot qualified.

`layout.plot` chooses `night-market`, `lantern-bayou`, `frostline-peaks`,
`mosslight-ruins`, `ember-forge`, `coral-drift` or `scaffold`. Omission keeps the original Night Market behavior. Only a declared
`scaffold: true` output may omit its landmark or posters with explicit `null`.
Frostline lift towers accept `[x,y,z]` or `[x,y,z,sheaveHeight]`; an explicit
height must be positive. The generated Bayou and Frostline layouts are inactive
starter data for their owners to replace, not substitutes for their theme art.
