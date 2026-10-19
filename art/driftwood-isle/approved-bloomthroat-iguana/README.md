# Bloomthroat Iguana DI-N10 — first complete source milestone

Owner approved building this identity in game on 2026-10-19. This is a bounded
source candidate, **not an admitted gameplay enemy or visual acceptance**.
The approved original hero is authoritative; AI world/explorer hidden sides
are supporting approximations, not measured anatomy.

## Selected source tuple

- `build_iguana_v3.py`: editable complete Blender/native mesh producer.
- `fit_core.py v3`: deterministic post-export measurement of existing living
  core hit volumes; preserves original metadata in `rejected-core-fit.metadata.json`.
- `v3/bloomthroat-iguana-v3.glb`: 27-joint skinned editable interchange model.
- `v3/native-source.json`, `v3/metadata.json`, `v3/payload.bin`: actual
  packedCreatureBodies source and typed consumer payload, 16 parts, 4,482 triangles.
- `iguanaClips.ts`: numeric own-rig idle, gait, bloom tell, bite, recovery,
  hit and grounded death-sag candidate. No runtime callbacks or Blender-axis reuse.
- `native.test.ts`: actual packed native decoder, fresh geometry ownership,
  normalized weighted skin, actual numericCreaturePose and THREE skin deformation.
- `audit_glb.py`, `audit_surface.py`: independent oriented triangle/paint/skin
  equivalence, closed-manifold outward winding and single-sided view culling.

Coordinates are native +Y up, +Z forward. Blender uses (x,-z,y), a proper
rotation. Binds are absolute identity-oriented native pivots. Model origin is
on the ground; body bind is (0,0.78,-0.2). No arbitrary model root lift.

## What the measurements mean

Core-only living capsule/head sphere fits named body/head parts, with radius
rounded up to the next millimeter from actual maximum corner distance. It
excludes tail, legs and throat bloom. Torso radius 0.623, half-length 0.64;
head radius 0.574. Body capsule bottom is 0.157 above ground. This is an
ordinary source hit-volume tuple, not proof of runtime damage or attack reach.
`v3/core-fit.json` records measured radii and source hash.

The weighted source sweep is 24 time samples across eight states (192 frames).
All feet stay at or above Y=0, root remains exactly its bind, and all sampled
body/head corners fit their corresponding living core volumes. Final death
is time-independent. This **does not test physical corpse contact**. In
particular, the engine's default custom-rig rigid corpse is one torso box;
its fit to the curled tail, head and feet has not been admitted. No physical
corpse recipe, special-case exemptions, callback or added engine shapes exist.
Full death/impulse/settling, hit registration, reach, combat, respawn and
reload must pass in the real runtime before gameplay promotion.

## Actual review evidence

`v3/hero.webp` and nine named angle WebPs are actual Blender renders of the
same final mesh. Camera data and raw-capture SHA256 values are supplied.
`paired-hero-board.webp`, `world-paired-nine-board.webp` and
`explorer-paired-nine-board.webp` pair actual source views with the approved
originals. These are source comparisons, not world/game/Explorer screenshots.
No invented likeness or animation score is assigned.

Remaining visible differences are substantial: the neck is too blocky and
column-like, the bloom reads as an accordion rather than broad flowing petals,
the head/brow needs a stronger reptile profile, cheek plates are too regularly
stacked, and the tail lacks the hero's broad terminal leaf-like section.
Legs/claws and gold/teal silhouette establish the identity, but the model is
not close enough to claim the owner's quality target. Independent review is
still required.

## Retained history and failures

V1 is frozen with clipped/tight hero framing and detached rear dorsal scutes.
V2 attaches tail scutes and corrects hero direction/framing. V3 moves the
native head pivot onto the actual head and retains identical visible mesh.
The original undersized core metadata is preserved beside fitted metadata.
All producer revisions and complete source outputs remain available.
Raw tool logs are local evidence, not publication inputs: they contain host
paths. Initial tool failures were read-only default HOME for heavy lane,
pnpm auto-install setup refusal, and a focused Vitest invocation missing its
explicit test-file argument. The working invocation uses installed Vitest
directly, with the explicit test path. No install was performed.

## Reproduce in the cloud checkout

Use the existing shared heavy-lane build lease for Blender; the producer is
run with `--out .../v3 --render-dir tmp/bloomthroat-iguana-v3-renders`.
Then run fit_core.py, both independent audits and make_review.py v3.
Focused tests use installed `node_modules/vitest/vitest.mjs run` with this
folder's native.test.ts and vitest.config.ts. No app/product build was run.

All runtime/shared paths are owned by the coordinator and untouched here.
No Git/GitHub publication, Mac access or production asset changes were made.

Paired boards map source left/right cameras by visible facing direction to
match the AI sheet; the original camera names describe observer azimuth.
The AI top view has a different in-plane orientation. Camera records, rather
than generated labels, establish the actual render orientation. No exact
camera calibration to the AI image is asserted.

The coordinator expanded the per-task binary budget to 5 MiB so all three
complete usable GLBs remain beside their native source outputs. Raw captures
total less than 30 MiB.
The configured linter ignores art sources even with its no-ignore switch;
therefore no lint success is claimed. The focused actual-consumer tests pass.
